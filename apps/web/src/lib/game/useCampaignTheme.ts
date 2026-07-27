import { useMemo } from 'react';
import type { CampaignEraState, CharacterResponse, GameStateResponse } from '@/lib/game-api';
import { getDungeonTheme, type DungeonTheme } from './dungeonThemes';
import { getElementTheme, type ElementTheme } from './elementThemes';

export type CampaignTheme = {
  dungeon: DungeonTheme;
  element: ElementTheme;
  era: CampaignEraState | null;
  chapterHouse: number;
};

/**
 * Resolve Campaign-scoped theme tokens from game state + character.
 * Apply via inline styles / props — do not write to :root.
 */
export function useCampaignTheme(
  state: GameStateResponse | null | undefined,
  character: CharacterResponse | null | undefined
): CampaignTheme {
  return useMemo(() => {
    const chapterHouse =
      state?.activeChapter?.currentHouse ??
      state?.saturnChapter?.currentHouse ??
      null;
    const dungeon = getDungeonTheme(chapterHouse);
    const element = getElementTheme(character?.primaryElement ?? null);
    return {
      dungeon,
      element,
      era: state?.campaignEra ?? null,
      chapterHouse: dungeon.house,
    };
  }, [state, character]);
}
