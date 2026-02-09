/**
 * Sonic Mirror report: 5 fixed inputs, deterministic plan generation (no ML).
 * Outputs plan_sha256, compact metrics (melody per phase, max sustain, harmony changes, density, rest ratio), mirror fidelity score.
 */

import * as crypto from "crypto";
import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import { encodeFeatures } from "../feature-encode";
import { guidanceFromFeatures } from "../astro/guidance";
import { planFromVector } from "../planner/narrative";
import { computePlanHash } from "../plan-hash";
import { scoreMirrorFidelity } from "../critics";

const ENCOUNTER_SEC = 15;
const RECOGNITION_SEC = 30;
const INTEGRATION_SEC = 15;

const FIXED_INPUTS: Array<{ datetime: string; lat: number; lon: number }> = [
  { datetime: "2025-01-15T12:00:00Z", lat: 40.7128, lon: -74.006 },
  { datetime: "2025-06-21T18:00:00Z", lat: 51.5074, lon: -0.1278 },
  { datetime: "2025-03-20T08:30:00Z", lat: 35.6762, lon: 139.6503 },
  { datetime: "2025-09-22T14:00:00Z", lat: -33.8688, lon: 151.2093 },
  { datetime: "2025-12-21T00:00:00Z", lat: 59.3293, lon: 18.0686 },
];

function makeSnapshot(input: (typeof FIXED_INPUTS)[0]): EphemerisSnapshot {
  const seed = input.datetime + input.lat + input.lon;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const planets = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
  ].map((name, i) => ({ name, lon: ((h + i * 37) * 17) % 360 }));
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

function generatePlanWithoutML(snapshot: EphemerisSnapshot, hash: string): Plan {
  const featureVec = encodeFeatures(snapshot) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, snapshot, hash);
  const guidanceWithSeed = { ...guidance, seed: hash };
  const rng = hashToSeed(hash);
  const v6: [number, number, number, number, number, number] = [
    rng(),
    rng(),
    rng(),
    rng(),
    rng(),
    rng(),
  ];
  return planFromVector(v6, guidanceWithSeed);
}

function compactMetrics(plan: Plan): {
  melodyPerPhase: [number, number, number];
  maxMelodySustainSec: number;
  harmonyChangesPerPhase: [number, number, number];
  densityPerChannel: Record<string, number>;
  restRatio: number;
} {
  const secPerBeat = 60 / plan.bpm;
  const melody = plan.events.filter((e) => e.channel === "melody").sort((a, b) => a.t0 - b.t0);
  const harmony = plan.events.filter((e) => e.channel === "harmony").sort((a, b) => a.t0 - b.t0);

  const phaseEnds = [ENCOUNTER_SEC, ENCOUNTER_SEC + RECOGNITION_SEC, ENCOUNTER_SEC + RECOGNITION_SEC + INTEGRATION_SEC];
  const melodyPerPhase: [number, number, number] = [0, 0, 0];
  for (const e of melody) {
    if (e.t0 < phaseEnds[0]) melodyPerPhase[0]++;
    else if (e.t0 < phaseEnds[1]) melodyPerPhase[1]++;
    else melodyPerPhase[2]++;
  }

  let maxMelodySustainSec = 0;
  for (const e of melody) {
    const d = e.t1 - e.t0;
    if (d > maxMelodySustainSec) maxMelodySustainSec = d;
  }

  const barSec = 4 * secPerBeat;
  const chordStarts = Array.from(new Set(harmony.map((e) => Math.floor(e.t0 / barSec) * barSec)));
  chordStarts.sort((a, b) => a - b);
  let prevRoot: number | null = null;
  const harmonyChangesPerPhase: [number, number, number] = [0, 0, 0];
  for (const t0 of chordStarts) {
    const chord = harmony.filter((e) => Math.abs(e.t0 - t0) < 0.01);
    const root = chord.length ? Math.min(...chord.map((e) => e.pitch)) : 0;
    if (prevRoot !== null && root !== prevRoot) {
      if (t0 < phaseEnds[0]) harmonyChangesPerPhase[0]++;
      else if (t0 < phaseEnds[1]) harmonyChangesPerPhase[1]++;
      else harmonyChangesPerPhase[2]++;
    }
    prevRoot = root;
  }

  const durationSec = plan.durationSec || 60;
  const densityPerChannel: Record<string, number> = {};
  for (const ch of ["melody", "harmony", "bass", "rhythm"]) {
    const count = plan.events.filter((e) => e.channel === ch).length;
    densityPerChannel[ch] = count / durationSec;
  }

  const totalNoteSec = plan.events.reduce((s, e) => s + (e.t1 - e.t0), 0);
  const restRatio = Math.max(0, 1 - totalNoteSec / (durationSec * 4));

  return {
    melodyPerPhase,
    maxMelodySustainSec: Math.round(maxMelodySustainSec * 1000) / 1000,
    harmonyChangesPerPhase,
    densityPerChannel,
    restRatio: Math.round(restRatio * 1000) / 1000,
  };
}

function main(): void {
  const inputPath = process.argv[2];
  let inputs = FIXED_INPUTS;
  if (inputPath && inputPath.endsWith(".json")) {
    try {
      const fs = require("fs");
      const raw = fs.readFileSync(inputPath, "utf8");
      inputs = JSON.parse(raw);
    } catch {
      console.error("Failed to read JSON input file, using 5 fixed inputs");
    }
  }

  const hash = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

  console.log("Sonic Mirror Report (deterministic)\n");
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const snapshot = makeSnapshot(input);
    const payloadHash = hash(JSON.stringify(snapshot)).slice(0, 32);
    const plan = generatePlanWithoutML(snapshot, payloadHash);
    const plan_sha256 = computePlanHash(plan);
    const metrics = compactMetrics(plan);
    const guidance = guidanceFromFeatures(encodeFeatures(snapshot) as FeatureVec, snapshot, payloadHash);
    const mirrorScores = scoreMirrorFidelity(plan, guidance);

    console.log(`--- Input ${i + 1}: ${input.datetime} ${input.lat},${input.lon} ---`);
    console.log(`plan_sha256: ${plan_sha256}`);
    console.log(`melody_per_phase: [${metrics.melodyPerPhase.join(", ")}]`);
    console.log(`max_melody_sustain_sec: ${metrics.maxMelodySustainSec}`);
    console.log(`harmony_changes_per_phase: [${metrics.harmonyChangesPerPhase.join(", ")}]`);
    console.log(`density_per_channel: ${JSON.stringify(metrics.densityPerChannel)}`);
    console.log(`rest_ratio: ${metrics.restRatio}`);
    console.log(`mirror_fidelity_score: ${mirrorScores.score.toFixed(4)}`);
    if (i === 0 && guidance.personality) {
      const p = guidance.personality;
      console.log(`personality (pp.v1): temperament.gravity=${p.temperament.gravity.toFixed(2)} warmth=${p.temperament.warmth.toFixed(2)} | moon.permeability=${p.subsystems.moon.permeability.toFixed(2)} | venus.softness=${p.subsystems.venus.softness.toFixed(2)} | mars.propulsion=${p.subsystems.mars.propulsion.toFixed(2)} | outers(pluto/neptune/uranus)=${p.subsystems.outers.plutoDepth.toFixed(2)}/${p.subsystems.outers.neptuneMist.toFixed(2)}/${p.subsystems.outers.uranusEdge.toFixed(2)} | reveal.recognition core/inner/style=${p.reveal.recognition.core.toFixed(2)}/${p.reveal.recognition.inner.toFixed(2)}/${p.reveal.recognition.style.toFixed(2)}`);
    }
    console.log("");
  }
}

main();
