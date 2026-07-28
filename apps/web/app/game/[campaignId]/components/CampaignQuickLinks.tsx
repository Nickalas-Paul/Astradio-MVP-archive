'use client';

import Link from 'next/link';
import type { DungeonAccent } from '@/lib/game/dungeonThemes';

type Props = {
  accent: DungeonAccent;
  codexHref: string;
  onOpenInventory: () => void;
  onOpenCharacter: () => void;
  onOpenLoot: () => void;
};

const btnClass =
  'rounded-lg px-4 py-2 text-xs font-semibold transition-colors hover:opacity-90';

/** Shared post-encounter shortcuts: drawer tabs + Dungeon Codex. */
export function CampaignQuickLinks({
  accent,
  codexHref,
  onOpenInventory,
  onOpenCharacter,
  onOpenLoot,
}: Props) {
  const style = {
    border: `1px solid ${accent.border}`,
    color: accent.text,
    background: accent.primaryAlpha(0.06),
  };

  return (
    <div className="flex flex-wrap justify-center gap-3">
      <button type="button" onClick={onOpenInventory} className={btnClass} style={style}>
        Inventory
      </button>
      <button type="button" onClick={onOpenCharacter} className={btnClass} style={style}>
        Character
      </button>
      <button type="button" onClick={onOpenLoot} className={btnClass} style={style}>
        Loot Table
      </button>
      <Link href={codexHref} className={btnClass} style={style}>
        Dungeon Codex
      </Link>
    </div>
  );
}
