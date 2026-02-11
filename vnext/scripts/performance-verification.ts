/**
 * Performance Layer v2 verification: print velocity stats by phrase and harmony onset distribution.
 * Confirms: (1) velocity varies by phrase, (2) harmony chord onsets are not all at bar start.
 * Run after build: node dist/vnext/vnext/scripts/performance-verification.js
 */

import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import { encodeFeatures } from "../feature-encode";
import { guidanceFromFeatures } from "../astro/guidance";
import { planFromVector } from "../planner/narrative";

const PHRASE_BARS = 4;

function makeSnapshot(): EphemerisSnapshot {
  const input = { datetime: "2025-01-15T12:00:00Z", lat: 40.7128, lon: -74.006 };
  const seed = input.datetime + input.lat + input.lon;
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
    ts: input.datetime,
    tz: "UTC",
    lat: input.lat,
    lon: input.lon,
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
  const snapshot = makeSnapshot();
  const hash = "perf-verify-" + snapshot.ts;
  const featureVec = encodeFeatures(snapshot) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, snapshot, hash);
  const guidanceWithSeed = { ...guidance, seed: hash };
  const rng = hashToSeed(hash);
  const v6: [number, number, number, number, number, number] = [rng(), rng(), rng(), rng(), rng(), rng()];
  const plan = planFromVector(v6, guidanceWithSeed);

  const bpm = plan.bpm;
  const secPerBeat = 60 / bpm;
  const secPerBar = secPerBeat * 4;

  const melody = plan.events.filter((e) => e.channel === "melody");
  const harmony = plan.events.filter((e) => e.channel === "harmony");

  const velByPhrase: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const e of melody) {
    const bar = Math.floor(e.t0 / secPerBar);
    const phrase = Math.min(3, Math.floor(bar / PHRASE_BARS));
    velByPhrase[phrase].push(e.velocity);
  }
  console.log("[performance-verification] Velocity by phrase (melody plan velocity):");
  for (let p = 0; p < 4; p++) {
    const arr = velByPhrase[p];
    if (arr.length === 0) console.log(`  phrase ${p}: (none)`);
    else {
      const sum = arr.reduce((a, b) => a + b, 0);
      const avg = sum / arr.length;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      console.log(`  phrase ${p}: n=${arr.length} avg=${avg.toFixed(3)} min=${min.toFixed(3)} max=${max.toFixed(3)}`);
    }
  }

  const onsetBuckets: Record<string, number> = { "0.0": 0, "1.0": 0, "1.5": 0, "2.0": 0, "2.5": 0, "3.0": 0, "other": 0 };
  const seenT0 = new Set<number>();
  for (const e of harmony) {
    const t0Rounded = Math.round(e.t0 * 100) / 100;
    if (seenT0.has(t0Rounded)) continue;
    seenT0.add(t0Rounded);
    const beatInBar = (e.t0 / secPerBeat) % 4;
    const key = beatInBar < 0.1 ? "0.0" : beatInBar >= 0.9 && beatInBar < 1.1 ? "1.0" : beatInBar >= 1.4 && beatInBar < 1.6 ? "1.5" : beatInBar >= 1.9 && beatInBar < 2.1 ? "2.0" : beatInBar >= 2.4 && beatInBar < 2.6 ? "2.5" : beatInBar >= 2.9 && beatInBar < 3.1 ? "3.0" : "other";
    onsetBuckets[key] = (onsetBuckets[key] ?? 0) + 1;
  }
  console.log("[performance-verification] Harmony chord onset distribution (beats within bar):");
  console.log("  " + JSON.stringify(onsetBuckets));
  const notAllDownbeat = (onsetBuckets["1.5"] ?? 0) + (onsetBuckets["2.0"] ?? 0) + (onsetBuckets["other"] ?? 0) > 0;
  console.log("[performance-verification] Harmony onsets vary (not all at 0.0): " + (notAllDownbeat ? "OK" : "FAIL"));
}

main();
