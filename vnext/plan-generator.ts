// vnext/plan-generator.ts
// ML-only cascade generator (no rules fallback)

import type { FeatureVec, Plan } from "./contracts";
import { generateWithStudent } from "./ml/student";
import { retrieveNearestPlan } from "./ml/retrieval";
import { refine } from "./ml/refiner";
import { audition } from "./audition-gate";

export async function generatePlanMLOnly(feat: FeatureVec): Promise<{ plan: Plan; source: string }> {
  // 1) Student
  {
    const plan = await generateWithStudent(feat);
    const res = audition(plan);
    if (res.passed) {
      return { plan, source: 'student' };
    }
  }
  
  // 2) Retrieval + Refiner
  {
    const prior = await retrieveNearestPlan(feat);
    if (prior) {
      const plan = await refine(prior, feat);
      const res = audition(plan);
      if (res.passed) {
        return { plan, source: 'retrieval+refiner' };
      }
    }
  }
  
  // 3) Last-known-good cache (optional later)
  throw new Error('ML cascade failed (no rules fallback)');
}
