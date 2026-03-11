import type { PartyProfile } from './party-types';
import type { CharacterProfile } from './types';

export interface GroupFieldProfile {
  partyId: string;

  dominantElements: string[];
  weakElements: string[];

  dominantModalities: string[];
  weakModalities: string[];

  sharedStrengths: string[];
  sharedBlindSpots: string[];

  supportCapacity: number;
  frictionLevel: number;
  cohesionScore: number;

  likelyCollectiveChallengeTypes: string[];
  groupThemeBias: string[];
}

function topKeys(
  obj: Record<string, number>,
  pick: 'max' | 'min',
  thresholdFraction = 0.5
): string[] {
  const entries = Object.entries(obj);
  if (!entries.length) return [];
  const vals = entries.map(([, v]) => v);
  const target = pick === 'max' ? Math.max(...vals) : Math.min(...vals);
  const span = Math.max(...vals) - Math.min(...vals) || 1;
  return entries
    .filter(([, v]) =>
      pick === 'max'
        ? v >= target - span * (1 - thresholdFraction)
        : v <= target + span * (1 - thresholdFraction)
    )
    .map(([k]) => k)
    .sort();
}

export interface BuildGroupFieldParams {
  party: PartyProfile;
  memberProfiles: Record<string, CharacterProfile>;
}

export function buildGroupFieldProfile(params: BuildGroupFieldParams): GroupFieldProfile {
  const { party, memberProfiles } = params;

  const dominantElements = topKeys(party.elementBlend, 'max');
  const weakElements = topKeys(party.elementBlend, 'min');
  const dominantModalities = topKeys(party.modalityBlend, 'max');
  const weakModalities = topKeys(party.modalityBlend, 'min');

  const domainAgg: Record<string, { sum: number; count: number }> = {};

  for (const { userId } of party.members) {
    const p = memberProfiles[userId];
    if (!p) continue;
    for (const d of p.signatureDomains) {
      const entry = domainAgg[d.domain] ?? { sum: 0, count: 0 };
      entry.sum += d.weight;
      entry.count += 1;
      domainAgg[d.domain] = entry;
    }
  }

  const avgDomains: Record<string, number> = {};
  for (const [dom, { sum, count }] of Object.entries(domainAgg)) {
    if (count > 0) avgDomains[dom] = sum / count;
  }

  const sortedDomains = Object.entries(avgDomains)
    .map(([domain, score]) => ({ domain, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.domain.localeCompare(b.domain);
    });

  const sharedStrengths = sortedDomains
    .filter((d) => d.score >= 0.6)
    .map((d) => d.domain);
  const sharedBlindSpots = sortedDomains
    .filter((d) => d.score <= 0.2)
    .map((d) => d.domain);

  const supportCapacity = party.supportIndex;
  const frictionLevel = party.tensionIndex;

  const cohesionScore =
    1 -
    (Math.abs(party.elementBlend.fire - party.elementBlend.air) +
      Math.abs(party.elementBlend.earth - party.elementBlend.water)) /
      4;

  const likelyCollectiveChallengeTypes: string[] = [];
  if (frictionLevel >= 0.6 && cohesionScore >= 0.5) {
    likelyCollectiveChallengeTypes.push('productive_conflict');
  }
  if (supportCapacity >= 0.6 && sharedStrengths.some((d) => d.includes('community'))) {
    likelyCollectiveChallengeTypes.push('collective_support');
  }
  if (weakElements.includes('earth')) {
    likelyCollectiveChallengeTypes.push('grounding_and_routine');
  }
  if (weakElements.includes('water')) {
    likelyCollectiveChallengeTypes.push('emotional_attunement');
  }

  const themeBiasSet = new Set<string>();
  for (const d of sharedStrengths) {
    if (d.includes('identity')) themeBiasSet.add('identity');
    if (d.includes('community') || d.includes('bond')) themeBiasSet.add('community');
    if (d.includes('service') || d.includes('work')) themeBiasSet.add('service');
  }
  const groupThemeBias = Array.from(themeBiasSet).sort();

  return {
    partyId: party.id,
    dominantElements,
    weakElements,
    dominantModalities,
    weakModalities,
    sharedStrengths,
    sharedBlindSpots,
    supportCapacity,
    frictionLevel,
    cohesionScore,
    likelyCollectiveChallengeTypes,
    groupThemeBias,
  };
}

