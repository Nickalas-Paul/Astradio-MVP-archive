'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export interface DungeonLayoutProps {
  /** Left HUD rail (hidden on mobile). */
  rail: ReactNode;
  /** Right drawer; render null when closed. */
  drawer: ReactNode;
  /** Bottom-docked panel (choices during encounter phase); render null to omit. */
  bottomDock: ReactNode;
  dungeonName: string;
  chapter: number;
  drawerOpen: boolean;
  onCharacterToggle: () => void;
  /** Compact stats shown in the top bar on mobile, where the rail is hidden. */
  mobileHp?: { current: number; max: number } | null;
  mobileStreak?: number;
  children: ReactNode;
}

/**
 * 3-zone Campaign game surface: HUD rail | scrollable stage | character drawer.
 * Transparent panels over the ambient backdrop; height pinned below the app header.
 */
export function DungeonLayout({
  rail,
  drawer,
  bottomDock,
  dungeonName,
  chapter,
  drawerOpen,
  onCharacterToggle,
  mobileHp,
  mobileStreak,
  children,
}: DungeonLayoutProps) {
  const hpRatio = mobileHp ? mobileHp.current / Math.max(1, mobileHp.max) : 1;
  const hpColor = hpRatio > 0.6 ? '#10B981' : hpRatio > 0.3 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative z-10 flex h-[calc(100dvh-69px)] w-full overflow-hidden">
      {rail}

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5"
          style={{
            background: 'rgba(0,0,0,.25)',
            borderBottom: '1px solid rgba(255,255,255,.04)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="min-w-0">
            <Link
              href="/game"
              className="block truncate font-serif text-sm uppercase tracking-widest text-accent hover:underline"
            >
              {dungeonName || 'Campaign'}
            </Link>
            <p className="text-[10px] text-text-muted">Chapter {chapter}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {mobileHp ? (
              <div className="flex items-center gap-1.5 md:hidden">
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(Math.max(0, Math.min(1, hpRatio)) * 100)}%`,
                      background: hpColor,
                    }}
                  />
                </div>
                <span className="text-[10px] text-text-secondary">
                  {mobileHp.current}/{mobileHp.max}
                </span>
                {typeof mobileStreak === 'number' ? (
                  <span className="text-[10px] text-accent">·&nbsp;{mobileStreak}🔥</span>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onCharacterToggle}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                drawerOpen
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-white/10 bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
              }`}
            >
              Character
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {bottomDock ? (
          <div
            className="shrink-0 px-4 py-3"
            style={{
              background: 'rgba(8,12,20,.85)',
              borderTop: '1px solid rgba(255,255,255,.06)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {bottomDock}
          </div>
        ) : null}
      </div>

      {drawer}
    </div>
  );
}
