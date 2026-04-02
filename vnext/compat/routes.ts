/**
 * Community Compatibility V1 — API route handlers.
 * Mount under /api (e.g. app.use('/api', compatRouter) then POST /api/charts, GET /api/charts/:id, etc.)
 */

import * as storage from './storage';
import { getChartById, createChart } from './chart-store';
import { createComparison, parseExpansionTier } from './comparison-service';
import { getProfileChartExplainer } from './profile-chart';
import { getCompatMatches, type CompatMatchMode } from './matches';
import { searchDirectoryUsers, isDirectoryChartId } from './directory';
import { RELATIONSHIP_MODES, type RelationshipMode } from './types';
import { createGroupProfile, type GroupsProfileRequest } from '../api/community-groups';
import { computeCompatibilityIntent, type CompatibilityIntentRequest } from '../api/compatibility-intent';
import { populateChartVector } from './vector-cache';
import { ensureSeedCandidateVectors } from './seed-vectors';
import type { ChartBInline, Comparison } from './types';
import { computeCompatibilitySystem, computeCompatibilityFieldOnly } from '../compatibility/service';

const express = require('express') as typeof import('express');
const COMPAT_MODES: CompatMatchMode[] = ['friend', 'lover', 'rival'];

function isChartTimezoneError(e: unknown): e is { message: string; code: string } {
  const c = (e as { code?: string })?.code;
  return c === 'INVALID_CHART_TIMEZONE' || c === 'CHART_TIMEZONE_UNRESOLVABLE';
}

type ComparisonWithRoles = Comparison & {
  seekerChartId?: string;
  targetChartId?: string;
};

function isRelationshipMode(s: string): s is RelationshipMode {
  return RELATIONSHIP_MODES.includes(s as RelationshipMode);
}

function isCompatMode(s: string): s is CompatMatchMode {
  return COMPAT_MODES.includes(s as CompatMatchMode);
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

export function createCompatRouter(): import('express').Router {
  const router = express.Router({ mergeParams: true });

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

  // GET /api/compat/matches?chartId=...&mode=friend|lover|rival&limit=...&cursor=... (cursor optional, stubbed for paging)
  router.get('/compat/matches', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartId = (req.query.chartId as string) || undefined;
      if (!chartId) {
        return res.status(400).json({ error: 'chartId is required' });
      }
      const mode: CompatMatchMode = isCompatMode((req.query.mode as string) || '') ? (req.query.mode as CompatMatchMode) : 'friend';
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
      const matches = await getCompatMatches(chartId, mode, limit);
      const generatedAt = new Date().toISOString();
      const matchesMock = process.env.VNEXT_MATCHES_MOCK === '1';
      return res.status(200).json({
        chartId,
        mode,
        limit,
        matches,
        generatedAt,
        version: COMPAT_RESPONSE_VERSION,
        synastryEnabled: false,
        matchesMock,
      });
    } catch (e: any) {
      if (e?.message?.includes('not found')) return res.status(404).json({ error: e.message });
      console.error('[compat] GET /compat/matches', e);
      return res.status(500).json({ error: e?.message || 'Failed to get matches' });
    }
  });

  // GET /api/community/search?q=&limit=&cursor= (directory search; seeded users only)
  router.get('/community/search', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const qRaw = req.query.q;
      const q = typeof qRaw === 'string' ? qRaw : (Array.isArray(qRaw) && qRaw.length > 0 ? String(qRaw[0]) : '');
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
      const cursor = (req.query.cursor as string) || undefined;
      const result = await searchDirectoryUsers({ q: q.trim(), limit, cursor });
      return res.status(200).json(result);
    } catch (e: any) {
      console.error('[compat] GET /community/search', e);
      return res.status(500).json({ error: e?.message || 'Search failed' });
    }
  });

  // GET /api/profile?userId= — current user + primary chart (for dev/preview; no auth)
  router.get('/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const userId = (req.query.userId as string) || undefined;
      if (!userId) {
        return res.status(400).json({ error: 'userId query required (dev: use cookie or query)' });
      }
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
      const userPayload: Record<string, unknown> = { id: u.id, displayName: u.displayName, handle: u.handle };
      const uExt = u as unknown as { discoverable?: boolean; show_in_feed?: boolean };
      if (uExt.discoverable !== undefined) userPayload.discoverable = uExt.discoverable;
      if (uExt.show_in_feed !== undefined) userPayload.show_in_feed = uExt.show_in_feed;
      return res.status(200).json({
        user: userPayload,
        primaryChart: chart ? { id: chart.id, label: chart.label, date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone } : null,
      });
    } catch (e: any) {
      console.error('[compat] GET /profile', e);
      return res.status(500).json({ error: e?.message || 'Failed to get profile' });
    }
  });

  // POST /api/profile — create user (dev, no auth). Body: { displayName, handle?, email?, chart?: { label, date, time, lat, lon [, timezone | tz] } }
  router.post('/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = (req.body || {}) as {
        displayName: string;
        handle?: string;
        email?: string;
        chart?: { label: string; date: string; time: string; lat: number; lon: number; timezone?: string; tz?: string };
      };
      const { displayName, handle, email, chart: chartInput } = body;
      if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        return res.status(400).json({ error: 'displayName required' });
      }
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
      const user = await storage.createUser({ displayName: displayName.trim(), handle: handle?.trim() || undefined, email: email?.trim() || undefined });
      console.log('[compat][profile][createUser]', {
        userId: user.id,
        handle: (user as any)?.handle,
        success: true,
      });
      let primaryChart: import('./types').Chart | null = null;
      if (chartInput != null && typeof chartInput === 'object') {
        const { label, date, time, lat, lon, timezone: tzField, tz: tzAlt } = chartInput;
        const clientTzRaw =
          typeof tzField === 'string' && tzField.trim()
            ? tzField.trim()
            : typeof tzAlt === 'string' && tzAlt.trim()
              ? tzAlt.trim()
              : undefined;
        primaryChart = await storage.createChart({
          ownerId: user.id,
          label: label.trim(),
          date: String(date).slice(0, 10),
          time: String(time).slice(0, 5),
          lat: Number(lat),
          lon: Number(lon),
          ...(clientTzRaw !== undefined ? { timezone: clientTzRaw } : {}),
        });
        console.log('[compat][profile][createChart]', {
          userId: user.id,
          chartId: primaryChart.id,
          path: 'inline',
          success: true,
        });
        await linkUserPrimaryChartWithRetry(user.id, primaryChart.id);
        if (process.env.POSTGRES_URL) {
          populateChartVector(primaryChart.id, primaryChart.snapshotHash).catch((err) => {
            console.warn('[compat] vector populate after chart create:', err?.message);
          });
        }
      } else {
        const defaultChart = await storage.ensureDefaultProfileChart();
        primaryChart = await storage.createChart({
          ownerId: user.id,
          label: defaultChart.label,
          date: defaultChart.date,
          time: defaultChart.time,
          lat: defaultChart.lat,
          lon: defaultChart.lon,
          timezone: defaultChart.timezone,
        });
        console.log('[compat][profile][createChart]', {
          userId: user.id,
          chartId: primaryChart.id,
          path: 'default-clone',
          success: true,
        });
        await linkUserPrimaryChartWithRetry(user.id, primaryChart.id);
        if (process.env.POSTGRES_URL) {
          populateChartVector(primaryChart.id, primaryChart.snapshotHash).catch((err) => {
            console.warn('[compat] vector populate after chart create:', err?.message);
          });
        }
      }
      return res.status(201).json({
        user: { id: user.id, displayName: user.displayName, handle: user.handle },
        primaryChart: primaryChart ? { id: primaryChart.id, label: primaryChart.label, date: primaryChart.date, time: primaryChart.time, lat: primaryChart.lat, lon: primaryChart.lon, timezone: primaryChart.timezone } : null,
      });
    } catch (e: any) {
      if (isChartTimezoneError(e)) {
        return res.status(400).json({ error: 'invalid_request', message: e.message, code: e.code });
      }
      console.error('[compat] POST /profile', e);
      return res.status(500).json({ error: e?.message || 'Failed to create profile' });
    }
  });

  // PATCH /api/profile — update discoverability / feed visibility (Phase 8G). Body: { userId, discoverable?, show_in_feed? }
  router.patch('/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = (req.body || {}) as { userId: string; discoverable?: boolean; show_in_feed?: boolean };
      const { userId, discoverable, show_in_feed } = body;
      if (!userId || typeof userId !== 'string' || !userId.trim()) {
        return res.status(400).json({ error: 'userId required' });
      }
      const u = await storage.getUser(userId.trim());
      if (!u) return res.status(404).json({ error: 'User not found' });
      await storage.updateUserDiscoverability(userId.trim(), { discoverable, show_in_feed });
      const updated = await storage.getUser(userId.trim());
      const userPayload: Record<string, unknown> = { id: updated!.id, displayName: updated!.displayName, handle: (updated as { handle?: string }).handle };
      const uExt = updated as unknown as { discoverable?: boolean; show_in_feed?: boolean };
      if (uExt?.discoverable !== undefined) userPayload.discoverable = uExt.discoverable;
      if (uExt?.show_in_feed !== undefined) userPayload.show_in_feed = uExt.show_in_feed;
      return res.status(200).json({ user: userPayload });
    } catch (e: any) {
      console.error('[compat] PATCH /profile', e);
      return res.status(500).json({ error: e?.message || 'Failed to update profile' });
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

  // GET /api/profile/:handle — lookup by handle (handle unique, optional)
  router.get('/profile/:handle', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const handle = Array.isArray(req.params.handle) ? req.params.handle[0] : req.params.handle;
      if (!handle || !handle.trim()) return res.status(400).json({ error: 'handle required' });
      const u = await storage.getUserByHandle(handle.trim());
      if (!u) return res.status(404).json({ error: 'User not found' });
      const chartId = await storage.getUserPrimaryChart(u.id) || storage.DEFAULT_PROFILE_CHART_ID;
      const chart = await getChartById(chartId);
      return res.status(200).json({
        user: { id: u.id, displayName: u.displayName, handle: u.handle },
        primaryChart: chart ? { id: chart.id, label: chart.label, date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone } : null,
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

  // GET /api/charts/:id
  router.get('/charts/:id', async (req: import('express').Request, res: import('express').Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chart = await getChartById(id);
    if (!chart) return res.status(404).json({ error: 'Chart not found' });
    return res.json(chart);
  });

  // POST /api/comparisons
  router.post('/comparisons', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = req.body || {};
      const {
        chartAId,
        chartBId,
        chartBInline,
        relationshipMode,
        generateComposition,
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
        generateComposition?: boolean;
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
      if (!relationshipMode || !isRelationshipMode(relationshipMode)) {
        return res.status(400).json({
          error: 'relationshipMode required',
          allowed: RELATIONSHIP_MODES
        });
      }

      const result = await createComparison({
        chartAId: effectiveChartAId,
        chartBId: effectiveChartBId || undefined,
        chartBInline: chartBInlineInput,
        relationshipMode,
        generateComposition: generateComposition !== false,
        fusion: fusionInput,
        createdBy: createdBy || undefined,
        expansionTier: parseExpansionTier(expansionTier ?? expansion_tier),
        // Preserve explicit seeker/target ids on the record when provided.
        seekerChartId: seekerChartId || undefined,
        targetChartId: targetChartId || undefined,
      } as any);

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
        relationshipMode: comparison.relationshipMode,
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
          relationshipMode: comparison.relationshipMode,
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
      relationshipMode: comparison.relationshipMode,
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
      const { seekerChartId, chart, intent, limit, facets, scope, groupId, seekerUserId } = body;
      if (!intent) {
        return res.status(400).json({ error: 'intent required' });
      }
      const validIntents = ['friendship', 'dating', 'collaboration', 'mentor', 'roommate', 'study'];
      if (!validIntents.includes(intent)) {
        return res.status(400).json({ error: 'Invalid intent', allowed: validIntents });
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
        facets,
        scope,
        groupId,
        seekerUserId
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
