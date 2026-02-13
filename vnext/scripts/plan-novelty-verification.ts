/**
 * Plan Novelty Verification Script
 * Prints progression_id, motif_id, bass_pattern_id, transformation_sequence
 * Confirms determinism: same seed + inputs => same IDs
 * 
 * Run: pnpm -C vnext run tsx scripts/plan-novelty-verification.ts
 */

import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { planFromVector } from '../planner/narrative';
import type { EphemerisSnapshot } from '../contracts';

function makeSnapshot(seed: string): EphemerisSnapshot {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
    (name, i) => ({ name, lon: ((h + i * 37) * 17) % 360 })
  );
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];
  const fire = 0.2 + (h % 11) / 40;
  const earth = 0.2 + ((h >> 4) % 11) / 40;
  const air = 0.2 + ((h >> 8) % 11) / 40;
  const water = Math.max(0, 1 - fire - earth - air);
  return {
    ts: '2025-01-15T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire, earth, air, water },
  };
}

function printNoveltyIds(plan: any, seed: string) {
  console.log(`\n=== Plan Novelty IDs (seed: ${seed.slice(0, 16)}...) ===`);
  if (plan.debug) {
    console.log(`  Progression ID: ${plan.debug.progressionId ?? 'N/A'}`);
    console.log(`  Motif ID: ${plan.debug.motifId ?? 'N/A'}`);
    console.log(`  Bass Pattern ID: ${plan.debug.bassPatternId ?? 'N/A'}`);
    console.log(`  Transformation Sequence: ${plan.debug.transformationSequence?.join(', ') ?? 'N/A'}`);
  } else {
    console.log('  (Debug IDs not available - ensure planner includes debug metadata)');
  }
  console.log(`  Plan ID: ${plan.id}`);
  console.log(`  BPM: ${plan.bpm}`);
  console.log(`  Events: ${plan.events.length} total`);
  const byChannel = plan.events.reduce((acc: any, e: any) => {
    acc[e.channel] = (acc[e.channel] || 0) + 1;
    return acc;
  }, {});
  console.log(`  Channels: ${JSON.stringify(byChannel)}`);
}

async function main() {
  console.log('Plan Novelty Verification\n');
  
  // Test 1: Same seed + inputs => same IDs
  const seed1 = 'test_seed_12345';
  const snapshot1 = makeSnapshot(seed1);
  const feat1 = encodeFeatures(snapshot1);
  const guidance1 = guidanceFromFeatures(feat1, snapshot1, seed1);
  const plan1a = planFromVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], { ...guidance1, genre: 'house' });
  
  const plan1b = planFromVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], { ...guidance1, genre: 'house' });
  
  console.log('Test 1: Determinism (same seed + inputs)');
  printNoveltyIds(plan1a, seed1);
  printNoveltyIds(plan1b, seed1);
  
  if (plan1a.debug && plan1b.debug) {
    const same = 
      plan1a.debug.progressionId === plan1b.debug.progressionId &&
      plan1a.debug.motifId === plan1b.debug.motifId &&
      plan1a.debug.bassPatternId === plan1b.debug.bassPatternId &&
      JSON.stringify(plan1a.debug.transformationSequence) === JSON.stringify(plan1b.debug.transformationSequence);
    console.log(`\n  ✓ Determinism check: ${same ? 'PASS' : 'FAIL'}`);
  }
  
  // Test 2: Different seed => different IDs (novelty)
  const seed2 = 'test_seed_67890';
  const snapshot2 = makeSnapshot(seed2);
  const feat2 = encodeFeatures(snapshot2);
  const guidance2 = guidanceFromFeatures(feat2, snapshot2, seed2);
  const plan2 = planFromVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], { ...guidance2, genre: 'house' });
  
  console.log('\nTest 2: Novelty (different seed)');
  printNoveltyIds(plan2, seed2);
  
  if (plan1a.debug && plan2.debug) {
    const different = 
      plan1a.debug.progressionId !== plan2.debug.progressionId ||
      plan1a.debug.motifId !== plan2.debug.motifId ||
      plan1a.debug.bassPatternId !== plan2.debug.bassPatternId;
    console.log(`\n  ✓ Novelty check: ${different ? 'PASS (IDs differ)' : 'WARN (some IDs same)'}`);
  }
  
  // Test 3: Different features => different IDs
  const snapshot3 = makeSnapshot('different_features');
  const feat3 = encodeFeatures(snapshot3);
  const guidance3 = guidanceFromFeatures(feat3, snapshot3, seed1); // Same seed, different features
  const plan3 = planFromVector([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], { ...guidance3, genre: 'house' });
  
  console.log('\nTest 3: Feature-driven selection (same seed, different features)');
  printNoveltyIds(plan3, seed1);
  
  console.log('\n=== Verification Complete ===\n');
}

main().catch(console.error);
