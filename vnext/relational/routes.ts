/**
 * Phase 5 — Relational groups API routes.
 * Owner auth enforced on every handler. Uses lib/relational-store.
 * Owner identity: session only in prod; query/body/ensureDevUser only when
 * NODE_ENV=development AND ALLOW_DEV_USER_FALLBACK=true.
 */

import type { Request, Response } from 'express';

// Path from dist/vnext/vnext/relational/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const relationalStore = require('../../../../lib/relational-store');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../lib/vector-store');
import { populateChartVector } from '../compat/vector-cache';
import {
  hashVector64,
  scoreChartsByIntent,
} from './compatibility/score';
import {
  computeMultiChartCompatibility,
  MissingVectorsError,
} from './compatibility/multi-chart';
import { listIntentProfiles } from './intent-profiles';
import {
  CONSTELLATION_CENTROIDS,
} from './constellation/centroids';
import { getConstellationEligibility } from './constellation/eligibility';
import { resolveOwnerId } from './owner-resolve';
import { resolveGroupChartIds } from './groups/member-resolver';
import { buildGroupReport } from './reports/group-report';
import { composeGroupFromChartIds } from './composition/group-compose-adapter';

async function requireOwner(req: Request, res: Response): Promise<string | null> {
  try {
    const ownerId = await resolveOwnerId(req);
    if (!ownerId) {
      res.status(401).json({ error: 'owner_id required (authenticated session)' });
      return null;
    }
    return ownerId;
  } catch (e) {
    res.status(401).json({ error: 'Could not resolve owner' });
    return null;
  }
}

function createRelationalRouter(): import('express').Router {
  const express = require('express') as typeof import('express');
  const router = express.Router({ mergeParams: true });

  // GET /api/relational/intent-profiles — list intent profiles
  router.get('/relational/intent-profiles', (_req: Request, res: Response) => {
    try {
      const profiles = listIntentProfiles().map((p) => ({
        id: p.id,
        slug: p.slug,
        label: p.label,
        version: p.version,
        algorithm_version: p.algorithm_version,
        profile_hash: p.profile_hash,
      }));
      return res.status(200).json({ intent_profiles: profiles });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/intent-profiles', err);
      return res
        .status(500)
        .json({ error: 'internal_error', message: err?.message || 'Failed to list intent profiles' });
    }
  });

  // GET /api/relational/constellations — list constellation centroids
  router.get('/relational/constellations', (_req: Request, res: Response) => {
    try {
      const centroids = CONSTELLATION_CENTROIDS.map((c) => ({
        slug: c.slug,
        label: c.label,
        version: c.version,
        algorithm_version: c.algorithm_version,
        eligibility_threshold: c.eligibility_threshold,
      }));
      return res.status(200).json({ constellations: centroids });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/constellations', err);
      return res
        .status(500)
        .json({ error: 'internal_error', message: err?.message || 'Failed to list constellations' });
    }
  });

  // POST /api/relational/constellations/eligibility — eligibility for one chart
  router.post('/relational/constellations/eligibility', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const body = req.body || {};
    const chartId = typeof body.chartId === 'string' ? body.chartId.trim() : '';
    if (!chartId) {
      return res
        .status(400)
        .json({ error: 'validation_error', message: 'chartId is required' });
    }
    try {
      const result = await getConstellationEligibility(chartId);
      return res.status(200).json({ eligibility: result });
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message?.startsWith('Vector not found for chart ')) {
        return res.status(422).json({
          error: 'missing_vectors',
          message: err.message,
          missing_chart_ids: [chartId],
        });
      }
      console.error('[relational] POST /relational/constellations/eligibility', err);
      return res
        .status(500)
        .json({ error: 'internal_error', message: err?.message || 'Failed to compute eligibility' });
    }
  });

  // POST /api/relational/compatibility — 1:1 compatibility score
  router.post('/relational/compatibility', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const body = req.body || {};
    const chartIdA = typeof body.chartIdA === 'string' ? body.chartIdA.trim() : '';
    const chartIdB = typeof body.chartIdB === 'string' ? body.chartIdB.trim() : '';
    const intentProfileId = typeof body.intentProfileId === 'string' ? body.intentProfileId.trim() : '';
    if (!chartIdA || !chartIdB || !intentProfileId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'chartIdA, chartIdB, and intentProfileId are required',
      });
    }
    try {
      const result = await scoreChartsByIntent(chartIdA, chartIdB, intentProfileId);
      return res.status(200).json(result);
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message?.startsWith('Vector not found for chart ')) {
        const missingId = err.message.replace('Vector not found for chart ', '').split(';')[0].trim();
        return res.status(422).json({
          error: 'missing_vectors',
          message: err.message,
          missing_chart_ids: [missingId],
        });
      }
      if (err.message?.includes('Intent profile not found')) {
        return res.status(404).json({ error: 'not_found', message: err.message });
      }
      console.error('[relational] POST /relational/compatibility', err);
      return res
        .status(500)
        .json({ error: 'internal_error', message: err?.message || 'Failed to compute compatibility' });
    }
  });

  // POST /api/relational/compatibility/multi — multi-chart compatibility for explicit chartIds.
  router.post('/relational/compatibility/multi', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const body = req.body || {};
    const chartIds = Array.isArray(body.chartIds) ? body.chartIds : [];
    const intentProfileId = typeof body.intentProfileId === 'string' ? body.intentProfileId.trim() : '';

    if (!chartIds.length || !chartIds.every((id: unknown) => typeof id === 'string' && id.trim())) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'chartIds must be a non-empty array of strings',
      });
    }
    if (!intentProfileId) {
      return res
        .status(400)
        .json({ error: 'validation_error', message: 'intentProfileId required' });
    }

    try {
      const result = await computeMultiChartCompatibility(
        chartIds as string[],
        intentProfileId
      );
      return res.status(200).json(result);
    } catch (e: unknown) {
      const err = e as Error;
      if (e instanceof MissingVectorsError) {
        return res.status(422).json({
          error: 'missing_vectors',
          message: err.message,
          missing_chart_ids: e.missing_chart_ids,
        });
      }
      if (err.message?.includes('Intent profile not found')) {
        return res.status(404).json({ error: 'not_found', message: err.message });
      }
      console.error('[relational] POST /relational/compatibility/multi', err);
      return res.status(500).json({
        error: 'internal_error',
        message: err?.message || 'Failed to compute multi-chart compatibility',
      });
    }
  });

  // POST /api/relational/charts — create non-platform chart (family/friends). Single vector write path via populateChartVector.
  router.post('/relational/charts', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const body = req.body || {};
    const { label, date, time, lat, lon, timezone } = body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return res
        .status(400)
        .json({ error: 'validation_error', message: 'label required' });
    }
    if (!date || typeof date !== 'string' || !date.trim()) {
      return res
        .status(400)
        .json({ error: 'validation_error', message: 'date required' });
    }
    if (!time || typeof time !== 'string' || !time.trim()) {
      return res
        .status(400)
        .json({ error: 'validation_error', message: 'time required' });
    }
    const latNum = typeof lat === 'number' ? lat : parseFloat(lat);
    const lonNum = typeof lon === 'number' ? lon : parseFloat(lon);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'lat required, must be in [-90, 90]',
      });
    }
    if (!Number.isFinite(lonNum) || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'lon required, must be in [-180, 180]',
      });
    }

    let chart: { id: string; ownerId: string; label: string; date: string; time: string; lat: number; lon: number; timezone?: string; isNonPlatform: boolean };
    try {
      chart = await relationalStore.createNonPlatformChart({
        ownerId,
        label: label.trim(),
        date: String(date).slice(0, 10),
        time: String(time).slice(0, 5),
        lat: latNum,
        lon: lonNum,
        timezone: (timezone && String(timezone).trim()) || undefined,
      });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] POST /relational/charts create', err);
      return res.status(500).json({
        error: 'internal_error',
        message: err?.message || 'Failed to create chart',
      });
    }

    try {
      await populateChartVector(chart.id, undefined);
    } catch (e: unknown) {
      try {
        await relationalStore.deleteChart(chart.id);
      } catch {
        // best-effort rollback
      }
      const err = e as Error;
      console.error(
        '[relational] POST /relational/charts vectorize failed, chart rolled back',
        err
      );
      return res.status(500).json({
        error: 'internal_error',
        message: 'Vector population failed; chart not created',
      });
    }

    const vecRow = await vectorStore.getChartVector(chart.id);
    const encoderVersion = vecRow?.encoderVersion ?? 'v1';
    const vectorHash = vecRow ? hashVector64(vecRow.vector64) : '';

    return res.status(201).json({
      chart: {
        id: chart.id,
        owner_id: chart.ownerId,
        label: chart.label,
        date: chart.date,
        time: chart.time,
        lat: chart.lat,
        lon: chart.lon,
        timezone: chart.timezone ?? null,
        is_non_platform: chart.isNonPlatform,
      },
      vector: { encoder_version: encoderVersion, vector_hash: vectorHash, chart_id: chart.id },
    });
  });

  // POST /api/relational/groups — create
  router.post('/relational/groups', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    try {
      const body = req.body || {};
      const { slug, name, description } = body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res
          .status(400)
          .json({ error: 'validation_error', message: 'name required' });
      }
      const group = await relationalStore.createRelationalGroup({
        ownerId,
        slug: (slug && String(slug).trim()) || undefined,
        name: name.trim(),
        description: (description && String(description)) || '',
      });
      return res.status(201).json(group);
    } catch (e: unknown) {
      const err = e as Error;
      const isConflict = err?.message?.includes('unique') || (err as any)?.code === '23505';
      if (isConflict) return res.status(409).json({ error: 'Group slug already exists for owner' });
      console.error('[relational] POST /relational/groups', err);
      return res.status(500).json({ error: err?.message || 'Failed to create group' });
    }
  });

  // GET /api/relational/groups — list by owner
  router.get('/relational/groups', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    try {
      const groups = await relationalStore.listRelationalGroupsByOwner(ownerId);
      return res.status(200).json({ groups });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/groups', err);
      return res.status(500).json({
        error: 'internal_error',
        message: err?.message || 'Failed to list groups',
      });
    }
  });

  // GET /api/relational/groups/:id — get one
  router.get('/relational/groups/:id', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const group = await relationalStore.getRelationalGroupById(id);
      if (!group) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Group not found' });
      }
      if (group.ownerId !== ownerId) {
        return res.status(403).json({ error: 'forbidden', message: 'Not group owner' });
      }
      return res.status(200).json(group);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/groups/:id', err);
      return res.status(500).json({ error: err?.message || 'Failed to get group' });
    }
  });

  // PATCH /api/relational/groups/:id
  router.patch('/relational/groups/:id', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const body = req.body || {};
      const patch: Record<string, unknown> = {};
      if (body.name != null) patch.name = body.name;
      if (body.description != null) patch.description = body.description;
      if (body.slug != null) patch.slug = body.slug;
      const group = await relationalStore.updateRelationalGroup(id, ownerId, patch);
      if (!group) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Group not found or not owner' });
      }
      return res.status(200).json(group);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] PATCH /relational/groups/:id', err);
      return res.status(500).json({ error: err?.message || 'Failed to update group' });
    }
  });

  // DELETE /api/relational/groups/:id
  router.delete('/relational/groups/:id', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const ok = await relationalStore.deleteRelationalGroup(id, ownerId);
      if (!ok) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Group not found or not owner' });
      }
      return res.status(204).send();
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] DELETE /relational/groups/:id', err);
      return res.status(500).json({ error: err?.message || 'Failed to delete group' });
    }
  });

  // POST /api/relational/groups/:id/members — add member
  router.post('/relational/groups/:id/members', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const group = await relationalStore.getRelationalGroupById(groupId);
      if (!group || group.ownerId !== ownerId) {
        return res.status(403).json({ error: 'forbidden', message: 'Not group owner' });
      }
      const body = req.body || {};
      const { memberType, chartId, userId, label } = body;
      if (!chartId || typeof chartId !== 'string' || !chartId.trim()) {
        return res
          .status(400)
          .json({ error: 'validation_error', message: 'chartId required' });
      }
      const mt = memberType === 'non_platform' ? 'non_platform' : 'platform';
      const member = await relationalStore.addRelationalGroupMember({
        groupId,
        memberType: mt,
        chartId: chartId.trim(),
        userId: mt === 'platform' ? (userId && String(userId).trim()) || undefined : undefined,
        label: (label && String(label)) || undefined,
      });
      return res.status(201).json(member);
    } catch (e: unknown) {
      const err = e as Error;
      const isConflict = err?.message?.includes('unique') || (err as any)?.code === '23505';
      if (isConflict) {
        return res
          .status(409)
          .json({ error: 'conflict', message: 'Chart already in group' });
      }
      if (err?.message?.includes('platform member requires')) {
        return res.status(400).json({
          error: 'validation_error',
          message: err.message,
        });
      }
      console.error('[relational] POST /relational/groups/:id/members', err);
      return res.status(500).json({ error: err?.message || 'Failed to add member' });
    }
  });

  // GET /api/relational/groups/:id/members — list members (includes chartIds for resolver)
  router.get('/relational/groups/:id/members', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const members = await relationalStore.listRelationalGroupMembers(groupId, ownerId);
      if (!members) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Group not found or not owner' });
      }
      return res.status(200).json({ members });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] GET /relational/groups/:id/members', err);
      return res.status(500).json({ error: err?.message || 'Failed to list members' });
    }
  });

  // GET /api/relational/groups/:id/chart-ids — resolve chart IDs (member resolver)
  router.get('/relational/groups/:id/chart-ids', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const chartIds = await resolveGroupChartIds(groupId, ownerId);
      return res.status(200).json({ chart_ids: chartIds });
    } catch (e: unknown) {
      const err = e as Error;
      if (err?.message?.includes('not found')) {
        return res.status(404).json({ error: 'not_found', message: err.message });
      }
      if (err?.message?.includes('Unauthorized')) {
        return res.status(403).json({ error: 'forbidden', message: err.message });
      }
      if (err?.message?.includes('no members')) {
        return res
          .status(400)
          .json({ error: 'validation_error', message: err.message });
      }
      console.error('[relational] GET /relational/groups/:id/chart-ids', err);
      return res.status(500).json({ error: err?.message || 'Failed to resolve chart IDs' });
    }
  });

  // DELETE /api/relational/groups/:id/members/:memberId
  router.delete('/relational/groups/:id/members/:memberId', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const groupId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
    try {
      const ok = await relationalStore.removeRelationalGroupMember(groupId, memberId, ownerId);
      if (!ok) {
        return res
          .status(404)
          .json({ error: 'not_found', message: 'Member not found or not group owner' });
      }
      return res.status(204).send();
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[relational] DELETE /relational/groups/:id/members/:memberId', err);
      return res.status(500).json({ error: err?.message || 'Failed to remove member' });
    }
  });

  // POST /api/relational/reports/group — build group compatibility report
  router.post('/relational/reports/group', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const body = req.body || {};
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const chartIdsInput = Array.isArray(body.chartIds) ? body.chartIds : undefined;
    const intentProfileId = typeof body.intentProfileId === 'string' ? body.intentProfileId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : undefined;

    if (!intentProfileId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'intentProfileId is required',
      });
    }
    if (!groupId && (!chartIdsInput || !chartIdsInput.length)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Either groupId or chartIds[] is required',
      });
    }

    try {
      let chartIds: string[];
      if (groupId) {
        chartIds = await resolveGroupChartIds(groupId, ownerId);
      } else {
        const ids = chartIdsInput as unknown[];
        if (!ids.every((id) => typeof id === 'string' && (id as string).trim())) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'chartIds must be a non-empty array of strings',
          });
        }
        chartIds = (ids as string[]).map((id) => id.trim());
      }

      const multi = await computeMultiChartCompatibility(chartIds, intentProfileId);
      const report = buildGroupReport(multi, { title });
      return res.status(200).json(report);
    } catch (e: unknown) {
      const err = e as Error;
      if (e instanceof MissingVectorsError) {
        return res.status(422).json({
          error: 'missing_vectors',
          message: err.message,
          missing_chart_ids: e.missing_chart_ids,
        });
      }
      if (err.message?.includes('Intent profile not found')) {
        return res.status(404).json({ error: 'not_found', message: err.message });
      }
      if (err.message?.includes('not found or not owner') || err.message?.includes('Unauthorized')) {
        return res.status(403).json({ error: 'forbidden', message: err.message });
      }
      console.error('[relational] POST /relational/reports/group', err);
      return res.status(500).json({
        error: 'internal_error',
        message: err?.message || 'Failed to build group report',
      });
    }
  });

  // POST /api/relational/compose/group — group composition
  router.post('/relational/compose/group', async (req: Request, res: Response) => {
    const ownerId = await requireOwner(req, res);
    if (!ownerId) return;
    const body = req.body || {};
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    const chartIdsInput = Array.isArray(body.chartIds) ? body.chartIds : undefined;

    if (!groupId && (!chartIdsInput || !chartIdsInput.length)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Either groupId or chartIds[] is required',
      });
    }

    try {
      let chartIds: string[];
      if (groupId) {
        chartIds = await resolveGroupChartIds(groupId, ownerId);
      } else {
        const ids = chartIdsInput as unknown[];
        if (!ids.every((id) => typeof id === 'string' && (id as string).trim())) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'chartIds must be a non-empty array of strings',
          });
        }
        chartIds = (ids as string[]).map((id) => id.trim());
      }

      const result = await composeGroupFromChartIds(chartIds, { groupId: groupId || undefined });
      return res.status(200).json(result);
    } catch (e: unknown) {
      const err = e as Error;
      if (e instanceof MissingVectorsError) {
        return res.status(422).json({
          error: 'missing_vectors',
          message: err.message,
          missing_chart_ids: e.missing_chart_ids,
        });
      }
      if (err.message?.includes('chartIds required for group compose')) {
        return res.status(400).json({
          error: 'validation_error',
          message: err.message,
        });
      }
      if (err.message?.includes('not found or not owner') || err.message?.includes('Unauthorized')) {
        return res.status(403).json({ error: 'forbidden', message: err.message });
      }
      console.error('[relational] POST /relational/compose/group', err);
      return res.status(500).json({
        error: 'internal_error',
        message: err?.message || 'Failed to compose group',
      });
    }
  });

  return router;
}

export { createRelationalRouter, resolveGroupChartIds };
