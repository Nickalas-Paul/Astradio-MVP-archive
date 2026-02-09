
// vnext/plan-generator.ts
// ML-only cascade generator (no rules fallback)

import crypto from "crypto";
import type { FeatureVec, Plan } from "./contracts";
import { studentVector } from "./ml";
import { planFromVector } from "./planner/narrative";
import { guidanceFromFeatures } from "./astro/guidance";
import { audition, ruleQualityPass } from "./audition-gate";
import { scoreMirrorFidelity } from "./critics";
import { logAudit } from "./logger";
import { MIN_RULE_QUALITY } from "./config/quality";

const MIRROR_FIDELITY_WEIGHT = 0.2;

const K = Number(process.env.VNEXT_K || 8);
const MIN_Q = MIN_RULE_QUALITY;
const JITTER = Number(process.env.VNEXT_JITTER || 0.10); // 0..1

// Deterministic PRNG (xorshift32) seeded from controls.hash to ensure repeatability
function createSeededRNG(seedStr: string) {
  // Derive a 32-bit seed from the hash string deterministically
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed ^ seedStr.charCodeAt(i)) >>> 0;
    // Mix
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909) >>> 0;
  }
  if (seed === 0) seed = 0x9E3779B9; // non-zero default
  let state = seed >>> 0;
  return () => {
    // xorshift32
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5;  state >>>= 0;
    // Map to [0,1)
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

function jitter(v: number[], sigma: number, rand: () => number) {
  if (sigma <= 0) return v.slice();
  return v.map(x => {
    const noise = (rand() - 0.5) * 2 * sigma; // [-sigma, +sigma]
    const y = x + noise;
    return Math.max(0, Math.min(1, y));
  });
}


export async function generatePlanMLOnly(feat: FeatureVec, chartContext?: any): Promise<{ plan: Plan; source: string; diag: any }> {
  const mlResult = await studentVector(feat); // [6] in [0,1]
  const { vector: base, modelVersion } = mlResult;
  
  // Compute astrological guidance if chartContext provided
  let guidance: any = undefined;
  // Create deterministic RNG from controls.hash when available
  const seedStr = (chartContext && (chartContext.hash || chartContext.controls?.hash)) || "seed";
  const rng = createSeededRNG(String(seedStr));
  if (chartContext) {
    try {
      // Convert chartContext to EphemerisSnapshot format
      const snapshot = {
        ts: chartContext.ts ?? chartContext.date ?? "",
        tz: chartContext.tz || chartContext.timezone || "UTC",
        lat: chartContext.lat || chartContext.latitude || 0,
        lon: chartContext.lon || chartContext.longitude || 0,
        houseSystem: chartContext.houseSystem || "placidus",
        planets: chartContext.planets?.map((p: any) => ({
          name: p.name,
          lon: p.lon || p.longitude || 0
        })) || [],
        houses: chartContext.houses || Array.from({length: 12}, (_, i) => i * 30) as [number, number, number, number, number, number, number, number, number, number, number, number],
        aspects: chartContext.aspects || [],
        moonPhase: chartContext.moonPhase || 0.5,
        dominantElements: chartContext.dominantElements || {
          fire: 0.25, earth: 0.25, air: 0.25, water: 0.25
        }
      };
      guidance = guidanceFromFeatures(feat, snapshot, String(seedStr));
      console.log(`🔮 Astro guidance: tempo=${guidance.tempoBias.toFixed(2)}, arc=${guidance.arcBias.toFixed(2)}, density=${guidance.densityBias.toFixed(2)}`);
    } catch (e) {
      console.warn(`⚠️ Failed to compute astro guidance: ${e}`);
    }
  }
  const guidanceWithSeed = guidance ? { ...guidance, seed: String(seedStr) } : { seed: String(seedStr) };
  const candidates = [base, ...Array.from({length: K-1}, () => jitter(base, JITTER, rng))];

  const scored = candidates.map(v6 => {
    const plan = planFromVector(v6 as any, guidanceWithSeed);
    const q = ruleQualityPass(plan);
    const mirrorScore = guidance ? scoreMirrorFidelity(plan, guidance).score : 0.5;
    const rankScore = q.score + MIRROR_FIDELITY_WEIGHT * mirrorScore;
    return { plan, q, v6, rankScore, mirrorScore };
  }).sort((a, b) => b.rankScore - a.rankScore);

  const best = scored[0];
  if (best.q.score < MIN_Q) {
    const diag = scored.map(s => ({score: +s.q.score.toFixed(3), v6: s.v6}));
    const err: any = new Error(`All candidates below threshold ${MIN_Q}`);
    err.statusCode = 422; err.diag = diag;
    throw err;
  }
  return {
    plan: best.plan,
    source: `student-${modelVersion}+rerank`,
    diag: {
      scores: scored.map(s => s.q.score),
      modelVersion,
      modelSource: modelVersion,
      canaryInfo: modelVersion === 'v2' ? 'canary-active' : 'baseline',
      ml_used: mlResult.ml_used,
      tf_backend: mlResult.tf_backend,
      model_sha: mlResult.model_sha,
      inference_ms: mlResult.inference_ms,
    },
  };
}

