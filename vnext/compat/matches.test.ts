/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/compat/matches.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import { buildAspectKey } from '../projection/insight-library/insight-library-index';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import { hash32, pickThreeDistinctAspects } from './matches';

function mockAspect(
  bodyA: string,
  bodyB: string,
  type: DirectedSnapshotAspect['type'],
  exactness: number
): DirectedSnapshotAspect {
  return {
    bodyA,
    bodyB,
    type,
    orb: 1,
    exactness,
    sourceSlotIndex: 0,
    targetSlotIndex: 1,
  };
}

function patternKey(
  picked: ReturnType<typeof pickThreeDistinctAspects>
): string {
  const part = (a: DirectedSnapshotAspect | undefined) =>
    a ? buildAspectKey(a.bodyA, a.bodyB, a.type) : 'none';
  return `${part(picked.forThem)}|${part(picked.forYou)}|${part(picked.together)}`;
}

const VARIETY_POOL: DirectedSnapshotAspect[] = [
  mockAspect('moon', 'moon', 'sextile', 0.85),
  mockAspect('venus', 'moon', 'trine', 0.8),
  mockAspect('moon', 'venus', 'sextile', 0.75),
  mockAspect('sun', 'mars', 'square', 0.9),
  mockAspect('mercury', 'venus', 'opposition', 0.7),
  mockAspect('mars', 'mars', 'trine', 0.65),
  mockAspect('sun', 'sun', 'conjunction', 0.6),
];

const BATCH_POOL: DirectedSnapshotAspect[] = [
  mockAspect('moon', 'moon', 'sextile', 0.85),
  mockAspect('venus', 'moon', 'trine', 0.8),
  mockAspect('sun', 'mars', 'square', 0.9),
  mockAspect('mercury', 'venus', 'opposition', 0.7),
  mockAspect('mars', 'mars', 'trine', 0.65),
  mockAspect('sun', 'moon', 'sextile', 0.62),
  mockAspect('sun', 'venus', 'trine', 0.61),
  mockAspect('moon', 'mercury', 'square', 0.58),
  mockAspect('venus', 'mercury', 'sextile', 0.57),
  mockAspect('mars', 'venus', 'opposition', 0.55),
  mockAspect('mercury', 'mercury', 'conjunction', 0.54),
  mockAspect('sun', 'mercury', 'trine', 0.53),
];

test('hash32 is deterministic', () => {
  assert.strictEqual(hash32('seeker:candidate:forThem'), hash32('seeker:candidate:forThem'));
  assert.notStrictEqual(hash32('a'), hash32('b'));
});

test('different chart pairs produce varied aspect patterns', () => {
  const results = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const picked = pickThreeDistinctAspects(
      VARIETY_POOL,
      VARIETY_POOL,
      'seeker-123',
      `candidate-${i}`
    );
    results.add(patternKey(picked));
  }
  assert.ok(results.size >= 7, `expected >=7 unique patterns, got ${results.size}`);
});

test('same chart pair produces consistent aspects', () => {
  const first = pickThreeDistinctAspects(VARIETY_POOL, VARIETY_POOL, 'seeker-123', 'candidate-456');
  for (let i = 0; i < 4; i++) {
    const again = pickThreeDistinctAspects(VARIETY_POOL, VARIETY_POOL, 'seeker-123', 'candidate-456');
    assert.strictEqual(patternKey(again), patternKey(first));
  }
});

test('batch deduplication limits repetition across cards', () => {
  const batchUsedKeys = new Set<string>();
  const aspectFrequency = new Map<string, number>();

  for (let i = 0; i < 10; i++) {
    const picked = pickThreeDistinctAspects(
      BATCH_POOL,
      BATCH_POOL,
      'seeker-123',
      `candidate-${i}`,
      batchUsedKeys
    );
    for (const aspect of [picked.forThem, picked.forYou, picked.together]) {
      if (!aspect) continue;
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      aspectFrequency.set(key, (aspectFrequency.get(key) ?? 0) + 1);
      batchUsedKeys.add(key);
    }
  }

  const maxFrequency = Math.max(...aspectFrequency.values(), 0);
  assert.ok(maxFrequency <= 5, `max frequency ${maxFrequency} should be <= 5`);
  assert.ok(
    aspectFrequency.size >= 12,
    `expected >=12 unique aspect keys, got ${aspectFrequency.size}`
  );
});
