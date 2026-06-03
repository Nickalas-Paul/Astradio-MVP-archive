/**
 * Sandbox pair/group synastry report assembly — tier-stratified activations with Sonic Interplay.
 * Separate from the main section pipeline; consumed by sandbox-composition-execute and the web UI.
 */

import type { EphemerisSnapshot } from '../../contracts';
import type { DirectedSnapshotAspect } from '../../synastry/synastry-types';
import { computeSynastryAspects } from '../../synastry/synastry-compute';
import { buildAspectKey, getAspectInsight } from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../insight-library/synastry-aspect-library-render';
import { capToMaxSentences } from './claim-synthesize';

export const SANDBOX_SYNASTRY_DISPLAY_CAP = 6;
export const SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR = 3;

export type SandboxSynastryTierId = 'personal' | 'social' | 'generational';

export type SandboxSynastryActivationV1 = {
  directionalHeader: string;
  synastryProse: string;
  sonicInterplay: string;
  tier: SandboxSynastryTierId;
  aspectKey: string;
  pairField: string;
};

export type SandboxSynastryTierBlockV1 = {
  tierId: SandboxSynastryTierId;
  title: string;
  activations: SandboxSynastryActivationV1[];
};

export type SandboxSynastryPairSectionV1 = {
  sourceSlotIndex: number;
  targetSlotIndex: number;
  /** Group mode: "Alice + Bob". Pair mode: omitted when empty. */
  pairHeader: string;
  tierBlocks: SandboxSynastryTierBlockV1[];
};

export type SandboxSynastryReportV1 = {
  schema_version: 'sandbox_synastry_v1';
  mode: 'pair' | 'group';
  pairSections: SandboxSynastryPairSectionV1[];
};

export type SandboxSynastryParticipantV1 = {
  slotIndex: number;
  label: string;
};

export type AssembleSandboxSynastryReportInput = {
  mode: 'pair' | 'group';
  participants: SandboxSynastryParticipantV1[];
  snapshotsOrdered: EphemerisSnapshot[];
  pairInteractionAspectsV2?: DirectedSnapshotAspect[];
};

const TIER_ORDER: SandboxSynastryTierId[] = ['personal', 'social', 'generational'];

const TIER_TITLES: Record<SandboxSynastryTierId, string> = {
  personal: 'The Personal Frequencies',
  social: 'The Shaping Forces',
  generational: 'The Generational Currents',
};

const PERSONAL_BODIES = new Set(['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS']);
const SOCIAL_BODIES = new Set(['JUPITER', 'SATURN']);
const GENERATIONAL_BODIES = new Set([
  'URANUS',
  'NEPTUNE',
  'PLUTO',
  'CHIRON',
  'CERES',
  'JUNO',
  'PALLAS',
  'VESTA',
]);

function tierForNatalBody(bodyA: string): SandboxSynastryTierId | null {
  const p = String(bodyA || '').toUpperCase();
  if (PERSONAL_BODIES.has(p)) return 'personal';
  if (SOCIAL_BODIES.has(p)) return 'social';
  if (GENERATIONAL_BODIES.has(p)) return 'generational';
  return null;
}

function activationScore(aspect: Pick<DirectedSnapshotAspect, 'exactness' | 'orb' | 'strength' | 'priorityBase'>): number {
  const exactness =
    typeof aspect.exactness === 'number'
      ? aspect.exactness
      : typeof aspect.strength === 'number'
        ? aspect.strength
        : 0;
  const priority = typeof aspect.priorityBase === 'number' ? aspect.priorityBase : 0;
  const orb = typeof aspect.orb === 'number' ? aspect.orb : 999;
  return exactness * 0.7 + priority * 0.3 - orb * 0.001;
}

function sortByActivationScore(
  a: Pick<DirectedSnapshotAspect, 'exactness' | 'orb' | 'strength' | 'priorityBase'>,
  b: Pick<DirectedSnapshotAspect, 'exactness' | 'orb' | 'strength' | 'priorityBase'>
): number {
  return activationScore(b) - activationScore(a);
}

function formatPlanetName(planet: string): string {
  const p = String(planet || '').toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatAspectName(aspect: string): string {
  return String(aspect || '').toLowerCase();
}

function possessivePlanetPhrase(label: string, planetDisplay: string): string {
  return label === 'YOUR' ? `YOUR ${planetDisplay}` : `${label}'s ${planetDisplay}`;
}

function labelAt(participants: SandboxSynastryParticipantV1[], slot: number): string {
  const row = participants.find((p) => p.slotIndex === slot);
  return row?.label ?? `Person ${slot + 1}`;
}

function sonicInterplayText(insight: NonNullable<ReturnType<typeof getAspectInsight>>): string {
  if (insight.sonic_synastry && insight.sonic_synastry.trim()) {
    return insight.sonic_synastry.trim();
  }
  if (insight.sonic && insight.sonic.trim()) {
    return capToMaxSentences(insight.sonic, 2);
  }
  return '';
}

function buildDirectionalHeader(
  aspect: DirectedSnapshotAspect,
  participants: SandboxSynastryParticipantV1[]
): string {
  const src = labelAt(participants, aspect.sourceSlotIndex);
  const tgt = labelAt(participants, aspect.targetSlotIndex);
  return `${possessivePlanetPhrase(src, formatPlanetName(String(aspect.bodyA)))} ${formatAspectName(String(aspect.type))} ${possessivePlanetPhrase(tgt, formatPlanetName(String(aspect.bodyB)))}`;
}

function aspectToActivation(
  aspect: DirectedSnapshotAspect,
  participants: SandboxSynastryParticipantV1[]
): SandboxSynastryActivationV1 | null {
  const tier = tierForNatalBody(String(aspect.bodyA || ''));
  if (!tier) return null;

  const aspectKey = buildAspectKey(String(aspect.bodyA), String(aspect.bodyB), String(aspect.type));
  if (isAspectLibraryKillListed(aspectKey)) return null;

  const insight = getAspectInsight(aspectKey);
  if (!insight) return null;

  const synastryProse = composeSynastryMepAspectParagraph(insight).trim();
  if (!synastryProse) return null;

  return {
    directionalHeader: buildDirectionalHeader(aspect, participants),
    synastryProse,
    sonicInterplay: sonicInterplayText(insight),
    tier,
    aspectKey,
    pairField: insight.pair,
  };
}

function selectActivationsForDirectedPair(
  aspects: DirectedSnapshotAspect[],
  sourceSlot: number,
  targetSlot: number,
  participants: SandboxSynastryParticipantV1[],
  claimedPairFields?: Set<string>
): SandboxSynastryActivationV1[] {
  const directed = aspects.filter(
    (a) => a.sourceSlotIndex === sourceSlot && a.targetSlotIndex === targetSlot
  );

  const byTier: Record<SandboxSynastryTierId, SandboxSynastryActivationV1[]> = {
    personal: [],
    social: [],
    generational: [],
  };

  for (const asp of directed) {
    const activation = aspectToActivation(asp, participants);
    if (!activation) continue;
    if (claimedPairFields?.has(activation.pairField)) continue;
    byTier[activation.tier].push(activation);
  }

  for (const tier of TIER_ORDER) {
    byTier[tier].sort((a, b) => {
      const aspA = directed.find(
        (d) => buildAspectKey(String(d.bodyA), String(d.bodyB), String(d.type)) === a.aspectKey
      );
      const aspB = directed.find(
        (d) => buildAspectKey(String(d.bodyA), String(d.bodyB), String(d.type)) === b.aspectKey
      );
      if (!aspA || !aspB) return 0;
      return sortByActivationScore(aspA, aspB);
    });
  }

  const selected: SandboxSynastryActivationV1[] = [];
  for (const tier of TIER_ORDER) {
    for (const activation of byTier[tier]) {
      if (selected.length >= SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR) break;
      if (claimedPairFields?.has(activation.pairField)) continue;
      selected.push(activation);
      claimedPairFields?.add(activation.pairField);
    }
    if (selected.length >= SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR) break;
  }

  return selected;
}

function buildTierBlocks(activations: SandboxSynastryActivationV1[]): SandboxSynastryTierBlockV1[] {
  const blocks: SandboxSynastryTierBlockV1[] = [];
  for (const tierId of TIER_ORDER) {
    const inTier = activations.filter((a) => a.tier === tierId);
    if (inTier.length === 0) continue;
    blocks.push({
      tierId,
      title: TIER_TITLES[tierId],
      activations: inTier,
    });
  }
  return blocks;
}

function pairTotalStrength(
  aspects: DirectedSnapshotAspect[],
  sourceSlot: number,
  targetSlot: number,
  participants: SandboxSynastryParticipantV1[]
): number {
  return aspects
    .filter((a) => a.sourceSlotIndex === sourceSlot && a.targetSlotIndex === targetSlot)
    .reduce((sum, asp) => {
      const activation = aspectToActivation(asp, participants);
      if (!activation) return sum;
      return sum + activationScore(asp);
    }, 0);
}

function unorderedPairs(slotIndices: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < slotIndices.length; i++) {
    for (let j = i + 1; j < slotIndices.length; j++) {
      out.push([slotIndices[i]!, slotIndices[j]!]);
    }
  }
  return out;
}

function aspectsForPair(
  snapshotsOrdered: EphemerisSnapshot[],
  sourceSlot: number,
  targetSlot: number,
  precomputed?: DirectedSnapshotAspect[]
): DirectedSnapshotAspect[] {
  if (precomputed && precomputed.length > 0) {
    const lo = Math.min(sourceSlot, targetSlot);
    const hi = Math.max(sourceSlot, targetSlot);
    return precomputed.filter((a) => {
      const aLo = Math.min(a.sourceSlotIndex, a.targetSlotIndex);
      const aHi = Math.max(a.sourceSlotIndex, a.targetSlotIndex);
      return aLo === lo && aHi === hi;
    });
  }
  const snapA = snapshotsOrdered[sourceSlot];
  const snapB = snapshotsOrdered[targetSlot];
  if (!snapA || !snapB) return [];
  return computeSynastryAspects({ snapshotsOrdered: [snapA, snapB], mode: 'pair' });
}

function buildPairSection(
  sourceSlot: number,
  targetSlot: number,
  participants: SandboxSynastryParticipantV1[],
  snapshotsOrdered: EphemerisSnapshot[],
  precomputed: DirectedSnapshotAspect[] | undefined,
  includePairHeader: boolean,
  claimedPairFields?: Set<string>
): SandboxSynastryPairSectionV1 | null {
  const aspects = aspectsForPair(snapshotsOrdered, sourceSlot, targetSlot, precomputed);
  const activations = selectActivationsForDirectedPair(
    aspects,
    sourceSlot,
    targetSlot,
    participants,
    claimedPairFields
  );
  if (activations.length === 0) return null;

  const tierBlocks = buildTierBlocks(activations);
  if (tierBlocks.length === 0) return null;

  const srcLabel = labelAt(participants, sourceSlot);
  const tgtLabel = labelAt(participants, targetSlot);
  const pairHeader = includePairHeader ? `${srcLabel} + ${tgtLabel}` : '';

  return {
    sourceSlotIndex: sourceSlot,
    targetSlotIndex: targetSlot,
    pairHeader,
    tierBlocks,
  };
}

/**
 * Assemble structured sandbox synastry report for pair (2) or group (3+) modes.
 * Returns null-equivalent empty pairSections when no qualifying activations exist.
 */
export function assembleSandboxSynastryReport(
  input: AssembleSandboxSynastryReportInput
): SandboxSynastryReportV1 {
  const { mode, participants, snapshotsOrdered, pairInteractionAspectsV2 } = input;

  if (mode === 'pair') {
    if (participants.length < 2 || snapshotsOrdered.length < 2) {
      return { schema_version: 'sandbox_synastry_v1', mode: 'pair', pairSections: [] };
    }
    const section = buildPairSection(
      0,
      1,
      participants,
      snapshotsOrdered,
      pairInteractionAspectsV2,
      false
    );
    return {
      schema_version: 'sandbox_synastry_v1',
      mode: 'pair',
      pairSections: section ? [section] : [],
    };
  }

  const displayCount = Math.min(participants.length, snapshotsOrdered.length, SANDBOX_SYNASTRY_DISPLAY_CAP);
  const displaySlots = Array.from({ length: displayCount }, (_, i) => i);
  const displayParticipants = participants.filter((p) => p.slotIndex < displayCount);

  const pairs = unorderedPairs(displaySlots);
  const pairStrengths = pairs.map(([a, b]) => ({
    sourceSlot: a,
    targetSlot: b,
    strength: pairTotalStrength(
      aspectsForPair(snapshotsOrdered, a, b, pairInteractionAspectsV2),
      a,
      b,
      displayParticipants
    ),
  }));
  pairStrengths.sort((x, y) => y.strength - x.strength);

  const claimedPairFields = new Set<string>();
  const pairSections: SandboxSynastryPairSectionV1[] = [];

  for (const { sourceSlot, targetSlot } of pairStrengths) {
    const section = buildPairSection(
      sourceSlot,
      targetSlot,
      displayParticipants,
      snapshotsOrdered,
      pairInteractionAspectsV2,
      true,
      claimedPairFields
    );
    if (section) pairSections.push(section);
  }

  return {
    schema_version: 'sandbox_synastry_v1',
    mode: 'group',
    pairSections,
  };
}

/** Section ids replaced by sandbox synastry report in pair/group resolve responses. */
export const SANDBOX_SYNASTRY_STRIP_SECTION_IDS = new Set([
  'aspects',
  'core_identity',
  'personal_expression',
  'growth_expansion',
  'evolutionary_currents',
  'no_activations',
  'group_key_interactions_v1',
  'relational_field',
  'signatures',
  'interaction_map',
  'delta_emphasis',
]);

export function stripSandboxSynastryLegacySections<T extends { sectionId?: string; id?: string }>(
  sections: T[]
): T[] {
  return sections.filter((s) => {
    const id = s.sectionId || s.id || '';
    return !SANDBOX_SYNASTRY_STRIP_SECTION_IDS.has(id);
  });
}
