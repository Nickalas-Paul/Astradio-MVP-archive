/**
 * Community Compatibility V1 — API route handlers.
 * Mount under /api (e.g. app.use('/api', compatRouter) then POST /api/charts, GET /api/charts/:id, etc.)
 */

import * as storage from './storage';
import { getChartById, createChart } from './chart-store';
import { createComparison } from './comparison-service';
import { getProfileChartExplainer } from './profile-chart';
import { getCompatMatches, type CompatMatchMode } from './matches';
import { searchDirectoryUsers, isDirectoryChartId } from './directory';
import type { RelationshipMode } from './types';
import { createGroupProfile, type GroupsProfileRequest } from '../api/community-groups';
import { computeCompatibilityIntent, type CompatibilityIntentRequest } from '../api/compatibility-intent';
import { populateChartVector } from './vector-cache';

const express = require('express') as typeof import('express');
const RELATIONSHIP_MODES: RelationshipMode[] = ['friends', 'rivals', 'lovers', 'mentor', 'collaborator', 'neutral'];
const COMPAT_MODES: CompatMatchMode[] = ['friend', 'lover', 'rival'];

function isRelationshipMode(s: string): s is RelationshipMode {
  return RELATIONSHIP_MODES.includes(s as RelationshipMode);
}

function isCompatMode(s: string): s is CompatMatchMode {
  return COMPAT_MODES.includes(s as CompatMatchMode);
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
    storage.ensureDefaultProfileChart().catch((e) => console.error('[compat] seed ensureDefaultProfileChart', e));
    storage.ensureMatchCandidateCharts().catch((e) => console.error('[compat] seed ensureMatchCandidateCharts', e));
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

  // POST /api/profile — create user (dev, no auth). Body: { displayName, handle?, email?, chart?: { label, date, time, lat, lon } }
  router.post('/profile', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = (req.body || {}) as { displayName: string; handle?: string; email?: string; chart?: { label: string; date: string; time: string; lat: number; lon: number } };
      const { displayName, handle, email, chart: chartInput } = body;
      if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        return res.status(400).json({ error: 'displayName required' });
      }
      const user = await storage.createUser({ displayName: displayName.trim(), handle: handle?.trim() || undefined, email: email?.trim() || undefined });
      console.log('[compat][profile][createUser]', {
        userId: user.id,
        handle: (user as any)?.handle,
        success: true,
      });
      let primaryChart: import('./types').Chart | null = null;
      if (chartInput && chartInput.label && chartInput.date && chartInput.time && Number.isFinite(chartInput.lat) && Number.isFinite(chartInput.lon)) {
        primaryChart = await storage.createChart({
          ownerId: user.id,
          label: chartInput.label,
          date: String(chartInput.date).slice(0, 10),
          time: String(chartInput.time).slice(0, 5),
          lat: Number(chartInput.lat),
          lon: Number(chartInput.lon),
        });
        console.log('[compat][profile][createChart]', {
          userId: user.id,
          chartId: primaryChart.id,
          path: 'inline',
          success: true,
        });
        await linkUserPrimaryChartWithRetry(user.id, primaryChart.id);
        // Vector population only on chart create (this path created a new chart)
        if (process.env.POSTGRES_URL) {
          populateChartVector(primaryChart.id, primaryChart.snapshotHash).catch((err) => {
            console.warn('[compat] vector populate after chart create:', err?.message);
          });
        }
      } else {
        const defaultChart = await storage.ensureDefaultProfileChart();
        console.log('[compat][profile][createChart]', {
          userId: user.id,
          chartId: defaultChart.id,
          path: 'default',
          success: true,
        });
        await linkUserPrimaryChartWithRetry(user.id, defaultChart.id);
        primaryChart = defaultChart;
      }
      return res.status(201).json({
        user: { id: user.id, displayName: user.displayName, handle: user.handle },
        primaryChart: primaryChart ? { id: primaryChart.id, label: primaryChart.label, date: primaryChart.date, time: primaryChart.time, lat: primaryChart.lat, lon: primaryChart.lon, timezone: primaryChart.timezone } : null,
      });
    } catch (e: any) {
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
      const { ownerId, label, date, time, lat, lon, timezone, snapshotHash } = body;
      if (!label || !date || !time || Number.isFinite(lat) === false || Number.isFinite(lon) === false) {
        return res.status(400).json({
          error: 'Missing or invalid fields',
          message: 'Required: label, date, time, lat, lon'
        });
      }
      const chart = await createChart({
        ownerId: ownerId || undefined,
        label,
        date: String(date).slice(0, 10),
        time: String(time).slice(0, 5),
        lat: Number(lat),
        lon: Number(lon),
        timezone: timezone || undefined,
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
      const { chartAId, chartBId, chartBInline, relationshipMode, generateComposition, fusion, createdBy } = body;
      if (!chartAId) {
        return res.status(400).json({ error: 'chartAId required' });
      }
      if (!chartBId && !chartBInline) {
        return res.status(400).json({
          error: 'Either chartBId or chartBInline (date, time, lat, lon) required'
        });
      }
      if (!relationshipMode || !isRelationshipMode(relationshipMode)) {
        return res.status(400).json({
          error: 'relationshipMode required',
          allowed: RELATIONSHIP_MODES
        });
      }
      const result = await createComparison({
        chartAId,
        chartBId: chartBId || undefined,
        chartBInline: chartBInline || undefined,
        relationshipMode,
        generateComposition: generateComposition !== false,
        fusion: fusion && Number.isFinite(fusion.wA) && Number.isFinite(fusion.wB) ? { wA: fusion.wA, wB: fusion.wB } : undefined,
        createdBy: createdBy || undefined
      });
      const response: Record<string, unknown> = {
        ...result.comparison,
        planHash: result.planHash,
        compositionId: result.compositionId
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

  // GET /api/comparisons/:id
  router.get('/comparisons/:id', async (req: import('express').Request, res: import('express').Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const comparison = await storage.getComparison(id);
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    return res.json(comparison);
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
