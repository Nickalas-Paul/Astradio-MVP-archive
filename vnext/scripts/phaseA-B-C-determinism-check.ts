import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildChartSemanticProfile } from '../interpretation/chart-semantic-profile';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildTransitPressureMap } from '../rpg/transit-pressure-map';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { buildChallengeOutcome } from '../rpg/reflection-mapper';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';

function log(title: string, value: unknown) {
  // eslint-disable-next-line no-console
  console.log(title, JSON.stringify(value, null, 2));
}

function snapshotVariant(delta: number): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128 + delta,
    lon: -74.006 + delta,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 + delta },
      { name: 'Moon', lon: 45 + delta },
      { name: 'Mercury', lon: 60 + delta },
      { name: 'Venus', lon: 75 + delta },
      { name: 'Mars', lon: 90 + delta },
      { name: 'Jupiter', lon: 105 + delta },
      { name: 'Saturn', lon: 120 + delta },
      { name: 'Uranus', lon: 135 + delta },
      { name: 'Neptune', lon: 150 + delta },
      { name: 'Pluto', lon: 165 + delta },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function asFeatureVec(len: number): FeatureVec {
  const arr = new Float32Array(len);
  for (let i = 0; i < len; i++) arr[i] = (i % 7) / 10;
  return arr as FeatureVec;
}

async function main() {
  const natalA = snapshotVariant(0);
  const natalB = snapshotVariant(5);

  const featureVec = asFeatureVec(64);

  const bundleA = buildRpgEffectsBundleFromSnapshot(natalA);
  const bundleB = buildRpgEffectsBundleFromSnapshot(natalB);

  const guidanceStub = {
    motionProfile: { motion: 0.5, flow: 0.5, gravity: 0.5, shimmer: 0.5 },
  } as any;

  const semanticA = buildChartSemanticProfile({
    snapshot: natalA,
    featureVec,
    guidance: guidanceStub,
  });
  const semanticB = buildChartSemanticProfile({
    snapshot: natalB,
    featureVec,
    guidance: guidanceStub,
  });

  const charA1 = buildCharacterProfile({
    natalSnapshot: natalA,
    featureVec,
    semanticProfile: semanticA,
    effectsBundle: bundleA,
  });
  const charA2 = buildCharacterProfile({
    natalSnapshot: natalA,
    featureVec,
    semanticProfile: semanticA,
    effectsBundle: bundleA,
  });
  const charB = buildCharacterProfile({
    natalSnapshot: natalB,
    featureVec,
    semanticProfile: semanticB,
    effectsBundle: bundleB,
  });

  log('charA1.id', charA1.id);
  log('charA2.id', charA2.id);
  log('charB.id', charB.id);

  const sameA =
    JSON.stringify(charA1.temperament) === JSON.stringify(charA2.temperament) &&
    charA1.id === charA2.id;
  const distinctAB = charA1.id !== charB.id;

  if (!sameA) {
    throw new Error('[PhaseA] CharacterProfile unstable for identical natal snapshot');
  }
  if (!distinctAB) {
    throw new Error('[PhaseA] CharacterProfile id did not change for materially different chart');
  }

  const transit = snapshotVariant(10);
  const pressures1 = buildTransitPressureMap({ natalSnapshot: natalA, transitSnapshot: transit });
  const pressures2 = buildTransitPressureMap({ natalSnapshot: natalA, transitSnapshot: transit });

  if (JSON.stringify(pressures1) !== JSON.stringify(pressures2)) {
    throw new Error('[PhaseB] TransitPressure map unstable for identical transit snapshot');
  }

  if (pressures1.length > 1) {
    const sorted = [...pressures1].sort((a, b) => {
      if (b.intensity !== a.intensity) return b.intensity - a.intensity;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.domain.localeCompare(b.domain);
    });
    if (JSON.stringify(sorted) !== JSON.stringify(pressures1)) {
      throw new Error('[PhaseB] TransitPressure ordering is not consistent with sort spec');
    }
  }

  const stubState: any = { chapter: 1 };
  const scene1 = buildChallengeScene({
    character: charA1,
    pressures: pressures1,
    state: stubState,
    semanticProfile: semanticA,
    natalSnapshot: natalA,
    transitSnapshot: transit,
  });
  const scene2 = buildChallengeScene({
    character: charA1,
    pressures: pressures1,
    state: stubState,
    semanticProfile: semanticA,
    natalSnapshot: natalA,
    transitSnapshot: transit,
  });

  if (JSON.stringify(scene1) !== JSON.stringify(scene2)) {
    throw new Error('[PhaseC] ChallengeScene unstable for identical inputs');
  }

  if (scene1 && scene1.choices && scene1.choices.length > 0) {
    const choice = scene1.choices[0];
    const outcome1 = buildChallengeOutcome({
      scene: scene1,
      choice,
      natalSnapshot: natalA,
      transitSnapshot: transit,
    });
    const outcome2 = buildChallengeOutcome({
      scene: scene1,
      choice,
      natalSnapshot: natalA,
      transitSnapshot: transit,
    });
    if (JSON.stringify(outcome1) !== JSON.stringify(outcome2)) {
      throw new Error('[PhaseD] ChallengeOutcome unstable for identical scene + choice');
    }
  }

  log('[OK] Phase A/B/C determinism check passed', {
    charIdA: charA1.id,
    charIdB: charB.id,
    pressureCount: pressures1.length,
    sceneId: scene1?.id,
  });
}

// eslint-disable-next-line no-console
main().catch((err) => {
  console.error('[phaseA-B-C-determinism-check] FAILED', err);
  process.exitCode = 1;
});

