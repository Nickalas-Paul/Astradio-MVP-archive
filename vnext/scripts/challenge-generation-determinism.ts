#!/usr/bin/env node
/**
 * Pass 3 — Determinism guard: same campaign state + same snapshot + same algo → identical ChallengeScene.
 */

import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildTransitPressureMap } from '../rpg/transit-pressure-map';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { initialCampaignState } from '../rpg/campaign/state-machine';

function snapshotWithTransitAspects(): { natal: EphemerisSnapshot; transit: EphemerisSnapshot } {
  const natal: EphemerisSnapshot = {
    ts: '1990-01-01T12:00:00Z',
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
  const transit: EphemerisSnapshot = {
    ...natal,
    ts: '2026-03-15T12:00:00Z',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 195 },
      { name: 'Mercury', lon: 30 },
      { name: 'Venus', lon: 210 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 300 },
      { name: 'Uranus', lon: 120 },
      { name: 'Neptune', lon: 330 },
      { name: 'Pluto', lon: 270 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
      { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
    ],
    moonPhase: 0.7,
  };
  return { natal, transit };
}

function main(): void {
  const { natal, transit } = snapshotWithTransitAspects();
  const featureVec = encodeFeatures(natal) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, natal, 'challenge-determinism');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['challenge-determinism'],
    snapshot: natal,
    featureVec,
    control_surface_hash: 'challenge-determinism',
    compose_seed: 'challenge-determinism',
    guidance,
  });
  const semanticCore = interpretCanonicalReportObject(canonical);

  const bundle = buildRpgEffectsBundleFromSnapshot(natal);
  const character = buildCharacterProfile({
    natalSnapshot: natal,
    featureVec,
    semanticCore,
    dominantPlanetNames: canonical.participants[0].dominant_planet_names,
    effectsBundle: bundle,
  });
  const pressures = buildTransitPressureMap({ natalSnapshot: natal, transitSnapshot: transit });
  const state = initialCampaignState(bundle);

  if (!pressures.length) {
    // eslint-disable-next-line no-console
    console.error('SKIP: no pressures for stub snapshots; cannot test scene');
    process.exit(0);
  }

  const scene1 = buildChallengeScene({
    character,
    pressures,
    state,
    semanticCore,
    natalSnapshot: natal,
    transitSnapshot: transit,
  });
  const scene2 = buildChallengeScene({
    character,
    pressures,
    state,
    semanticCore,
    natalSnapshot: natal,
    transitSnapshot: transit,
  });

  if (JSON.stringify(scene1) !== JSON.stringify(scene2)) {
    // eslint-disable-next-line no-console
    console.error('FAIL: same campaign state + same snapshot → different ChallengeScene');
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('OK: challenge generation is deterministic (same inputs → identical ChallengeScene)');
}

main();
