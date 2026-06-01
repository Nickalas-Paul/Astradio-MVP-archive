/**
 * Audio identity: SemanticCore.audio bands are stable across projection surfaces;
 * removed `audio_staging` / `musical` sections must not appear.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-audio-identity-consistency.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectFeedCardFromSemanticCore, projectTextFromSemanticCore } from '../projection/text-projection';
import { mapArc, mapDensity, mapTempo, mapTensionBias, mapTexture } from '../projection/rule-layer/audio-lexicon';
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

function assertNoRemovedAudioSections(sections: ProjectedExplanationSection[], label: string): void {
  assert(
    !sections.some((s) => s.id === 'audio_staging' || s.id === 'musical'),
    `${label}: must not emit audio_staging or musical`
  );
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
  const audioSig = JSON.stringify(core.audio);
  const seed = 'aident-seed';

  for (const { surface, tier } of [
    { surface: 'profile' as const, tier: 'extended' as const },
    { surface: 'daily' as const, tier: 'extended' as const },
    { surface: 'sandbox' as const, tier: 'extended' as const },
  ]) {
    const sec = projectTextFromSemanticCore(core, seed, { phaseD: true, surface, tier, narrativePlan: null });
    assertNoRemovedAudioSections(sec, surface);
    const blob = sec.map((s) => [s.text, ...(s.bullets ?? [])].join('\n')).join('\n');
    assertNoContradictoryListenLexicon(core, blob, surface);
    assert(JSON.stringify(core.audio) === audioSig, `${surface}: core.audio unchanged`);
  }

  const feed = projectFeedCardFromSemanticCore(core, seed);
  assertNoRemovedAudioSections(feed, 'feed');
  const feedBlob = feed.map((s) => [s.text, ...(s.bullets ?? [])].join('\n')).join('\n');
  assertNoContradictoryListenLexicon(core, feedBlob, 'feed');

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, audio: core.audio }, null, 2));
}

main();
