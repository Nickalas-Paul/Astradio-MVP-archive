// vnext/rpg/effects/bundle-from-snapshot.ts
// Deterministic transformation: EphemerisSnapshot (natal) -> RPGEffectsBundle.

import type { EphemerisSnapshot } from '../../contracts';
import { lonToSign, lonToHouse } from '../../astro/profile-from-snapshot';
import { hashCanonicalJson } from '../hash/json-hash';
import { hashSnapshot } from '../hash/snapshot-hash';
import {
  type BodyId,
  type AspectType,
  type RPGEffectsBundle,
  type RPGBodyPlacementEffect,
  type RPGAspectEffect,
  type RPGDomainScore,
  type RPGBundleMetadata,
  type RpgMapVersion,
  type RpgAlgoVersion,
  type AudioAlgoVersion,
} from '../contracts';
import { loadRpgV1Maps } from '../maps/load-v1';

const RPG_MAP_VERSION = 'v1' as RpgMapVersion;
const RPG_ALGO_VERSION = 'rpg-v1' as RpgAlgoVersion;
const AUDIO_ALGO_VERSION = 'audio-v1' as AudioAlgoVersion;

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

function toBodyId(name: string): BodyId | null {
  const key = name.toLowerCase();
  return BODY_NAME_TO_ID[key] ?? null;
}

const REQUIRED_BODIES: BodyId[] = [
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
];

function validateRequiredBodies(snapshot: EphemerisSnapshot): void {
  const present = new Set<BodyId>();
  for (const planet of snapshot.planets || []) {
    const id = toBodyId(planet.name);
    if (id) {
      present.add(id);
    }
  }
  const missing = REQUIRED_BODIES.filter((b) => !present.has(b));
  if (missing.length > 0) {
    throw new Error(
      `[rpg-effects] Snapshot missing required bodies: ${missing.join(', ')}`
    );
  }
}

function buildClassSlugFromSign(sign: string): string {
  return `class_${sign.toLowerCase()}`;
}

function buildSubclassSlugFromSign(sign: string): string {
  return `subclass_${sign.toLowerCase()}`;
}

function buildRisingSlugFromSign(sign: string | null): string {
  if (!sign) return 'rising_unknown';
  return `rising_${sign.toLowerCase()}`;
}

function ensureHouses(snapshot: EphemerisSnapshot): number[] {
  if (!snapshot.houses || snapshot.houses.length < 12) {
    throw new Error('[rpg-effects] Snapshot missing houses for RPG bundle');
  }
  return snapshot.houses.slice();
}

function buildPlacements(
  snapshot: EphemerisSnapshot,
  bodyOrder: BodyId[],
  maps: ReturnType<typeof loadRpgV1Maps>
): RPGBodyPlacementEffect[] {
  const cusps = ensureHouses(snapshot);
  const placements: RPGBodyPlacementEffect[] = [];

  for (const body of bodyOrder) {
    const planetName = body.charAt(0).toUpperCase() + body.slice(1);
    const planet = snapshot.planets.find((p) => p.name.toLowerCase() === planetName.toLowerCase());
    if (!planet) continue;

    const lon = planet.lon;
    const { sign } = lonToSign(lon);
    const house = lonToHouse(lon, cusps);
    const base = maps.bodyBase[body] ?? { primary_role: 'unknown', base_domains: [], modifiers: {} };
    const style = maps.signStyle[sign.toLowerCase()] ?? { domain_bias: {}, style_tags: [] };
    const arenaKey = String(house);
    const arena = maps.houseArena[arenaKey] ?? 'unknown';

    const domainsSet = new Set<string>();
    const modifiers: Record<string, number> = {};

    if (Array.isArray(base.base_domains)) {
      for (const d of base.base_domains) {
        if (typeof d === 'string') domainsSet.add(d);
      }
    }

    if (style.domain_bias && typeof style.domain_bias === 'object') {
      for (const [dom, weight] of Object.entries(style.domain_bias)) {
        if (typeof weight === 'number' && weight !== 0) {
          domainsSet.add(dom);
          modifiers[dom] = (modifiers[dom] ?? 0) + weight;
        }
      }
    }

    if (arena && arena !== 'unknown') {
      domainsSet.add(arena);
    }

    for (const rule of maps.domainResolver) {
      if (rule && rule.body === body && (!rule.house_domain || rule.house_domain === arena)) {
        if (Array.isArray(rule.domains)) {
          for (const d of rule.domains) {
            if (typeof d === 'string') domainsSet.add(d);
          }
        }
      }
    }

    const sortedOverrides = [...maps.placementOverrides].sort((a, b) =>
      String(a.id ?? '').localeCompare(String(b.id ?? ''))
    );
    for (const ov of sortedOverrides) {
      if (ov.body !== body) continue;
      const condHouse = ov.condition?.house;
      if (typeof condHouse === 'number' && condHouse !== house) continue;
      if (Array.isArray(ov.override_domains) && ov.override_domains.length > 0) {
        domainsSet.clear();
        for (const d of ov.override_domains) {
          if (typeof d === 'string') domainsSet.add(d);
        }
      }
      if (ov.modifier_multipliers && typeof ov.modifier_multipliers === 'object') {
        for (const [key, mult] of Object.entries(ov.modifier_multipliers)) {
          if (typeof mult === 'number') {
            modifiers[key] = (modifiers[key] ?? 1) * mult;
          }
        }
      }
    }

    const domains = Array.from(domainsSet).sort();

    placements.push({
      body,
      sign,
      house,
      domains,
      primaryRole: String(base.primary_role || body),
      modifiers,
    });
  }

  return placements;
}

function buildAspects(
  snapshot: EphemerisSnapshot,
  bodyOrder: BodyId[]
): RPGAspectEffect[] {
  const orderIndex = new Map<BodyId, number>();
  bodyOrder.forEach((b, idx) => orderIndex.set(b, idx));

  const effects: RPGAspectEffect[] = [];

  for (const asp of snapshot.aspects || []) {
    const type = asp.type as AspectType;
    if (!ASPECT_ORDER.includes(type)) continue;

    const aId = toBodyId(asp.a);
    const bId = toBodyId(asp.b);
    if (!aId || !bId) continue;

    const orb = typeof asp.orb === 'number' ? asp.orb : 0;

    effects.push({
      a: aId,
      b: bId,
      aspect: type,
      orb,
      domains: [],
      tensionWeight: 1,
    });
  }

  effects.sort((e1, e2) => {
    const t1 = ASPECT_ORDER.indexOf(e1.aspect);
    const t2 = ASPECT_ORDER.indexOf(e2.aspect);
    if (t1 !== t2) return t1 - t2;

    const min1 = Math.min(orderIndex.get(e1.a) ?? 0, orderIndex.get(e1.b) ?? 0);
    const min2 = Math.min(orderIndex.get(e2.a) ?? 0, orderIndex.get(e2.b) ?? 0);
    if (min1 !== min2) return min1 - min2;

    const max1 = Math.max(orderIndex.get(e1.a) ?? 0, orderIndex.get(e1.b) ?? 0);
    const max2 = Math.max(orderIndex.get(e2.a) ?? 0, orderIndex.get(e2.b) ?? 0);
    return max1 - max2;
  });

  return effects;
}

function buildDomainSummary(
  placements: RPGBodyPlacementEffect[],
  aspects: RPGAspectEffect[]
): RPGDomainScore[] {
  const agg = new Map<string, { score: number; contributors: Set<string> }>();

  for (const p of placements) {
    const contributorId = `body:${p.body}`;
    for (const dom of p.domains) {
      const entry = agg.get(dom) ?? { score: 0, contributors: new Set<string>() };
      entry.score += 1;
      entry.contributors.add(contributorId);
      agg.set(dom, entry);
    }
  }

  for (const a of aspects) {
    const contributorId = `aspect:${a.a}-${a.b}-${a.aspect}`;
    for (const dom of a.domains) {
      const entry = agg.get(dom) ?? { score: 0, contributors: new Set<string>() };
      entry.score += a.tensionWeight;
      entry.contributors.add(contributorId);
      agg.set(dom, entry);
    }
  }

  const entries: RPGDomainScore[] = [];
  let maxScore = 0;
  for (const [domain, { score, contributors }] of agg.entries()) {
    if (score > maxScore) maxScore = score;
    entries.push({
      domain,
      score,
      normalizedScore: 0,
      contributingSignals: Array.from(contributors).sort(),
    });
  }

  if (maxScore > 0) {
    for (const e of entries) {
      e.normalizedScore = e.score / maxScore;
    }
  }

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.domain.localeCompare(b.domain);
  });

  return entries;
}

export function buildRpgEffectsBundleFromSnapshot(snapshot: EphemerisSnapshot): RPGEffectsBundle {
  const maps = loadRpgV1Maps();
  const bodyOrder = maps.bodyOrder;

  validateRequiredBodies(snapshot);

  const cusps = ensureHouses(snapshot);
  const ascLon = cusps[0];
  const { sign: ascSign } = lonToSign(ascLon);

  const sun = snapshot.planets.find((p) => p.name.toLowerCase() === 'sun');
  const moon = snapshot.planets.find((p) => p.name.toLowerCase() === 'moon');

  const sunSign = sun ? lonToSign(sun.lon).sign : 'Unknown';
  const moonSign = moon ? lonToSign(moon.lon).sign : 'Unknown';

  const classSlug = buildClassSlugFromSign(sunSign);
  const subclassSlug = buildSubclassSlugFromSign(moonSign);
  const risingModifierSlug = buildRisingSlugFromSign(ascSign || null);

  const placements = buildPlacements(snapshot, bodyOrder, maps);
  const aspects = buildAspects(snapshot, bodyOrder);
  const domainSummary = buildDomainSummary(placements, aspects);

  const natalSnapshotHash = hashSnapshot(snapshot);

  const metadata: RPGBundleMetadata = {
    rpg_map_version: RPG_MAP_VERSION,
    rpg_algo_version: RPG_ALGO_VERSION,
    audio_algo_version: AUDIO_ALGO_VERSION,
    natal_snapshot_hash: natalSnapshotHash,
    bundle_hash: '',
  };

  const bundle: RPGEffectsBundle = {
    metadata,
    classSlug,
    subclassSlug,
    risingModifierSlug,
    placements,
    aspects,
    domainSummary,
  };

  const bundleHash = hashCanonicalJson(bundle);
  bundle.metadata.bundle_hash = bundleHash;

  return bundle;
}

