'use client';

import { useMemo } from 'react';
import { getElementColors, type ClassDisplay } from '@/lib/class-display';
import type { InventoryResponse, StatBlock } from '@/lib/game-api';

export interface HudRailProps {
  display: ClassDisplay | null;
  stats: StatBlock | null;
  inventory: InventoryResponse | null;
  currentHP: number;
  maxHP: number;
  wounded: boolean;
  streak: number;
  onAvatarClick: () => void;
  onGearClick: () => void;
}

const STAT_ABBR: Array<{ key: keyof StatBlock; abbr: string }> = [
  { key: 'vitality', abbr: 'VIT' },
  { key: 'resilience', abbr: 'RES' },
  { key: 'cunning', abbr: 'CUN' },
  { key: 'charm', abbr: 'CHR' },
  { key: 'intuition', abbr: 'INT' },
  { key: 'willpower', abbr: 'WIL' },
];

function statColor(value: number): string {
  if (value >= 14) return '#10B981';
  if (value >= 8) return '#F59E0B';
  return '#EF4444';
}

function rarityColor(rarity: string | undefined): string {
  const r = (rarity || '').toLowerCase();
  if (r === 'legendary') return '#8B5CF6';
  if (r === 'rare') return '#3B82F6';
  if (r === 'uncommon') return '#10B981';
  return '#6B7280';
}

const SLOT_GLYPH: Record<string, string> = {
  weapon: '⚔',
  armor: '🛡',
  accessory: '◈',
  consumable_1: '🧪',
  consumable_2: '🧪',
  relic: '☿',
};

const LOCK_CONDITION: Record<string, string> = {
  accessory: '7d',
  consumable_2: '14d',
  relic: '♄',
};

const RAIL_SLOTS = ['weapon', 'armor', 'consumable_1', 'accessory', 'consumable_2', 'relic'] as const;

function slotUnlocked(slotsUnlocked: string[], slot: string): boolean {
  if (slot === 'consumable_1') {
    return slotsUnlocked.includes('consumable') || slotsUnlocked.includes('consumable_1');
  }
  return slotsUnlocked.includes(slot);
}

export function HudRail({
  display,
  stats,
  inventory,
  currentHP,
  maxHP,
  wounded,
  streak,
  onAvatarClick,
  onGearClick,
}: HudRailProps) {
  const colors = getElementColors(display?.element ?? 'Earth');

  const hpRatio = Math.max(0, Math.min(1, currentHP / Math.max(1, maxHP)));
  const hpColor = wounded
    ? '#991B1B'
    : hpRatio > 0.6
      ? '#10B981'
      : hpRatio > 0.3
        ? '#F59E0B'
        : '#EF4444';

  const gearSlots = useMemo(() => {
    const unlocked = inventory?.slotsUnlocked ?? ['weapon', 'armor', 'consumable_1'];
    return RAIL_SLOTS.map((slot) => {
      const item = inventory?.equipped?.[slot] ?? null;
      return {
        slot,
        unlocked: slotUnlocked(unlocked, slot),
        item,
        glyph: SLOT_GLYPH[slot] ?? '◇',
        lockCondition: LOCK_CONDITION[slot] ?? '',
      };
    });
  }, [inventory]);

  return (
    <aside
      className="hidden w-[72px] shrink-0 flex-col items-center gap-[14px] overflow-y-auto py-4 md:flex"
      style={{
        background: 'rgba(0,0,0,.4)',
        borderRight: '1px solid rgba(255,255,255,.04)',
      }}
      aria-label="Character HUD"
    >
      <button
        type="button"
        onClick={onAvatarClick}
        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white transition-transform hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${colors.gradient1}, ${colors.gradient2})`,
          border: '2px solid rgba(255,255,255,.15)',
        }}
        aria-label="Open character sheet"
      >
        {display?.classInitial ?? '??'}
      </button>

      <p className="max-w-full truncate px-1 text-center text-[8px] uppercase tracking-wider text-text-muted">
        {display?.className ?? 'Character'}
      </p>

      <div className="w-full space-y-1.5 px-2.5">
        {STAT_ABBR.map(({ key, abbr }) => {
          const value = stats?.[key] ?? 0;
          const color = statColor(value);
          const pct = Math.round((Math.max(0, Math.min(20, value)) / 20) * 100);
          return (
            <div key={key} className="space-y-0.5">
              <span className="block text-[7px] font-bold leading-none" style={{ color }}>
                {abbr}
              </span>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {gearSlots.map(({ slot, unlocked, item, glyph, lockCondition }) => (
          <button
            key={slot}
            type="button"
            onClick={onGearClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xs transition-transform hover:scale-105"
            style={{
              background: 'rgba(255,255,255,.03)',
              border: unlocked
                ? `1px solid ${item ? rarityColor(item.rarity) : 'rgba(255,255,255,.1)'}`
                : '1px dashed rgba(255,255,255,.1)',
              opacity: unlocked ? 1 : 0.5,
            }}
            aria-label={unlocked ? `${slot} slot` : `${slot} slot locked`}
            title={item?.name ?? (unlocked ? `Empty ${slot}` : `Locked (${lockCondition})`)}
          >
            {unlocked ? (
              <span aria-hidden>{item ? glyph : '·'}</span>
            ) : (
              <span className="flex flex-col items-center leading-none">
                <span aria-hidden>🔒</span>
                <span className="mt-0.5 text-[6px] text-text-muted">{lockCondition}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1">
        <div className="flex h-[100px] w-2 items-end overflow-hidden rounded-full bg-white/10">
          <div
            className={`w-full rounded-full transition-all duration-700 ${wounded ? 'animate-pulse' : ''}`}
            style={{ height: `${Math.round(hpRatio * 100)}%`, background: hpColor }}
          />
        </div>
        <span className="text-[9px] font-semibold text-text-secondary">
          {currentHP}/{maxHP}
        </span>
      </div>

      <div className="flex flex-col items-center pb-1">
        <span className="text-[8px] uppercase tracking-wider text-text-muted">Streak</span>
        <span className="text-sm font-bold text-accent">{streak}</span>
      </div>
    </aside>
  );
}
