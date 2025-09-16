// vnext/ml/retrieval.ts - Retrieval priors bank with cosine K-NN
import type { FeatureVec, Plan } from "../contracts";

type Entry = { id: string; feat: Float32Array; plan: Plan; timestamp: number };
const bank: Entry[] = [];

export function addToBank(id: string, feat: Float32Array, plan: Plan) {
  bank.push({ 
    id, 
    feat, 
    plan, 
    timestamp: Date.now() 
  });
  
  console.log(`📚 Added to retrieval bank: ${id} (${bank.length} total)`);
}

export async function retrieveNearestPlan(feat: FeatureVec): Promise<Plan | null> {
  if (!bank.length) {
    console.log("📚 Retrieval bank is empty");
    return null;
  }
  
  let best: { score: number; plan: Plan } | null = null;
  
  for (const e of bank) {
    const score = cosine(feat, e.feat);
    if (!best || score > best.score) {
      best = { score, plan: e.plan };
    }
  }
  
  const threshold = 0.7; // Minimum similarity threshold
  if (best && best.score >= threshold) {
    console.log(`🎯 Retrieved plan with similarity: ${(best.score * 100).toFixed(1)}%`);
    return best.plan;
  }
  
  console.log(`📚 No similar plans found (best similarity: ${best ? (best.score * 100).toFixed(1) : 0}%)`);
  return null;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export function getBankStats() {
  return {
    size: bank.length,
    entries: bank.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      age: Date.now() - e.timestamp
    }))
  };
}

export function clearBank() {
  const oldSize = bank.length;
  bank.length = 0;
  console.log(`🗑️ Cleared retrieval bank (${oldSize} entries removed)`);
}