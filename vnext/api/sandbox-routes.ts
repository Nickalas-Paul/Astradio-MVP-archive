/**
 * Phase 4A — Sandbox API routes.
 * POST /api/sandbox/snapshot — generate snapshot with overrides
 * POST /api/sandbox/report — generate compose-free report from sandbox draft
 */

import type { SandboxBirth, SandboxOverrides, EphemerisSnapshot } from '../contracts';
import { generateSnapshotWithOverrides, hashBirth, hashOverrides, validateSandboxOverrides } from './sandbox-snapshot';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';

/**
 * Adapters may transform structure, never meaning.
 * Sandbox report explanation is TextProjection(SemanticCore) only; features/personality/guidance are mechanical support data, not authoritative readings.
 */

const express = require('express') as typeof import('express');

/**
 * Fetch base snapshot from /api/chart-snapshot endpoint.
 */
async function fetchBaseSnapshot(birth: SandboxBirth): Promise<EphemerisSnapshot> {
  const PORT = process.env.PORT || '4000';
  const base = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || `http://localhost:${PORT}`;
  const timeStr = birth.time.length === 5 ? birth.time : birth.time.slice(0, 5);
  const params = new URLSearchParams({
    date: birth.date,
    time: timeStr,
    lat: String(birth.lat),
    lon: String(birth.lon)
  });
  const url = `${base}/api/chart-snapshot?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch base snapshot: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function createSandboxRouter(): import('express').Router {
  const router = express.Router({ mergeParams: true });

  // POST /api/sandbox/snapshot
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

      // Fetch base snapshot
      const baseSnapshot = await fetchBaseSnapshot(birth);

      // Apply overrides
      const overriddenSnapshot = generateSnapshotWithOverrides(baseSnapshot, overrides);

      // Generate hashes
      const birthHash = hashBirth(birth);
      const overridesHash = hashOverrides(overrides);
      const combinedHash = require('crypto').createHash('sha256')
        .update(birthHash + overridesHash, 'utf8')
        .digest('hex');

      return res.status(200).json({
        snapshot: overriddenSnapshot,
        meta: {
          baseHash: birthHash,
          overridesHash,
          combinedHash
        }
      });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[sandbox] POST /sandbox/snapshot', err);
      return res.status(500).json({ error: err?.message || 'Failed to generate snapshot with overrides' });
    }
  });

  // POST /api/sandbox/report
  router.post('/sandbox/report', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = req.body || {};
      const birth: SandboxBirth = body.birth;
      const overrides: SandboxOverrides = body.overrides || { planets: {} };
      const seed: string | undefined = body.seed;

      if (!birth || !birth.date || !birth.time || typeof birth.lat !== 'number' || typeof birth.lon !== 'number') {
        return res.status(400).json({ error: 'birth object with date, time, lat, lon required' });
      }
      try {
        validateSandboxOverrides(overrides);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid overrides';
        return res.status(400).json({ error: msg });
      }

      // Fetch base snapshot
      const baseSnapshot = await fetchBaseSnapshot(birth);

      // Apply overrides
      const overriddenSnapshot = generateSnapshotWithOverrides(baseSnapshot, overrides);

      // Generate architecture from overridden snapshot
      const architecture = await generateArchitectureFromSnapshot(overriddenSnapshot, seed);

      // Generate combined hash
      const birthHash = hashBirth(birth);
      const overridesHash = hashOverrides(overrides);
      const combinedHash = require('crypto').createHash('sha256')
        .update(birthHash + overridesHash, 'utf8')
        .digest('hex');

      const controlHash = combinedHash;
      const composeSeed = typeof seed === 'string' && seed.length > 0 ? seed : combinedHash;
      const canonicalReport = buildCanonicalReportForSnapshotSurface({
        surface_kind: 'profile_natal',
        subject_ids: [controlHash],
        snapshot: architecture.snapshot,
        featureVec: architecture.features,
        control_surface_hash: controlHash,
        compose_seed: composeSeed,
        guidance: architecture.guidance,
      });
      const semanticCore = interpretCanonicalReportObject(canonicalReport);
      const projected = projectTextFromSemanticCore(semanticCore, controlHash);

      // Compose-free report (no music, no gates). relationalContext for reporting intake.
      return res.status(200).json({
        features: Array.from(architecture.features),
        personality: architecture.personality,
        guidance: architecture.guidance,
        explanation: {
          spec: 'UnifiedSpecV1.1',
          sections: projected.map((s) => ({
            id: s.id,
            title: s.title,
            text: s.text,
            bullets: s.bullets,
          })),
        },
        relationalContext: architecture.relationalContext,
        seed: architecture.seed,
        meta: {
          combinedHash,
          data_classification: {
            explanation: 'semantic_projection_v1',
            features_personality_guidance: 'mechanical_support_non_authoritative',
          },
          canonical_object_hash: canonicalReport.object_identity_hash,
        },
      });
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[sandbox] POST /sandbox/report', err);
      return res.status(500).json({ error: err?.message || 'Failed to generate sandbox report' });
    }
  });

  return router;
}
