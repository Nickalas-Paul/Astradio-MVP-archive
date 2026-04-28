import type { RelationalFieldScoreContract } from './contracts';
import type { RelationalIntent } from './relational-intent';

export type IntentFitBucket = 'high' | 'moderate' | 'low';

const INTENT_WEIGHTS: Record<
  RelationalIntent,
  { cohesion: number; tension: number; transformation: number; stability: number }
> = {
  friend: { cohesion: 0.4, tension: 0.1, transformation: 0.15, stability: 0.35 },
  lover: { cohesion: 0.3, tension: 0.1, transformation: 0.4, stability: 0.2 },
  rival: { cohesion: 0.25, tension: 0.35, transformation: 0.25, stability: 0.15 },
  collaborator: { cohesion: 0.35, tension: 0.15, transformation: 0.15, stability: 0.35 },
};

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function canonicalIntentRank(scoring: RelationalFieldScoreContract, intent: RelationalIntent): number {
  const weights = INTENT_WEIGHTS[intent];
  return clamp01(
    scoring.derived_indices.cohesion_index * weights.cohesion +
      scoring.derived_indices.tension_index * weights.tension +
      scoring.derived_indices.transformation_index * weights.transformation +
      scoring.derived_indices.stability_index * weights.stability
  );
}

export function bucketIntentFit(score: number): IntentFitBucket {
  if (score >= 0.66) return 'high';
  if (score >= 0.33) return 'moderate';
  return 'low';
}
