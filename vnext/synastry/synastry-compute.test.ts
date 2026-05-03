/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/synastry/synastry-compute.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import type { EphemerisSnapshot } from '../contracts';
import { ASPECT_CONFIG } from '../aspect-engine';
import {
  buildSynastryDeterministicKey,
  computeSynastryAspects,
} from './synastry-compute';

function baseSnap(): Omit<EphemerisSnapshot, 'planets'> {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40,
    lon: -74,
    houseSystem: 'placidus',
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as EphemerisSnapshot['houses'],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function snap10(
  longitudes: Record<string, number> & { sun: number; moon: number; mercury: number; venus: number; mars: number; jupiter: number; saturn: number; uranus: number; neptune: number; pluto: number }
): EphemerisSnapshot {
  const names = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ] as const;
  return {
    ...baseSnap(),
    planets: names.map((n) => ({ name: n, lon: longitudes[n] })),
  };
}

test('conjunction: same longitude for body pair across charts', () => {
  const a = snap10(
    Object.fromEntries(
      ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
        (n) => [n, 10]
      )
    ) as Parameters<typeof snap10>[0]
  );
  const b = snap10(
    Object.fromEntries(
      ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
        (n) => [n, 10]
      )
    ) as Parameters<typeof snap10>[0]
  );
  const out = computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'pair' });
  const sunSun = out.filter((x) => x.bodyA === 'sun' && x.bodyB === 'sun');
  assert.ok(sunSun.some((x) => x.type === 'conjunction' && x.orb === 0));
});

test('five aspect types: geometry hits each type at tight orb', () => {
  const cfg = ASPECT_CONFIG;
  const base = { sun: 0, moon: 10, mercury: 20, venus: 30, mars: 40, jupiter: 50, saturn: 60, uranus: 70, neptune: 80, pluto: 85 };
  const cases: Array<{ type: keyof typeof cfg; lonB: number }> = [
    { type: 'conjunction', lonB: 0 + cfg.conjunction.angle },
    { type: 'opposition', lonB: 0 + cfg.opposition.angle },
    { type: 'square', lonB: 0 + cfg.square.angle },
    { type: 'trine', lonB: 0 + cfg.trine.angle },
    { type: 'sextile', lonB: 0 + cfg.sextile.angle },
  ];
  for (const c of cases) {
    const a = snap10({ ...base, sun: 0 });
    const b = snap10({ ...base, sun: c.lonB });
    const out = computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'pair' });
    const hit = out.find((x) => x.bodyA === 'sun' && x.bodyB === 'sun');
    assert.ok(hit, c.type);
    assert.strictEqual(hit!.type, c.type);
    assert.strictEqual(hit!.orb, 0);
  }
});

test('orb boundary: exact threshold qualifies, epsilon over threshold rejected', () => {
  const cfg = ASPECT_CONFIG;
  const margin = 1e-4;
  const a = snap10({
    sun: 0,
    moon: 10,
    mercury: 20,
    venus: 30,
    mars: 40,
    jupiter: 50,
    saturn: 60,
    uranus: 70,
    neptune: 80,
    pluto: 85,
  });
  const bOk = snap10({
    sun: 0 + cfg.conjunction.orb,
    moon: 10,
    mercury: 20,
    venus: 30,
    mars: 40,
    jupiter: 50,
    saturn: 60,
    uranus: 70,
    neptune: 80,
    pluto: 85,
  });
  const bBad = snap10({
    sun: 0 + cfg.conjunction.orb + margin,
    moon: 10,
    mercury: 20,
    venus: 30,
    mars: 40,
    jupiter: 50,
    saturn: 60,
    uranus: 70,
    neptune: 80,
    pluto: 85,
  });
  const okHit = computeSynastryAspects({ snapshotsOrdered: [a, bOk], mode: 'pair' }).find(
    (x) => x.bodyA === 'sun' && x.bodyB === 'sun'
  );
  assert.ok(okHit);
  const bad = computeSynastryAspects({ snapshotsOrdered: [a, bBad], mode: 'pair' }).find(
    (x) => x.bodyA === 'sun' && x.bodyB === 'sun'
  );
  assert.strictEqual(bad, undefined);
});

test('pair mode determinism: identical outputs byte-identical', () => {
  const a = snap10({
    sun: 1,
    moon: 2,
    mercury: 3,
    venus: 4,
    mars: 5,
    jupiter: 100,
    saturn: 110,
    uranus: 200,
    neptune: 210,
    pluto: 220,
  });
  const b = snap10({
    sun: 15,
    moon: 25,
    mercury: 35,
    venus: 45,
    mars: 55,
    jupiter: 105,
    saturn: 115,
    uranus: 205,
    neptune: 215,
    pluto: 225,
  });
  const r1 = JSON.stringify(computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'pair' }));
  const r2 = JSON.stringify(computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'pair' }));
  assert.strictEqual(r1, r2);
});

test('group matrix: identical snapshots across three charts yield many hits then cap 32', () => {
  const s = snap10(
    Object.fromEntries(
      ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
        (n) => [n, 33]
      )
    ) as Parameters<typeof snap10>[0]
  );
  const out = computeSynastryAspects({
    snapshotsOrdered: [s, s, s],
    mode: 'group_matrix',
  });
  assert.strictEqual(out.length, 32);
});

test('group matrix: four charts still caps at 32', () => {
  const s = snap10({
    sun: 0,
    moon: 10,
    mercury: 20,
    venus: 30,
    mars: 40,
    jupiter: 50,
    saturn: 60,
    uranus: 70,
    neptune: 80,
    pluto: 90,
  });
  const out = computeSynastryAspects({
    snapshotsOrdered: [s, s, s, s],
    mode: 'group_matrix',
  });
  assert.strictEqual(out.length, 32);
});

test('ranking: 1° conjunction beats 6° square (exactness)', () => {
  /** Same-name pairs offset by 15° so no same-body cross-aspect outscores Sun↔Sun (1°); Mars on B at 84° gives Sun(A)→Mars(B) square at max orb (exactness 0). */
  const a = snap10({
    sun: 0,
    moon: 10,
    mercury: 20,
    venus: 149,
    mars: 170,
    jupiter: 180,
    saturn: 190,
    uranus: 200,
    neptune: 210,
    pluto: 220,
  });
  const b = snap10({
    sun: 1,
    moon: 25,
    mercury: 35,
    venus: 164,
    mars: 84,
    jupiter: 195,
    saturn: 205,
    uranus: 215,
    neptune: 225,
    pluto: 235,
  });
  const out = computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'pair' });
  const idxSunSun = out.findIndex((x) => x.bodyA === 'sun' && x.bodyB === 'sun' && x.type === 'conjunction');
  const idxSunMarsSq = out.findIndex((x) => x.bodyA === 'sun' && x.bodyB === 'mars' && x.type === 'square');
  assert.ok(idxSunSun >= 0, 'expected sun-sun conjunction');
  assert.ok(idxSunMarsSq >= 0, 'expected sun-mars square');
  assert.ok(idxSunSun < idxSunMarsSq, 'tighter conjunction should sort before loose square');
});

test('tiebreak: priorityBase — same exactness favors luminaries (sun involved)', () => {
  const orb = 2;
  const a = snap10({
    sun: 0,
    moon: 0,
    mercury: 0,
    venus: 0,
    mars: 0,
    jupiter: 0,
    saturn: 0,
    uranus: 0,
    neptune: 0,
    pluto: 0,
  });
  const b = snap10({
    sun: orb,
    moon: orb,
    mercury: orb,
    venus: orb,
    mars: orb,
    jupiter: orb,
    saturn: orb,
    uranus: orb,
    neptune: orb,
    pluto: orb,
  });
  const group = computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'group_matrix' });
  const top = group[0];
  assert.ok(top);
  assert.ok(
    (top!.bodyA === 'sun' && top!.bodyB === 'sun') ||
      (top!.bodyA === 'moon' && top!.bodyB === 'moon')
  );
  assert.strictEqual(top!.orb, orb);
});

test('empty: pair mode with one snapshot returns []', () => {
  const a = snap10({
    sun: 0,
    moon: 10,
    mercury: 20,
    venus: 30,
    mars: 40,
    jupiter: 50,
    saturn: 60,
    uranus: 70,
    neptune: 80,
    pluto: 90,
  });
  assert.deepStrictEqual(computeSynastryAspects({ snapshotsOrdered: [a], mode: 'pair' }), []);
});

test('empty: group_matrix with zero snapshots returns []', () => {
  assert.deepStrictEqual(computeSynastryAspects({ snapshotsOrdered: [], mode: 'group_matrix' }), []);
});

test('invalid longitude NaN: skips body, no throw', () => {
  const a: EphemerisSnapshot = {
    ...baseSnap(),
    planets: [
      { name: 'sun', lon: NaN },
      { name: 'moon', lon: 10 },
      { name: 'mercury', lon: 20 },
      { name: 'venus', lon: 30 },
      { name: 'mars', lon: 40 },
      { name: 'jupiter', lon: 50 },
      { name: 'saturn', lon: 60 },
      { name: 'uranus', lon: 70 },
      { name: 'neptune', lon: 80 },
      { name: 'pluto', lon: 85 },
    ],
  };
  const b = snap10({
    sun: 10,
    moon: 10,
    mercury: 20,
    venus: 30,
    mars: 40,
    jupiter: 50,
    saturn: 60,
    uranus: 70,
    neptune: 80,
    pluto: 85,
  });
  assert.doesNotThrow(() => computeSynastryAspects({ snapshotsOrdered: [a, b], mode: 'pair' }));
});

test('deterministic key format example', () => {
  const k = buildSynastryDeterministicKey({
    pairIndex: 1,
    sourceSlot: 1,
    targetSlot: 2,
    sourceBody: 'mars',
    targetBody: 'venus',
    aspectType: 'square',
  });
  assert.strictEqual(k, 'p001|s1|t2|mars|venus|square');
});
