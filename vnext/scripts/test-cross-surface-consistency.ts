/**
 * Cross-surface authority: one SemanticCore, multiple projection surfaces — same listen core + claim head alignment.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-cross-surface-consistency.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForAggregate, buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { mergeFeatureVectors } from '../compat/fusion';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectFeedCardFromSemanticCore, projectTextFromSemanticCore } from '../projection/text-projection';
import {
  fullPerceptualListenSummaryFromCore,
  mapArc,
  mapDensity,
  mapTempo,
  mapTensionBias,
  mapTexture,
} from '../projection/rule-layer/audio-lexicon';
import type { SemanticCore } from '../semantic/semantic-core';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection, ProjectionOptions, ProjectionSurface } from '../projection/projection-types';

const TOP_N = 7;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-cross-surface-consistency] ${msg}`);
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

function snapWithOffset(delta: number): EphemerisSnapshot {
  const n = snap();
  return {
    ...n,
    lat: n.lat + delta,
    lon: n.lon + delta,
    planets: n.planets.map((p, i) => ({ ...p, lon: p.lon + delta * (i + 1) })),
  };
}

function collectReferencedClaimIds(sections: ProjectedExplanationSection[]): Set<string> {
  const out = new Set<string>();
  for (const s of sections) {
    for (const id of s.meta?.claimIdsReferenced ?? []) out.add(id);
  }
  return out;
}

function audioStagingBody(surface: string, sections: ProjectedExplanationSection[]): string {
  const a = sections.find((s) => s.id === 'audio_staging');
  assert(!!a, `${surface}: audio_staging missing`);
  return [a!.text, ...(a!.bullets ?? [])].join('\n');
}

function assertDeterministicProjectionRun(
  core: SemanticCore,
  seed: string,
  options: ProjectionOptions,
  label: string
): ProjectedExplanationSection[] {
  const run1 = projectTextFromSemanticCore(core, seed, options);
  const run2 = projectTextFromSemanticCore(core, seed, options);
  assert(JSON.stringify(run1) === JSON.stringify(run2), `${label}: deterministic projection`);
  return run1;
}

/** Feed cards omit `audio_staging`; forbid alternate-band listen phrases that would contradict `core.audio`. */
function assertNoContradictoryListenLexicon(core: SemanticCore, blob: string): void {
  const low = blob.toLowerCase();
  const a = core.audio;
  for (const code of ['TEMPO_HIGH', 'TEMPO_LOW', 'TEMPO_MED'] as const) {
    if (code === a.tempo_band) continue;
    const needle = mapTempo(code).toLowerCase();
    assert(!low.includes(needle), `feed: contradictory tempo clause (${code})`);
  }
  for (const code of ['DENSITY_DENSE', 'DENSITY_SPARSE', 'DENSITY_BALANCED'] as const) {
    if (code === a.density_band) continue;
    const needle = mapDensity(code).toLowerCase();
    assert(!low.includes(needle), `feed: contradictory density clause (${code})`);
  }
  for (const code of ['ARC_SURGE_RESOLVE', 'ARC_FALL', 'ARC_RISE', 'ARC_CYCLIC'] as const) {
    if (code === a.arc_bias) continue;
    const needle = mapArc(code).toLowerCase();
    assert(!low.includes(needle), `feed: contradictory arc clause (${code})`);
  }
  for (const code of ['AUDIO_TENSION_HIGH', 'AUDIO_TENSION_LOW', 'AUDIO_TENSION_MED'] as const) {
    if (code === a.tension_bias) continue;
    const needle = mapTensionBias(code).toLowerCase();
    assert(!low.includes(needle), `feed: contradictory tension clause (${code})`);
  }
  for (const code of [
    'REL_TEXTURE_FLUID',
    'REL_TEXTURE_CALL_RESPONSE',
    'REL_TEXTURE_STATIC',
    'REL_TEXTURE_NEUTRAL',
  ] as const) {
    if (code === a.relational_texture) continue;
    const needle = mapTexture(code).toLowerCase();
    assert(!low.includes(needle), `feed: contradictory texture clause (${code})`);
  }
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'xscs');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['xscs'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'xscs',
    compose_seed: 'xscs',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  assert(
    core.provenance.source_object_hash === canonical.object_identity_hash,
    'semantic core must pin canonical object_identity_hash'
  );
  const listen = fullPerceptualListenSummaryFromCore(core);
  const topIds = core.claims.slice(0, TOP_N).map((c) => c.claim_id);
  assert(topIds.length === Math.min(TOP_N, core.claims.length), 'fixture must expose TOP_N claims');

  const seed = 'xscs-fixed-seed';
  const specs: Array<{ surface: 'profile' | 'daily' | 'sandbox' | 'feed'; tier: 'extended' | 'baseline' }> = [
    { surface: 'profile', tier: 'extended' },
    { surface: 'daily', tier: 'extended' },
    { surface: 'sandbox', tier: 'extended' },
    { surface: 'feed', tier: 'baseline' },
  ];

  const claimHits: Set<string>[] = [];
  for (const { surface, tier } of specs) {
    const sections =
      surface === 'feed'
        ? projectFeedCardFromSemanticCore(core, seed)
        : projectTextFromSemanticCore(core, seed, {
            phaseD: true,
            surface,
            tier,
            narrativePlan: null,
          });
    const pv = sections[sections.length - 1]?.meta?.projection_validation;
    assert(!!pv && pv.ok === true, `${surface}: validation ok`);
    const body =
      surface === 'feed'
        ? sections.map((s) => [s.text, ...(s.bullets ?? [])].join('\n')).join('\n')
        : audioStagingBody(surface, sections);
    if (surface === 'feed') {
      assertNoContradictoryListenLexicon(core, body);
    } else {
      assert(body.includes(listen), `${surface}: fused listen must embed canonical five-clause summary`);
    }

    const refs = collectReferencedClaimIds(sections);
    if (surface === 'feed') {
      const head2 = topIds.slice(0, 2);
      for (const id of head2) assert(refs.has(id), `feed: must reference claim ${id}`);
    } else {
      for (const id of topIds) assert(refs.has(id), `${surface}: must reference claim ${id}`);
    }
    claimHits.push(new Set(topIds.filter((id) => refs.has(id))));
  }

  assert(
    claimHits[0]!.size === claimHits[1]!.size && claimHits[0]!.size === claimHits[2]!.size,
    'profile/daily/sandbox must surface the same TOP_N claim coverage'
  );
  for (const id of topIds) {
    assert(claimHits[0]!.has(id) && claimHits[1]!.has(id) && claimHits[2]!.has(id), `claim ${id} must appear on profile/daily/sandbox`);
  }

  const na = snap();
  const nb = snapWithOffset(3.5);
  const nc = snapWithOffset(8.25);
  const fva = encodeFeatures(na) as FeatureVec;
  const fvb = encodeFeatures(nb) as FeatureVec;
  const fvc = encodeFeatures(nc) as FeatureVec;
  const gg = guidanceFromFeatures(fva, na, 'xscs-group');
  const m12 = mergeFeatureVectors(fva, fvb, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });
  const merged3 = mergeFeatureVectors(m12, fvc, { relationshipMode: 'neutral', wA: 0.67, wB: 0.33 });
  const canonicalAgg = buildCanonicalReportForAggregate({
    kind: 'group',
    subject_ids: ['xscs-group'],
    participants: [
      { snapshot: na, featureVec: fva, role: 'primary' },
      { snapshot: nb, featureVec: fvb, role: 'member_i' },
      { snapshot: nc, featureVec: fvc, role: 'member_i' },
    ],
    composite: merged3 as FeatureVec,
    anchorIndex: 0,
    control_surface_hash: 'xscs-group',
    compose_seed: 'xscs-group',
    guidance: gg,
    relationalWeather: null,
  });
  const coreAgg = interpretCanonicalReportObject(canonicalAgg);
  const coreAgg2 = interpretCanonicalReportObject(canonicalAgg);
  assert(JSON.stringify(coreAgg.claims) === JSON.stringify(coreAgg2.claims), 'same canonical aggregate -> identical SemanticCore claims');
  assert(
    coreAgg.claims.every((c, i) => c.priority_rank === coreAgg2.claims[i]?.priority_rank),
    'same canonical aggregate -> identical claim priority ordering'
  );

  const matrixSurfaces: ProjectionSurface[] = ['profile', 'sandbox', 'group', 'campaign'];
  const matrixSeed = 'xscs-cross-surface-matrix';
  for (const dominantFlag of [false, true] as const) {
    const surfaceClaimHits = new Map<ProjectionSurface, Set<string>>();
    for (const surface of matrixSurfaces) {
      const options: ProjectionOptions = {
        phaseD: true,
        surface,
        tier: 'extended',
        narrativePlan: null,
        mechanismExpressionDominantSignals: dominantFlag,
        ...(surface === 'group' ? { participantCount: 3 } : {}),
      };
      const sections = assertDeterministicProjectionRun(
        coreAgg,
        `${matrixSeed}:${surface}:${String(dominantFlag)}`,
        options,
        `${surface}:dom=${String(dominantFlag)}`
      );
      const pv = sections[sections.length - 1]?.meta?.projection_validation;
      assert(!!pv && pv.ok === true, `${surface}:dom=${String(dominantFlag)} validation ok`);
      const refs = collectReferencedClaimIds(sections);
      const aggHead = coreAgg.claims.slice(0, TOP_N).map((c) => c.claim_id);
      const topHitCount = aggHead.filter((id) => refs.has(id)).length;
      assert(topHitCount >= 1, `${surface}:dom=${String(dominantFlag)} must reference at least one TOP_N claim`);
      assert(refs.has(aggHead[0]!), `${surface}:dom=${String(dominantFlag)} must reference top claim ${aggHead[0]}`);
      if (surface !== 'campaign') {
        const audio = audioStagingBody(surface, sections);
        assert(audio.length > 0, `${surface}:dom=${String(dominantFlag)} audio staging non-empty`);
      }
      surfaceClaimHits.set(surface, new Set(aggHead.filter((id) => refs.has(id))));
    }
    const profileHits = surfaceClaimHits.get('profile')!;
    for (const s of matrixSurfaces) {
      const hits = surfaceClaimHits.get(s)!;
      assert(hits.size >= 1, `${s}:dom=${String(dominantFlag)} has non-empty TOP_N coverage`);
      assert(profileHits.size >= 1, `profile:dom=${String(dominantFlag)} has non-empty TOP_N coverage`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        canonical_hash: canonical.object_identity_hash,
        canonical_aggregate_hash: canonicalAgg.object_identity_hash,
        top_claim_ids: topIds,
        surfaces: [...specs.map((s) => s.surface), 'profile', 'sandbox', 'group', 'campaign'],
      },
      null,
      2
    )
  );
}

main();
