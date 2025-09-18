
// vnext/plan-generator.ts
// ML-only cascade generator (no rules fallback)

import crypto from "crypto";
import type { FeatureVec, Plan } from "./contracts";
import { generateWithStudent, studentVector, vectorToPlan } from "./ml/student";
import { planFromVector } from "./planner/narrative";
import { guidanceFromFeatures } from "./astro/guidance";
import { retrieveNearestPlan, addToBank } from "./ml/retrieval";
import { refine } from "./ml/refiner";
import { audition, ruleQualityPass } from "./audition-gate";
import { logAudit } from "./logger";
import { MIN_RULE_QUALITY } from "./config/quality";

const K = Number(process.env.VNEXT_K || 8);
const MIN_Q = MIN_RULE_QUALITY;
const JITTER = Number(process.env.VNEXT_JITTER || 0.10); // 0..1

function jitter(v: number[], sigma: number) {
  return v.map(x => Math.max(0, Math.min(1, x + (crypto.randomBytes(1)[0]/255 - 0.5) * 2 * sigma)));
}


export async function generatePlanMLOnly(feat: FeatureVec, chartContext?: any): Promise<{ plan: Plan; source: string; diag: any }> {
  const { vector: base, modelVersion, source: modelSource } = await studentVector(feat, chartContext); // [6] in [0,1]
  
  // Compute astrological guidance if chartContext provided
  let guidance: any = undefined;
  if (chartContext) {
    try {
      // Convert chartContext to EphemerisSnapshot format
      const snapshot = {
        ts: chartContext.ts || chartContext.date || new Date().toISOString(),
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
      guidance = guidanceFromFeatures(feat, snapshot);
      console.log(`🔮 Astro guidance: tempo=${guidance.tempoBias.toFixed(2)}, arc=${guidance.arcBias.toFixed(2)}, density=${guidance.densityBias.toFixed(2)}`);
    } catch (e) {
      console.warn(`⚠️ Failed to compute astro guidance: ${e}`);
    }
  }
  
  const candidates = [base, ...Array.from({length: K-1}, (_,i)=> jitter(base, JITTER))];

  const scored = candidates.map(v6 => {
    const plan = planFromVector(v6 as any, guidance);
    const q = ruleQualityPass(plan);
    return { plan, q, v6 };
  }).sort((a,b)=> b.q.score - a.q.score);

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
      modelSource,
      canaryInfo: modelVersion === 'v2' ? 'canary-active' : 'baseline'
    } 
  };
}

