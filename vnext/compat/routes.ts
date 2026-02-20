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
      const q = (req.query.q as string) || '';
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
      const cursor = (req.query.cursor as string) || undefined;
      const result = await searchDirectoryUsers({ q, limit, cursor });
      return res.status(200).json(result);
    } catch (e: any) {
      console.error('[compat] GET /community/search', e);
      return res.status(500).json({ error: e?.message || 'Search failed' });
    }
  });

  // GET /api/profile/chart?chartId= (optional; default = chart_profile_default). V1: chartId must be in directory allowlist.
  router.get('/profile/chart', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartId = (req.query.chartId as string) || storage.DEFAULT_PROFILE_CHART_ID;
      if (!(await isDirectoryChartId(chartId))) {
        return res.status(403).json({ error: 'Chart not in public directory' });
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
