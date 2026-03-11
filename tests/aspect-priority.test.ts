/**
 * Deterministic aspect prioritization: same inputs → same ranked outputs.
 */

import { sortAspectsByPriority, topRankedAspects, compareAspects, type AspectWithMeta } from '../vnext/aspect-priority';

function asp(overrides: Partial<AspectWithMeta> & { bodyA: string; bodyB: string; type: string }): AspectWithMeta {
  return {
    bodyA: overrides.bodyA,
    bodyB: overrides.bodyB,
    type: overrides.type,
    orb: overrides.orb ?? 0,
    priorityBase: overrides.priorityBase,
    exactness: overrides.exactness,
    strength: overrides.strength,
    ...overrides,
  };
}

describe('aspect-priority', () => {
  it('sorts by priorityBase descending', () => {
    const aspects: AspectWithMeta[] = [
      asp({ bodyA: 'sun', bodyB: 'moon', type: 'conjunction', priorityBase: 0.5 }),
      asp({ bodyA: 'mars', bodyB: 'jupiter', type: 'square', priorityBase: 0.9 }),
      asp({ bodyA: 'venus', bodyB: 'saturn', type: 'trine', priorityBase: 0.7 }),
    ];
    const sorted = sortAspectsByPriority(aspects);
    expect(sorted[0].priorityBase).toBe(0.9);
    expect(sorted[1].priorityBase).toBe(0.7);
    expect(sorted[2].priorityBase).toBe(0.5);
  });

  it('tiebreak by exactness then strength', () => {
    const aspects: AspectWithMeta[] = [
      asp({ bodyA: 'sun', bodyB: 'moon', type: 'conjunction', priorityBase: 0.8, exactness: 0.6, strength: 0.6 }),
      asp({ bodyA: 'mars', bodyB: 'venus', type: 'square', priorityBase: 0.8, exactness: 0.9, strength: 0.9 }),
      asp({ bodyA: 'jupiter', bodyB: 'saturn', type: 'trine', priorityBase: 0.8, exactness: 0.9, strength: 0.8 }),
    ];
    const sorted = sortAspectsByPriority(aspects);
    expect(sorted[0].bodyA).toBe('mars');
    expect(sorted[1].bodyA).toBe('jupiter');
    expect(sorted[2].bodyA).toBe('sun');
  });

  it('topRankedAspects returns at most n', () => {
    const aspects: AspectWithMeta[] = [
      asp({ bodyA: 'sun', bodyB: 'moon', type: 'conjunction', priorityBase: 0.9 }),
      asp({ bodyA: 'mars', bodyB: 'venus', type: 'square', priorityBase: 0.7 }),
      asp({ bodyA: 'jupiter', bodyB: 'saturn', type: 'trine', priorityBase: 0.5 }),
    ];
    expect(topRankedAspects(aspects, 2)).toHaveLength(2);
    expect(topRankedAspects(aspects, 10)).toHaveLength(3);
    expect(topRankedAspects(aspects, 0)).toHaveLength(0);
  });

  it('same input produces same order (deterministic)', () => {
    const aspects: AspectWithMeta[] = [
      asp({ bodyA: 'sun', bodyB: 'mars', type: 'square', priorityBase: 0.85 }),
      asp({ bodyA: 'moon', bodyB: 'venus', type: 'conjunction', priorityBase: 0.85 }),
      asp({ bodyA: 'mercury', bodyB: 'jupiter', type: 'sextile', priorityBase: 0.85 }),
    ];
    const first = sortAspectsByPriority(aspects).map((a) => `${a.bodyA}-${a.bodyB}-${a.type}`);
    const second = sortAspectsByPriority(aspects).map((a) => `${a.bodyA}-${a.bodyB}-${a.type}`);
    expect(first).toEqual(second);
  });
});
