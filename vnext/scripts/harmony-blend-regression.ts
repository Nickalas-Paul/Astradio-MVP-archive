/**
 * Color-shift harmony blending regression: harmony overlap exists, determinism, max harmony sustain.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/harmony-blend-regression.js
 */

import * as crypto from "crypto";
import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import { encodeFeatures } from "../feature-encode";
import { guidanceFromFeatures } from "../astro/guidance";
import { planFromVector } from "../planner/narrative";
import { renderWav60s } from "../audio/wav-renderer";

const FIXED = { datetime: "2025-01-15T12:00:00Z", lat: 40.7128, lon: -74.006 };
const HARMONY_MAX_SUSTAIN_SEC = 8;

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

function generatePlan(snapshot: EphemerisSnapshot, hash: string): Plan {
  const featureVec = encodeFeatures(snapshot) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, snapshot);
  const guidanceWithSeed = { ...guidance, seed: hash };
  const rng = hashToSeed(hash);
  const v6: [number, number, number, number, number, number] = [rng(), rng(), rng(), rng(), rng(), rng()];
  return planFromVector(v6, guidanceWithSeed);
}

function main(): void {
  let failed = 0;
  const snapshot = makeSnapshot(FIXED.datetime, FIXED.lat, FIXED.lon);
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex").slice(0, 32);
  const plan = generatePlan(snapshot, payloadHash);
  const payload = { hash: payloadHash };

  const harmony = plan.events.filter((e) => e.channel === "harmony").sort((a, b) => a.t0 - b.t0 || a.pitch - b.pitch);
  const byChordT0 = new Map<number, { t0: number; maxT1: number }>();
  for (const ev of harmony) {
    const key = Math.round(ev.t0 * 1000);
    const t1 = ev.t1;
    if (!byChordT0.has(key)) byChordT0.set(key, { t0: ev.t0, maxT1: t1 });
    else byChordT0.get(key)!.maxT1 = Math.max(byChordT0.get(key)!.maxT1, t1);
  }
  const chordStarts = Array.from(byChordT0.keys()).sort((a, b) => a - b);

  console.log("[harmony-blend-regression] 1) Harmony overlap exists");
  let overlapCount = 0;
  for (let i = 0; i < chordStarts.length - 1; i++) {
    const cur = byChordT0.get(chordStarts[i])!;
    const nextT0 = byChordT0.get(chordStarts[i + 1])!.t0;
    if (nextT0 < cur.maxT1) overlapCount++;
  }
  if (overlapCount <= 0) {
    console.error("FAIL: no harmony events with next starting before current ends (overlap count =", overlapCount, ")");
    failed++;
  } else {
    console.log("OK: harmony overlap count =", overlapCount);
  }

  console.log("[harmony-blend-regression] 2) Determinism: render twice => same audio.sha256");
  const r1 = renderWav60s(plan, payload, payload.hash, { sampleRate: 22050, channels: 1 });
  const r2 = renderWav60s(plan, payload, payload.hash, { sampleRate: 22050, channels: 1 });
  if (r1.sha256 !== r2.sha256) {
    console.error("FAIL: audio.sha256 differs:", r1.sha256, "vs", r2.sha256);
    failed++;
  } else {
    console.log("OK: audio.sha256 stable:", r1.sha256.slice(0, 16) + "...");
  }

  console.log("[harmony-blend-regression] 3) Harmony notes <= max sustain (", HARMONY_MAX_SUSTAIN_SEC, "s)");
  for (const ev of harmony) {
    const dur = ev.t1 - ev.t0;
    if (dur > HARMONY_MAX_SUSTAIN_SEC) {
      console.error("FAIL: harmony note exceeds", HARMONY_MAX_SUSTAIN_SEC, "s: duration", dur.toFixed(2), "s");
      failed++;
    }
  }
  if (failed === 0) console.log("OK: all harmony durations <=", HARMONY_MAX_SUSTAIN_SEC, "s");

  if (failed > 0) {
    console.error("\n[harmony-blend-regression]", failed, "assertion(s) failed");
    process.exit(1);
  }
  console.log("\n[harmony-blend-regression] All checks passed.");
}

main();
