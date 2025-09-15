// vnext/ml/refiner.ts
// Refiner for plan enhancement (ML-only)

import type { FeatureVec, Plan } from "../contracts";

export async function refine(plan: Plan, _feat: FeatureVec): Promise<Plan> {
  // No-op initially; keep interface stable
  return plan;
}
