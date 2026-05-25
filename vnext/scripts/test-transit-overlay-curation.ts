/**
 * Phase 7 Transit QA — unit tests for overlay curation (ranking, cap, diversification, sentence caps).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-transit-overlay-curation.js
 */

import assert from 'node:assert/strict';
import { encodeFeatures } from '../feature-encode';
import type { FeatureVec } from '../contracts';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForOverlay } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { capToMaxSentences } from '../projection/rule-layer/claim-synthesize';
import { assemblePhaseDSections } from '../projection/rule-layer/assemble-sections';
import { buildTransitListenMetaphor } from '../projection/rule-layer/transit-listen-metaphor';
import { normalizeProjectionInput } from '../projection/rule-layer/normalize-input';
import { classifyTemporalVoice } from '../projection/rule-layer/temporal-classify';
import { buildPlacementKeys } from '../projection/placement-keys';
import {
  applyDiversificationPenalty,
  compareRankedActivations,
  filterNatalToTransitAspects,
  getNatalBodyTierPriority,
  MAX_ACTIVATIONS_PER_DAY,
  rankTransitActivations,
  selectTopActivationsWithDiversity,
  sortRankedActivations,
} from '../projection/rule-layer/transit-overlay-curation';
import type { EphemerisSnapshot } from '../contracts';
import type { AspectTypeKey } from '../aspect-engine';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';

function directed(
  bodyA: string,
  bodyB: string,
  type: AspectTypeKey,
  priorityBase: number,
  orb = 1
): DirectedSnapshotAspect {
  return {
    bodyA: bodyA.toLowerCase(),
    bodyB: bodyB.toLowerCase(),
    type,
    orb,
    exactAngle: 0,
    dynamics: 'flowing',
    strength: 0.5,
    exactness: priorityBase,
    priorityBase,
    sourceSlotIndex: 0,
    targetSlotIndex: 1,
  };
}

function testSentenceCap() {
  const raw = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4.';
  const capped = capToMaxSentences(raw, 2);
  assert.equal(capped, 'Sentence 1. Sentence 2.');
}

function testSonicCapOneSentence() {
  const raw = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4.';
  const capped = capToMaxSentences(raw, 1);
  assert.equal(capped, 'Sentence 1.');
}

function testDirectionFilter() {
  const aspects = [
    directed('SUN', 'JUPITER', 'trine', 0.8),
    { ...directed('JUPITER', 'SUN', 'square', 0.9), sourceSlotIndex: 1, targetSlotIndex: 0 },
    directed('MOON', 'SATURN', 'square', 0.7),
  ];
  const filtered = filterNatalToTransitAspects(aspects);
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1));
}

function testTierPriority() {
  assert.equal(getNatalBodyTierPriority('SUN'), 0);
  assert.equal(getNatalBodyTierPriority('PLUTO'), 3);
}

function testRankingOrder() {
  const aspects = [
    directed('PLUTO', 'URANUS', 'conjunction', 0.95),
    directed('SUN', 'JUPITER', 'trine', 0.5),
    directed('MOON', 'SATURN', 'square', 0.8),
    directed('SUN', 'MARS', 'sextile', 0.9),
  ];
  const ranked = rankTransitActivations(aspects);
  assert.ok(ranked.length >= 1);
  const sunFirst = ranked.findIndex((r) => r.natalBody === 'SUN');
  const plutoIdx = ranked.findIndex((r) => r.natalBody === 'PLUTO');
  if (sunFirst >= 0 && plutoIdx >= 0) {
    assert.ok(sunFirst < plutoIdx, 'Luminaries tier before outer planets');
  }
  if (ranked.length >= 2 && ranked[0]!.natalBody === 'SUN') {
    assert.ok(ranked[0]!.priorityScore >= ranked[1]!.priorityScore || ranked[1]!.tierPriority > ranked[0]!.tierPriority);
  }
}

function testGlobalCap() {
  const many: DirectedSnapshotAspect[] = [];
  for (let i = 0; i < 30; i++) {
    const bodies = ['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN'];
    const trans = ['JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO', 'MARS', 'VENUS'];
    many.push(
      directed(bodies[i % bodies.length]!, trans[i % trans.length]!, 'trine', 0.5 + (i % 10) / 20, i * 0.1)
    );
  }
  const ranked = rankTransitActivations(many);
  const selected = selectTopActivationsWithDiversity(ranked, ranked, MAX_ACTIVATIONS_PER_DAY);
  assert.ok(selected.length <= MAX_ACTIVATIONS_PER_DAY);
}

function testDiversificationPenalty() {
  const ranked = rankTransitActivations([
    directed('MOON', 'JUPITER', 'trine', 0.9),
    directed('SUN', 'SATURN', 'square', 0.7),
  ]);
  if (ranked.length < 2) return;
  const moonHit = ranked.find((r) => r.natalBody === 'MOON' && r.transitBody === 'JUPITER');
  const sunHit = ranked.find((r) => r.natalBody === 'SUN');
  if (!moonHit || !sunHit) return;

  const previous = {
    calendarDate: '2026-05-24',
    aspectKeys: [moonHit.aspectKey],
    natalBodies: ['MOON'],
    transitBodies: ['JUPITER'],
    generatedAt: '2026-05-24T12:00:00Z',
  };
  const penalized = applyDiversificationPenalty(ranked, previous);
  const moonPen = penalized.find((r) => r.aspectKey === moonHit.aspectKey)!;
  const sunPen = penalized.find((r) => r.aspectKey === sunHit.aspectKey)!;
  assert.ok(moonPen.priorityScore < moonHit.priorityScore);
  assert.equal(sunPen.priorityScore, sunHit.priorityScore);
  const sorted = sortRankedActivations(penalized);
  assert.ok(compareRankedActivations(sorted[0]!, sorted[1]!) <= 0);
}

function testQuietSkyFallback() {
  const ranked = rankTransitActivations([
    directed('SUN', 'JUPITER', 'trine', 0.6),
    directed('MOON', 'SATURN', 'square', 0.5),
  ]);
  const penalized = applyDiversificationPenalty(ranked, {
    calendarDate: '2026-05-24',
    aspectKeys: ranked.map((r) => r.aspectKey),
    natalBodies: ranked.map((r) => r.natalBody),
    transitBodies: ranked.map((r) => r.transitBody),
    generatedAt: '2026-05-24T12:00:00Z',
  });
  const sortedPen = sortRankedActivations(penalized);
  const selected = selectTopActivationsWithDiversity(sortedPen, ranked, 5);
  assert.ok(selected.length >= 1);
  assert.ok(selected.length <= MAX_ACTIVATIONS_PER_DAY);
}

function makeNatalTaurusSun10th(): EphemerisSnapshot {
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];
  return {
    ts: '1990-05-15T12:00:00Z',
    tz: 'America/Chicago',
    lat: 29.4,
    lon: -98.5,
    houseSystem: 'placidus',
    planets: [
      { name: 'sun', lon: 285 },
      { name: 'moon', lon: 288 },
      { name: 'jupiter', lon: 100 },
    ],
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0, earth: 2, air: 0, water: 0 },
  };
}

function makeTransitSkySun8th(): EphemerisSnapshot {
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120,
  ];
  return {
    ts: '2026-05-24T12:00:00Z',
    tz: 'America/Chicago',
    lat: 29.4,
    lon: -98.5,
    houseSystem: 'placidus',
    planets: [
      { name: 'sun', lon: 350 },
      { name: 'moon', lon: 20 },
      { name: 'jupiter', lon: 200 },
    ],
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0, earth: 0, air: 1, water: 0 },
  };
}

function testNatalPlacementUsesNatalSnapshot() {
  const natal = makeNatalTaurusSun10th();
  const transit = makeTransitSkySun8th();
  const natalSun = buildPlacementKeys(natal).find((p) => p.planet === 'SUN');
  const transitSun = buildPlacementKeys(transit).find((p) => p.planet === 'SUN');
  assert.ok(natalSun && transitSun, 'placement keys exist');
  assert.equal(natalSun.house, 10, 'natal Sun in 10th house');
  assert.notEqual(transitSun.house, 10, 'transit cusps must not place Sun in 10th');
  assert.notEqual(natalSun.house, transitSun.house, 'fixture: natal vs transit Sun houses differ');
  /** Overlay header must use natal snapshot keys, not transit. */
  assert.equal(natalSun.house, 10);
}

function testGlobalCapAndDedupe() {
  const duped = [
    directed('SUN', 'JUPITER', 'sextile', 0.9),
    directed('SUN', 'JUPITER', 'sextile', 0.4),
    directed('MOON', 'SATURN', 'square', 0.85),
    directed('MERCURY', 'VENUS', 'trine', 0.8),
    directed('MARS', 'PLUTO', 'opposition', 0.75),
    directed('VENUS', 'NEPTUNE', 'conjunction', 0.7),
    directed('JUPITER', 'URANUS', 'trine', 0.65),
  ];
  const ranked = rankTransitActivations(duped);
  const keys = ranked.map((r) => r.aspectKey);
  assert.equal(new Set(keys).size, keys.length, 'rank dedupes aspect keys');
  const selected = selectTopActivationsWithDiversity(ranked, ranked, MAX_ACTIVATIONS_PER_DAY);
  assert.ok(selected.length <= MAX_ACTIVATIONS_PER_DAY);
}

function testGlobalCapSelectionCount() {
  const manyAspects: DirectedSnapshotAspect[] = [];
  const bodies = ['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS'];
  const trans = ['JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO'];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = 0; j < trans.length; j++) {
      manyAspects.push(directed(bodies[i]!, trans[j]!, 'trine', 0.9 - i * 0.05 - j * 0.01));
    }
  }
  const filtered = filterNatalToTransitAspects(manyAspects);
  const ranked = rankTransitActivations(filtered);
  const selected = selectTopActivationsWithDiversity(ranked, ranked, MAX_ACTIVATIONS_PER_DAY);
  assert.equal(selected.length, MAX_ACTIVATIONS_PER_DAY, 'busy sky still caps at 3 globally');
}

function sumSectionCharacters(
  sections: Array<{ text?: string; bullets?: string[] }>
): number {
  return sections.reduce((n, s) => n + (s.text?.length ?? 0) + (s.bullets?.join('').length ?? 0), 0);
}

function testBuildTransitListenMetaphor() {
  const ranked = rankTransitActivations([directed('SUN', 'JUPITER', 'sextile', 0.9)]);
  const core = interpretCanonicalReportObject(
    buildCanonicalReportForOverlay({
      subject_ids: ['sonic-test'],
      natalSnapshot: makeNatalTaurusSun10th(),
      natalFeatureVec: encodeFeatures(makeNatalTaurusSun10th()) as FeatureVec,
      transitSnapshot: makeTransitSkySun8th(),
      transitFeatureVec: encodeFeatures(makeTransitSkySun8th()) as FeatureVec,
      control_surface_hash: 'sonic-test',
      compose_seed: 'sonic-test',
      guidance: guidanceFromFeatures(
        encodeFeatures(makeNatalTaurusSun10th()) as FeatureVec,
        makeNatalTaurusSun10th(),
        'sonic-test'
      ),
    })
  );
  const text = buildTransitListenMetaphor(core, ranked);
  assert.ok(text.length > 0, 'listen metaphor has content');
  assert.ok(text.length <= 500, `listen metaphor <= 500 chars (got ${text.length})`);
  assert.ok(text.includes("today's transits"), 'temporal framing present');
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  assert.ok(sentences.length <= 3, `at most 3 sentences (got ${sentences.length})`);
}

function testOverlaySonicAssembly() {
  const natal = makeNatalTaurusSun10th();
  const transit = makeTransitSkySun8th();
  const fv = encodeFeatures(natal) as FeatureVec;
  const fvt = encodeFeatures(transit) as FeatureVec;
  const g = guidanceFromFeatures(fv, natal, 'overlay-sonic');
  const core = interpretCanonicalReportObject(
    buildCanonicalReportForOverlay({
      subject_ids: ['overlay-sonic'],
      natalSnapshot: natal,
      natalFeatureVec: fv,
      transitSnapshot: transit,
      transitFeatureVec: fvt,
      control_surface_hash: 'overlay-sonic',
      compose_seed: 'overlay-sonic',
      guidance: g,
    })
  );
  const aspects: DirectedSnapshotAspect[] = [
    directed('SUN', 'JUPITER', 'sextile', 0.95),
    directed('SUN', 'SATURN', 'square', 0.94),
    directed('SUN', 'URANUS', 'trine', 0.93),
    directed('MOON', 'SATURN', 'square', 0.9),
    directed('MERCURY', 'VENUS', 'trine', 0.85),
    directed('MARS', 'PLUTO', 'opposition', 0.8),
    directed('VENUS', 'NEPTUNE', 'conjunction', 0.75),
  ];
  const norm = normalizeProjectionInput(core, 'overlay-sonic', {
    phaseD: true,
    surface: 'overlay_pair',
    tier: 'extended',
  });
  const sections = assemblePhaseDSections({
    core,
    seed: 'overlay-sonic',
    options: {
      phaseD: true,
      surface: 'overlay_pair',
      tier: 'extended',
      snapshot: natal,
      secondarySnapshot: transit,
      pairInteractionAspectsV2: aspects,
      transitCalendarDate: '2026-05-24',
    },
    tierMetaRequested: norm.tierMetaRequested,
    tierEff: norm.tierEff,
    surface: 'overlay_pair',
    temporalBucket: classifyTemporalVoice(core),
  });

  const coreIdentity = sections.find((s) => s.id === 'core_identity');
  const activationText = coreIdentity?.text ?? '';
  const sonicLineCount = (activationText.match(/\*\*Listen for:\*\*/g) || []).length;
  assert.ok(sonicLineCount > 0, 'at least one sonic line present');
  assert.ok(sonicLineCount <= MAX_ACTIVATIONS_PER_DAY, 'no more than max activations sonic lines');

  const todaysSound = sections.find((s) => s.id === 'todays_sound');
  assert.ok(todaysSound !== undefined, 'todays_sound section exists');
  assert.ok((todaysSound?.text?.length ?? 0) > 0, 'todays_sound has content');
  assert.ok((todaysSound?.text?.length ?? 0) <= 500, 'todays_sound under 500 char ceiling');

  const totalChars = sumSectionCharacters(sections);
  assert.ok(totalChars <= 8000, `total chars ${totalChars} must not exceed 8k ceiling`);
  assert.ok(totalChars >= 1200, `total chars ${totalChars} must include activations + sonic + closing`);
}

function testGracefulMissingSonic() {
  const ranked = rankTransitActivations([directed('SUN', 'JUPITER', 'sextile', 0.9)]);
  const core = interpretCanonicalReportObject(
    buildCanonicalReportForOverlay({
      subject_ids: ['no-sonic'],
      natalSnapshot: makeNatalTaurusSun10th(),
      natalFeatureVec: encodeFeatures(makeNatalTaurusSun10th()) as FeatureVec,
      transitSnapshot: makeTransitSkySun8th(),
      transitFeatureVec: encodeFeatures(makeTransitSkySun8th()) as FeatureVec,
      control_surface_hash: 'no-sonic',
      compose_seed: 'no-sonic',
      guidance: guidanceFromFeatures(
        encodeFeatures(makeNatalTaurusSun10th()) as FeatureVec,
        makeNatalTaurusSun10th(),
        'no-sonic'
      ),
    })
  );
  const text = buildTransitListenMetaphor(core, ranked);
  assert.ok(text.length > 0, 'fallback listen text when clips present');
  const empty = buildTransitListenMetaphor(core, []);
  assert.ok(empty.includes("today's transits"), 'empty activations still temporal');
}

function main() {
  testSentenceCap();
  testSonicCapOneSentence();
  testDirectionFilter();
  testTierPriority();
  testRankingOrder();
  testGlobalCap();
  testGlobalCapAndDedupe();
  testDiversificationPenalty();
  testQuietSkyFallback();
  testNatalPlacementUsesNatalSnapshot();
  testGlobalCapSelectionCount();
  testBuildTransitListenMetaphor();
  testOverlaySonicAssembly();
  testGracefulMissingSonic();
  console.log('[test-transit-overlay-curation] all tests passed');
}

main();
