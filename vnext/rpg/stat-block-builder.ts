/**
 * Deterministic 6-stat mechanical block from a natal EphemerisSnapshot.
 * Layers: base weights × sign × house × dignity × retrograde + aspect bonuses → scale 4–18 → clamp 1–20.
 */

import type { EphemerisSnapshot } from '../contracts';
import { lonToSign, lonToHouse } from '../astro/profile-from-snapshot';
import { getDignityLabel, getDignityMultiplier } from './dignity-calculator';
import { isRetrograde, retrogradeMultiplier } from './retrograde-detector';
import { loadRpgV1Maps } from './maps/load-v1';
import type {
  StatBlock,
  StatBlockRaw,
  StatDerivationTrace,
  StatKey,
} from './types';

export type { StatBlock, StatBlockRaw, StatDerivationTrace, StatKey };

const STAT_KEYS: readonly StatKey[] = [
  'vitality',
  'resilience',
  'cunning',
  'charm',
  'intuition',
  'willpower',
] as const;

const CORE_BODIES = [
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

const ASPECT_BASE_BONUS: Record<string, number> = {
  conjunction: 0.4,
  trine: 0.3,
  sextile: 0.2,
  square: 0.15,
  opposition: 0.1,
};

const ASPECT_ORDER = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;

function emptyRaw(): StatBlockRaw {
  return {
    vitality: 0,
    resilience: 0,
    cunning: 0,
    charm: 0,
    intuition: 0,
    willpower: 0,
  };
}

function emptyFinal(): StatBlock {
  return {
    vitality: 4,
    resilience: 4,
    cunning: 4,
    charm: 4,
    intuition: 4,
    willpower: 4,
  };
}

function toBodyKey(name: string): string {
  return name.trim().toLowerCase();
}

function orbScale(orb: number): number {
  if (orb <= 2) return 1.0;
  if (orb <= 5) return 0.75;
  if (orb <= 8) return 0.5;
  return 0.25;
}

function primaryStatKeys(statPrimary: Record<string, number> | undefined): StatKey[] {
  if (!statPrimary || typeof statPrimary !== 'object') return [];
  const out: StatKey[] = [];
  for (const key of STAT_KEYS) {
    if (typeof statPrimary[key] === 'number' && (statPrimary[key] as number) > 0) {
      out.push(key);
    }
  }
  return out;
}

function collectWeights(
  primary: Record<string, number> | undefined,
  secondary: Record<string, number> | undefined
): Partial<Record<StatKey, number>> {
  const weights: Partial<Record<StatKey, number>> = {};
  for (const [k, v] of Object.entries(primary || {})) {
    if (STAT_KEYS.includes(k as StatKey) && typeof v === 'number' && v > 0) {
      weights[k as StatKey] = v;
    }
  }
  for (const [k, v] of Object.entries(secondary || {})) {
    if (STAT_KEYS.includes(k as StatKey) && typeof v === 'number' && v > 0) {
      weights[k as StatKey] = (weights[k as StatKey] ?? 0) + v;
    }
  }
  return weights;
}

/** Linear scale raw scores into [4, 18], round, clamp to [1, 20]. */
export function normalizeStatBlock(raw: StatBlockRaw): StatBlock {
  const values = STAT_KEYS.map((k) => raw[k]);
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const out = emptyFinal();
  if (max <= min) {
    const mid = 11;
    for (const k of STAT_KEYS) out[k] = mid;
    return out;
  }

  for (const k of STAT_KEYS) {
    const scaled = 4 + ((raw[k] - min) / (max - min)) * (18 - 4);
    const rounded = Math.round(scaled);
    out[k] = Math.max(1, Math.min(20, rounded));
  }
  return out;
}

/**
 * Build mechanical StatBlock + derivation trace from a natal snapshot.
 * Fully deterministic: same snapshot → identical output.
 */
export function buildStatBlock(snapshot: EphemerisSnapshot): {
  stats: StatBlock;
  trace: StatDerivationTrace;
} {
  const maps = loadRpgV1Maps();
  const cusps = snapshot.houses;
  if (!cusps || cusps.length < 12) {
    throw new Error('[stat-block] Snapshot missing houses');
  }

  const raw = emptyRaw();
  const perPlanet: StatDerivationTrace['perPlanet'] = {};
  const aspectBonuses: StatDerivationTrace['aspectBonuses'] = [];

  const planetByBody = new Map<string, { lon: number; speed?: number }>();
  for (const p of snapshot.planets || []) {
    const key = toBodyKey(p.name);
    if (!planetByBody.has(key)) {
      planetByBody.set(key, { lon: p.lon, speed: p.speed });
    }
  }

  // --- Placement contributions ---
  for (const body of CORE_BODIES) {
    const planet = planetByBody.get(body);
    if (!planet) continue;

    const { sign } = lonToSign(planet.lon);
    const signKey = sign.toLowerCase();
    const house = lonToHouse(planet.lon, cusps);
    const dignity = getDignityLabel(body, sign);
    const digMult = getDignityMultiplier(body, sign);
    const retro = isRetrograde(body, planet.speed);
    const retroMult = retrogradeMultiplier(body, planet.speed);

    const base = maps.bodyBase[body] ?? {};
    const weights = collectWeights(base.stat_primary, base.stat_secondary);
    const style = maps.signStyle[signKey] ?? {};
    const statBonus = (style.stat_bonus && typeof style.stat_bonus === 'object'
      ? style.stat_bonus
      : {}) as Partial<Record<StatKey, number>>;
    const affinity = maps.houseStatAffinity[String(house)];

    const contributions: Partial<Record<StatKey, number>> = {};

    for (const [stat, baseWeight] of Object.entries(weights) as Array<[StatKey, number]>) {
      const signMult = 1.0 + (typeof statBonus[stat] === 'number' ? (statBonus[stat] as number) : 0);
      let houseMult = 1.0;
      if (
        affinity &&
        affinity.boosted_stat === stat &&
        typeof affinity.multiplier === 'number'
      ) {
        houseMult = affinity.multiplier;
      }
      const contrib = baseWeight * signMult * houseMult * digMult * retroMult;
      contributions[stat] = (contributions[stat] ?? 0) + contrib;
      raw[stat] += contrib;
    }

    perPlanet[body] = {
      sign,
      house,
      dignity,
      retrograde: retro,
      contributions,
    };
  }

  // --- Aspect bonuses (primary stats of both planets) ---
  const aspects = [...(snapshot.aspects || [])].sort((a, b) => {
    const t1 = ASPECT_ORDER.indexOf(a.type as (typeof ASPECT_ORDER)[number]);
    const t2 = ASPECT_ORDER.indexOf(b.type as (typeof ASPECT_ORDER)[number]);
    if (t1 !== t2) return t1 - t2;
    const aA = toBodyKey(a.bodyA ?? (a as { a?: string }).a ?? '');
    const aB = toBodyKey(a.bodyB ?? (a as { b?: string }).b ?? '');
    const bA = toBodyKey(b.bodyA ?? (b as { a?: string }).a ?? '');
    const bB = toBodyKey(b.bodyB ?? (b as { b?: string }).b ?? '');
    const c1 = aA.localeCompare(bA);
    if (c1 !== 0) return c1;
    return aB.localeCompare(bB);
  });

  for (const asp of aspects) {
    const type = asp.type;
    const baseBonus = ASPECT_BASE_BONUS[type];
    if (typeof baseBonus !== 'number') continue;

    const bodyA = toBodyKey(asp.bodyA ?? (asp as { a?: string }).a ?? '');
    const bodyB = toBodyKey(asp.bodyB ?? (asp as { b?: string }).b ?? '');
    if (!bodyA || !bodyB) continue;
    if (!CORE_BODIES.includes(bodyA as (typeof CORE_BODIES)[number])) continue;
    if (!CORE_BODIES.includes(bodyB as (typeof CORE_BODIES)[number])) continue;

    const orb = typeof asp.orb === 'number' && Number.isFinite(asp.orb) ? Math.abs(asp.orb) : 0;
    const scaled = baseBonus * orbScale(orb);

    const baseA = maps.bodyBase[bodyA] ?? {};
    const baseB = maps.bodyBase[bodyB] ?? {};
    const primariesA = primaryStatKeys(baseA.stat_primary);
    const primariesB = primaryStatKeys(baseB.stat_primary);

    const statBonuses: Partial<Record<StatKey, number>> = {};
    for (const stat of [...primariesA, ...primariesB]) {
      statBonuses[stat] = (statBonuses[stat] ?? 0) + scaled;
      raw[stat] += scaled;
    }

    aspectBonuses.push({
      bodyA,
      bodyB,
      aspectType: type,
      orb,
      statBonuses,
    });
  }

  // Stable sort aspect bonuses for determinism of trace ordering
  aspectBonuses.sort((x, y) => {
    const c1 = x.bodyA.localeCompare(y.bodyA);
    if (c1 !== 0) return c1;
    const c2 = x.bodyB.localeCompare(y.bodyB);
    if (c2 !== 0) return c2;
    return x.aspectType.localeCompare(y.aspectType);
  });

  const final = normalizeStatBlock(raw);
  const trace: StatDerivationTrace = {
    raw: { ...raw },
    final: { ...final },
    perPlanet,
    aspectBonuses,
  };

  return { stats: final, trace };
}

/**
 * If bundle lacks a v2 stat block (or is stamped rpg-v1), recompute from snapshot.
 * Mutates nothing — returns a new object when enrichment is needed.
 */
export function ensureBundleStatBlock<T extends {
  metadata?: { rpg_algo_version?: string };
  statBlock?: StatBlock;
  statTrace?: StatDerivationTrace;
}>(bundle: T, snapshot: EphemerisSnapshot): T & { statBlock: StatBlock; statTrace: StatDerivationTrace } {
  const algo = String(bundle.metadata?.rpg_algo_version ?? '');
  const hasStats = bundle.statBlock != null && bundle.statTrace != null;
  if (hasStats && algo !== 'rpg-v1') {
    return bundle as T & { statBlock: StatBlock; statTrace: StatDerivationTrace };
  }
  const { stats, trace } = buildStatBlock(snapshot);
  return {
    ...bundle,
    statBlock: stats,
    statTrace: trace,
  };
}

/** Neutral stub for test fixtures that construct CharacterProfile without a snapshot. */
export function stubStatBlock(fill = 10): StatBlock {
  return {
    vitality: fill,
    resilience: fill,
    cunning: fill,
    charm: fill,
    intuition: fill,
    willpower: fill,
  };
}

export function stubStatTrace(fill = 10): StatDerivationTrace {
  const final = stubStatBlock(fill);
  return {
    raw: { ...final },
    final,
    perPlanet: {},
    aspectBonuses: [],
  };
}
