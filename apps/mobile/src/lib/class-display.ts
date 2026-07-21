export type GameElement = 'Fire' | 'Earth' | 'Air' | 'Water';

type ClassInfo = {
  name: string;
  element: GameElement;
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  role: string;
};

export const CLASS_MAP: Record<string, ClassInfo> = {
  aries: { name: 'Flamecaller', element: 'Fire', modality: 'Cardinal', role: 'Aggressive striker, initiator' },
  taurus: { name: 'Stonebinder', element: 'Earth', modality: 'Fixed', role: 'Resilient tank, resource hoarder' },
  gemini: { name: 'Spelltwister', element: 'Air', modality: 'Mutable', role: 'Fast dual-caster, chaos manipulator' },
  cancer: { name: 'Tidemage', element: 'Water', modality: 'Cardinal', role: 'Protective healer, emotion-based power' },
  leo: { name: 'Radiant', element: 'Fire', modality: 'Fixed', role: 'Charismatic leader, self-buffing paladin' },
  virgo: { name: 'Mindweaver', element: 'Earth', modality: 'Mutable', role: 'Tactical debuffer, precision magic' },
  libra: { name: 'Mirrorblade', element: 'Air', modality: 'Cardinal', role: 'Balanced duelist, charm-based fighter' },
  scorpio: { name: 'Soulpiercer', element: 'Water', modality: 'Fixed', role: 'Shadow assassin, emotional control' },
  sagittarius: { name: 'Starforger', element: 'Fire', modality: 'Mutable', role: 'Long-range chaos archer, travel-based skills' },
  capricorn: { name: 'Ironwright', element: 'Earth', modality: 'Cardinal', role: 'Fortress builder, enduring strategist' },
  aquarius: { name: 'Stormsinger', element: 'Air', modality: 'Fixed', role: 'Inventive spellcaster, anti-structure' },
  pisces: { name: 'Dreamdancer', element: 'Water', modality: 'Mutable', role: 'Illusionist, dreamwalker, spiritual buffer' },
};

export function normalizeSign(value: string): string {
  return String(value || '').toLowerCase().replace(/^(class_|subclass_|rising_)/, '').trim();
}

function title(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : 'Unknown';
}

export function getClassDisplay(classSlug: string, subclassSlug: string, risingSlug: string) {
  const sun = normalizeSign(classSlug);
  const moon = normalizeSign(subclassSlug);
  const rising = normalizeSign(risingSlug);
  const primary = CLASS_MAP[sun];
  const className = primary?.name ?? title(sun);
  return {
    className,
    subclassName: CLASS_MAP[moon]?.name ?? title(moon),
    risingName: CLASS_MAP[rising]?.name ?? title(rising),
    classInitial: className.slice(0, 2).toUpperCase(),
    element: primary?.element ?? ('Earth' as const),
    modality: primary?.modality ?? 'Fixed',
    role: primary?.role ?? 'Adventurer',
    sunSign: title(sun),
    moonSign: title(moon),
    risingSign: title(rising),
  };
}

export const ELEMENT_COLORS: Record<GameElement, [string, string]> = {
  Earth: ['#0e9696', '#00674f'],
  Fire: ['#EF4444', '#991B1B'],
  Water: ['#3B82F6', '#1E40AF'],
  Air: ['#94A3B8', '#475569'],
};
