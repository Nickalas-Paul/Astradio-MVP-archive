/**
 * Tail-fill relatedness for controlled mechanism-expression paragraphs (projection-only).
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import { mechanismGroupPartitionKey } from './dominant-signal-selection';

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

function graphConnectsToDominant(claimId: string, dominantIds: ReadonlySet<string>, core: SemanticCore): boolean {
  const edges = core.tension_harmony?.claim_edges;
  if (!edges || edges.length === 0) return false;
  for (const e of edges) {
    const from = e.from_claim_id as string;
    const to = e.to_claim_id as string;
    if (from === claimId && dominantIds.has(to)) return true;
    if (to === claimId && dominantIds.has(from)) return true;
  }
  return false;
}

/**
 * True if `claim` may share tail thematic proximity with any dominant claim
 * (same mechanism partition, same participant slots, or tension-harmony edge).
 */
export function claimMechanismRelatedToDominants(
  claim: SemanticClaim,
  dominantClaims: readonly SemanticClaim[],
  core: SemanticCore
): boolean {
  if (dominantClaims.length === 0) return false;
  const dominantIds = new Set<string>(dominantClaims.map((c) => c.claim_id));

  const pk = mechanismGroupPartitionKey(claim);
  for (const d of dominantClaims) {
    if (mechanismGroupPartitionKey(d) === pk) return true;
    if (slotsEqual(claim.participant_slot_indices, d.participant_slot_indices)) return true;
  }
  if (graphConnectsToDominant(claim.claim_id, dominantIds, core)) return true;
  return false;
}
