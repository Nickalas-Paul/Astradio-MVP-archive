'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useGameState } from '@/hooks/useGameState';
import { fetchLootTable, type LootTableResponse } from '@/lib/game-api';
import { getDungeonTheme } from '@/lib/game/dungeonThemes';
import {
  activeHouseFromState,
  completedHousesFromFlags,
  pickLootPreview,
  rarityColor,
} from './codex-utils';
import { ALL_DUNGEON_HOUSES, DUNGEON_DESCRIPTIONS } from './dungeon-descriptions';

type Props = {
  campaignId: string;
};

function houseFromHash(): number | null {
  if (typeof window === 'undefined') return null;
  const match = /^#house-(\d+)$/.exec(window.location.hash);
  if (!match) return null;
  const house = Number(match[1]);
  return house >= 1 && house <= 12 ? house : null;
}

export function DungeonCodex({ campaignId }: Props) {
  const router = useRouter();
  const { state, loading, error, refresh } = useGameState(campaignId);
  const activeHouse = activeHouseFromState(state);
  const completedHouses = useMemo(
    () => completedHousesFromFlags(state?.milestoneFlags),
    [state?.milestoneFlags]
  );

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [lootTable, setLootTable] = useState<LootTableResponse | null>(null);
  const [lootLoading, setLootLoading] = useState(false);
  const [lootError, setLootError] = useState<string | null>(null);
  const [hashScrolled, setHashScrolled] = useState(false);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const house of ALL_DUNGEON_HOUSES) {
        if (next[house] === undefined) {
          next[house] = house === activeHouse;
        }
      }
      const hashHouse = houseFromHash();
      if (hashHouse) next[hashHouse] = true;
      return next;
    });
  }, [activeHouse]);

  useEffect(() => {
    if (!campaignId || lootTable || lootLoading) return;
    setLootLoading(true);
    setLootError(null);
    fetchLootTable(campaignId)
      .then(setLootTable)
      .catch((e) => setLootError(e instanceof Error ? e.message : 'Failed to load loot table'))
      .finally(() => setLootLoading(false));
  }, [campaignId, lootTable, lootLoading]);

  useEffect(() => {
    if (loading || state) return;
    if (!error) return;
    const msg = error.toLowerCase();
    if (
      msg.includes('disabled') ||
      msg.includes('combat') ||
      msg.includes('gate') ||
      msg.includes('not enabled') ||
      msg.includes('503')
    ) {
      router.replace('/game');
    }
  }, [loading, error, state, router]);

  const scrollToHash = useCallback(() => {
    const hashHouse = houseFromHash();
    if (!hashHouse) return;
    const el = document.getElementById(`house-${hashHouse}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHashScrolled(true);
    }
  }, []);

  useEffect(() => {
    if (hashScrolled || loading) return;
    const timer = window.setTimeout(scrollToHash, 120);
    return () => window.clearTimeout(timer);
  }, [hashScrolled, loading, scrollToHash]);

  const toggleHouse = (house: number) => {
    setExpanded((prev) => ({ ...prev, [house]: !prev[house] }));
  };

  const lootPreview = pickLootPreview(lootTable?.items, 4);
  const activeTheme = getDungeonTheme(activeHouse);

  return (
    <AppShell contentClassName="p-4 md:p-6 safe-bottom">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <Link
            href={`/game/${encodeURIComponent(campaignId)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary"
          >
            <span aria-hidden>←</span> Back to encounter
          </Link>
          <div>
            <h1 className="font-serif text-display text-text-primary">Dungeon Codex</h1>
            <p className="mt-1 text-body-sm text-text-secondary">
              The twelve arenas your campaign moves through
            </p>
          </div>
        </div>

        {loading && !state ? (
          <Card elevation="resting" size="md">
            <p className="text-body-sm text-text-secondary">Loading campaign state…</p>
          </Card>
        ) : null}

        {error && !state ? (
          <Card elevation="resting" size="md" className="space-y-3">
            <p className="text-body-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => void refresh()}>
              Retry
            </Button>
          </Card>
        ) : null}

        {state ? (
          <div className="space-y-3">
            {ALL_DUNGEON_HOUSES.map((house) => {
              const theme = getDungeonTheme(house);
              const copy = DUNGEON_DESCRIPTIONS[house]!;
              const isActive = house === activeHouse;
              const isCompleted = completedHouses.has(house);
              const isOpen = !!expanded[house];
              const showLoot = isActive && lootPreview.length > 0;

              return (
                <article
                  key={house}
                  id={`house-${house}`}
                  className="scroll-mt-24 overflow-hidden rounded-xl transition-colors"
                  style={{
                    border: `1px solid ${isActive ? theme.accent.border : 'rgba(255,255,255,0.08)'}`,
                    background: isActive
                      ? theme.accent.primaryAlpha(0.06)
                      : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleHouse(house)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: theme.accent.primaryAlpha(0.12),
                        border: `1px solid ${theme.accent.primaryAlpha(0.2)}`,
                        color: theme.accent.text,
                      }}
                      aria-hidden
                    >
                      {theme.sigil}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-h4 text-text-primary">{theme.name}</h2>
                        {isActive ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              color: theme.accent.text,
                              background: theme.accent.primaryAlpha(0.15),
                              border: `1px solid ${theme.accent.border}`,
                            }}
                          >
                            You are here
                          </span>
                        ) : null}
                        {isCompleted && !isActive ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                            Completed
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        House {house}
                        <span className="mx-1">·</span>
                        {theme.domain}
                      </p>
                      {!isOpen ? (
                        <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
                          {copy.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="shrink-0 text-lg text-text-muted"
                      aria-hidden
                      style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
                    >
                      ▾
                    </span>
                  </button>

                  {isOpen ? (
                    <div
                      className="space-y-4 border-t px-4 pb-4 pt-3"
                      style={{ borderColor: theme.accent.primaryAlpha(0.1) }}
                    >
                      <p className="font-serif text-body leading-relaxed text-text-primary">
                        {copy.description}
                      </p>

                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                          What to expect
                        </h3>
                        <ul className="mt-2 space-y-2">
                          {copy.whatToExpect.map((line) => (
                            <li
                              key={line}
                              className="flex gap-2 text-xs leading-relaxed text-text-secondary"
                            >
                              <span
                                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                                style={{ background: theme.accent.text }}
                              />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                          Loot preview
                        </h3>
                        {showLoot ? (
                          <div className="mt-2 space-y-1.5">
                            {lootPreview.map((item) => (
                              <div
                                key={item.slug}
                                className="flex items-center justify-between gap-2 rounded-lg bg-white/[.03] px-2.5 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-serif text-[13px] text-text-primary">
                                    {item.name}
                                  </p>
                                  <p className="text-[9px] capitalize text-text-muted">
                                    {item.category}
                                    {Object.entries(item.statModifiers || {})
                                      .filter(([, v]) => v)
                                      .map(([k, v]) => ` · +${v} ${k}`)
                                      .join('')}
                                  </p>
                                </div>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase"
                                  style={{
                                    color: rarityColor(item.rarity),
                                    background: `${rarityColor(item.rarity)}20`,
                                  }}
                                >
                                  {item.rarity}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs italic text-text-muted">
                            {isActive && lootLoading
                              ? 'Loading loot table…'
                              : isActive && lootError
                                ? lootError
                                : 'Enter this dungeon to see available loot.'}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {state ? (
          <div className="flex justify-center pt-2 pb-4">
            <Link
              href={`/game/${encodeURIComponent(campaignId)}`}
              className="rounded-[10px] px-8 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.04]"
              style={{
                background: `linear-gradient(135deg, ${activeTheme.accent.primary}, ${activeTheme.accent.primaryAlpha(0.7)})`,
                boxShadow: `0 4px 16px ${activeTheme.accent.glow}`,
              }}
            >
              Return to encounter
            </Link>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
