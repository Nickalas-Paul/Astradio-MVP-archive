/**
 * Phase 1 — Stat block validation: determinism, dignity/retro impact, differentiation.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/stat-block-validation.js
 */

import type { EphemerisSnapshot, SnapshotAspect, FeatureVec } from '../contracts';
import { hashCanonicalJson } from '../rpg/hash/json-hash';
import { buildStatBlock, normalizeStatBlock } from '../rpg/stat-block-builder';
import { getDignityMultiplier, getDignityLabel } from '../rpg/dignity-calculator';
import { isRetrograde } from '../rpg/retrograde-detector';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildCharacterProfile } from '../rpg/character-builder';
import { encodeFeatures } from '../feature-encode';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { guidanceFromFeatures } from '../astro/guidance';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  // eslint-disable-next-line no-console
  console.log(`✓ ${msg}`);
}

function baseHouses(): EphemerisSnapshot['houses'] {
  return [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
}

function makePlanets(
  overrides: Partial<Record<string, { lon: number; speed?: number }>>
): EphemerisSnapshot['planets'] {
  const defaults: Record<string, { lon: number; speed?: number }> = {
    sun: { lon: 15 },
    moon: { lon: 45 },
    mercury: { lon: 20 },
    venus: { lon: 50 },
    mars: { lon: 100 },
    jupiter: { lon: 200 },
    saturn: { lon: 280 },
    uranus: { lon: 10 },
    neptune: { lon: 330 },
    pluto: { lon: 250 },
  };
  for (const [k, v] of Object.entries(overrides)) {
    defaults[k.toLowerCase()] = { ...defaults[k.toLowerCase()], ...v };
  }
  return Object.entries(defaults).map(([name, v]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    lon: v.lon,
    speed: v.speed,
  }));
}

function makeSnapshot(
  planetOverrides: Partial<Record<string, { lon: number; speed?: number }>> = {},
  aspects: SnapshotAspect[] = [],
  houses?: EphemerisSnapshot['houses']
): EphemerisSnapshot {
  return {
    ts: '1990-05-15T12:00:00Z',
    tz: 'America/Chicago',
    lat: 41.88,
    lon: -87.63,
    houseSystem: 'placidus',
    planets: makePlanets(planetOverrides),
    houses: houses ?? baseHouses(),
    aspects,
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

/** Nickster-ish: Sun Taurus (~45°), Moon Taurus, Asc Leo (cusp0 ≈ 120°). */
function nicksterSnapshot(): EphemerisSnapshot {
  const houses: EphemerisSnapshot['houses'] = [
    120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60, 90,
  ];
  return makeSnapshot(
    {
      sun: { lon: 45 },
      moon: { lon: 50 },
      mercury: { lon: 55 },
      venus: { lon: 40 },
      mars: { lon: 100 },
      jupiter: { lon: 200 },
      saturn: { lon: 280 },
      uranus: { lon: 250 },
      neptune: { lon: 280 },
      pluto: { lon: 230 },
    },
    [],
    houses
  );
}

function diverseSnapshots(): EphemerisSnapshot[] {
  const seeds = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return seeds.map((offset, i) =>
    makeSnapshot({
      sun: { lon: (offset + 10) % 360 },
      moon: { lon: (offset + 40 + i * 7) % 360 },
      mercury: { lon: (offset + 20) % 360 },
      venus: { lon: (offset + 80) % 360 },
      mars: { lon: (offset + 110 + i * 3) % 360 },
      jupiter: { lon: (offset + 160) % 360 },
      saturn: { lon: (offset + 200 + i * 5) % 360 },
      uranus: { lon: (offset + 250) % 360 },
      neptune: { lon: (offset + 280) % 360 },
      pluto: { lon: (offset + 310) % 360 },
    })
  );
}

async function main(): Promise<void> {
  // --- Dignity unit checks ---
  assert(getDignityLabel('sun', 'Leo') === 'domicile', 'Sun in Leo = domicile');
  assert(getDignityMultiplier('sun', 'Leo') === 1.3, 'Sun Leo multiplier 1.3');
  assert(getDignityLabel('sun', 'Aquarius') === 'detriment', 'Sun in Aquarius = detriment');
  assert(getDignityMultiplier('sun', 'Aquarius') === 0.8, 'Sun Aquarius multiplier 0.8');
  assert(getDignityLabel('mercury', 'Virgo') === 'domicile', 'Mercury Virgo prefers domicile over exaltation');
  assert(getDignityLabel('pluto', 'Aries') === 'neutral', 'Pluto unresolved fall → neutral');

  // --- Retrograde ---
  assert(isRetrograde('sun', -1) === false, 'Sun never retrograde');
  assert(isRetrograde('moon', -1) === false, 'Moon never retrograde');
  assert(isRetrograde('mars', -0.5) === true, 'Mars negative speed = retrograde');
  assert(isRetrograde('mars', 0.5) === false, 'Mars positive speed = direct');
  assert(isRetrograde('mars', undefined) === false, 'Undefined speed = direct');

  // --- Determinism (100 runs) ---
  const snap = nicksterSnapshot();
  const first = buildStatBlock(snap);
  const firstHash = hashCanonicalJson(first);
  for (let i = 0; i < 100; i++) {
    const again = buildStatBlock(snap);
    if (hashCanonicalJson(again) !== firstHash) {
      throw new Error(`FAIL: determinism broken on run ${i + 1}`);
    }
  }
  assert(true, 'Determinism: 100 identical hashes for same snapshot');

  // --- Integer range ---
  for (const k of Object.keys(first.stats) as Array<keyof typeof first.stats>) {
    const v = first.stats[k];
    assert(Number.isInteger(v) && v >= 1 && v <= 20, `Nickster ${k}=${v} in 1–20`);
  }

  // --- Nickster directional ---
  // eslint-disable-next-line no-console
  console.log('[nickster stats]', first.stats);
  assert(first.stats.resilience >= 8, 'Nickster resilience not bottom-tier (earth luminaries)');
  assert(first.stats.charm >= 6, 'Nickster charm present (Venus-ruled Taurus / fire rising context)');

  // --- Dignity impact: Sun Leo vs Sun Aquarius ---
  const sunLeo = makeSnapshot({ sun: { lon: 130 } }); // Leo ~120–150
  const sunAqua = makeSnapshot({ sun: { lon: 310 } }); // Aquarius ~300–330
  const leoStats = buildStatBlock(sunLeo).stats;
  const aquaStats = buildStatBlock(sunAqua).stats;
  const vitalityDelta = Math.abs(leoStats.vitality - aquaStats.vitality);
  // eslint-disable-next-line no-console
  console.log('[dignity] Sun Leo vs Aquarius vitality', leoStats.vitality, aquaStats.vitality);
  assert(vitalityDelta >= 2, `Dignity impact on Vitality ≥ 2 (got ${vitalityDelta})`);

  // --- Retrograde impact: Mars direct vs Rx ---
  const marsDirect = makeSnapshot({ mars: { lon: 100, speed: 0.6 } });
  const marsRx = makeSnapshot({ mars: { lon: 100, speed: -0.4 } });
  const d = buildStatBlock(marsDirect).stats;
  const r = buildStatBlock(marsRx).stats;
  // eslint-disable-next-line no-console
  console.log('[retro] Mars direct vs Rx', { vitality: [d.vitality, r.vitality], cunning: [d.cunning, r.cunning] });
  assert(
    d.vitality - r.vitality >= 1 || d.cunning - r.cunning >= 1,
    'Retrograde Mars lowers Vitality and/or Cunning by ≥ 1'
  );

  // --- Differentiation across 12 charts ---
  const blocks = diverseSnapshots().map((s) => buildStatBlock(s).stats);
  const hashes = new Set(blocks.map((b) => hashCanonicalJson(b)));
  assert(hashes.size === blocks.length, `All ${blocks.length} diverse charts produce unique stat blocks`);

  const allVals: number[] = [];
  const highHits = new Set<string>();
  const lowHits = new Set<string>();
  for (const b of blocks) {
    for (const [k, v] of Object.entries(b)) {
      allVals.push(v);
      if (v > 12) highHits.add(k);
      if (v < 8) lowHits.add(k);
    }
  }
  assert(highHits.size >= 3, `≥3 stats hit >12 across set (got ${[...highHits]})`);
  assert(lowHits.size >= 3, `≥3 stats hit <8 across set (got ${[...lowHits]})`);
  assert(!allVals.every((v) => v === 4), 'Not all values stuck at floor 4');
  assert(!allVals.every((v) => v === 18), 'Not all values stuck at ceiling 18');

  // --- Normalize edge: equal raws → mid ---
  const equal = normalizeStatBlock({
    vitality: 5,
    resilience: 5,
    cunning: 5,
    charm: 5,
    intuition: 5,
    willpower: 5,
  });
  assert(equal.vitality === 11, 'Equal raws normalize to mid 11');

  // --- Bundle embeds stats + rpg-v2 ---
  const bundle = buildRpgEffectsBundleFromSnapshot(snap);
  assert(bundle.metadata.rpg_algo_version === 'rpg-v2', 'Bundle algo version is rpg-v2');
  assert(bundle.statBlock != null, 'Bundle embeds statBlock');
  assert(bundle.statTrace != null, 'Bundle embeds statTrace');
  assert(
    hashCanonicalJson(bundle.statBlock) === hashCanonicalJson(first.stats),
    'Bundle statBlock matches buildStatBlock'
  );

  // --- Character profile includes stats; temperament still present ---
  const featureVec = encodeFeatures(snap) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, snap, 'stat_validation');
  const report = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['stat_validation'],
    snapshot: snap,
    featureVec,
    control_surface_hash: 'stat_validation',
    compose_seed: 'stat_validation',
    guidance,
  });
  const semanticCore = interpretCanonicalReportObject(report);
  const character = buildCharacterProfile({
    natalSnapshot: snap,
    featureVec,
    semanticCore,
    dominantPlanetNames: report.participants[0]?.dominant_planet_names ?? ['Sun', 'Moon'],
    effectsBundle: bundle,
  });
  assert(character.statBlock != null, 'CharacterProfile.statBlock present');
  assert(typeof character.temperament.will === 'number', 'Temperament axes unaffected');
  assert(
    hashCanonicalJson(character.statBlock) === hashCanonicalJson(first.stats),
    'CharacterProfile.statBlock matches builder'
  );

  // eslint-disable-next-line no-console
  console.log('\nAll Phase 1 stat-block validation checks passed.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
