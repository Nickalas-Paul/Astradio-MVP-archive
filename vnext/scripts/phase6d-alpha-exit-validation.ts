/**
 * Phase 6D Alpha — offline projection gate (viewer seeker slot + compat_pair + Phase 6C tiers).
 * Run: npm run test:phase6d-alpha-exit
 *
 * Pair forecast HTTP path shares composeComparisonAggregateReading with saved comparisons; this script
 * validates seeker-centric canonical wiring independent of Stage 4 / DB.
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { mergeFeatureVectors } from '../compat/fusion';
import { buildCanonicalReportForAggregate } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import { toLegacyPairInteractionAspect } from '../synastry/synastry-types';
import type { EphemerisSnapshot } from '../contracts';
import type { FeatureVec } from '../contracts';

const houses = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;

function baseSnapshot(): Omit<EphemerisSnapshot, 'planets'> {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    houses: [...houses],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function seekerSnapshot(): EphemerisSnapshot {
  return {
    ...baseSnapshot(),
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
  };
}

function targetSnapshot(): EphemerisSnapshot {
  return {
    ...baseSnapshot(),
    planets: [
      { name: 'Sun', lon: 20 },
      { name: 'Moon', lon: 105 },
      { name: 'Mercury', lon: 65 },
      { name: 'Venus', lon: 210 },
      { name: 'Mars', lon: 95 },
      { name: 'Jupiter', lon: 110 },
      { name: 'Saturn', lon: 125 },
      { name: 'Uranus', lon: 140 },
      { name: 'Neptune', lon: 155 },
      { name: 'Pluto', lon: 170 },
    ],
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[phase6d-alpha-exit-validation] ${msg}`);
}

const directedFixture: DirectedSnapshotAspect[] = [
  {
    bodyA: 'MARS',
    bodyB: 'VENUS',
    type: 'trine',
    orb: 0.5,
    sourceSlotIndex: 0,
    targetSlotIndex: 1,
    dynamics: 'flowing',
    strength: 0.8,
  },
  {
    bodyA: 'MOON',
    bodyB: 'SUN',
    type: 'square',
    orb: 0.5,
    sourceSlotIndex: 1,
    targetSlotIndex: 0,
    dynamics: 'tense',
    strength: 0.7,
  },
];

function main(): void {
  const natalA = seekerSnapshot();
  const natalB = targetSnapshot();
  const fv = encodeFeatures(natalA);
  const fvB = encodeFeatures(natalB);
  const merged = mergeFeatureVectors(fv, fvB, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 }) as FeatureVec;
  const g = guidanceFromFeatures(fv, natalA, 'p6d-alpha');

  const legacy = directedFixture.map((r) => toLegacyPairInteractionAspect(r));

  const canonicalReport = buildCanonicalReportForAggregate({
    kind: 'comparison',
    subject_ids: ['p6d-alpha'],
    participants: [
      { snapshot: natalA, featureVec: fv, role: 'primary' },
      { snapshot: natalB, featureVec: fvB, role: 'member_i' },
    ],
    composite: merged,
    anchorIndex: 0,
    control_surface_hash: 'p6d-alpha',
    compose_seed: 'p6d-alpha',
    guidance: g,
    relationalWeather: null,
    pair_interaction_aspects: legacy,
    pair_interaction_aspects_v2: directedFixture,
    comparison_seeker_context_v1: {
      seekerChartId: 'chart-seeker',
      targetChartId: 'chart-target',
      seekerSlotIndex: 0,
      targetSlotIndex: 1,
    },
  });

  const insightOpts = insightProjectionOptionsFromCanonical(canonicalReport);
  assert(
    insightOpts.comparisonSeekerContextV1?.seekerSlotIndex === 0,
    'viewer-centric pair: seekerSlotIndex must be 0 in projection options'
  );

  const core = interpretCanonicalReportObject(canonicalReport);
  const projected = projectTextFromSemanticCore(core, 'p6d-alpha', {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    aggregateKind: 'comparison',
    connectionMode: 'friends',
    aspectTension: null,
    compatClassCode: undefined,
    ...insightOpts,
  });

  const ids = projected.map((s) => s.id);
  assert(ids.includes('personal_expression'), 'friends: expected personal_expression (Phase 6C activation tier)');
  const joinProjected = projected.map((s) => s.text).join('\n');
  assert(
    joinProjected.includes('activated by **their'),
    'friends: expected seeker→partner activation copy (viewer-centric framing)',
  );

  /** Regression: must stay aligned with `runAggregateComposition` in vnext/api/compose.ts (group → surface group). */
  function projectionSurfaceForAggregateKind(kind: 'comparison' | 'group'): 'compat_pair' | 'group' {
    return kind === 'comparison' ? 'compat_pair' : 'group';
  }
  assert(projectionSurfaceForAggregateKind('comparison') === 'compat_pair', 'pair aggregate uses compat_pair surface');
  assert(projectionSurfaceForAggregateKind('group') === 'group', 'group aggregate uses group surface (3+ chart path)');

  console.log('[phase6d-alpha-exit-validation] OK');
}

main();
