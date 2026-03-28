// vnext/rpg/transit/signal-detection.ts
// QUARANTINED as primary Campaign pressure source (Phase 1+). Use cross-aspects / phase1 resolver.
// Layer 1: Deterministic transit signal detection.

import type { EphemerisSnapshot } from '../../contracts';
import { lonToHouse } from '../../astro/profile-from-snapshot';
import type { BodyId, AspectType, RPGTransitSignal } from '../contracts';
import { loadRpgV1Maps } from '../maps/load-v1';

const ASPECT_ORDER: AspectType[] = ['conjunction', 'opposition', 'square', 'trine', 'sextile'];

const BODY_NAME_TO_ID: Record<string, BodyId> = {
  sun: 'sun',
  moon: 'moon',
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
  pluto: 'pluto',
  ceres: 'ceres',
  pallas: 'pallas',
  juno: 'juno',
  vesta: 'vesta',
  chiron: 'chiron',
};

const OUTER_BODIES: BodyId[] = ['uranus', 'neptune', 'pluto'];
const LUMINARIES: BodyId[] = ['sun', 'moon'];

function toBodyId(name: string): BodyId | null {
  const key = name.toLowerCase();
  return BODY_NAME_TO_ID[key] ?? null;
}

function aspectBaseWeight(type: AspectType): number {
  switch (type) {
    case 'conjunction':
      return 1.4;
    case 'opposition':
      return 1.35;
    case 'square':
      return 1.3;
    case 'trine':
      return 1.1;
    case 'sextile':
      return 1.05;
    default:
      return 1;
  }
}

function orbWeight(orb: number | undefined): number {
  if (typeof orb !== 'number' || orb < 0) return 1;
  const clamped = Math.min(orb, 6);
  return 1 + (6 - clamped) * 0.03;
}

export function detectTransitSignals(snapshot: EphemerisSnapshot): RPGTransitSignal[] {
  const maps = loadRpgV1Maps();
  const bodyOrder = maps.bodyOrder;
  const houseArena = maps.houseArena;

  const orderIndex = new Map<BodyId, number>();
  bodyOrder.forEach((b, idx) => orderIndex.set(b, idx));

  const cusps = snapshot.houses;
  if (!cusps || cusps.length < 12) {
    throw new Error('[rpg-transit] Snapshot missing houses for transit signal detection');
  }

  const signals: RPGTransitSignal[] = [];

  for (const asp of snapshot.aspects || []) {
    const type = asp.type as AspectType;
    if (!ASPECT_ORDER.includes(type)) continue;

    const aId = toBodyId(asp.bodyA ?? (asp as { a?: string }).a ?? '');
    const bId = toBodyId(asp.bodyB ?? (asp as { b?: string }).b ?? '');
    if (!aId || !bId) continue;

    const idxA = orderIndex.get(aId) ?? 0;
    const idxB = orderIndex.get(bId) ?? 0;
    const primary: BodyId = idxA <= idxB ? aId : bId;
    const secondary: BodyId = idxA <= idxB ? bId : aId;

    const primaryPlanet = snapshot.planets.find(
      (p) => toBodyId(p.name) === primary
    );
    const house = primaryPlanet ? lonToHouse(primaryPlanet.lon, cusps) : 1;
    const arena = houseArena[String(house)] ?? 'unknown';

    const base = aspectBaseWeight(type);

    let multiplier = 1;
    if (OUTER_BODIES.includes(aId) || OUTER_BODIES.includes(bId)) {
      multiplier *= 1.25;
    }
    if (LUMINARIES.includes(aId) || LUMINARIES.includes(bId)) {
      multiplier *= 1.15;
    }
    if (house === 1 || house === 4 || house === 7 || house === 10) {
      multiplier *= 1.2;
    }

    const tension =
      type === 'conjunction' || type === 'opposition' || type === 'square'
        ? base * multiplier
        : 0;
    const support =
      type === 'trine' || type === 'sextile' ? base * multiplier : 0;

    const w = (tension || support || base * multiplier) * orbWeight(asp.orb);

    const tags: string[] = [];
    tags.push(`aspect:${type}`);
    tags.push(`arena:${arena}`);
    if (OUTER_BODIES.includes(aId) || OUTER_BODIES.includes(bId)) {
      tags.push('outer_involved');
    }
    if (LUMINARIES.includes(aId) || LUMINARIES.includes(bId)) {
      tags.push('luminary_involved');
    }
    if (house === 1 || house === 4 || house === 7 || house === 10) {
      tags.push('angular');
    }

    const signalId = `sig_${primary}_${secondary}_${type}_${house}`;

    signals.push({
      signal_id: signalId,
      body: primary,
      otherBody: secondary,
      aspect: type,
      orb: typeof asp.orb === 'number' ? asp.orb : undefined,
      house,
      tensionScore: tension,
      supportScore: support,
      weight: w,
      tags,
    });
  }

  signals.sort((s1, s2) => {
    if (s2.weight !== s1.weight) return s2.weight - s1.weight;
    const t1 = s1.aspect ? ASPECT_ORDER.indexOf(s1.aspect) : -1;
    const t2 = s2.aspect ? ASPECT_ORDER.indexOf(s2.aspect) : -1;
    if (t1 !== t2) return t1 - t2;
    const i1 = orderIndex.get(s1.body) ?? 0;
    const i2 = orderIndex.get(s2.body) ?? 0;
    if (i1 !== i2) return i1 - i2;
    const j1 = s1.otherBody ? orderIndex.get(s1.otherBody) ?? 0 : 0;
    const j2 = s2.otherBody ? orderIndex.get(s2.otherBody) ?? 0 : 0;
    if (j1 !== j2) return j1 - j2;
    return (s1.house ?? 0) - (s2.house ?? 0);
  });

  return signals;
}

