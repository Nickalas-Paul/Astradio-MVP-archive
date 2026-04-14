/**
 * Tiered reinforcement classification for claim-body discipline (projection-only).
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import { mechanismFamilyToken, mechanismSignalGroupKey } from './dominant-signal-selection';

function compatiblePolarity(a: SemanticClaim, b: SemanticClaim): boolean {
  return a.polarity === b.polarity || a.polarity === 'neutral' || b.polarity === 'neutral';
}

function slotsEqual(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function edgeConnectsToDominant(
  claim: SemanticClaim,
  dominantClaims: readonly SemanticClaim[],
  core: SemanticCore
): boolean {
  const edges = core.tension_harmony?.claim_edges;
  if (!edges || edges.length === 0) return false;
  const dominantIds = new Set(dominantClaims.map((d) => d.claim_id as string));
  const cid = claim.claim_id as string;
  for (const e of edges) {
    const from = e.from_claim_id as string;
    const to = e.to_claim_id as string;
    if (from === cid && dominantIds.has(to)) return true;
    if (to === cid && dominantIds.has(from)) return true;
  }
  return false;
}

function slotAugmentedMatch(c: SemanticClaim, d: SemanticClaim): boolean {
  return (
    slotsEqual(c.participant_slot_indices, d.participant_slot_indices) &&
    (c.derivation_code === d.derivation_code || mechanismFamilyToken(c) === mechanismFamilyToken(d))
  );
}

/**
 * Tier 1: same `mechanismSignalGroupKey` as some dominant.
 * Tier 2: same mechanism family + compatible polarity (and not Tier 1 — checked first).
 * Tier 3: valid undirected edge to some dominant in `tension_harmony.claim_edges`.
 * Tier 4: slot match plus same derivation or same family as some dominant.
 * Otherwise drift (`null`).
 */
export function reinforcementTier(
  claim: SemanticClaim,
  dominantClaims: readonly SemanticClaim[],
  core: SemanticCore
): 1 | 2 | 3 | 4 | null {
  if (dominantClaims.length === 0) return null;

  for (const d of dominantClaims) {
    if (mechanismSignalGroupKey(claim) === mechanismSignalGroupKey(d)) return 1;
  }
  for (const d of dominantClaims) {
    if (mechanismFamilyToken(claim) === mechanismFamilyToken(d) && compatiblePolarity(claim, d)) {
      return 2;
    }
  }
  if (edgeConnectsToDominant(claim, dominantClaims, core)) return 3;
  for (const d of dominantClaims) {
    if (slotAugmentedMatch(claim, d)) return 4;
  }
  return null;
}

/** Sort key: strength descending, priority_rank ascending, claim_id ascending. */
export function compareClaimsDeterministic(a: SemanticClaim, b: SemanticClaim): number {
  if (a.strength !== b.strength) {
    return a.strength > b.strength ? -1 : 1;
  }
  if (a.priority_rank !== b.priority_rank) {
    return a.priority_rank - b.priority_rank;
  }
  return (a.claim_id as ClaimId).localeCompare(b.claim_id as ClaimId);
}

export function sortClaimsDeterministic(claims: readonly SemanticClaim[]): SemanticClaim[] {
  return [...claims].sort(compareClaimsDeterministic);
}
