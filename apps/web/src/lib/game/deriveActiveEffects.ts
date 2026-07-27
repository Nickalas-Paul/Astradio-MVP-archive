import { normalizeElementKey, type ElementKey } from './elementThemes';

export type ActiveEffectColor = 'green' | 'dungeon' | 'blue' | 'red';

export type DerivedActiveEffect = {
  id: string;
  name: string;
  description: string;
  category: 'element' | 'chapter' | 'system' | 'buff' | 'debuff';
  color: ActiveEffectColor;
};

const ELEMENT_BUFFS: Record<ElementKey, { name: string; desc: string }> = {
  earth: { name: 'Earthen Fortitude', desc: '+3 Resilience from Earth affinity' },
  fire: { name: 'Flame Vigor', desc: '+3 Vitality from Fire affinity' },
  air: { name: 'Aether Clarity', desc: '+3 Cunning from Air affinity' },
  water: { name: 'Tidal Intuition', desc: '+3 Intuition from Water affinity' },
};

const CHAPTER_BUFFS: Record<number, { name: string; desc: string }> = {
  1: { name: "Forge's Temper", desc: 'Chapter buff · +2 Vitality while forging' },
  2: { name: "Vault's Yield", desc: 'Chapter buff · +2 Cunning in resource encounters' },
  3: { name: "Whisper's Edge", desc: 'Chapter buff · +2 Charm in dialogue' },
  4: { name: 'Ancestral Guard', desc: 'Chapter buff · +2 Resilience from roots' },
  5: { name: 'Stage Presence', desc: 'Chapter buff · +2 Charm under spotlight' },
  6: { name: 'Disciplined Focus', desc: 'Chapter buff · +2 Cunning in precision tasks' },
  7: { name: 'Mirror Insight', desc: 'Chapter buff · +2 Intuition in partnerships' },
  8: { name: 'Underworld Nerve', desc: 'Chapter buff · +2 Willpower in transformation' },
  9: { name: "Pilgrim's Insight", desc: 'Chapter buff · +2 Intuition while exploring' },
  10: { name: 'Summit Authority', desc: 'Chapter buff · +3 Charm in judgment' },
  11: { name: 'Network Pulse', desc: 'Chapter buff · +2 Charm in community' },
  12: { name: 'Dream Veil', desc: 'Chapter buff · +2 Intuition in dissolution' },
};

type BuffLike = {
  stat?: string;
  magnitude?: number;
  expiresDate?: string;
  source?: string;
};

type ShieldLike = {
  reduction?: number;
  expiresDate?: string;
} | null;

/** Presentation-only Active Effects derived from existing campaign/character data. */
export function deriveActiveEffects(params: {
  primaryElement?: string | null;
  chapterHouse?: number | null;
  streak?: number | null;
  activeBuffs?: BuffLike[] | null;
  damageShield?: ShieldLike;
}): DerivedActiveEffect[] {
  const effects: DerivedActiveEffect[] = [];
  const element = normalizeElementKey(params.primaryElement);
  const el = ELEMENT_BUFFS[element];
  effects.push({
    id: `element-${element}`,
    name: el.name,
    description: el.desc,
    category: 'element',
    color: 'green',
  });

  const house =
    typeof params.chapterHouse === 'number' && params.chapterHouse >= 1 && params.chapterHouse <= 12
      ? params.chapterHouse
      : 9;
  const chapter = CHAPTER_BUFFS[house] ?? CHAPTER_BUFFS[9]!;
  effects.push({
    id: `chapter-${house}`,
    name: chapter.name,
    description: chapter.desc,
    category: 'chapter',
    color: 'dungeon',
  });

  const streak = typeof params.streak === 'number' ? params.streak : 0;
  if (streak > 0) {
    effects.push({
      id: 'streak-shield',
      name: 'Streak Shield',
      description: `${streak}-day streak · Minor damage reduction`,
      category: 'system',
      color: 'blue',
    });
  }

  const shield = params.damageShield;
  if (shield && typeof shield.reduction === 'number' && shield.reduction > 0) {
    effects.push({
      id: 'damage-shield',
      name: 'Damage Shield',
      description: `−${shield.reduction} incoming damage${
        shield.expiresDate ? ` · until ${shield.expiresDate}` : ''
      }`,
      category: 'system',
      color: 'blue',
    });
  }

  for (const [i, buff] of (params.activeBuffs ?? []).entries()) {
    const stat = String(buff.stat || 'stat');
    const mag = typeof buff.magnitude === 'number' ? buff.magnitude : 0;
    const isDebuff = mag < 0;
    effects.push({
      id: `buff-${i}-${stat}`,
      name: `${stat.charAt(0).toUpperCase()}${stat.slice(1)} ${isDebuff ? 'Penalty' : 'Boost'}`,
      description: `${mag > 0 ? '+' : ''}${mag} ${stat}${
        buff.expiresDate ? ` · expires ${buff.expiresDate}` : ''
      }${buff.source ? ` · ${buff.source}` : ''}`,
      category: isDebuff ? 'debuff' : 'buff',
      color: isDebuff ? 'red' : 'green',
    });
  }

  return effects;
}
