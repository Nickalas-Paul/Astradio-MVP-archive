/**
 * Audio identity: fused five-clause listen is identical for one core across projection surfaces.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-audio-identity-consistency.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectFeedCardFromSemanticCore, projectTextFromSemanticCore } from '../projection/text-projection';
import {
  AUDIO_LEXICON_CLAUSE_STRINGS,
  fullPerceptualListenSummaryFromCore,
  mapArc,
  mapDensity,
  mapTempo,
  mapTensionBias,
  mapTexture,
} from '../projection/rule-layer/audio-lexicon';
import type { SemanticCore } from '../semantic/semantic-core';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection } from '../projection/projection-types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-audio-identity-consistency] ${msg}`);
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

function audioBlob(sections: ProjectedExplanationSection[]): string {
  const a = sections.find((s) => s.id === 'audio_staging');
  assert(!!a, 'audio_staging required');
  return [a!.text, ...(a!.bullets ?? [])].join('\n').toLowerCase();
}

function assertNoContradictoryListenLexicon(core: SemanticCore, blob: string, label: string): void {
  const low = blob.toLowerCase();
  const a = core.audio;
  for (const code of ['TEMPO_HIGH', 'TEMPO_LOW', 'TEMPO_MED'] as const) {
    if (code === a.tempo_band) continue;
    assert(!low.includes(mapTempo(code).toLowerCase()), `${label}: contradictory tempo (${code})`);
  }
  for (const code of ['DENSITY_DENSE', 'DENSITY_SPARSE', 'DENSITY_BALANCED'] as const) {
    if (code === a.density_band) continue;
    assert(!low.includes(mapDensity(code).toLowerCase()), `${label}: contradictory density (${code})`);
  }
  for (const code of ['ARC_SURGE_RESOLVE', 'ARC_FALL', 'ARC_RISE', 'ARC_CYCLIC'] as const) {
    if (code === a.arc_bias) continue;
    assert(!low.includes(mapArc(code).toLowerCase()), `${label}: contradictory arc (${code})`);
  }
  for (const code of ['AUDIO_TENSION_HIGH', 'AUDIO_TENSION_LOW', 'AUDIO_TENSION_MED'] as const) {
    if (code === a.tension_bias) continue;
    assert(!low.includes(mapTensionBias(code).toLowerCase()), `${label}: contradictory tension (${code})`);
  }
  for (const code of [
    'REL_TEXTURE_FLUID',
    'REL_TEXTURE_CALL_RESPONSE',
    'REL_TEXTURE_STATIC',
    'REL_TEXTURE_NEUTRAL',
  ] as const) {
    if (code === a.relational_texture) continue;
    assert(!low.includes(mapTexture(code).toLowerCase()), `${label}: contradictory texture (${code})`);
  }
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'aident');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['aident'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'aident',
    compose_seed: 'aident',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  const expected = fullPerceptualListenSummaryFromCore(core);
  const seed = 'aident-seed';

  const blobs: string[] = [];
  for (const { surface, tier } of [
    { surface: 'profile' as const, tier: 'extended' as const },
    { surface: 'daily' as const, tier: 'extended' as const },
    { surface: 'sandbox' as const, tier: 'extended' as const },
  ]) {
    const sec = projectTextFromSemanticCore(core, seed, { phaseD: true, surface, tier, narrativePlan: null });
    const b = audioBlob(sec);
    assert(b.includes(expected.toLowerCase()), `${surface}: must contain canonical fused listen`);
    blobs.push(b);
  }
  const feed = projectFeedCardFromSemanticCore(core, seed);
  const feedBlob = feed.map((s) => [s.text, ...(s.bullets ?? [])].join('\n')).join('\n');
  assertNoContradictoryListenLexicon(core, feedBlob, 'feed');

  const extraLex = AUDIO_LEXICON_CLAUSE_STRINGS.filter((clause) => {
    const low = clause.toLowerCase();
    return !expected.toLowerCase().includes(low);
  });
  for (const clause of extraLex) {
    const needle = clause.toLowerCase();
    for (let i = 0; i < blobs.length; i++) {
      const label = ['profile', 'daily', 'sandbox'][i]!;
      const without = blobs[i]!.replace(expected.toLowerCase(), ' ');
      assert(
        !without.includes(needle),
        `${label}: no extra listen-clause phrase outside fused block (${clause.slice(0, 40)}…)`
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, fused_len: expected.length }, null, 2));
}

main();
