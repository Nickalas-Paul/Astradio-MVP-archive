/**
 * Aggregate authority: same A+B comparison canonical is stable; compat_pair and sandbox surfaces
 * share the same fused listen identity drawn from one aggregate SemanticCore.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-aggregate-consistency.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForAggregate } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { mergeFeatureVectors } from '../compat/fusion';
import { fullPerceptualListenSummaryFromCore } from '../projection/rule-layer/audio-lexicon';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection } from '../projection/projection-types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-aggregate-consistency] ${msg}`);
}

function snap(d = 0): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128 + d,
    lon: -74.006 + d,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 + d },
      { name: 'Moon', lon: 45 + d },
      { name: 'Mercury', lon: 60 + d },
      { name: 'Venus', lon: 75 + d },
      { name: 'Mars', lon: 90 + d },
      { name: 'Jupiter', lon: 105 + d },
      { name: 'Saturn', lon: 120 + d },
      { name: 'Uranus', lon: 135 + d },
      { name: 'Neptune', lon: 150 + d },
      { name: 'Pluto', lon: 165 + d },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function claimIds(core: ReturnType<typeof interpretCanonicalReportObject>): string {
  return core.claims.map((c) => c.claim_id).join(',');
}

function audioBlob(sections: ProjectedExplanationSection[]): string {
  const a = sections.find((s) => s.id === 'audio_staging');
  assert(!!a, 'audio_staging required');
  return [a!.text, ...(a!.bullets ?? [])].join('\n');
}

function collectAllClaimRefs(sections: ProjectedExplanationSection[]): Set<string> {
  const out = new Set<string>();
  for (const s of sections) {
    for (const id of s.meta?.claimIdsReferenced ?? []) out.add(id);
  }
  return out;
}

function main(): void {
  const natal = snap(0);
  const natal2 = snap(5);
  const fv = encodeFeatures(natal) as FeatureVec;
  const fv2 = encodeFeatures(natal2) as FeatureVec;
  const g = guidanceFromFeatures(fv, natal, 'aggc');
  const merged = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });

  const params = {
    kind: 'comparison' as const,
    subject_ids: ['aggc'],
    participants: [
      { snapshot: natal, featureVec: fv, role: 'primary' as const },
      { snapshot: natal2, featureVec: fv2, role: 'member_i' as const },
    ],
    composite: merged as FeatureVec,
    anchorIndex: 0,
    control_surface_hash: 'aggc',
    compose_seed: 'aggc',
    guidance: g,
    relationalWeather: null,
  };

  const c1 = buildCanonicalReportForAggregate(params);
  const c2 = buildCanonicalReportForAggregate(params);
  assert(c1.object_identity_hash === c2.object_identity_hash, 'aggregate canonical hash must be stable across rebuild');

  const core = interpretCanonicalReportObject(c1);
  const listen = fullPerceptualListenSummaryFromCore(core);
  const seed = 'aggc-proj';

  const compat = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    connectionMode: 'lovers',
  });
  const sandbox = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'sandbox',
    tier: 'extended',
    narrativePlan: null,
  });

  for (const [label, sec] of [
    ['compat_pair', compat],
    ['sandbox', sandbox],
  ] as const) {
    const pv = sec[sec.length - 1]?.meta?.projection_validation;
    assert(!!pv && pv.ok === true, `${label}: validation ok`);
    assert(audioBlob(sec).includes(listen), `${label}: fused listen must match aggregate core`);
  }

  const core2 = interpretCanonicalReportObject(c2);
  assert(claimIds(core) === claimIds(core2), 'interpreted aggregate claim spine must match on rebuild');

  const compatB = projectTextFromSemanticCore(core, 'aggc-alt-seed', {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    connectionMode: 'lovers',
  });

  assert(
    collectAllClaimRefs(compat).size === collectAllClaimRefs(compatB).size &&
      [...collectAllClaimRefs(compat)].every((id) => collectAllClaimRefs(compatB).has(id)),
    'compat_pair: different projection seeds must preserve referenced claim set'
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, object_identity_hash: c1.object_identity_hash }, null, 2));
}

main();
