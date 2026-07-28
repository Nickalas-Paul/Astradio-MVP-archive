import type { LootTableResponse } from '@/lib/game-api';

const RARITY_RANK: Record<string, number> = {
  legendary: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

/** Houses the player has cleared (departed via chapter transition). */
export function completedHousesFromFlags(flags: string[] | undefined): Set<number> {
  const completed = new Set<number>();
  for (const flag of flags ?? []) {
    const chapter = /^chapter_transition_(\d+)_to_(\d+)$/.exec(flag);
    if (chapter) {
      completed.add(Number(chapter[1]));
      continue;
    }
    const saturn = /^saturn_transition_(\d+)_to_(\d+)$/.exec(flag);
    if (saturn) completed.add(Number(saturn[1]));
  }
  return completed;
}

export function activeHouseFromState(state: {
  activeChapter?: { currentHouse?: number } | null;
  saturnChapter?: { currentHouse?: number } | null;
} | null | undefined): number {
  return (
    state?.activeChapter?.currentHouse ??
    state?.saturnChapter?.currentHouse ??
    1
  );
}

/** Pick signature loot rows for the active dungeon preview. */
export function pickLootPreview(
  items: LootTableResponse['items'] | undefined,
  limit = 4
): LootTableResponse['items'] {
  if (!items?.length) return [];
  const sorted = [...items].sort((a, b) => {
    const ra = RARITY_RANK[a.rarity?.toLowerCase() ?? ''] ?? 0;
    const rb = RARITY_RANK[b.rarity?.toLowerCase() ?? ''] ?? 0;
    return rb - ra;
  });
  const seen = new Set<string>();
  const picked: LootTableResponse['items'] = [];
  for (const item of sorted) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function rarityColor(rarity: string | undefined): string {
  const key = (rarity ?? '').toLowerCase();
  if (key === 'legendary') return '#8B5CF6';
  if (key === 'rare') return '#3B82F6';
  if (key === 'uncommon') return '#10B981';
  return '#6B7280';
}
