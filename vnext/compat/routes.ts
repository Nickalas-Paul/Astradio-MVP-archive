/**
 * Community Compatibility V1 — API route handlers.
 * Mount under /api (e.g. app.use('/api', compatRouter) then POST /api/charts, GET /api/charts/:id, etc.)
 */

import * as storage from './storage';
import { getChartById, createChart, listChartsByOwner, selectHandleResolvedChart, getChartSnapshotCached } from './chart-store';
import { createComparison, parseExpansionTier } from './comparison-service';
import { getProfileChartExplainer } from './profile-chart';
import { buildProfileActiveStateProjection } from '../profile/profile-active-state';
import { generateExtendedCompatibility, getCompatMatches, toPublicCompatMatch } from './matches';
import { getDeployMeta } from '../deploy-meta';
import { RELATIONAL_INTENTS, type RelationalIntent, mapLegacyIntentToRelational } from '../compatibility/relational-intent';
import { isDirectoryChartId } from './directory';
import {
  RELATIONSHIP_MODES,
  coerceRelationshipModeFromStorage,
  parseRelationshipModeInput,
  type RelationshipMode,
} from './types';
import { createGroupProfile, type GroupsProfileRequest } from '../api/community-groups';
import { computeCompatibilityIntent, type CompatibilityIntentRequest } from '../api/compatibility-intent';
import { populateChartVector } from './vector-cache';
import { ensureSeedCandidateVectors } from './seed-vectors';
import {
  generateProfileIdentityAudioForChart,
  natalSnapshotFingerprintForChart,
  persistProfileIdentityAudioAfterPrimaryAttach,
} from './identity-audio';
import { seedFounderConnection } from './founder-connection';
import type { ChartBInline, Comparison } from './types';
import {
  hasProfilePersonalizationKeys,
  parseProfilePersonalizationPatch,
} from './profile-personalization';
import { computeCompatibilitySystem, computeCompatibilityFieldOnly } from '../compatibility/service';
import path from 'path';
import { formatSandboxChartSearchLabel } from './chart-search-label';
import { clientAvatarUrl } from './client-avatar-url';
import { ownPrimaryChartPayload, publicPrimaryChartPayload, chartPayloadForPublicView } from './chart-privacy';

const express = require('express') as typeof import('express');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateLimit = require('express-rate-limit') as (
  options: Parameters<typeof import('express-rate-limit').rateLimit>[0]
) => ReturnType<typeof import('express-rate-limit').rateLimit>;
const argon2 = require('argon2') as typeof import('argon2');

type AvatarStorageLib = {
  uploadAvatar: (userId: string, imageBuffer: Buffer, format?: string) => Promise<string>;
  getAvatarObject: (userId: string) => Promise<{ buffer: Buffer; contentType: string }>;
};

type AvatarUploadLib = {
  isValidImageBuffer: (buffer: Buffer) => boolean;
  moderateImageBuffer: (buffer: Buffer) => Promise<{ ok: true } | { ok: false; message: string }>;
  processAvatarImage: (buffer: Buffer) => Promise<Buffer>;
  MODERATION_REJECTION_MESSAGE: string;
};

function getAvatarDeps(): {
  storageLib: AvatarStorageLib;
  avatarUploadLib: AvatarUploadLib;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const storageLib = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'avatar-storage')) as AvatarStorageLib;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const avatarUploadLib = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'avatar-upload')) as AvatarUploadLib;
  return { storageLib, avatarUploadLib };
}

let _avatarUpload: any = null;

function getAvatarMulter() {
  if (!_avatarUpload) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const multerLib = require('multer');
    _avatarUpload = multerLib({
      storage: multerLib.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req: unknown, file: { mimetype?: string }, cb: (err: Error | null, accept?: boolean) => void) => {
        if (file.mimetype?.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      },
    });
  }
  return _avatarUpload;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const astradioPgStore = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'pg-store')) as {
  normalizeLoginEmail: (e: string) => string;
  createRegisteredUser: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getUserAuthForLogin: (
    e: string
  ) => Promise<{ id: string; displayName: string; handle?: string; passwordHash: string | null } | null>;
  createEmailVerificationToken: (userId: string) => Promise<string>;
  verifyEmailToken: (token: string) => Promise<{ valid: boolean; userId?: string; email?: string }>;
  isEmailVerified: (userId: string) => Promise<boolean>;
  getUserEmailVerificationByNormalizedEmail: (
    emailNormalized: string
  ) => Promise<{
    id: string;
    email: string;
    emailVerified: boolean;
    tokenExpiresAt: string | null;
  } | null>;
  createPasswordResetToken: (userId: string) => Promise<string>;
  resetPasswordWithToken: (
    emailNormalized: string,
    rawToken: string,
    passwordHash: string
  ) => Promise<{ ok: boolean; error?: string; userId?: string }>;
  getUserByNormalizedEmailForPasswordReset: (
    emailNormalized: string
  ) => Promise<{ id: string; email: string } | null>;
  searchChartsAccessibleToUser: (
    userId: string,
    q: string,
    limit: number
  ) => Promise<
    Array<{
      chart: import('./types').Chart;
      source: 'own' | 'connection';
      ownerUser: { id: string; displayName?: string; handle?: string } | null;
    }>
  >;
  chartAccessibleToUser: (userId: string, chartId: string) => Promise<boolean>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const emailUtil = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'email')) as {
  sendEmail: (p: { to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: string }>;
  buildVerificationEmail: (verifyUrl: string) => { subject: string; html: string };
  buildPasswordResetEmail: (resetUrl: string) => { subject: string; html: string };
};

const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const REGISTRATION_SENT_MESSAGE = 'Verification email sent';

const PROFILE_CHART_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PROFILE_CHART_TIME_RE = /^\d{2}:\d{2}$/;

function validateProfileChartDate(date: string): string | null {
  const trimmed = date.trim();
  if (!PROFILE_CHART_DATE_RE.test(trimmed)) {
    return 'chart.date must be YYYY-MM-DD format';
  }
  const parts = trimmed.split('-').map((p) => Number(p));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1900 || year > maxYear || month < 1 || month > 12) {
    return 'chart.date must be YYYY-MM-DD format';
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return 'chart.date must be YYYY-MM-DD format';
  }
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (isNaN(parsed.getTime())) {
    return 'chart.date must be YYYY-MM-DD format';
  }
  return null;
}

function validateProfileChartTime(time: string): string | null {
  const trimmed = time.trim();
  if (!PROFILE_CHART_TIME_RE.test(trimmed)) {
    return 'chart.time must be HH:MM format';
  }
  const [hours, minutes] = trimmed.split(':').map((p) => Number(p));
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return 'chart.time must be HH:MM format';
  }
  return null;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    error: 'too_many_attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function frontendBaseUrl(): string {
  const raw = process.env.FRONTEND_URL || 'https://astradio.io';
  return String(raw).trim().replace(/\/+$/, '') || 'https://astradio.io';
}

async function sendPasswordResetEmailForUser(
  userId: string,
  emailTo: string,
  emailForUrl: string
): Promise<void> {
  const rawToken = await astradioPgStore.createPasswordResetToken(userId);
  const token = String(rawToken || '').trim();
  if (!token) {
    throw new Error('password_reset_token_missing');
  }
  const emailParam = encodeURIComponent(emailForUrl);
  const tokenParam = encodeURIComponent(token);
  // Use reset_token (not token) — some mail security gateways strip ?token= from links.
  const resetUrl = `${frontendBaseUrl()}/reset-password?reset_token=${tokenParam}&email=${emailParam}`;
  const { subject, html } = emailUtil.buildPasswordResetEmail(resetUrl);
  const result = await emailUtil.sendEmail({ to: emailTo, subject, html });
  if (!result.success) {
    console.error('[compat] password reset email failed', { userId, to: emailTo, error: result.error });
  }
}

async function sendVerificationEmailForUser(userId: string, emailTo: string): Promise<void> {
  const token = await astradioPgStore.createEmailVerificationToken(userId);
  const verifyUrl = `${frontendBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const { subject, html } = emailUtil.buildVerificationEmail(verifyUrl);
  const result = await emailUtil.sendEmail({ to: emailTo, subject, html });
  if (result.success) {
    console.log('[compat] verification email sent', { userId, to: emailTo });
  } else {
    console.error('[compat] verification email failed', { userId, to: emailTo, error: result.error });
  }
}
function isChartTimezoneError(e: unknown): e is { message: string; code: string } {
  const c = (e as { code?: string })?.code;
  return c === 'INVALID_CHART_TIMEZONE' || c === 'CHART_TIMEZONE_UNRESOLVABLE';
}

type ComparisonWithRoles = Comparison & {
  seekerChartId?: string;
  targetChartId?: string;
};

function isCompatMode(s: string): s is RelationalIntent {
  return (RELATIONAL_INTENTS as readonly string[]).includes(s);
}

function isChartBInline(value: unknown): value is ChartBInline {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChartBInline>;
  return (
    typeof candidate.date === 'string' &&
    typeof candidate.time === 'string' &&
    typeof candidate.lat === 'number' &&
    typeof candidate.lon === 'number' &&
    Number.isFinite(candidate.lat) &&
    Number.isFinite(candidate.lon)
  );
}

function isFusionParams(value: unknown): value is { wA: number; wB: number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { wA?: unknown; wB?: unknown };
  return (
    typeof candidate.wA === 'number' &&
    typeof candidate.wB === 'number' &&
    Number.isFinite(candidate.wA) &&
    Number.isFinite(candidate.wB)
  );
}

/** JSON `user` object for profile routes (Phase 7A: bio, discoverableAs, lookingFor, …). */
function profileUserPayload(u: import('./types').User & { handle?: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: u.id,
    displayName: u.displayName,
    handle: u.handle,
  };
  if (u.discoverable !== undefined) payload.discoverable = u.discoverable;
  if (u.show_in_feed !== undefined) payload.show_in_feed = u.show_in_feed;
  if (u.bio !== undefined && u.bio !== '') payload.bio = u.bio;
  const avatar = clientAvatarUrl(u.id, u.avatarUrl);
  if (avatar) payload.avatarUrl = avatar;
  if (u.discoverableAs !== undefined) payload.discoverableAs = u.discoverableAs;
  if (u.lookingFor !== undefined && u.lookingFor !== '') payload.lookingFor = u.lookingFor;
  if (u.chartHighlights !== undefined && u.chartHighlights.length > 0) {
    payload.chartHighlights = u.chartHighlights;
  }
  if (u.emailVerified !== undefined) payload.emailVerified = u.emailVerified;
  return payload;
}

function parseTransitInput(value: unknown): { date: string; time: string; lat: number; lon: number; timezone?: string } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.date !== 'string' ||
    typeof candidate.time !== 'string' ||
    typeof candidate.lat !== 'number' ||
    typeof candidate.lon !== 'number'
  ) {
    return undefined;
  }
  return {
    date: candidate.date.slice(0, 10),
    time: candidate.time.slice(0, 5),
    lat: candidate.lat,
    lon: candidate.lon,
    timezone: typeof candidate.timezone === 'string' ? candidate.timezone : undefined,
  };
}

const COMPAT_RESPONSE_VERSION = 'v1';

async function linkUserPrimaryChartWithRetry(userId: string, chartId: string): Promise<void> {
  const maxAttempts = 2;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log('[compat][profile][setPrimaryChart]', { userId, chartId, attempt, success: false });
      await storage.setUserPrimaryChart(userId, chartId);
      const linkedChartId = await storage.getUserPrimaryChart(userId);
      const success = linkedChartId === chartId;
      console.log('[compat][profile][setPrimaryChart]', { userId, chartId, attempt, success, linkedChartId });
      if (success) return;
      lastError = new Error(`Primary chart linkage mismatch: expected=${chartId} actual=${linkedChartId}`);
    } catch (e: any) {
      lastError = e;
      console.error('[compat][profile][setPrimaryChart]', {
        userId,
        chartId,
        attempt,
        success: false,
        error: e?.message || String(e),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to set primary chart after retry');
}

type ProfileChartBody = {
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  tz?: string;
};

async function populateChartVectorWithRetry(chartId: string, snapshotHash?: string): Promise<void> {
  if (!process.env.POSTGRES_URL) return;
  try {
    await populateChartVector(chartId, snapshotHash);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compat] vector populate FAILED for chart:', chartId, msg);
    try {
      await populateChartVector(chartId, snapshotHash);
    } catch (retryErr: unknown) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error('[compat] vector populate RETRY FAILED for chart:', chartId, retryMsg);
    }
  }
}

/** Shared chart + primary link path for register and proxy-authenticated profile completion. */
async function attachPrimaryChartForNewUser(
  userId: string,
  chartInput: ProfileChartBody | null | undefined
): Promise<import('./types').Chart | null> {
  let primaryChart: import('./types').Chart | null = null;
  /** True when a new chart row was created (registration / first attach), not a Settings birth-field update. */
  let createdNewPrimaryChart = false;
  /** Prior natal fingerprint when updating an existing primary chart; null = new chart / no fingerprint / fallback. */
  let priorNatalFingerprintForIdentityAudio: string | null = null;
  if (chartInput != null && typeof chartInput === 'object') {
    const { label, date, time, lat, lon, timezone: tzField, tz: tzAlt } = chartInput;
    const clientTzRaw =
      typeof tzField === 'string' && tzField.trim()
        ? tzField.trim()
        : typeof tzAlt === 'string' && tzAlt.trim()
          ? tzAlt.trim()
          : undefined;
    const birthPayload = {
      label: label.trim(),
      date: String(date).slice(0, 10),
      time: String(time).slice(0, 5),
      lat: Number(lat),
      lon: Number(lon),
      ...(clientTzRaw !== undefined ? { timezone: clientTzRaw } : {}),
    };
    const existingPrimaryId =
      storage.getUserPrimaryChart != null ? await storage.getUserPrimaryChart(userId) : undefined;
    if (
      existingPrimaryId &&
      existingPrimaryId !== storage.DEFAULT_PROFILE_CHART_ID &&
      storage.updateChartBirthFields != null
    ) {
      const existingRow = await storage.getChart(existingPrimaryId);
      if (existingRow && existingRow.ownerId === userId) {
        priorNatalFingerprintForIdentityAudio = await natalSnapshotFingerprintForChart(existingRow);
        primaryChart = (await storage.updateChartBirthFields(existingPrimaryId, userId, birthPayload)) ?? null;
        if (primaryChart) {
          await linkUserPrimaryChartWithRetry(userId, primaryChart.id);
          await populateChartVectorWithRetry(primaryChart.id, primaryChart.snapshotHash);
        }
      }
    }
    if (!primaryChart) {
      priorNatalFingerprintForIdentityAudio = null;
      primaryChart = await storage.createChart({
        ownerId: userId,
        ...birthPayload,
      });
      createdNewPrimaryChart = true;
      await linkUserPrimaryChartWithRetry(userId, primaryChart.id);
      await populateChartVectorWithRetry(primaryChart.id, primaryChart.snapshotHash);
    }
  } else {
    const defaultChart = await storage.ensureDefaultProfileChart();
    primaryChart = await storage.createChart({
      ownerId: userId,
      label: defaultChart.label,
      date: defaultChart.date,
      time: defaultChart.time,
      lat: defaultChart.lat,
      lon: defaultChart.lon,
      timezone: defaultChart.timezone,
    });
    createdNewPrimaryChart = true;
    await linkUserPrimaryChartWithRetry(userId, primaryChart.id);
    await populateChartVectorWithRetry(primaryChart.id, primaryChart.snapshotHash);
  }
  if (primaryChart && createdNewPrimaryChart) {
    void persistProfileIdentityAudioAfterPrimaryAttach(primaryChart, priorNatalFingerprintForIdentityAudio).catch(
      (err: unknown) => {
        console.warn('[compat] identity audio attach hook:', err instanceof Error ? err.message : err);
      }
    );
    void seedFounderConnection(userId, primaryChart.id).catch((err: unknown) => {
      console.warn('[compat] founder connection attach hook:', err instanceof Error ? err.message : err);
    });
  }
  return primaryChart;
}

const MIN_PASSWORD_LENGTH = 8;

function resolveProxySessionUserId(req: import('express').Request): string {
  const u = req.user as { id?: string } | undefined;
  if (u && typeof u.id === 'string' && u.id.trim()) return u.id.trim();
  return (req.headers['x-proxy-session-user-id'] || '').toString().trim();
}

function chartSearchCallerUserId(req: import('express').Request): string {
  const u = req.user as { id?: string } | undefined;
  if (u && typeof u.id === 'string' && u.id.trim()) return u.id.trim();
  const fromHeader = (req.headers['x-caller-user-id'] || '').toString().trim();
  const fromQuery = req.query.userId != null ? String(req.query.userId).trim() : '';
  return fromHeader || fromQuery || '';
}

export function createCompatRouter(): import('express').Router {
  const router = express.Router({ mergeParams: true });

  const { proxySecretGate } = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'proxy-secret-gate')) as {
    proxySecretGate: import('express').RequestHandler;
  };
  router.use(proxySecretGate);

  // Seed default profile chart and match candidates once at startup (async; idempotent).
  setImmediate(() => {
    void (async () => {
      try {
        await storage.ensureDefaultProfileChart();
      } catch (e) {
        console.error('[compat] seed ensureDefaultProfileChart', e);
      }

      try {
        await storage.ensureMatchCandidateCharts();
      } catch (e) {
        console.error('[compat] seed ensureMatchCandidateCharts', e);
      }

      try {
        const results = await ensureSeedCandidateVectors();
        if (results.length > 0) {
          console.log('[compat] seed candidate vectors', {
            total: results.length,
            regenerated: results.filter((result) => result.status === 'regenerated').map((result) => result.chartId),
          });
        }
      } catch (e) {
        console.error('[compat] seed ensureSeedCandidateVectors', e);
      }
    })();
  });

  // GET /api/compat/health — report synastry/mock state for beta clarity
  router.get('/compat/health', (_req: import('express').Request, res: import('express').Response) => {
    const matchesMock = process.env.VNEXT_MATCHES_MOCK === '1';
    res.status(200).json({
      status: 'healthy',
      service: 'compatibility',
      timestamp: new Date().toISOString(),
      synastry: 'disabled',
      matchesMock,
    });
  });

  router.post('/compatibility/field', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartIds = Array.isArray(req.body?.chartIds) ? req.body.chartIds.filter((v: unknown): v is string => typeof v === 'string' && !!v.trim()) : [];
      if (chartIds.length < 2) {
        return res.status(400).json({ error: 'chartIds array with at least two chart ids required' });
      }
      const transitInput = parseTransitInput(req.body?.transit);
      const field = await computeCompatibilityFieldOnly({
        chartIds,
        relationshipBindingId: typeof req.body?.relationshipBindingId === 'string' ? req.body.relationshipBindingId : null,
        transitInput,
      });
      return res.status(200).json(field);
    } catch (e: any) {
      console.error('[compat] POST /compatibility/field', e);
      return res.status(500).json({ error: e?.message || 'Failed to build compatibility field' });
    }
  });

  router.post('/compatibility/score', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartIds = Array.isArray(req.body?.chartIds) ? req.body.chartIds.filter((v: unknown): v is string => typeof v === 'string' && !!v.trim()) : [];
      if (chartIds.length < 2) {
        return res.status(400).json({ error: 'chartIds array with at least two chart ids required' });
      }
      const transitInput = parseTransitInput(req.body?.transit);
      const result = await computeCompatibilitySystem({
        chartIds,
        relationshipBindingId: typeof req.body?.relationshipBindingId === 'string' ? req.body.relationshipBindingId : null,
        transitInput,
      });
      return res.status(200).json({
        compatibility_field_hash: result.field.object_identity_hash,
        scoring: result.scoring,
      });
    } catch (e: any) {
      console.error('[compat] POST /compatibility/score', e);
      return res.status(500).json({ error: e?.message || 'Failed to score compatibility field' });
    }
  });

  router.post('/compatibility/classify', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartIds = Array.isArray(req.body?.chartIds) ? req.body.chartIds.filter((v: unknown): v is string => typeof v === 'string' && !!v.trim()) : [];
      if (chartIds.length < 2) {
        return res.status(400).json({ error: 'chartIds array with at least two chart ids required' });
      }
      const transitInput = parseTransitInput(req.body?.transit);
      const result = await computeCompatibilitySystem({
        chartIds,
        relationshipBindingId: typeof req.body?.relationshipBindingId === 'string' ? req.body.relationshipBindingId : null,
        transitInput,
      });
      return res.status(200).json({
        compatibility_field_hash: result.field.object_identity_hash,
        scoring: result.scoring,
        classification: result.classification,
      });
    } catch (e: any) {
      console.error('[compat] POST /compatibility/classify', e);
      return res.status(500).json({ error: e?.message || 'Failed to classify compatibility field' });
    }
  });

  // GET /api/compat/matches?chartId=...&mode=friend|lover&limit=... (legacy rival/collaborator → friend)
  router.get('/compat/matches', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartId = (req.query.chartId as string) || undefined;
      if (!chartId) {
        return res.status(400).json({ error: 'chartId is required' });
      }
      const rawMode = String(req.query.mode || '').trim().toLowerCase();
      const mode: RelationalIntent = isCompatMode(rawMode)
        ? (rawMode as RelationalIntent)
        : mapLegacyIntentToRelational(rawMode) ?? 'friend';
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
      const matches = await getCompatMatches(chartId, mode, limit);
      const publicMatches = matches.map(toPublicCompatMatch);
      const generatedAt = new Date().toISOString();
      const matchesMock = process.env.VNEXT_MATCHES_MOCK === '1';
      if (process.env.MATCHES_BULLET_DEBUG === '1' && Array.isArray(matches) && matches.length > 0) {
        const ep0 = matches[0]?.explanationProfile as Record<string, unknown> | undefined;
        console.log(
          '[API_RESPONSE_DEBUG] first match explanationProfile.synastryBullets:',
          JSON.stringify(ep0?.synastryBullets ?? null, null, 2)
        );
      }
      return res.status(200).json({
        chartId,
        mode,
        limit,
        matches: publicMatches,
        generatedAt,
        version: COMPAT_RESPONSE_VERSION,
        synastryEnabled: true,
        matchesMock,
        _meta: getDeployMeta(),
      });
    } catch (e: any) {
      console.error('[compat] GET /compat/matches', e);
      return res.status(500).json({ error: e?.message || 'Failed to get compatibility matches' });
    }
  });

  // GET /api/compat/extended?seekerChartId=&targetChartId=&intent=friend|partner&count=
  router.get('/compat/extended', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const seekerChartId = String(req.query.seekerChartId || '').trim();
      const targetChartId = String(req.query.targetChartId || '').trim();
      if (!seekerChartId || !targetChartId) {
        return res.status(400).json({ error: 'seekerChartId and targetChartId are required' });
      }
      const rawIntent = String(req.query.intent || 'friend').trim().toLowerCase();
      const intent: 'friend' | 'partner' = rawIntent === 'partner' || rawIntent === 'lover' ? 'partner' : 'friend';
      const count = Math.min(15, Math.max(3, parseInt(String(req.query.count || '10'), 10) || 10));
      const bullets = await generateExtendedCompatibility(seekerChartId, targetChartId, intent, count);
      return res.status(200).json({
        seekerChartId,
        targetChartId,
        intent,
        count: bullets.length,
        bullets,
        generatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      if (e?.message?.includes('not found')) return res.status(404).json({ error: e.message });
      console.error('[compat] GET /compat/extended', e);
      return res.status(500).json({ error: e?.message || 'Failed to get extended compatibility' });
    }
  });

  // POST /api/auth/register — email + password + profile/chart (engine-only verification; no session cookie here)
  router.post('/auth/register', authLimiter, async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      const body = (req.body || {}) as {
        email?: string;
        password?: string;
        displayName?: string;
        handle?: string;
        chart?: ProfileChartBody;
      };
      const emailRaw = typeof body.email === 'string' ? body.email : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const displayName = typeof body.displayName === 'string' ? body.displayName : '';
      const emailNormalized = astradioPgStore.normalizeLoginEmail(emailRaw);
      if (!emailNormalized || !emailRaw.includes('@')) {
        return res.status(400).json({ error: 'valid email required' });
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }
      if (!displayName.trim()) {
        return res.status(400).json({ error: 'displayName required' });
      }
      const chartInput = body.chart;
      if (chartInput != null && typeof chartInput === 'object') {
        const { label, date, time, lat, lon } = chartInput;
        if (!label || typeof label !== 'string' || !label.trim()) {
          return res.status(400).json({ error: 'chart.label required when chart is provided' });
        }
        if (!date || typeof date !== 'string' || !date.trim()) {
          return res.status(400).json({ error: 'chart.date required when chart is provided' });
        }
        if (!time || typeof time !== 'string' || !time.trim()) {
          return res.status(400).json({ error: 'chart.time required when chart is provided' });
        }
        if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({ error: 'chart.lat required and must be a number between -90 and 90' });
        }
        if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
          return res.status(400).json({ error: 'chart.lon required and must be a number between -180 and 180' });
        }
      }

      const existing = await astradioPgStore.getUserAuthForLogin(emailNormalized);
      if (existing) {
        return res.status(200).json({ message: REGISTRATION_SENT_MESSAGE });
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      let user: { id: string; displayName: string; handle?: string };
      try {
        const created = await astradioPgStore.createRegisteredUser({
          displayName: displayName.trim(),
          handle: typeof body.handle === 'string' ? body.handle.trim() || undefined : undefined,
          email: emailRaw.trim(),
          emailNormalized,
          passwordHash,
        });
        user = {
          id: String(created.id),
          displayName: String(created.displayName),
          handle: typeof created.handle === 'string' ? created.handle : undefined,
        };
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '23505') {
          return res.status(200).json({ message: REGISTRATION_SENT_MESSAGE });
        }
        throw e;
      }

      try {
        await sendVerificationEmailForUser(user.id, emailRaw.trim());
      } catch (emailErr) {
        console.error('[compat] POST /auth/register verification email error', emailErr);
      }

      let primaryChart: import('./types').Chart | null = null;
      try {
        primaryChart = await attachPrimaryChartForNewUser(user.id, chartInput ?? undefined);
      } catch (e: unknown) {
        if (isChartTimezoneError(e)) {
          return res.status(400).json({
            error: 'invalid_request',
            message: String((e as { message?: string }).message || e),
            code: (e as { code?: string }).code,
          });
        }
        throw e;
      }

      return res.status(200).json({ message: REGISTRATION_SENT_MESSAGE });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[compat] POST /auth/register', e);
      return res.status(500).json({ error: msg || 'Registration failed' });
    }
  });

  router.post('/auth/login', authLimiter, async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      const body = (req.body || {}) as { email?: string; password?: string };
      const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
      const emailNormalized = astradioPgStore.normalizeLoginEmail(emailRaw);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!emailNormalized || !password) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const row = await astradioPgStore.getUserAuthForLogin(emailNormalized);
      if (!row || !row.passwordHash) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const ok = await argon2.verify(row.passwordHash, password);
      if (!ok) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const verified = await astradioPgStore.isEmailVerified(row.id);
      if (!verified) {
        try {
          const emailTo =
            (await astradioPgStore.getUserEmailVerificationByNormalizedEmail(emailNormalized))?.email?.trim() ||
            emailRaw;
          if (emailTo) {
            await sendVerificationEmailForUser(row.id, emailTo);
          }
        } catch (verifyResendErr) {
          console.error('[compat] POST /auth/login resend verification', verifyResendErr);
        }
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      return res.status(200).json({
        user: { id: row.id, displayName: row.displayName, handle: row.handle, emailVerified: true },
      });
    } catch (e: unknown) {
      console.error('[compat] POST /auth/login', e);
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  // POST /api/auth/token — mobile: email/password → JWT access token (no Vercel session cookie)
  router.post('/auth/token', authLimiter, async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
        return res.status(503).json({ error: 'jwt_not_configured' });
      }
      const { generateAccessToken } = require(path.join(__dirname, '..', '..', '..', '..', 'lib', 'authentication')) as {
        generateAccessToken: (userId: string, deviceId?: string | null) => string;
      };
      const body = (req.body || {}) as { email?: string; password?: string };
      const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
      const emailNormalized = astradioPgStore.normalizeLoginEmail(emailRaw);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!emailNormalized || !password) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const row = await astradioPgStore.getUserAuthForLogin(emailNormalized);
      if (!row || !row.passwordHash) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const ok = await argon2.verify(row.passwordHash, password);
      if (!ok) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const verified = await astradioPgStore.isEmailVerified(row.id);
      if (!verified) {
        try {
          const emailTo =
            (await astradioPgStore.getUserEmailVerificationByNormalizedEmail(emailNormalized))?.email?.trim() ||
            emailRaw;
          if (emailTo) {
            await sendVerificationEmailForUser(row.id, emailTo);
          }
        } catch (verifyResendErr) {
          console.error('[compat] POST /auth/token resend verification', verifyResendErr);
        }
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const token = generateAccessToken(row.id);
      return res.status(200).json({
        token,
        user: { id: row.id, displayName: row.displayName, handle: row.handle },
      });
    } catch (e: unknown) {
      console.error('[compat] POST /auth/token', e);
      return res.status(500).json({ error: 'Token issuance failed' });
    }
  });

  router.get('/auth/verify-email', async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
      if (!token) {
        return res.status(400).json({ error: 'invalid_or_expired_token' });
      }
      const result = await astradioPgStore.verifyEmailToken(token);
      if (!result.valid) {
        return res.status(400).json({ error: 'invalid_or_expired_token' });
      }
      return res.status(200).json({ verified: true });
    } catch (e: unknown) {
      console.error('[compat] GET /auth/verify-email', e);
      return res.status(500).json({ error: 'verification_failed' });
    }
  });

  router.post('/auth/forgot-password', authLimiter, async (req: import('express').Request, res: import('express').Response) => {
    const generic = { message: 'If that email is registered, a reset link has been sent.' };
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      const body = (req.body || {}) as { email?: string };
      const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
      const emailNormalized = astradioPgStore.normalizeLoginEmail(emailRaw);
      if (!emailNormalized) {
        return res.status(200).json(generic);
      }
      const row = await astradioPgStore.getUserByNormalizedEmailForPasswordReset(emailNormalized);
      if (row) {
        const emailTo = row.email && String(row.email).trim() ? String(row.email).trim() : emailRaw;
        try {
          await sendPasswordResetEmailForUser(row.id, emailTo, emailRaw || emailTo);
        } catch (emailErr) {
          console.error('[compat] POST /auth/forgot-password email', emailErr);
        }
      }
      return res.status(200).json(generic);
    } catch (e: unknown) {
      console.error('[compat] POST /auth/forgot-password', e);
      return res.status(200).json(generic);
    }
  });

  router.post('/auth/reset-password', authLimiter, async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      const body = (req.body || {}) as { email?: string; token?: string; password?: string };
      const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const emailNormalized = astradioPgStore.normalizeLoginEmail(emailRaw);
      if (!emailNormalized || !token || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: 'invalid_token' });
      }
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const result = await astradioPgStore.resetPasswordWithToken(emailNormalized, token, passwordHash);
      if (!result.ok) {
        return res.status(400).json({ error: 'invalid_token' });
      }
      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (e: unknown) {
      console.error('[compat] POST /auth/reset-password', e);
      return res.status(500).json({ error: 'reset_failed' });
    }
  });

  router.post('/auth/resend-verification', async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(501).json({ error: 'auth_requires_postgres' });
      }
      const body = (req.body || {}) as { email?: string };
      const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
      const emailNormalized = astradioPgStore.normalizeLoginEmail(emailRaw);
      if (!emailNormalized) {
        return res.status(200).json({ sent: true });
      }
      const row = await astradioPgStore.getUserEmailVerificationByNormalizedEmail(emailNormalized);
      if (!row || row.emailVerified) {
        return res.status(200).json({ sent: true });
      }
      if (row.tokenExpiresAt) {
        const expiresAt = new Date(row.tokenExpiresAt);
        const createdApprox = expiresAt.getTime() - 24 * 60 * 60 * 1000;
        if (Date.now() - createdApprox < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
          return res.status(429).json({ error: 'wait_before_resend' });
        }
      }
      const emailTo = row.email && String(row.email).trim() ? String(row.email).trim() : emailRaw;
      await sendVerificationEmailForUser(row.id, emailTo);
      return res.status(200).json({ sent: true });
    } catch (e: unknown) {
      console.error('[compat] POST /auth/resend-verification', e);
      return res.status(500).json({ error: 'resend_failed' });
    }
  });

  // GET /api/profile — own profile + primary chart (session via x-proxy-session-user-id)
  router.get('/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const proxyUserId = resolveProxySessionUserId(req);
      if (!proxyUserId) {
        return res.status(401).json({ error: 'proxy_identity_required' });
      }
      const userId = proxyUserId;
      const storageAny = storage as any;
      const adapterName: string = storageAny?.getStorage?.().__compatName || 'unknown';
      // eslint-disable-next-line no-console
      console.log('[compat] GET /profile', {
        userId,
        adapter: adapterName,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
      });
      const u = await storage.getUser(userId);
      if (!u) return res.status(404).json({ error: 'User not found' });
      const chartId = await storage.getUserPrimaryChart(userId) || storage.DEFAULT_PROFILE_CHART_ID;
      const chart = await getChartById(chartId);
      const userPayload = profileUserPayload(u);
      return res.status(200).json({
        user: userPayload,
        primaryChart: chart ? ownPrimaryChartPayload(chart) : null,
      });
    } catch (e: any) {
      console.error('[compat] GET /profile', e);
      return res.status(500).json({ error: e?.message || 'Failed to get profile' });
    }
  });

  // POST /api/profile — disabled: anonymous account creation removed; use POST /api/auth/register (Next sets session).
  router.post('/profile', (_req: import('express').Request, res: import('express').Response) => {
    return res.status(403).json({
      error: 'registration_required',
      message: 'Use POST /api/auth/register to create an account.',
    });
  });

  // POST /api/profile/user-chart — Next-only: requires x-proxy-session-user-id (session user from Vercel proxy).
  router.post('/profile/user-chart', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const proxyUserId = resolveProxySessionUserId(req);
      if (!proxyUserId) {
        return res.status(401).json({ error: 'proxy_identity_required' });
      }
      const u = await storage.getUser(proxyUserId);
      if (!u) {
        return res.status(404).json({ error: 'User not found' });
      }
      const body = (req.body || {}) as { chart?: ProfileChartBody };
      const chartInput = body.chart;
      if (chartInput == null || typeof chartInput !== 'object') {
        return res.status(400).json({ error: 'chart required' });
      }
      const { label, date, time, lat, lon } = chartInput;
      if (!label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'chart.label required' });
      }
      if (!date || typeof date !== 'string' || !date.trim()) {
        return res.status(400).json({ error: 'chart.date required' });
      }
      if (!time || typeof time !== 'string' || !time.trim()) {
        return res.status(400).json({ error: 'chart.time required' });
      }
      const dateErr = validateProfileChartDate(date);
      if (dateErr) {
        return res.status(400).json({ error: dateErr });
      }
      const timeErr = validateProfileChartTime(time);
      if (timeErr) {
        return res.status(400).json({ error: timeErr });
      }
      if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'chart.lat invalid' });
      }
      if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        return res.status(400).json({ error: 'chart.lon invalid' });
      }
      let primaryChart: import('./types').Chart | null = null;
      try {
        primaryChart = await attachPrimaryChartForNewUser(proxyUserId, chartInput);
      } catch (e: unknown) {
        if (isChartTimezoneError(e)) {
          return res.status(400).json({
            error: 'invalid_request',
            message: String((e as { message?: string }).message || e),
            code: (e as { code?: string }).code,
          });
        }
        throw e;
      }
      const refreshed = await storage.getUser(proxyUserId);
      return res.status(201).json({
        user: profileUserPayload(refreshed ?? u),
        primaryChart: primaryChart ? ownPrimaryChartPayload(primaryChart) : null,
      });
    } catch (e: unknown) {
      console.error('[compat] POST /profile/user-chart', e);
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save chart' });
    }
  });

  // POST /api/profile/identity-audio — user-initiated natal identity soundtrack (Identity tab CTA).
  router.post('/profile/identity-audio', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const proxyUserId = resolveProxySessionUserId(req);
      if (!proxyUserId) {
        return res.status(401).json({ error: 'proxy_identity_required' });
      }
      const primaryChartId =
        storage.getUserPrimaryChart != null ? await storage.getUserPrimaryChart(proxyUserId) : undefined;
      if (!primaryChartId || primaryChartId === storage.DEFAULT_PROFILE_CHART_ID) {
        return res.status(404).json({ error: 'No chart found' });
      }
      const chart = await storage.getChart(primaryChartId);
      if (!chart || chart.ownerId !== proxyUserId) {
        return res.status(404).json({ error: 'Chart not found' });
      }
      const result = await generateProfileIdentityAudioForChart(chart);
      if (!result.identity_export_id) {
        return res.status(502).json({
          error: result.error || 'Audio generation failed',
        });
      }
      return res.status(200).json({ identity_export_id: result.identity_export_id });
    } catch (e: unknown) {
      console.error('[compat] POST /profile/identity-audio', e);
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Audio generation failed' });
    }
  });

  // PATCH /api/profile — discoverability (8G) + personalization (9A-1). userId from x-proxy-session-user-id only.
  router.patch('/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const proxyUserId = resolveProxySessionUserId(req);
      if (!proxyUserId) {
        return res.status(401).json({ error: 'proxy_identity_required' });
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const userId = proxyUserId.trim();
      const u = await storage.getUser(userId);
      if (!u) return res.status(404).json({ error: 'User not found' });

      const discoverable = body.discoverable;
      const show_in_feed = body.show_in_feed;
      const hasVisibility =
        discoverable !== undefined || show_in_feed !== undefined;
      const hasPersonalization = hasProfilePersonalizationKeys(body);

      if (!hasVisibility && !hasPersonalization) {
        return res.status(400).json({ error: 'no updatable fields provided' });
      }

      const updateOpts: Parameters<typeof storage.updateUserProfile>[1] = {};

      if (hasVisibility) {
        if (discoverable !== undefined && typeof discoverable !== 'boolean') {
          return res.status(400).json({ error: 'discoverable must be a boolean' });
        }
        if (show_in_feed !== undefined && typeof show_in_feed !== 'boolean') {
          return res.status(400).json({ error: 'show_in_feed must be a boolean' });
        }
        if (discoverable !== undefined) updateOpts.discoverable = discoverable;
        if (show_in_feed !== undefined) updateOpts.show_in_feed = show_in_feed;
      }

      if (hasPersonalization) {
        const parsed = parseProfilePersonalizationPatch(body);
        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }
        Object.assign(updateOpts, parsed.patch);
      }

      try {
        await storage.updateUserProfile(userId, updateOpts);
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err.code === 'CHART_HIGHLIGHTS_COLUMN_MISSING') {
          return res.status(501).json({ error: 'chart_highlights_unavailable' });
        }
        throw e;
      }

      const updated = await storage.getUser(userId);
      return res.status(200).json({ user: profileUserPayload(updated!) });
    } catch (e: any) {
      console.error('[compat] PATCH /profile', e);
      return res.status(500).json({ error: e?.message || 'Failed to update profile' });
    }
  });

  // GET /api/profile/avatar/:userId — stream avatar from S3 (same-origin when bucket is private).
  router.get('/profile/avatar/:userId', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const { storageLib } = getAvatarDeps();
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      if (!userId?.trim()) return res.status(400).json({ error: 'userId required' });
      const u = await storage.getUser(userId.trim());
      if (!u?.avatarUrl) return res.status(404).json({ error: 'Avatar not found' });
      const { buffer, contentType } = await storageLib.getAvatarObject(userId.trim());
      res.set('Cache-Control', 'public, max-age=3600');
      res.type(contentType);
      return res.send(buffer);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'AVATAR_NOT_FOUND') {
        return res.status(404).json({ error: 'Avatar not found' });
      }
      console.error('[compat] GET /profile/avatar/:userId', e);
      return res.status(500).json({ error: err?.message || 'Failed to load avatar' });
    }
  });

  // POST /api/profile/avatar — upload profile photo (Rekognition + sharp + S3).
  router.post(
    '/profile/avatar',
    (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
      getAvatarMulter().single('avatar')(req, res, next),
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const { storageLib, avatarUploadLib } = getAvatarDeps();
        const { uploadAvatar } = storageLib;
        const {
          isValidImageBuffer,
          moderateImageBuffer,
          processAvatarImage,
          MODERATION_REJECTION_MESSAGE,
        } = avatarUploadLib;
        const proxyUserId = resolveProxySessionUserId(req);
        if (!proxyUserId) {
          return res.status(401).json({ error: 'proxy_identity_required' });
        }
        const file = (req as import('express').Request & { file?: { buffer: Buffer } }).file;
        if (!file?.buffer) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        const userId = proxyUserId.trim();
        const u = await storage.getUser(userId);
        if (!u) return res.status(404).json({ error: 'User not found' });

        if (!isValidImageBuffer(file.buffer)) {
          console.log('[avatar] Rejected: invalid file header');
          return res.status(400).json({ error: MODERATION_REJECTION_MESSAGE });
        }

        const moderation = await moderateImageBuffer(file.buffer);
        if (!moderation.ok) {
          return res.status(400).json({ error: moderation.message || MODERATION_REJECTION_MESSAGE });
        }

        const processed = await processAvatarImage(file.buffer);
        const s3Url = await uploadAvatar(userId, processed, 'jpg');
        await storage.updateAvatarUrl(userId, s3Url);

        return res.status(200).json({ avatarUrl: clientAvatarUrl(userId, s3Url) });
      } catch (e: unknown) {
        console.error('[compat] POST /profile/avatar', e);
        return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to upload avatar' });
      }
    }
  );

  // DELETE /api/profile/avatar — remove profile photo.
  router.delete('/profile/avatar', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const proxyUserId = resolveProxySessionUserId(req);
      if (!proxyUserId) {
        return res.status(401).json({ error: 'proxy_identity_required' });
      }
      const userId = proxyUserId.trim();
      const u = await storage.getUser(userId);
      if (!u) return res.status(404).json({ error: 'User not found' });
      await storage.updateAvatarUrl(userId, null);
      return res.status(200).json({ avatarUrl: null });
    } catch (e: unknown) {
      console.error('[compat] DELETE /profile/avatar', e);
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to remove avatar' });
    }
  });

  // POST /api/profile/active-state — A + C(t) via overlay compose (comparison_pair). Body: { chartId, calendarDate, localTime, location, userId? }
  router.post('/profile/active-state', express.json({ limit: '64kb' }), async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = (req.body || {}) as {
        chartId?: string;
        calendarDate?: string;
        localTime?: string;
        location?: Record<string, unknown>;
        userId?: string;
        skipCache?: boolean;
        generateAudio?: boolean;
        expectedPlanSha256?: string;
        expectedObjectIdentityHash?: string;
      };
      const chartId = typeof body.chartId === 'string' ? body.chartId.trim() : '';
      const calendarDate = typeof body.calendarDate === 'string' ? body.calendarDate.trim() : '';
      const localTime = typeof body.localTime === 'string' ? body.localTime.trim() : '';
      if (!chartId || !calendarDate || !localTime || !body.location || typeof body.location !== 'object') {
        return res.status(400).json({
          error: 'chartId, calendarDate, localTime, and location are required',
          code: 'PROFILE_ACTIVE_INVALID_BODY',
        });
      }
      if (body.generateAudio === true) {
        const ep = typeof body.expectedPlanSha256 === 'string' ? body.expectedPlanSha256.trim() : '';
        const eo = typeof body.expectedObjectIdentityHash === 'string' ? body.expectedObjectIdentityHash.trim() : '';
        if (!ep || !eo) {
          return res.status(400).json({
            error: 'generateAudio requires expectedPlanSha256 and expectedObjectIdentityHash from prior text response',
            code: 'PROFILE_ACTIVE_AUDIO_EXPECTED_HASHES',
          });
        }
      }
      const proxyUserId = resolveProxySessionUserId(req);
      const userIdForProjection =
        proxyUserId || (typeof body.userId === 'string' ? body.userId.trim() : null);
      const result = await buildProfileActiveStateProjection({
        chartId,
        calendarDate,
        localTime,
        location: body.location,
        userId: userIdForProjection,
        skipCache: body.skipCache === true,
        generateAudio: body.generateAudio === true,
        expectedPlanSha256:
          typeof body.expectedPlanSha256 === 'string' ? body.expectedPlanSha256.trim() : undefined,
        expectedObjectIdentityHash:
          typeof body.expectedObjectIdentityHash === 'string' ? body.expectedObjectIdentityHash.trim() : undefined,
      });
      return res.status(200).json(result);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === 'NATAL_TIMEZONE_REQUIRED') {
        return res.status(422).json({ error: e?.message || 'NATAL_TIMEZONE_REQUIRED', code });
      }
      if (code === 'LOCATION_REQUIRED' || code === 'INVALID_SOURCE' || code === 'LOCATION_INVALID') {
        return res.status(400).json({ error: e?.message || 'Invalid location', code: code || 'LOCATION_INVALID' });
      }
      if (e?.message?.includes('Chart not found')) return res.status(404).json({ error: e.message });
      if ((e as any)?.code === 'ML_INFERENCE_UNAVAILABLE') return res.status(503).json({ error: 'ML inference unavailable' });
      if ((e as any)?.code === 'HASH_MISMATCH') {
        return res.status(422).json({ error: e?.message || 'HASH_MISMATCH', code: 'HASH_MISMATCH' });
      }
      console.error('[compat] POST /profile/active-state', e);
      return res.status(500).json({ error: e?.message || 'Failed to build profile active state' });
    }
  });

  // GET /api/profile/chart?chartId= (optional; default = chart_profile_default). Allow directory charts or any chart that exists in storage (e.g. user-created on profile creation).
  router.get('/profile/chart', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartId = (req.query.chartId as string) || storage.DEFAULT_PROFILE_CHART_ID;
      const inDirectory = await isDirectoryChartId(chartId);
      const chart = await getChartById(chartId);
      if (!inDirectory && !chart) {
        return res.status(403).json({ error: 'Chart not found or not accessible' });
      }
      const result = await getProfileChartExplainer(chartId);
      return res.status(200).json(result);
    } catch (e: any) {
      if (e?.message?.includes('not found')) return res.status(404).json({ error: e.message });
      if ((e as any)?.code === 'ML_INFERENCE_UNAVAILABLE') return res.status(503).json({ error: 'ML inference unavailable' });
      console.error('[compat] GET /profile/chart', e);
      return res.status(500).json({ error: e?.message || 'Failed to get profile chart' });
    }
  });

  // GET /api/profile/:handle — lookup by handle; falls back to user id when handle misses
  router.get('/profile/:handle', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const handle = Array.isArray(req.params.handle) ? req.params.handle[0] : req.params.handle;
      if (!handle || !handle.trim()) return res.status(400).json({ error: 'handle required' });
      const slug = handle.trim();
      let u = await storage.getUserByHandle(slug);
      if (!u) {
        u = await storage.getUser(slug);
      }
      if (!u) return res.status(404).json({ error: 'User not found' });
      const chartId = await storage.getUserPrimaryChart(u.id) || storage.DEFAULT_PROFILE_CHART_ID;
      const chart = await getChartById(chartId);
      return res.status(200).json({
        user: profileUserPayload(u),
        primaryChart: publicPrimaryChartPayload(chart),
      });
    } catch (e: any) {
      console.error('[compat] GET /profile/:handle', e);
      return res.status(500).json({ error: e?.message || 'Failed to get profile' });
    }
  });

  // POST /api/charts
  router.post('/charts', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = req.body || {};
      const { ownerId, label, date, time, lat, lon, timezone, tz, snapshotHash } = body;
      if (!label || !date || !time || Number.isFinite(lat) === false || Number.isFinite(lon) === false) {
        return res.status(400).json({
          error: 'Missing or invalid fields',
          message: 'Required: label, date, time, lat, lon'
        });
      }
      const tzClient =
        typeof timezone === 'string' && timezone.trim()
          ? timezone.trim()
          : typeof tz === 'string' && tz.trim()
            ? tz.trim()
            : undefined;
      const chart = await createChart({
        ownerId: ownerId || undefined,
        label,
        date: String(date).slice(0, 10),
        time: String(time).slice(0, 5),
        lat: Number(lat),
        lon: Number(lon),
        ...(tzClient !== undefined ? { timezone: tzClient } : {}),
        snapshotHash: snapshotHash || undefined
      });
      // Phase 4: populate stored vector when Postgres available (single write path)
      if (process.env.POSTGRES_URL) {
        populateChartVector(chart.id, chart.snapshotHash).catch((err) => {
          console.warn('[compat] vector populate after chart create:', err?.message);
        });
      }
      return res.status(201).json(chart);
    } catch (e: any) {
      if (isChartTimezoneError(e)) {
        return res.status(400).json({ error: 'invalid_request', message: e.message, code: e.code });
      }
      console.error('[compat] POST /charts', e);
      return res.status(500).json({ error: e?.message || 'Failed to create chart' });
    }
  });

  // GET /api/charts/search?q=&limit= — authenticated; own charts + peer charts from accepted relationships
  router.get('/charts/search', async (req: import('express').Request, res: import('express').Response) => {
    try {
      if (!process.env.POSTGRES_URL) {
        return res.status(503).json({ error: 'Chart search requires database' });
      }
      const userId = chartSearchCallerUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const limitParam = req.query.limit != null ? Number(req.query.limit) : 10;
      const rows = await astradioPgStore.searchChartsAccessibleToUser(userId, q, limitParam);
      const results = rows.map((row) => {
        const { chart, source, ownerUser } = row;
        const handleOut =
          ownerUser?.handle != null && String(ownerUser.handle).trim()
            ? String(ownerUser.handle).trim().startsWith('@')
              ? String(ownerUser.handle).trim()
              : `@${String(ownerUser.handle).trim()}`
            : null;
        const out: Record<string, unknown> = {
          chart_id: chart.id,
          user_id: chart.ownerId || '',
          display_name: ownerUser?.displayName ?? null,
          handle: handleOut,
          birth_date: chart.date,
          label: formatSandboxChartSearchLabel(chart, ownerUser),
          source,
        };
        if (source === 'own') {
          const bt =
            chart.time && typeof chart.time === 'string' && chart.time.length >= 5
              ? chart.time.slice(0, 5)
              : null;
          out.birth_time = bt;
        }
        return out;
      });
      return res.status(200).json({ results });
    } catch (e: unknown) {
      console.error('[compat] GET /charts/search', e instanceof Error ? e.message : e);
      return res.status(500).json({ error: 'Chart search failed' });
    }
  });

  async function chartJsonWithOwnerMeta(
    chart: import('./types').Chart,
    viewerUserId: string | null
  ) {
    let ownerDisplayName: string | null = null;
    let ownerHandle: string | null = null;
    if (chart.ownerId) {
      const owner = await storage.getUser(chart.ownerId);
      if (owner) {
        ownerDisplayName = owner.displayName?.trim() || null;
        if (owner.handle?.trim()) {
          const h = owner.handle.trim();
          ownerHandle = h.startsWith('@') ? h : `@${h}`;
        }
      }
    }
    const isOwn = Boolean(viewerUserId && chart.ownerId && chart.ownerId === viewerUserId);
    const base = isOwn
      ? chart
      : chartPayloadForPublicView(chart as unknown as Record<string, unknown>);
    return {
      ...base,
      ownerDisplayName,
      ownerHandle,
    };
  }

  // GET /api/charts/:id
  router.get('/charts/:id', async (req: import('express').Request, res: import('express').Response) => {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || '').trim();
    if (!id) return res.status(404).json({ error: 'Chart not found' });
    const viewerUserId = resolveProxySessionUserId(req) || null;
    const chart = await getChartById(id);
    if (chart) return res.json(await chartJsonWithOwnerMeta(chart, viewerUserId));

    const userByHandle = await storage.getUserByHandle(id);
    if (!userByHandle) return res.status(404).json({ error: 'Chart not found' });

    const charts = await listChartsByOwner(userByHandle.id);
    const resolved = selectHandleResolvedChart(charts, id);
    if (resolved) return res.json(await chartJsonWithOwnerMeta(resolved, viewerUserId));
    return res.status(404).json({ error: 'Chart not found', code: 'CHART_LOOKUP_AMBIGUOUS' });
  });

  // GET /api/charts/:id/snapshot — wheel-safe ephemeris (positions/houses only; server reads full chart)
  router.get('/charts/:id/snapshot', async (req: import('express').Request, res: import('express').Response) => {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || '').trim();
    if (!id) return res.status(404).json({ error: 'Chart not found' });
    const viewerUserId = resolveProxySessionUserId(req);
    if (!viewerUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const chart = await getChartById(id);
    if (!chart) return res.status(404).json({ error: 'Chart not found' });
    const allowed = await astradioPgStore.chartAccessibleToUser(viewerUserId, id);
    if (!allowed) {
      return res.status(403).json({
        error: "This chart isn't available for import. Connect with this person first, or enter their birth data manually.",
        code: 'CHART_ACCESS_DENIED',
      });
    }
    try {
      const snapshot = await getChartSnapshotCached(id);
      return res.json({ snapshot });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Chart snapshot failed';
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/comparisons
   *
   * Relationship modes: canonical set `friends` | `lovers` | `neutral` (`vnext/compat/types`).
   * Phase 6C soft-compat: body may still send `rivals` | `mentor` | `collaborator`; they normalize to `friends` via `parseRelationshipModeInput`.
   *
   * Future (~2 releases post-6C): plan to **reject** deprecated strings with HTTP 400 and e.g. `DEPRECATED_RELATIONSHIP_MODE` instead of normalizing — not enabled yet.
   */
  router.post('/comparisons', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = req.body || {};
      /** Invariant: HTTP compatibility comparisons always run aggregate compose (explanation + compatibilityText). */
      const suppressComposeRequested =
        body &&
        typeof body === 'object' &&
        'generateComposition' in body &&
        (body as { generateComposition?: unknown }).generateComposition === false;
      if (suppressComposeRequested) {
        console.warn(
          '[compat] POST /api/comparisons: ignoring generateComposition:false — server invariant forces composition',
        );
      }
      const {
        chartAId,
        chartBId,
        chartBInline,
        relationshipMode,
        fusion,
        createdBy,
        expansionTier,
        expansion_tier,
        mode,
        seekerChartId,
        targetChartId,
        roles,
      } = body as {
        chartAId?: string;
        chartBId?: string;
        chartBInline?: unknown;
        relationshipMode?: string;
        fusion?: { wA: unknown; wB: unknown };
        createdBy?: string;
        expansionTier?: string;
        expansion_tier?: string;
        mode?: string;
        seekerChartId?: string;
        targetChartId?: string;
        roles?: Record<string, unknown>;
      };
      if (typeof mode === 'string' && mode === 'compatibility') {
        return res.status(400).json({
          error: 'mode=\"compatibility\" is not supported on /api/comparisons. Use seekerChartId/targetChartId or chartAId/chartBId only.',
          code: 'UNSUPPORTED_COMPARISONS_MODE_COMPATIBILITY'
        });
      }
      const chartBInlineInput = isChartBInline(chartBInline) ? chartBInline : undefined;
      const fusionInput = isFusionParams(fusion) ? fusion : undefined;

      const effectiveChartAId = chartAId || seekerChartId;
      const effectiveChartBId = chartBId || targetChartId;

      if (!effectiveChartAId) {
        return res.status(400).json({ error: 'seekerChartId or chartAId required' });
      }
      if (!effectiveChartBId && !chartBInlineInput) {
        return res.status(400).json({
          error: 'targetChartId or chartBId or chartBInline (date, time, lat, lon) required'
        });
      }
      let normalizedRelationshipMode: RelationshipMode;
      try {
        normalizedRelationshipMode = parseRelationshipModeInput(relationshipMode);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid relationshipMode';
        return res.status(400).json({
          error: msg,
          allowed: [...RELATIONSHIP_MODES],
          note: 'Legacy values rivals, mentor, collaborator are accepted and normalized to friends.',
        });
      }

      const result = await createComparison({
        chartAId: effectiveChartAId,
        chartBId: effectiveChartBId || undefined,
        chartBInline: chartBInlineInput,
        relationshipMode: normalizedRelationshipMode,
        generateComposition: true,
        fusion: fusionInput,
        createdBy: createdBy || undefined,
        expansionTier: parseExpansionTier(expansionTier ?? expansion_tier),
        // Preserve explicit seeker/target ids on the record when provided.
        seekerChartId: seekerChartId || undefined,
        targetChartId: targetChartId || undefined,
      } as any);

      if (!result.comparison) {
        return res.status(500).json({ error: 'comparison_persist_failed' });
      }
      const comparison = result.comparison as ComparisonWithRoles & { roles?: any };
      const seekerChartIdOut = comparison.seekerChartId || comparison.chartAId;
      const targetChartIdOut = comparison.targetChartId || comparison.chartBId;
      const responseRoles = {
        ...(roles && typeof roles === 'object' ? roles : {}),
        seekerChartId: seekerChartIdOut,
        targetChartId: targetChartIdOut,
      };

      const response: Record<string, unknown> = {
        ...comparison,
        seekerChartId: seekerChartIdOut,
        targetChartId: targetChartIdOut,
        relationshipMode: coerceRelationshipModeFromStorage(comparison.relationshipMode),
        roles: responseRoles,
        planHash: result.planHash,
        compositionId: result.compositionId,
        semantic_reading_available: result.semantic_reading_available,
      };
      if (result.audioBase64) {
        (response as any).audio = { base64: result.audioBase64, format: 'wav' };
      }
      if (result.explanation) {
        (response as any).explanation = result.explanation;
      }
      if (result.exportId) {
        (response as any).exportJobId = result.exportId;
      }
      return res.status(201).json(response);
    } catch (e: any) {
      console.error('[compat] POST /comparisons', e);
      const code = e?.message?.includes('not found') ? 404 : 500;
      return res.status(code).json({ error: e?.message || 'Failed to create comparison' });
    }
  });

  // GET /api/comparisons?userId=... — list comparisons scoped by createdBy
  router.get('/comparisons', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const userId = (req.query.userId as string) || undefined;
      if (!userId) {
        return res.status(400).json({ error: 'userId query required for listing comparisons' });
      }
      const items = await storage.listComparisonsByUser(userId);
      const normalized = items.map((cmp) => {
        const comparison = cmp as ComparisonWithRoles & { roles?: any };
        const seekerChartId = comparison.seekerChartId || comparison.chartAId;
        const targetChartId = comparison.targetChartId || comparison.chartBId;
        const rolesOut = {
          ...(comparison.roles && typeof comparison.roles === 'object' ? comparison.roles : {}),
          seekerChartId,
          targetChartId,
        };
        return {
          ...comparison,
          seekerChartId,
          targetChartId,
          relationshipMode: coerceRelationshipModeFromStorage(comparison.relationshipMode),
          roles: rolesOut,
        };
      });
      return res.status(200).json({ items: normalized });
    } catch (e: any) {
      console.error('[compat] GET /comparisons', e);
      return res.status(500).json({ error: e?.message || 'Failed to list comparisons' });
    }
  });

  // GET /api/comparisons/:id
  router.get('/comparisons/:id', async (req: import('express').Request, res: import('express').Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const comparison = (await storage.getComparison(id)) as ComparisonWithRoles | undefined;
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    const seekerChartId = comparison.seekerChartId || comparison.chartAId;
    const targetChartId = comparison.targetChartId || comparison.chartBId;
    return res.json({
      ...comparison,
      seekerChartId,
      targetChartId,
      relationshipMode: coerceRelationshipModeFromStorage(comparison.relationshipMode),
      roles: {
        seekerChartId,
        targetChartId
      }
    });
  });

  // POST /api/community/groups/profile — GroupProfile aggregate (no music/gates)
  router.post('/community/groups/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = (req.body || {}) as GroupsProfileRequest;
      const { groupId, chartIds, featureVecs, aggregationMode, seed } = body;
      if (!groupId) {
        return res.status(400).json({ error: 'groupId required' });
      }
      if (!chartIds?.length && !featureVecs?.length) {
        return res.status(400).json({ error: 'Either chartIds or featureVecs must be provided' });
      }
      const result = await createGroupProfile({
        groupId,
        chartIds: chartIds?.length ? chartIds : undefined,
        featureVecs: featureVecs?.length ? featureVecs : undefined,
        aggregationMode,
        seed
      });
      // Serialize Float32Array for JSON
      const out = {
        ...result,
        featuresAgg: Array.from(result.featuresAgg)
      };
      return res.status(200).json(out);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[compat] POST /community/groups/profile', err);
      const code = err?.message?.includes('not found') ? 404 : 500;
      return res.status(code).json({ error: err?.message || 'Failed to create group profile' });
    }
  });

  // POST /api/compatibility/intent — curated clusters (no ranked list; no percentages in response)
  router.post('/compatibility/intent', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = (req.body || {}) as CompatibilityIntentRequest;
      const { seekerChartId, chart, intent: rawIntent, limit, scope, groupId, seekerUserId } = body;
      if (rawIntent == null || String(rawIntent).trim() === '') {
        return res.status(400).json({ error: 'intent required' });
      }
      const mapped = mapLegacyIntentToRelational(String(rawIntent));
      const intent = mapped ?? (isCompatMode(String(rawIntent)) ? (String(rawIntent) as RelationalIntent) : null);
      if (!intent) {
        return res.status(400).json({ error: 'Invalid intent', allowed: [...RELATIONAL_INTENTS] });
      }
      if (!seekerChartId && !chart) {
        return res.status(400).json({ error: 'Either seekerChartId or chart must be provided' });
      }
      if (scope === 'group' && !groupId) {
        return res.status(400).json({ error: 'groupId required when scope is group' });
      }
      const result = await computeCompatibilityIntent({
        seekerChartId,
        chart,
        intent,
        limit,
        scope,
        groupId,
        seekerUserId,
      });
      return res.status(200).json(result);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[compat] POST /compatibility/intent', err);
      const code = err?.message?.includes('not found') ? 404 : 500;
      return res.status(code).json({ error: err?.message || 'Failed to compute compatibility intent' });
    }
  });

  return router;
}
