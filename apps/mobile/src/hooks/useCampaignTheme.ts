import { useMemo } from 'react';
import { getDungeonTheme, type DungeonTheme } from '../lib/game/dungeon-themes';
import { getElementTheme, type ElementTheme } from '../lib/game/element-themes';

type ChapterLike = {
  currentHouse?: number;
  label?: string;
  domain?: string;
} | null;

/**
 * Resolve Campaign dungeon + element themes for RN screens.
 * Dungeon from Mars activeChapter house; element from class/primary string.
 */
export function useCampaignTheme(
  activeChapter: ChapterLike,
  primaryElement: string | null | undefined
): { dungeon: DungeonTheme; element: ElementTheme } {
  return useMemo(() => {
    const house =
      typeof activeChapter?.currentHouse === 'number' ? activeChapter.currentHouse : 1;
    return {
      dungeon: getDungeonTheme(house),
      element: getElementTheme(primaryElement ?? 'fire'),
    };
  }, [activeChapter?.currentHouse, primaryElement]);
}
