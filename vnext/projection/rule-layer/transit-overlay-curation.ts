/**
 * Profile Current Transit (overlay_pair) — ranking, cap, diversification, and selection.
 * Pure functions; used by assembleOverlayActivationSections.
 */

import type { SnapshotAspect } from '../../contracts';
import {
  buildAspectKey,
  getAspectInsight,
} from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { PLANET_TIERS } from '../placement-keys';
import type { DirectedSnapshotAspect } from '../../synastry/synastry-types';

export const MAX_ACTIVATIONS_PER_DAY = 5 as const;
export const MIN_ACTIVATIONS_QUIET_FALLBACK = 3 as const;

export type TransitDiversificationContext = {
  calendarDate: string;
  aspectKeys: string[];
  natalBodies: string[];
  transitBodies: string[];
  generatedAt: string;
};

export type RankedActivation = {
  aspect: DirectedSnapshotAspect;
  natalBody: string;
  transitBody: string;
  aspectKey: string;
  tierPriority: number;
  priorityScore: number;
  penaltyApplied?: boolean;
};

const ALL_NATAL_BODIES = new Set<string>([
  ...PLANET_TIERS.core_identity,
  ...PLANET_TIERS.personal_expression,
  ...PLANET_TIERS.growth_expansion,
  ...PLANET_TIERS.evolutionary_currents,
]);

export function getNatalBodyTierPriority(body: string): number {
  const b = body.toUpperCase();
  if ((PLANET_TIERS.core_identity as readonly string[]).includes(b)) return 0;
  if ((PLANET_TIERS.personal_expression as readonly string[]).includes(b)) return 1;
  if ((PLANET_TIERS.growth_expansion as readonly string[]).includes(b)) return 2;
  if ((PLANET_TIERS.evolutionary_currents as readonly string[]).includes(b)) return 3;
  return 999;
}

export function getTierIdForNatalBody(body: string): string {
  const b = body.toUpperCase();
  if ((PLANET_TIERS.core_identity as readonly string[]).includes(b)) return 'core_identity';
  if ((PLANET_TIERS.personal_expression as readonly string[]).includes(b)) return 'personal_expression';
  if ((PLANET_TIERS.growth_expansion as readonly string[]).includes(b)) return 'growth_expansion';
  return 'evolutionary_currents';
}

function isDirectedAspect(
  aspect: SnapshotAspect | DirectedSnapshotAspect
): aspect is DirectedSnapshotAspect {
  return (
    typeof (aspect as DirectedSnapshotAspect).sourceSlotIndex === 'number' &&
    typeof (aspect as DirectedSnapshotAspect).targetSlotIndex === 'number'
  );
}

/** Natal chart slot 0 → transit slot 1 only (drops inverted transit→natal sweep). */
export function filterNatalToTransitAspects(
  aspects: readonly (SnapshotAspect | DirectedSnapshotAspect)[]
): DirectedSnapshotAspect[] {
  const directed = aspects.filter(isDirectedAspect);
  if (directed.length > 0) {
    return directed.filter((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1);
  }
  return aspects
    .filter((a) => ALL_NATAL_BODIES.has(String(a.bodyA || '').toUpperCase()))
    .map((a) => ({
      ...a,
      sourceSlotIndex: 0,
      targetSlotIndex: 1,
    })) as DirectedSnapshotAspect[];
}

function isLibraryEligibleActivation(natalBody: string, transitBody: string, type: string): boolean {
  const key = buildAspectKey(natalBody, transitBody, type);
  if (isAspectLibraryKillListed(key)) return false;
  const insight = getAspectInsight(key);
  if (!insight) return false;
  const text = (insight.core_transit || insight.core || '').trim();
  return text.length > 0;
}

export function compareRankedActivations(a: RankedActivation, b: RankedActivation): number {
  if (a.tierPriority !== b.tierPriority) return a.tierPriority - b.tierPriority;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  const orbA = a.aspect.orb ?? 99;
  const orbB = b.aspect.orb ?? 99;
  if (orbA !== orbB) return orbA - orbB;
  return a.aspectKey.localeCompare(b.aspectKey, 'en');
}

export function rankTransitActivations(
  aspects: readonly DirectedSnapshotAspect[]
): RankedActivation[] {
  const byKey = new Map<string, RankedActivation>();
  for (const aspect of aspects) {
    const natalBody = String(aspect.bodyA || '').toUpperCase();
    const transitBody = String(aspect.bodyB || '').toUpperCase();
    if (!ALL_NATAL_BODIES.has(natalBody)) continue;
    if (!isLibraryEligibleActivation(natalBody, transitBody, String(aspect.type || ''))) continue;

    const aspectKey = buildAspectKey(natalBody, transitBody, String(aspect.type || ''));
    const candidate: RankedActivation = {
      aspect,
      natalBody,
      transitBody,
      aspectKey,
      tierPriority: getNatalBodyTierPriority(natalBody),
      priorityScore: aspect.priorityBase ?? aspect.exactness ?? 0,
    };
    const existing = byKey.get(aspectKey);
    if (!existing || compareRankedActivations(candidate, existing) < 0) {
      byKey.set(aspectKey, candidate);
    }
  }
  return [...byKey.values()].sort(compareRankedActivations);
}

export function applyDiversificationPenalty(
  ranked: readonly RankedActivation[],
  previousContext: TransitDiversificationContext | null | undefined
): RankedActivation[] {
  if (!previousContext) return ranked.map((a) => ({ ...a }));

  const previousAspectKeys = new Set(previousContext.aspectKeys);
  const previousNatalBodies = new Set(previousContext.natalBodies.map((b) => b.toUpperCase()));
  const previousTransitBodies = new Set(previousContext.transitBodies.map((b) => b.toUpperCase()));

  return ranked.map((activation) => {
    let penaltyMultiplier = 1;
    if (previousAspectKeys.has(activation.aspectKey)) penaltyMultiplier *= 0.5;
    if (previousNatalBodies.has(activation.natalBody)) penaltyMultiplier *= 0.8;
    if (previousTransitBodies.has(activation.transitBody)) penaltyMultiplier *= 0.8;

    return {
      ...activation,
      priorityScore: activation.priorityScore * penaltyMultiplier,
      penaltyApplied: penaltyMultiplier < 1,
    };
  });
}

export function sortRankedActivations(ranked: readonly RankedActivation[]): RankedActivation[] {
  return [...ranked].sort(compareRankedActivations);
}

export function selectTopActivationsWithDiversity(
  penalizedSorted: readonly RankedActivation[],
  unpenalizedSorted: readonly RankedActivation[],
  maxCount: number = MAX_ACTIVATIONS_PER_DAY
): RankedActivation[] {
  const cap = Math.min(maxCount, penalizedSorted.length);
  let selected = penalizedSorted.slice(0, cap);

  if (selected.length < MIN_ACTIVATIONS_QUIET_FALLBACK && unpenalizedSorted.length > selected.length) {
    const need = Math.min(
      MIN_ACTIVATIONS_QUIET_FALLBACK,
      maxCount,
      unpenalizedSorted.length
    );
    selected = unpenalizedSorted.slice(0, need);
  }

  return selected;
}

export function groupActivationsByTier(
  selected: readonly RankedActivation[]
): Map<string, RankedActivation[]> {
  const byTier = new Map<string, RankedActivation[]>();
  for (const activation of selected) {
    const tierId = getTierIdForNatalBody(activation.natalBody);
    const list = byTier.get(tierId) ?? [];
    list.push(activation);
    byTier.set(tierId, list);
  }
  return byTier;
}

export function diversificationContextFromSelected(
  selected: readonly RankedActivation[],
  calendarDate: string
): TransitDiversificationContext {
  return {
    calendarDate,
    aspectKeys: selected.map((a) => a.aspectKey),
    natalBodies: [...new Set(selected.map((a) => a.natalBody))],
    transitBodies: [...new Set(selected.map((a) => a.transitBody))],
    generatedAt: new Date().toISOString(),
  };
}

export function extractTransitCurationFromSections(
  sections: Array<{ meta?: unknown }>
): TransitDiversificationContext | null {
  for (const sec of sections) {
    const meta = sec.meta as { transitCurationFull?: TransitDiversificationContext } | undefined;
    if (meta?.transitCurationFull?.aspectKeys?.length) {
      return meta.transitCurationFull;
    }
  }

  const keys: string[] = [];
  const natalBodies: string[] = [];
  const transitBodies: string[] = [];
  let calendarDate = '';

  for (const sec of sections) {
    const meta = sec.meta as
      | {
          transitCuration?: {
            aspectKeys?: string[];
            natalBodies?: string[];
            transitBodies?: string[];
            calendarDate?: string;
          };
        }
      | undefined;
    const tc = meta?.transitCuration;
    if (!tc) continue;
    if (tc.calendarDate) calendarDate = tc.calendarDate;
    if (tc.aspectKeys) keys.push(...tc.aspectKeys);
    if (tc.natalBodies) natalBodies.push(...tc.natalBodies);
    if (tc.transitBodies) transitBodies.push(...tc.transitBodies);
  }

  if (keys.length === 0) return null;

  return {
    calendarDate: calendarDate || new Date().toISOString().slice(0, 10),
    aspectKeys: [...new Set(keys)],
    natalBodies: [...new Set(natalBodies.map((b) => b.toUpperCase()))],
    transitBodies: [...new Set(transitBodies.map((b) => b.toUpperCase()))],
    generatedAt: new Date().toISOString(),
  };
}
