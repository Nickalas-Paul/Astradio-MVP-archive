/**
 * Phase 0 repetition collapse: idempotency, full projection validation, canonical stability.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-repetition-collapse-phase0.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import type { CanonicalReportObject } from '../canonical/canonical-report-object';
import {
  collapseRepetitionPhase0,
  PoolNormSet,
  poolNormOccurrenceCountsOnReport,
  phase01PickRepairLiteral,
} from '../projection/rule-layer/repetition-collapse-phase0';
import { normalizeProjectionInput } from '../projection/rule-layer/normalize-input';
import { validateReportSections } from '../projection/rule-layer/validate-projection';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectionOptions } from '../projection/projection-types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-repetition-collapse-phase0] ${msg}`);
}

function snap(): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function profileFixture(): {
  core: ReturnType<typeof interpretCanonicalReportObject>;
  canonical: CanonicalReportObject;
} {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'rpt0');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['rpt0-hash'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  return { core: interpretCanonicalReportObject(canonical), canonical };
}

function assertFullProjection(
  label: string,
  core: ReturnType<typeof interpretCanonicalReportObject>,
  canonical: CanonicalReportObject,
  seed: string,
  options: ProjectionOptions
): void {
  const projectionOptions: ProjectionOptions = {
    ...options,
    ...insightProjectionOptionsFromCanonical(canonical),
  };
  const norm = normalizeProjectionInput(core, seed, projectionOptions);
  const tierForDensity = projectionOptions.surface === 'feed' ? (projectionOptions.tier ?? 'baseline') : norm.tierEff;
  const validateTier = projectionOptions.surface === 'feed' ? 'baseline' : norm.tierEff;
  const full = projectTextFromSemanticCore(core, seed, projectionOptions);
  if (full.length === 0) {
    assert(false, `${label}: projection returned no sections`);
  }

  /**
   * Phase 0.1 — on the compressed feed surface, each pool literal norm appears at most once on the report.
   * Full profile/aggregate fixtures may still carry duplicate pool literals when removal + strict repair
   * exhaust (no fallback); feed_card path satisfies the strict invariant in practice.
   */
  if (projectionOptions.surface === 'feed') {
    const poolCounts = poolNormOccurrenceCountsOnReport(full);
    for (const [, c] of poolCounts) {
      assert(c <= 1, `${label}: Phase 0.1 pool literal norm must appear at most once per report (got ${c})`);
    }
  }

  const tierRequested = projectionOptions.surface === 'feed' ? (projectionOptions.tier ?? 'baseline') : norm.tierEff;
  const vr =
    projectionOptions.surface === 'feed'
      ? validateReportSections(full, 'feed', 'baseline', core, tierRequested)
      : validateReportSections(full, projectionOptions.surface, validateTier, core, tierForDensity);
  assert(vr.ok, `${label}: validateReportSections after full projection: ${vr.violations.join(';')}`);

  const once = collapseRepetitionPhase0(full, {
    core,
    seed,
    surface: projectionOptions.surface,
    validateTier,
    tierForDensity,
  });
  const twice = collapseRepetitionPhase0(once, {
    core,
    seed,
    surface: projectionOptions.surface,
    validateTier,
    tierForDensity,
  });
  assert(JSON.stringify(once) === JSON.stringify(twice), `${label}: idempotency collapse(collapse(x))===collapse(x)`);
  const pc1 = poolNormOccurrenceCountsOnReport(once);
  const pc2 = poolNormOccurrenceCountsOnReport(twice);
  for (const n of pc1.keys()) {
    assert(
      pc1.get(n) === pc2.get(n),
      `${label}: Phase 0.1 pool norm counts stable under idempotent collapse`
    );
  }
}

function main(): void {
  /** Phase 0.1 — repair exhaustion: all PoolNormSet members marked present → no valid literal → null (detectable). */
  const exhausted = phase01PickRepairLiteral(
    'profile',
    { seed: 'phase01-exhaust', tierForDensity: 'baseline' },
    0,
    '',
    PoolNormSet,
    'significance',
    []
  );
  assert(exhausted === null, 'Phase 0.1: pickRepairLiteral must return null when pool norms exhausted on report');

  const { core, canonical } = profileFixture();
  const { core: core2 } = profileFixture();
  assert(
    core.provenance.source_object_hash === core2.provenance.source_object_hash,
    'semantic provenance stable for identical snapshot'
  );

  const seed = 'rpt0-seed';

  assertFullProjection('profile_A', core, canonical, seed, {
    phaseD: true,
    surface: 'profile',
    tier: 'baseline',
    narrativePlan: null,
  });

  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'rpt0');
  const canonicalDaily = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'home_daily',
    subject_ids: ['rpt0-daily'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const coreDaily = interpretCanonicalReportObject(canonicalDaily);
  assertFullProjection('daily', coreDaily, canonicalDaily, seed, {
    phaseD: true,
    surface: 'daily',
    tier: 'baseline',
    narrativePlan: null,
  });

  const h1 = canonical.object_identity_hash;
  projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'profile',
    tier: 'extended',
    narrativePlan: null,
    ...insightProjectionOptionsFromCanonical(canonical),
  });
  const canonical2 = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['rpt0-hash'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  assert(h1 === canonical2.object_identity_hash, 'canonical_object_identity unchanged across projection tier');

  console.log('[test-repetition-collapse-phase0] OK');
}

main();
