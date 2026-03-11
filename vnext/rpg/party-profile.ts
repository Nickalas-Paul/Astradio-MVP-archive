import type { PartyMemberRef, PartyProfile } from './party-types';

export interface BuildPartyProfileParams {
  id: string;
  members: PartyMemberRef[];
  /** Per-member element weights (normalized per chart). */
  memberElements: Array<{
    userId: string;
    chartId: string;
    fire: number;
    earth: number;
    air: number;
    water: number;
  }>;
  /** Per-member modality weights (normalized per chart). */
  memberModalities: Array<{
    userId: string;
    chartId: string;
    cardinal: number;
    fixed: number;
    mutable: number;
  }>;
  /** Per-member tension/support indices derived from canonical engines. */
  memberTensionSupport: Array<{
    userId: string;
    chartId: string;
    tensionIndex: number;
    supportIndex: number;
  }>;
}

export function buildPartyProfile(params: BuildPartyProfileParams): PartyProfile {
  const { id, members, memberElements, memberModalities, memberTensionSupport } = params;

  const elementBlend = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalityBlend = { cardinal: 0, fixed: 0, mutable: 0 };
  let tensionSum = 0;
  let supportSum = 0;
  const n = Math.max(1, members.length);

  for (const m of memberElements) {
    elementBlend.fire += m.fire;
    elementBlend.earth += m.earth;
    elementBlend.air += m.air;
    elementBlend.water += m.water;
  }

  for (const m of memberModalities) {
    modalityBlend.cardinal += m.cardinal;
    modalityBlend.fixed += m.fixed;
    modalityBlend.mutable += m.mutable;
  }

  for (const m of memberTensionSupport) {
    tensionSum += m.tensionIndex;
    supportSum += m.supportIndex;
  }

  const normalize = (v: number) => (n > 0 ? v / n : 0);

  return {
    id,
    members,
    elementBlend: {
      fire: normalize(elementBlend.fire),
      earth: normalize(elementBlend.earth),
      air: normalize(elementBlend.air),
      water: normalize(elementBlend.water),
    },
    modalityBlend: {
      cardinal: normalize(modalityBlend.cardinal),
      fixed: normalize(modalityBlend.fixed),
      mutable: normalize(modalityBlend.mutable),
    },
    tensionIndex: normalize(tensionSum),
    supportIndex: normalize(supportSum),
  };
}

