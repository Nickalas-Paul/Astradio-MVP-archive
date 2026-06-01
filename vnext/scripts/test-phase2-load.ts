/**
 * Phase 2 — load metrics, wrapper repetition, audio duplication, sentence length.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-phase2-load.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection } from '../projection/projection-types';
import {
  audioDuplicationFamilies,
  sentenceLengthStats,
  totalLoadScore,
  countSentenceLoads,
  validatePhase2Sections,
  wrapperRepetitionMetric,
} from '../projection/rule-layer/phase2-sentence-load';

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

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-phase2-load] ${msg}`);
}

function allText(sections: ProjectedExplanationSection[]): string {
  return sections.map((s) => [s.title, s.text, ...(s.bullets ?? [])].join('\n')).join('\n');
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p2load');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['test-hash'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  const sections = projectTextFromSemanticCore(core, 'p2seed', {
    surface: 'profile',
    tier: 'extended',
    phaseD: true,
    ...insightProjectionOptionsFromCanonical(canonical),
  });

  validatePhase2Sections(sections, 'p2seed');

  const text = allText(sections);
  const wrap = wrapperRepetitionMetric(text);
  assert(wrap <= 0.2, `wrapper metric too high: ${wrap}`);

  const fam = audioDuplicationFamilies(text, true);
  assert(fam.tempo <= 1, `tempo family repeats: ${fam.tempo}`);
  assert(fam.density <= 1, `density family repeats: ${fam.density}`);
  assert(fam.tension <= 1, `tension family repeats: ${fam.tension}`);
  assert(fam.arc <= 1, `arc family repeats: ${fam.arc}`);

  const { avgWords, longRatio } = sentenceLengthStats(text);
  assert(avgWords <= 28, `avg words too high: ${avgWords}`);
  assert(longRatio <= 0.15, `long sentence ratio too high: ${longRatio}`);

  let maxL = 0;
  for (const s of sections) {
    for (const sent of s.text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)) {
      const t = totalLoadScore(countSentenceLoads(sent, 'template'));
      maxL = Math.max(maxL, t);
    }
  }
  assert(maxL <= 2, `max sentence load ${maxL} exceeds 2`);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { ok: true, wrapperRepetition: wrap, audioFamilies: fam, avgWords, longRatio, maxLoad: maxL },
      null,
      2
    )
  );
}

main();
