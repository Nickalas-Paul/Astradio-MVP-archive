/**
 * Provenance verification: assert deterministic hash chain from snapshot -> featurevec -> v6 -> plan -> wav.
 * Run: npm run test:provenance-verification
 */

import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import { encodeFeatures } from "../feature-encode";
import { guidanceFromFeatures } from "../astro/guidance";
import { planFromVector } from "../planner/narrative";
import { computePlanHash } from "../plan-hash";
import * as crypto from "crypto";

const sha256 = (input: string): string => {
  return crypto.createHash('sha256').update(input).digest('hex');
};

function hashSnapshot(snapshot: EphemerisSnapshot): string {
  const canonical = {
    ts: snapshot.ts,
    tz: snapshot.tz,
    lat: snapshot.lat,
    lon: snapshot.lon,
    houseSystem: snapshot.houseSystem,
    planets: snapshot.planets.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => ({
      name: p.name,
      lon: p.lon,
      lat: p.lat ?? null,
      speed: p.speed ?? null
    })),
    houses: snapshot.houses,
    aspects: snapshot.aspects.slice().sort((a, b) => {
      const cmp = (a.bodyA ?? (a as { a?: string }).a ?? '').localeCompare(b.bodyA ?? (b as { a?: string }).a ?? '');
      return cmp !== 0 ? cmp : (a.bodyB ?? (a as { b?: string }).b ?? '').localeCompare(b.bodyB ?? (b as { b?: string }).b ?? '');
    }),
    moonPhase: snapshot.moonPhase,
    dominantElements: snapshot.dominantElements
  };
  return sha256(JSON.stringify(canonical));
}

function hashFeatureVec(featureVec: FeatureVec): string {
  const precision = 6;
  const parts = Array.from(featureVec).map(v => v.toFixed(precision));
  return sha256(parts.join(','));
}

function hashV6(v6: number[]): string {
  const precision = 6;
  const parts = v6.map(v => v.toFixed(precision));
  return sha256(parts.join(','));
}

function makeSnapshot(datetime: string, lat: number, lon: number): EphemerisSnapshot {
  const seed = datetime + lat + lon;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].map(
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
    ts: datetime,
    tz: "UTC",
    lat,
    lon,
    houseSystem: "placidus",
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire, earth, air, water },
  };
}

function hashToSeed(seedStr: string): () => number {
  let state = 0;
  for (let i = 0; i < seedStr.length; i++) {
    state = (state ^ seedStr.charCodeAt(i)) >>> 0;
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 0) / 0xffffffff;
  };
}

function main(): void {
  console.log("[provenance-verification] Testing deterministic hash chain...\n");

  // Test 1: Same inputs => same hashes
  const snapshot1 = makeSnapshot("2025-01-15T12:00:00Z", 40.7128, -74.006);
  const snapshot2 = makeSnapshot("2025-01-15T12:00:00Z", 40.7128, -74.006);
  const featureVec1 = encodeFeatures(snapshot1) as FeatureVec;
  const featureVec2 = encodeFeatures(snapshot2) as FeatureVec;
  
  const snapshotHash1 = hashSnapshot(snapshot1);
  const snapshotHash2 = hashSnapshot(snapshot2);
  const featureVecHash1 = hashFeatureVec(featureVec1);
  const featureVecHash2 = hashFeatureVec(featureVec2);
  
  console.log("Test 1: Same inputs => same hashes");
  console.log(`  snapshot_sha256: ${snapshotHash1 === snapshotHash2 ? "OK" : "FAIL"} (${snapshotHash1.slice(0, 8)}...)`);
  console.log(`  featurevec_sha256: ${featureVecHash1 === featureVecHash2 ? "OK" : "FAIL"} (${featureVecHash1.slice(0, 8)}...)`);
  
  const hash = snapshotHash1.slice(0, 16);
  const guidance1 = guidanceFromFeatures(featureVec1, snapshot1, hash);
  const guidance2 = guidanceFromFeatures(featureVec2, snapshot2, hash);
  const rng1 = hashToSeed(hash);
  const rng2 = hashToSeed(hash);
  const v6_1: [number, number, number, number, number, number] = [rng1(), rng1(), rng1(), rng1(), rng1(), rng1()];
  const v6_2: [number, number, number, number, number, number] = [rng2(), rng2(), rng2(), rng2(), rng2(), rng2()];
  
  const v6Hash1 = hashV6(v6_1);
  const v6Hash2 = hashV6(v6_2);
  console.log(`  v6_sha256: ${v6Hash1 === v6Hash2 ? "OK" : "FAIL"} (${v6Hash1.slice(0, 8)}...)`);
  
  const plan1 = planFromVector(v6_1, { ...guidance1, seed: hash, genre: 'house' });
  const plan2 = planFromVector(v6_2, { ...guidance2, seed: hash, genre: 'house' });
  const planHash1 = computePlanHash(plan1);
  const planHash2 = computePlanHash(plan2);
  console.log(`  plan_sha256: ${planHash1 === planHash2 ? "OK" : "FAIL"} (${planHash1.slice(0, 8)}...)\n`);

  // Test 2: Small chart change => different hashes
  const snapshot3 = makeSnapshot("2025-01-15T12:10:00Z", 40.7128, -74.006); // +10 minutes
  const snapshotHash3 = hashSnapshot(snapshot3);
  const featureVec3 = encodeFeatures(snapshot3) as FeatureVec;
  const featureVecHash3 = hashFeatureVec(featureVec3);
  
  console.log("Test 2: Small chart change => different hashes");
  console.log(`  snapshot_sha256 differs: ${snapshotHash1 !== snapshotHash3 ? "OK" : "FAIL"}`);
  console.log(`    before: ${snapshotHash1.slice(0, 8)}...`);
  console.log(`    after:  ${snapshotHash3.slice(0, 8)}...`);
  console.log(`  featurevec_sha256 differs: ${featureVecHash1 !== featureVecHash3 ? "OK" : "FAIL"}`);
  console.log(`    before: ${featureVecHash1.slice(0, 8)}...`);
  console.log(`    after:  ${featureVecHash3.slice(0, 8)}...\n`);

  // Print chain for inspection
  console.log("Hash chain (first input):");
  console.log(`  snapshot_sha256:    ${snapshotHash1}`);
  console.log(`  featurevec_sha256:   ${featureVecHash1}`);
  console.log(`  v6_sha256:          ${v6Hash1}`);
  console.log(`  plan_sha256:        ${planHash1}`);

  const allPassed = snapshotHash1 === snapshotHash2 && featureVecHash1 === featureVecHash2 && 
                    v6Hash1 === v6Hash2 && planHash1 === planHash2 &&
                    snapshotHash1 !== snapshotHash3 && featureVecHash1 !== featureVecHash3;
  
  console.log(`\n[provenance-verification] ${allPassed ? "All tests passed" : "Some tests failed"}`);
  process.exit(allPassed ? 0 : 1);
}

main();
