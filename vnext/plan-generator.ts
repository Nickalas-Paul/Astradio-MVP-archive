// vnext/plan-generator.ts
// ML-only cascade generator (no rules fallback)

import crypto from "crypto";
import type { FeatureVec, Plan } from "./contracts";
import { generateWithStudent, studentVector, vectorToPlan } from "./ml/student";
import { planFromVector } from "./planner/narrative";
import { retrieveNearestPlan, addToBank } from "./ml/retrieval";
import { refine } from "./ml/refiner";
import { audition, ruleQualityPass } from "./audition-gate";
import { logAudit } from "./logger";

const K = Number(process.env.VNEXT_K || 8);
const MIN_Q = Number(process.env.MIN_RULE_QUALITY || 0.55);
const JITTER = Number(process.env.VNEXT_JITTER || 0.10); // 0..1

function jitter(v: number[], sigma: number) {
  return v.map(x => Math.max(0, Math.min(1, x + (crypto.randomBytes(1)[0]/255 - 0.5) * 2 * sigma)));
}


export async function generatePlanMLOnly(feat: FeatureVec): Promise<{ plan: Plan; source: string; diag: any }> {
  const base = await studentVector(feat); // [6] in [0,1]
  const candidates = [base, ...Array.from({length: K-1}, (_,i)=> jitter(base, JITTER))];

  const scored = candidates.map(v6 => {
    const plan = planFromVector(v6 as any);
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
  return { plan: best.plan, source: "student+rerank", diag: { scores: scored.map(s => s.q.score) } };
}

