/**
 * Phase 7 Transit QA — unit tests for overlay curation (ranking, cap, diversification, sentence caps).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-transit-overlay-curation.js
 */

import assert from 'node:assert/strict';
import { capToMaxSentences } from '../projection/rule-layer/claim-synthesize';
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
  assert.ok(selected.length <= 5);
}

function main() {
  testSentenceCap();
  testDirectionFilter();
  testTierPriority();
  testRankingOrder();
  testGlobalCap();
  testDiversificationPenalty();
  testQuietSkyFallback();
  console.log('[test-transit-overlay-curation] all tests passed');
}

main();
