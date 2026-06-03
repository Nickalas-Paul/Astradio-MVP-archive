/**
 * Sandbox API routes.
 * POST /api/sandbox/snapshot — preview-only (not on artifact critical path)
 * POST /api/sandbox/resolve — unified composition → canonical pipeline
 */

import type { SandboxBirth, SandboxOverrides, EphemerisSnapshot } from '../contracts';
import { generateSnapshotWithOverrides, hashBirth, hashOverrides, validateSandboxOverrides } from './sandbox-snapshot';
import { executeSandboxComposition } from './sandbox-composition-execute';
import { CANONICAL_INPUT_HASH_VERSION } from './sandbox-determinism';

const express = require('express') as typeof import('express');

async function fetchBaseSnapshot(birth: SandboxBirth): Promise<EphemerisSnapshot> {
  const PORT = process.env.PORT || '4000';
  const base = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || `http://localhost:${PORT}`;
  const timeStr = birth.time.length === 5 ? birth.time : birth.time.slice(0, 5);
  const params = new URLSearchParams({
    date: birth.date,
    time: timeStr,
    lat: String(birth.lat),
    lon: String(birth.lon),
  });
  const tz = typeof birth.tz === 'string' ? birth.tz.trim() : '';
  if (tz) params.set('timezone', tz);
  const houseSystem = typeof birth.houseSystem === 'string' ? birth.houseSystem.trim() : '';
  if (houseSystem) params.set('houseSystem', houseSystem);
  const url = `${base}/api/chart-snapshot?${params}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      `Failed to fetch base snapshot: ${res.status} ${res.statusText}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as EphemerisSnapshot;
}

function extractCanonicalObjectHashFromCompose(compose: { explanation?: { meta?: { canonical_object_hash?: string } } }): string | null {
  const h = compose?.explanation?.meta?.canonical_object_hash;
  return typeof h === 'string' ? h : null;
}

export function createSandboxRouter(): import('express').Router {
  const router = express.Router({ mergeParams: true });

  router.post('/sandbox/snapshot', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = req.body || {};
      const birth: SandboxBirth = body.birth;
      const overrides: SandboxOverrides = body.overrides || { planets: {} };

      if (!birth || !birth.date || !birth.time || typeof birth.lat !== 'number' || typeof birth.lon !== 'number') {
        return res.status(400).json({ error: 'birth object with date, time, lat, lon required' });
      }
      try {
        validateSandboxOverrides(overrides);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid overrides';
        return res.status(400).json({ error: msg });
      }

      let baseSnapshot: EphemerisSnapshot;
      try {
        baseSnapshot = await fetchBaseSnapshot(birth);
      } catch (fetchErr: unknown) {
        const fe = fetchErr as Error & { status?: number };
        const status = fe.status === 422 ? 422 : 500;
        return res.status(status).json({ error: fe.message || 'Failed to fetch base snapshot' });
      }
      const overriddenSnapshot = generateSnapshotWithOverrides(baseSnapshot, overrides);

      const birthHash = hashBirth(birth);
      const overridesHash = hashOverrides(overrides);
      const combinedHash = require('crypto')
        .createHash('sha256')
        .update(birthHash + overridesHash, 'utf8')
        .digest('hex');

      return res.status(200).json({
        snapshot: overriddenSnapshot,
        meta: {
          preview_only: true,
          baseHash: birthHash,
          overridesHash,
          combinedHash,
          canonical_input_hash_version: CANONICAL_INPUT_HASH_VERSION,
        },
      });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[sandbox] POST /sandbox/snapshot', err);
      return res.status(500).json({ error: err?.message || 'Failed to generate snapshot with overrides' });
    }
  });

  router.post('/sandbox/resolve', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const result = await executeSandboxComposition(req.body);
      if (!result.ok) {
        return res.status(result.status).json({
          ok: false,
          code: result.code,
          error: result.message,
        });
      }

      let canonical_object_hash: string | null = null;
      if (result.compose) {
        canonical_object_hash = extractCanonicalObjectHashFromCompose(result.compose as any);
      } else if (result.aggregate) {
        const meta = (result.aggregate as any).explanation?.meta;
        canonical_object_hash = typeof meta?.canonical_object_hash === 'string' ? meta.canonical_object_hash : null;
      }

      return res.status(200).json({
        ok: true,
        composition_mode: result.composition_mode,
        canonical_slot_order: result.canonical_slot_order,
        canonical_input_hash: result.canonical_input_hash,
        canonical_input_hash_version: result.canonical_input_hash_version,
        output_kind: result.output_kind,
        canonical_object_hash,
        compose: result.compose ?? undefined,
        aggregate: result.aggregate ?? undefined,
        ...(result.synastryNotice ? { synastryNotice: result.synastryNotice } : {}),
        ...(result.sandboxSynastryReport ? { sandboxSynastryReport: result.sandboxSynastryReport } : {}),
        ...(result.resolve_pipeline_version ? { resolve_pipeline_version: result.resolve_pipeline_version } : {}),
      });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[sandbox] POST /sandbox/resolve', err);
      return res.status(500).json({ ok: false, code: 'internal_error', error: err?.message || 'resolve failed' });
    }
  });

  return router;
}
