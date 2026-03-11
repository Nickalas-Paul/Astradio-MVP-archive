import type { PartyMemberRef, PartyProfile } from './party-types';
import type { CharacterProfile } from './types';

export interface BuildPartyProfileParams {
  id: string;
  formationMode: 'chosen' | 'routed';
  memberUserIds: string[];
  memberProfiles: Record<string, CharacterProfile>;
}

export function buildPartyProfile(params: BuildPartyProfileParams): PartyProfile {
  const { id, formationMode, memberUserIds, memberProfiles } = params;

  const members: PartyMemberRef[] = memberUserIds.map((userId) => ({
    userId,
    chartId: memberProfiles[userId]?.id ?? userId,
  }));

  const n = Math.max(1, members.length);

  let fire = 0;
  let earth = 0;
  let air = 0;
  let water = 0;
  let cardinal = 0;
  let fixed = 0;
  let mutable = 0;
  let tensionSum = 0;
  let supportSum = 0;
  const roleCounts: Record<string, number> = {};
  const domainAgg: Record<string, { sum: number; count: number }> = {};

  for (const userId of memberUserIds) {
    const profile = memberProfiles[userId];
    if (!profile) continue;

    const el = profile.primaryElement;
    if (el === 'fire') fire += 1;
    else if (el === 'earth') earth += 1;
    else if (el === 'air') air += 1;
    else if (el === 'water') water += 1;

    const mod = profile.angularEmphasis;
    if (mod.first || mod.tenth) cardinal += 1;
    if (mod.fourth) fixed += 1;
    if (mod.seventh) mutable += 1;

    tensionSum += profile.temperament.shadowCapacity;
    supportSum +=
      (profile.temperament.bond +
        profile.temperament.attunement +
        profile.temperament.discipline) /
      3;

    const t = profile.temperament;
    const elKey = profile.primaryElement;
    let role = 'integrator';
    if (t.will >= t.courage && elKey === 'fire') role = 'initiator';
    else if (t.discipline >= t.will && elKey === 'earth') role = 'anchor';
    else if (t.insight >= t.bond && elKey === 'air') role = 'strategist';
    else role = 'integrator';
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;

    for (const d of profile.signatureDomains) {
      const entry = domainAgg[d.domain] ?? { sum: 0, count: 0 };
      entry.sum += d.weight;
      entry.count += 1;
      domainAgg[d.domain] = entry;
    }
  }

  const normalize = (v: number) => (n > 0 ? v / n : 0);

  const roleDistribution: Record<string, number> = {};
  let maxRoleCount = 0;
  for (const [role, count] of Object.entries(roleCounts)) {
    roleDistribution[role] = count / n;
    if (count > maxRoleCount) maxRoleCount = count;
  }
  const roleRedundancyIndex = n > 0 ? maxRoleCount / n : 0;

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
  const sharedStrengthDomains = sortedDomains
    .filter((d) => d.score >= 0.6)
    .map((d) => d.domain);
  const sharedWeakDomains = sortedDomains
    .filter((d) => d.score <= 0.2)
    .map((d) => d.domain);

  return {
    id,
    formationMode,
    members,
    elementBlend: {
      fire: normalize(fire),
      earth: normalize(earth),
      air: normalize(air),
      water: normalize(water),
    },
    modalityBlend: {
      cardinal: normalize(cardinal),
      fixed: normalize(fixed),
      mutable: normalize(mutable),
    },
    tensionIndex: normalize(tensionSum),
    supportIndex: normalize(supportSum),
    roleDistribution,
    sharedStrengthDomains,
    sharedWeakDomains,
    roleRedundancyIndex,
  };
}

