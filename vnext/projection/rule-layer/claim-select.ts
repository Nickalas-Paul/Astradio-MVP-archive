/**
 * Step 4 — claim window selection (existing semantic ordering preserved).
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ExpansionTier } from '../projection-types';

export function claimWindow(tier: ExpansionTier): number {
  if (tier === 'baseline') return 6;
  if (tier === 'expanded') return 14;
  return 999;
}

export function selectClaimSlice(core: SemanticCore, tier: ExpansionTier): readonly SemanticClaim[] {
  const n = claimWindow(tier);
  return core.claims.slice(0, n);
}
