export type RarityPalette = {
  border: string;
  glow: string;
  bg: string;
  label: string;
};

export const RARITY_COLORS: Record<string, RarityPalette> = {
  common: {
    border: '#4A5568',
    glow: 'rgba(74, 85, 104, 0.3)',
    bg: 'rgba(74, 85, 104, 0.08)',
    label: '#A0AEC0',
  },
  uncommon: {
    border: '#38A169',
    glow: 'rgba(56, 161, 105, 0.3)',
    bg: 'rgba(56, 161, 105, 0.08)',
    label: '#68D391',
  },
  rare: {
    border: '#4299E1',
    glow: 'rgba(66, 153, 225, 0.3)',
    bg: 'rgba(66, 153, 225, 0.08)',
    label: '#63B3ED',
  },
  epic: {
    border: '#9F7AEA',
    glow: 'rgba(159, 122, 234, 0.3)',
    bg: 'rgba(159, 122, 234, 0.08)',
    label: '#B794F4',
  },
  legendary: {
    border: '#ECC94B',
    glow: 'rgba(236, 201, 75, 0.3)',
    bg: 'rgba(236, 201, 75, 0.08)',
    label: '#F6E05E',
  },
};

export function rarityColor(rarity: string | undefined | null): RarityPalette {
  const key = (rarity ?? '').toLowerCase();
  return RARITY_COLORS[key] ?? RARITY_COLORS.common!;
}
