/**
 * Sonic Mirror determinism + melody caps assertions.
 * 1) Same seed + same inputs => same plan_sha256 (and same audio.sha256 when WAV enabled, via existing soak).
 * 2) Melodic motion caps: max melody sustain < X, melody events per phase >= N.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/mirror-determinism.js
 */

import * as crypto from "crypto";
import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import { encodeFeatures } from "../feature-encode";
import { guidanceFromFeatures } from "../astro/guidance";
import { planFromVector } from "../planner/narrative";
import { computePlanHash } from "../plan-hash";

const ENCOUNTER_SEC = 15;
const RECOGNITION_SEC = 30;
const INTEGRATION_SEC = 15;
const MAX_MELODY_SUSTAIN_ASSERT_SEC = 5;
const MIN_MELODY_PER_PHASE_ASSERT: [number, number, number] = [8, 12, 8];

function makeSnapshot(datetime: string, lat: number, lon: number): EphemerisSnapshot {
  const seed = datetime + lat + lon;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const planets = [
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
  ].map((name, i) => ({ name, lon: ((h + i * 37) * 17) % 360 }));
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
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5;  state >>>= 0;
    return (state >>> 0) / 0xffffffff;
  };
}

function generatePlanDeterministic(snapshot: EphemerisSnapshot, hash: string): Plan {
  const featureVec = encodeFeatures(snapshot) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, snapshot);
  const guidanceWithSeed = { ...guidance, seed: hash };
  const rng = hashToSeed(hash);
  const v6: [number, number, number, number, number, number] = [rng(), rng(), rng(), rng(), rng(), rng()];
  return planFromVector(v6, guidanceWithSeed);
}

function melodyMetrics(plan: Plan): { maxSustainSec: number; perPhase: [number, number, number] } {
  const secPerBeat = 60 / plan.bpm;
  const barSec = 4 * secPerBeat;
  const phaseForBar = (bar: number): 0 | 1 | 2 => (bar < 4 ? 0 : bar < 12 ? 1 : 2);
  const melody = plan.events.filter((e) => e.channel === "melody").sort((a, b) => a.t0 - b.t0);
  let maxSustainSec = 0;
  for (const e of melody) {
    const d = e.t1 - e.t0;
    if (d > maxSustainSec) maxSustainSec = d;
  }
  const perPhase: [number, number, number] = [0, 0, 0];
  for (const e of melody) {
    const bar = Math.floor(e.t0 / barSec);
    perPhase[phaseForBar(bar)]++;
  }
  return { maxSustainSec, perPhase };
}

function main(): void {
  let failed = 0;
  const FIXED = { datetime: "2025-01-15T12:00:00Z", lat: 40.7128, lon: -74.006 };
  const snapshot = makeSnapshot(FIXED.datetime, FIXED.lat, FIXED.lon);
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex").slice(0, 32);

  console.log("[mirror-determinism] 1) Same seed + same inputs => same plan_sha256");
  const plan1 = generatePlanDeterministic(snapshot, payloadHash);
  const plan2 = generatePlanDeterministic(snapshot, payloadHash);
  const hash1 = computePlanHash(plan1);
  const hash2 = computePlanHash(plan2);
  if (hash1 !== hash2) {
    console.error("FAIL: plan_sha256 differed across two runs:", hash1, "vs", hash2);
    failed++;
  } else {
    console.log("OK: plan_sha256 stable:", hash1.slice(0, 16) + "...");
  }

  console.log("[mirror-determinism] 2) Melody caps: max sustain < X, per-phase >= N");
  const { maxSustainSec, perPhase } = melodyMetrics(plan1);
  if (maxSustainSec >= MAX_MELODY_SUSTAIN_ASSERT_SEC) {
    console.error(`FAIL: max melody sustain ${maxSustainSec.toFixed(2)}s >= ${MAX_MELODY_SUSTAIN_ASSERT_SEC}s`);
    failed++;
  } else {
    console.log(`OK: max melody sustain ${maxSustainSec.toFixed(2)}s < ${MAX_MELODY_SUSTAIN_ASSERT_SEC}s`);
  }
  for (let p = 0; p < 3; p++) {
    const minRequired = MIN_MELODY_PER_PHASE_ASSERT[p];
    if (perPhase[p] < minRequired) {
      console.error(`FAIL: phase ${p} melody count ${perPhase[p]} < ${minRequired}`);
      failed++;
    } else {
      console.log(`OK: phase ${p} melody count ${perPhase[p]} >= ${minRequired}`);
    }
  }

  if (failed > 0) {
    console.error("\n[mirror-determinism] " + failed + " assertion(s) failed");
    process.exit(1);
  }
  console.log("\n[mirror-determinism] All assertions passed.");
}

main();
