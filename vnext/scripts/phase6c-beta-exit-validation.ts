/**
 * Phase 6C-Beta exit criteria — offline projection checks (no HTTP server).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/phase6c-beta-exit-validation.js
 *
 * Mirrors compose: aggregate canonical + insightProjectionOptionsFromCanonical + projectTextFromSemanticCore.
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
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { composeSynastryMepAspectParagraph } from '../projection/insight-library/synastry-aspect-library-render';

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

/** Slot 0 (seeker): Mars 90° — trine to partner Venus at 210°. Sun 15° — square to partner Moon at 105°. */
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

/** Slot 1 (target): Venus 210° (trine seeker Mars); Moon 105° (square to seeker Sun). */
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
  if (!cond) throw new Error(`[phase6c-beta-exit-validation] ${msg}`);
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

function runCompat(opts: { relationshipMode: 'friends' | 'lovers' }): ReturnType<typeof projectTextFromSemanticCore> {
  const natalA = seekerSnapshot();
  const natalB = targetSnapshot();
  const fv = encodeFeatures(natalA);
  const fvB = encodeFeatures(natalB);
  const merged = mergeFeatureVectors(fv, fvB, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 }) as FeatureVec;
  const g = guidanceFromFeatures(fv, natalA, 'p6c-beta');

  const legacy = directedFixture.map((r) => toLegacyPairInteractionAspect(r));

  const canonicalReport = buildCanonicalReportForAggregate({
    kind: 'comparison',
    subject_ids: ['p6c-beta'],
    participants: [
      { snapshot: natalA, featureVec: fv, role: 'primary' },
      { snapshot: natalB, featureVec: fvB, role: 'member_i' },
    ],
    composite: merged,
    anchorIndex: 0,
    control_surface_hash: 'p6c-beta',
    compose_seed: 'p6c-beta',
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

  const core = interpretCanonicalReportObject(canonicalReport);
  const insightOpts = insightProjectionOptionsFromCanonical(canonicalReport);

  return projectTextFromSemanticCore(core, 'p6c-beta', {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    aggregateKind: 'comparison',
    connectionMode: opts.relationshipMode,
    aspectTension: null,
    ...insightOpts,
    compatClassCode: undefined,
  });
}

function runLegacyNoV2(): ReturnType<typeof projectTextFromSemanticCore> {
  const natal = seekerSnapshot();
  const natal2 = targetSnapshot();
  const fv = encodeFeatures(natal);
  const fv2 = encodeFeatures(natal2);
  const merged = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 }) as FeatureVec;
  const g = guidanceFromFeatures(fv, natal, 'p6c-legacy');

  const canonicalReport = buildCanonicalReportForAggregate({
    kind: 'comparison',
    subject_ids: ['p6c-legacy'],
    participants: [
      { snapshot: natal, featureVec: fv, role: 'primary' },
      { snapshot: natal2, featureVec: fv2, role: 'member_i' },
    ],
    composite: merged,
    anchorIndex: 0,
    control_surface_hash: 'p6c-legacy',
    compose_seed: 'p6c-legacy',
    guidance: g,
    relationalWeather: null,
    pair_interaction_aspects: directedFixture.map(toLegacyPairInteractionAspect),
  });

  const core = interpretCanonicalReportObject(canonicalReport);
  const insightOpts = insightProjectionOptionsFromCanonical(canonicalReport);

  return projectTextFromSemanticCore(core, 'p6c-legacy', {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    aggregateKind: 'comparison',
    connectionMode: 'friends',
    aspectTension: null,
    ...insightOpts,
  });
}

function main(): void {
  // 1 + 2: Activations + seeker-only direction
  const friends = runCompat({ relationshipMode: 'friends' });
  const idsFriends = friends.map((s) => s.id);
  assert(idsFriends.includes('personal_expression'), 'friends: expected personal_expression tier');
  const joinFriends = friends.map((s) => s.text).join('\n');
  assert(joinFriends.includes('activated by **their'), 'friends: expected partner activation line');
  assert(
    joinFriends.toLowerCase().includes('mars') && joinFriends.toLowerCase().includes('venus'),
    'friends: expected Mars/Venus copy from seeker→target trine',
  );
  assert(
    !joinFriends.includes('Your moon is activated'),
    'friends: B→A MOON–SUN square must not appear as seeker activations',
  );

  // 3: Relationship mode variants differ
  const lovers = runCompat({ relationshipMode: 'lovers' });
  const peFriends = friends.find((s) => s.id === 'personal_expression')?.text ?? '';
  const peLovers = lovers.find((s) => s.id === 'personal_expression')?.text ?? '';
  assert(peFriends.length > 0 && peLovers.length > 0, 'both modes need personal_expression body');
  assert(peFriends !== peLovers, 'lovers vs friends: personal_expression copy should differ');

  // 4: Legacy — no V2 / no seeker context → no activation tier ids from Phase 6C path
  const legacy = runLegacyNoV2();
  const legacyIds = legacy.map((s) => s.id);
  assert(
    !legacyIds.includes('personal_expression') && !legacyIds.includes('core_identity'),
    `legacy: must not inject Phase 6C activation tier sections; got ${legacyIds.join(',')}`,
  );
  assert(legacyIds.includes('connection_structure') || legacyIds.includes('relational_field'), 'legacy: spine still present');

  // Gamma G1–G3: library synthesis, deduped signatures, ordering (V2 path)
  const synA = friends.find((s) => s.id === 'synthesis_a');
  assert(synA?.title === 'Synastry synthesis', 'Gamma G1: synthesis_a title');
  assert(
    (synA?.text ?? '').toLowerCase().includes('mars') && (synA?.text ?? '').toLowerCase().includes('venus'),
    'Gamma G1: synthesis_a uses library copy for Mars–Venus',
  );
  const synB = friends.find((s) => s.id === 'synthesis_b');
  if (synB) {
    assert(synB.title === 'Extended synastry', 'Gamma G1: synthesis_b title when section emitted');
  }

  const venusMarsKey = buildAspectKey('MARS', 'VENUS', 'trine');
  const vmInsight = getAspectInsight(venusMarsKey);
  if (!vmInsight) throw new Error('[phase6c-beta-exit-validation] Gamma G2: lookup Venus–Mars trine insight');
  const libSnippet = composeSynastryMepAspectParagraph(vmInsight, 'friendship').slice(0, 140).trim();
  const sigText = friends.find((s) => s.id === 'signatures')?.text ?? '';
  assert(
    libSnippet.length > 20 && !sigText.includes(libSnippet),
    'Gamma G2: signatures must not repeat synastry library slice (dedupe)',
  );

  const ordered = friends.map((s) => s.id);
  const iSyn = ordered.indexOf('synthesis_a');
  const iConn = ordered.indexOf('connection_structure');
  assert(iSyn >= 0 && iConn >= 0 && iSyn < iConn, 'Gamma G3: synthesis_a before connection_structure');

  const legacySyn = legacy.find((s) => s.id === 'synthesis_a');
  assert(legacySyn?.title === 'Synthesis', 'Gamma legacy: semantic synthesis title when no V2');

  console.log('[phase6c-beta-exit-validation] OK');
}

main();
