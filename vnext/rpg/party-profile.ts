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
  }

  const normalize = (v: number) => (n > 0 ? v / n : 0);

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
  };
}

