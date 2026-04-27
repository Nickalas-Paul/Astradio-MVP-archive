/**
 * Deterministic composition layer: filter + order mechanism-window claims per surface, before MEP.
 * Pure functions only. Does not mutate canonical `SemanticCore` or input slices.
 */
import type { SemanticClaim } from '../../semantic/semantic-core';
import type { ExpansionTier, ProjectionOptions, ProjectionSurface } from '../projection-types';
import { mechanismFamilyToken } from './dominant-signal-selection';

export type SurfaceMechanismCompositionContext = {
  surface: ProjectionSurface;
  tier: ExpansionTier;
  seed: string;
  options: ProjectionOptions;
};

type Band = 0 | 1 | 2;

function floorForTier(tier: ExpansionTier, windowSize: number): number {
  const t = tier === 'baseline' ? 3 : tier === 'expanded' ? 5 : 8;
  return Math.min(t, windowSize);
}

function isCrossSlot(c: SemanticClaim): boolean {
  return c.participant_slot_indices.length >= 2;
}

function isCrossChartDerived(c: SemanticClaim): boolean {
  return c.derivation_code === 'DERIVE_CROSS_CHART_VEC';
}

function isRelationalRelFamily(c: SemanticClaim): boolean {
  const t = mechanismFamilyToken(c);
  return t === 'rel_harmony' || t === 'rel_friction' || t === 'rel_intensity';
}

function isCrossElementOrTensionFamily(c: SemanticClaim): boolean {
  const t = mechanismFamilyToken(c);
  return t === 'cross_element' || t === 'cross_tension';
}

/** Profile: single-slot, non-cross, non-relational / non-cross-pair. */
function profileStrictKeep(c: SemanticClaim): boolean {
  if (isCrossSlot(c) || isCrossChartDerived(c)) return false;
  if (isRelationalRelFamily(c) || isCrossElementOrTensionFamily(c)) return false;
  return true;
}

/** Compat: cross-slot, cross-derived, relational or cross family tokens. */
function compatStrictKeep(c: SemanticClaim): boolean {
  return isCrossSlot(c) || isCrossChartDerived(c) || isRelationalRelFamily(c) || isCrossElementOrTensionFamily(c);
}

/** Isolated primary only [0]. */
function isSoloPrimaryOnly(c: SemanticClaim): boolean {
  return c.participant_slot_indices.length === 1 && c.participant_slot_indices[0] === 0;
}

/** Group: multi-slot or any non-solo-primary-only. */
function groupStrictKeep(c: SemanticClaim): boolean {
  if (isCrossSlot(c)) return true;
  if (isSoloPrimaryOnly(c)) return false;
  return true;
}

function subarrayPreserveBaseOrder(
  base: readonly SemanticClaim[],
  predicate: (c: SemanticClaim) => boolean
): SemanticClaim[] {
  const out: SemanticClaim[] = [];
  for (const c of base) {
    if (predicate(c)) out.push(c);
  }
  return out;
}

function compareComposed(a: SemanticClaim, b: SemanticClaim, bandA: number, bandB: number): number {
  if (bandA !== bandB) return bandA - bandB;
  if (b.strength !== a.strength) return b.strength - a.strength;
  if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
  return a.claim_id.localeCompare(b.claim_id);
}

/**
 * window slice → filter → fallback → sort → return.
 * @param baseSlice — `core.claims.slice(0, claimWindow(tier))` (read-only; copy only).
 */
export function applySurfaceMechanismComposition(
  baseSlice: readonly SemanticClaim[],
  ctx: SurfaceMechanismCompositionContext
): { claims: readonly SemanticClaim[] } {
  const { surface, tier } = ctx;
  const base = baseSlice;
  const n = base.length;
  if (n === 0) return { claims: [] };

  const floor = floorForTier(tier, n);

  if (surface === 'sandbox') {
    return { claims: base.slice() };
  }

  if (surface === 'overlay_pair' || surface === 'daily' || surface === 'feed' || surface === 'campaign') {
    return { claims: base.slice() };
  }

  let keepPredicate: (c: SemanticClaim) => boolean;
  if (surface === 'profile') {
    keepPredicate = profileStrictKeep;
  } else if (surface === 'compat_pair') {
    keepPredicate = compatStrictKeep;
  } else if (surface === 'group') {
    keepPredicate = groupStrictKeep;
  } else {
    return { claims: base.slice() };
  }

  const strict = subarrayPreserveBaseOrder(base, keepPredicate);
  const strictIds = new Set(strict.map((c) => c.claim_id));
  let final: SemanticClaim[];
  let usedFull = false;

  if (strict.length >= floor) {
    final = strict.slice();
  } else {
    const merged: SemanticClaim[] = strict.slice();
    const have = new Set(merged.map((c) => c.claim_id));
    for (const c of base) {
      if (merged.length >= floor) break;
      if (!have.has(c.claim_id)) {
        merged.push(c);
        have.add(c.claim_id);
      }
    }
    if (merged.length < floor) {
      final = base.slice();
      usedFull = true;
    } else {
      final = merged;
    }
  }

  const bandMap = new Map<string, Band>();
  if (usedFull) {
    for (const c of final) bandMap.set(c.claim_id, 2);
  } else {
    for (const c of final) {
      if (strictIds.has(c.claim_id)) bandMap.set(c.claim_id, 0);
      else bandMap.set(c.claim_id, 1);
    }
  }

  const arr = final.slice();
  const bands = (id: string): number => bandMap.get(id) ?? 2;
  arr.sort((a, b) => compareComposed(a, b, bands(a.claim_id), bands(b.claim_id)));
  return { claims: arr };
}
