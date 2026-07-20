'use client';

import type { CharacterHP } from '@/lib/game-api';
import { HPBar } from './HPBar';

export interface GameStateHeaderProps {
  hp: CharacterHP;
  streak: number;
  saturnChapter: { label: string; currentHouse: number } | null;
  chapter: number;
}

export function GameStateHeader({ hp, streak, saturnChapter, chapter }: GameStateHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 px-4 py-3 shadow-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="min-w-0 flex-1 md:max-w-xs">
          <HPBar
            current={hp.current}
            max={hp.max}
            wounded={hp.wounded}
            woundedDaysRemaining={hp.woundedDaysRemaining}
            size="sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
          <span>
            Streak: <span className="font-medium text-text-primary">{streak}</span>
          </span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span className="truncate">
            {saturnChapter?.label || 'Unknown dungeon'}
            {saturnChapter ? (
              <span className="text-text-muted"> (House {saturnChapter.currentHouse})</span>
            ) : null}
          </span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span>
            Ch. <span className="font-medium text-text-primary">{chapter}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
