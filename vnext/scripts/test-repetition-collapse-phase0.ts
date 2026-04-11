/**
 * Phase 0 repetition collapse: idempotency, full projection validation, canonical stability.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-repetition-collapse-phase0.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { collapseRepetitionPhase0 } from '../projection/rule-layer/repetition-collapse-phase0';
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

function coreFromSnap(): ReturnType<typeof interpretCanonicalReportObject> {
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
  return interpretCanonicalReportObject(canonical);
}

function assertFullProjection(
  label: string,
  core: ReturnType<typeof interpretCanonicalReportObject>,
  seed: string,
  options: ProjectionOptions
): void {
  const norm = normalizeProjectionInput(core, seed, options);
  const tierForDensity = options.surface === 'feed' ? (options.tier ?? 'baseline') : norm.tierEff;
  const validateTier = options.surface === 'feed' ? 'baseline' : norm.tierEff;
  const full = projectTextFromSemanticCore(core, seed, options);
  const tierRequested = options.surface === 'feed' ? (options.tier ?? 'baseline') : norm.tierEff;
  const vr =
    options.surface === 'feed'
      ? validateReportSections(full, 'feed', 'baseline', core, tierRequested)
      : validateReportSections(full, options.surface, validateTier, core, tierForDensity);
  assert(vr.ok, `${label}: validateReportSections after full projection: ${vr.violations.join(';')}`);

  const twice = collapseRepetitionPhase0(full, {
    core,
    seed,
    surface: options.surface,
    validateTier,
    tierForDensity,
  });
  assert(JSON.stringify(full) === JSON.stringify(twice), `${label}: idempotency collapse(collapse(x))===collapse(x)`);
}

function main(): void {
  const core = coreFromSnap();
  const core2 = coreFromSnap();
  assert(
    core.provenance.source_object_hash === core2.provenance.source_object_hash,
    'semantic provenance stable for identical snapshot'
  );

  const seed = 'rpt0-seed';

  assertFullProjection('profile_A', core, seed, {
    phaseD: true,
    surface: 'profile',
    tier: 'baseline',
    narrativePlan: null,
  });

  assertFullProjection('profile_A_overlay_Ct', core, seed, {
    phaseD: true,
    surface: 'daily',
    tier: 'baseline',
    narrativePlan: null,
  });

  assertFullProjection('compat_A_B', core, seed, {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'baseline',
    narrativePlan: null,
    connectionMode: 'friends',
  });

  assertFullProjection('group_A_B_N', core, seed, {
    phaseD: true,
    surface: 'group',
    tier: 'baseline',
    narrativePlan: null,
    participantCount: 4,
  });

  assertFullProjection('feed', core, seed, {
    phaseD: true,
    surface: 'feed',
    tier: 'baseline',
    narrativePlan: null,
  });

  assertFullProjection('campaign', core, seed, {
    phaseD: true,
    surface: 'campaign',
    tier: 'baseline',
    narrativePlan: null,
  });

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
  const h1 = canonical.object_identity_hash;
  projectTextFromSemanticCore(interpretCanonicalReportObject(canonical), seed, {
    phaseD: true,
    surface: 'profile',
    tier: 'extended',
    narrativePlan: null,
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
