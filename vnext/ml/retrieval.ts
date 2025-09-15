// vnext/ml/retrieval.ts
// Retrieval system for ML safety net (pure ML, no rules)

import type { FeatureVec, Plan } from "../contracts";

export async function retrieveNearestPlan(_feat: FeatureVec): Promise<Plan | null> {
  // Stub: wire to real priors bank later
  return null;
}
