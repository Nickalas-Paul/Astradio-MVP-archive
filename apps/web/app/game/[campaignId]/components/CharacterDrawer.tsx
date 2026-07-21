'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/shared/Button';
import { getClassDisplay, normalizeSignSlug } from '@/lib/class-display';
import {
  fetchLootTable,
  type CharacterResponse,
  type InventoryBagItem,
  type InventoryResponse,
  type LootTableResponse,
  type StatBlock,
} from '@/lib/game-api';

export type DrawerTab = 'character' | 'inventory' | 'loot';

export interface CharacterDrawerProps {
  campaignId: string;
  open: boolean;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  character: CharacterResponse | null;
  characterLoading: boolean;
  characterError: string | null;
  inventory: InventoryResponse | null;
  inventoryLoading: boolean;
  mutating: boolean;
  onEquip: (instanceId: string) => Promise<void>;
  onUnequip: (slot: string) => Promise<void>;
  onUse: (instanceId: string) => Promise<void>;
  onDiscard: (instanceId: string) => Promise<void>;
}

const STAT_KEYS: (keyof StatBlock)[] = [
  'vitality',
  'resilience',
  'cunning',
  'charm',
  'intuition',
  'willpower',
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

/* ---- statTrace parsing (DTO ships it as unknown) ---- */

type PlanetTrace = {
  sign?: string;
  house?: number;
  dignity?: string;
  retrograde?: boolean;
  contributions?: Partial<Record<string, number>>;
};

type AspectTrace = {
  bodyA?: string;
  bodyB?: string;
  aspectType?: string;
  orb?: number;
  statBonuses?: Partial<Record<string, number>>;
};

type ParsedTrace = {
  perPlanet: Record<string, PlanetTrace>;
  aspectBonuses: AspectTrace[];
};

function parseStatTrace(trace: unknown): ParsedTrace | null {
  if (!trace || typeof trace !== 'object') return null;
  const t = trace as Record<string, unknown>;
  const perPlanet =
    t.perPlanet && typeof t.perPlanet === 'object'
      ? (t.perPlanet as Record<string, PlanetTrace>)
      : {};
  const aspectBonuses = Array.isArray(t.aspectBonuses) ? (t.aspectBonuses as AspectTrace[]) : [];
  if (Object.keys(perPlanet).length === 0 && aspectBonuses.length === 0) return null;
  return { perPlanet, aspectBonuses };
}

function dignityLabel(dignity: string | undefined): string {
  const d = (dignity || 'neutral').toLowerCase();
  if (d === 'domicile') return 'at home (+30%)';
  if (d === 'exaltation') return 'exalted (+20%)';
  if (d === 'detriment') return 'in detriment (−20%)';
  if (d === 'fall') return 'in fall (−30%)';
  return '';
}

function StatTraceDetail({ trace, statKey }: { trace: ParsedTrace; statKey: string }) {
  const rows = Object.entries(trace.perPlanet)
    .map(([planet, p]) => ({
      planet,
      contribution: p.contributions?.[statKey] ?? 0,
      sign: p.sign ?? '',
      house: p.house,
      dignity: dignityLabel(p.dignity),
      retrograde: !!p.retrograde,
    }))
    .filter((r) => r.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);

  const aspects = trace.aspectBonuses.filter((a) => (a.statBonuses?.[statKey] ?? 0) > 0);

  if (rows.length === 0 && aspects.length === 0) {
    return <p className="text-[10px] text-text-muted">No individual contributions recorded.</p>;
  }

  return (
    <div className="space-y-1.5 rounded-lg bg-black/30 p-2.5">
      {rows.map((r) => (
        <div key={r.planet} className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className="text-text-secondary">
            <span className="font-semibold capitalize text-text-primary">{r.planet}</span>
            {r.sign ? ` in ${r.sign}` : ''}
            {typeof r.house === 'number' ? `, house ${r.house}` : ''}
            {r.dignity ? `, ${r.dignity}` : ''}
            {r.retrograde ? ', retrograde' : ''}
          </span>
          <span className="shrink-0 font-semibold text-accent">+{r.contribution.toFixed(1)}</span>
        </div>
      ))}
      {aspects.map((a, i) => (
        <div key={i} className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className="capitalize text-text-secondary">
            {a.bodyA} {a.aspectType} {a.bodyB}
            {typeof a.orb === 'number' ? ` (${a.orb.toFixed(1)}° orb)` : ''}
          </span>
          <span className="shrink-0 font-semibold text-accent">
            +{(a.statBonuses?.[statKey] ?? 0).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---- Character tab ---- */

function CharacterTab({
  character,
  loading,
  error,
}: {
  character: CharacterResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const [openTrace, setOpenTrace] = useState<string | null>(null);

  const display = useMemo(() => {
    if (!character) return null;
    return getClassDisplay(character.classSlug, character.subclassSlug, character.risingSlug);
  }, [character]);

  const trace = useMemo(() => parseStatTrace(character?.statTrace), [character?.statTrace]);

  const buildSummary = useMemo(() => {
    if (!character || !display) return '';
    const sun = normalizeSignSlug(character.classSlug);
    const moon = normalizeSignSlug(character.subclassSlug);
    const sunT = display.sunSign;
    const moonT = display.moonSign;
    const ascT = display.ascSign;
    if (sun === moon) {
      return `Double ${sunT} core with ${ascT} rising. ${display.role}.`;
    }
    return `${sunT} core, ${moonT} instincts, ${ascT} rising. ${display.role}.`;
  }, [character, display]);

  if (loading) return <p className="p-4 text-xs text-text-secondary">Loading character…</p>;
  if (error) return <p className="p-4 text-xs text-danger">{error}</p>;
  if (!character || !display) return null;

  return (
    <div className="space-y-5 p-4">
      <div>
        <h3 className="font-serif text-base font-bold text-text-primary">{display.className}</h3>
        <p className="text-xs text-text-muted">{display.role}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[.03] p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-text-muted">Subclass</p>
          <p className="text-xs font-semibold text-text-primary">{display.subclassName}</p>
          <p className="text-[10px] text-text-muted">Moon in {display.moonSign}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[.03] p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-text-muted">Rising</p>
          <p className="text-xs font-semibold text-text-primary">{display.risingName}</p>
          <p className="text-[10px] text-text-muted">{display.ascSign} ascendant</p>
        </div>
      </div>

      {buildSummary ? <p className="text-xs italic text-text-secondary">{buildSummary}</p> : null}

      <section className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Combat Stats
        </h4>
        {STAT_KEYS.map((key) => {
          const base = character.baseStats[key];
          const eff = character.effectiveStats[key];
          const gear = character.effectiveStats.bonuses?.[key] ?? 0;
          const pct = Math.round((Math.max(0, Math.min(20, eff)) / 20) * 100);
          const color = statColor(eff);
          const expanded = openTrace === key;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs capitalize text-text-secondary">{key}</span>
                <span className="text-sm font-bold text-text-primary">
                  {gear ? <span className="mr-1 text-xs font-semibold text-success">+{gear}</span> : null}
                  {eff}
                  {eff !== base ? (
                    <span className="ml-1 text-[10px] font-normal text-text-muted">
                      (base {base})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              {trace ? (
                <button
                  type="button"
                  className="text-[10px] text-accent hover:underline"
                  onClick={() => setOpenTrace(expanded ? null : key)}
                >
                  Why this stat? {expanded ? '▴' : '▾'}
                </button>
              ) : null}
              {expanded && trace ? <StatTraceDetail trace={trace} statKey={key} /> : null}
            </div>
          );
        })}
        {character.effectiveStats.woundedPenalty ? (
          <p className="text-[10px] text-danger">Wounded: stats reduced by 25%.</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Temperament
        </h4>
        {Object.entries(character.temperament || {}).map(([axis, value]) => {
          const v = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 0;
          return (
            <div key={axis} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[10px] capitalize text-text-secondary">
                {axis}
              </span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.round(v * 100)}%` }}
                />
              </div>
              <span className="w-7 shrink-0 text-right text-[10px] text-text-muted">
                {Math.round(v * 100)}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* ---- Inventory tab ---- */

const EQUIP_SLOTS = ['weapon', 'armor', 'consumable_1', 'accessory', 'consumable_2', 'relic'] as const;

const SLOT_LOCK_LABEL: Record<string, string> = {
  accessory: 'Unlocks at 7-day streak',
  consumable_2: 'Unlocks at 14-day streak',
  relic: 'Unlocks at first Saturn transition',
};

function slotIsUnlocked(slotsUnlocked: string[], slot: string): boolean {
  if (slot === 'consumable_1') {
    return slotsUnlocked.includes('consumable') || slotsUnlocked.includes('consumable_1');
  }
  return slotsUnlocked.includes(slot);
}

function InventoryTab({
  inventory,
  loading,
  mutating,
  onEquip,
  onUnequip,
  onUse,
  onDiscard,
}: Pick<
  CharacterDrawerProps,
  'inventory' | 'mutating' | 'onEquip' | 'onUnequip' | 'onUse' | 'onDiscard'
> & { loading: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected: InventoryBagItem | null = useMemo(
    () => inventory?.bag?.find((i) => i.instanceId === selectedId) ?? null,
    [inventory, selectedId]
  );

  const gearChips = useMemo(() => {
    return Object.entries(inventory?.statBonusesFromGear || {}).filter(([, v]) => v);
  }, [inventory]);

  if (loading && !inventory) {
    return <p className="p-4 text-xs text-text-secondary">Loading inventory…</p>;
  }
  if (!inventory) return null;

  return (
    <div className="space-y-5 p-4">
      <section className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Equipped</h4>
        <div className="grid grid-cols-3 gap-2">
          {EQUIP_SLOTS.map((slot) => {
            const unlocked = slotIsUnlocked(inventory.slotsUnlocked ?? [], slot);
            const item = inventory.equipped?.[slot] ?? null;
            return (
              <div
                key={slot}
                className="flex min-h-[64px] flex-col items-center justify-center rounded-lg p-1.5 text-center"
                style={{
                  background: 'rgba(255,255,255,.03)',
                  border: unlocked
                    ? `1px solid ${item ? rarityColor(item.rarity) : 'rgba(255,255,255,.1)'}`
                    : '1px dashed rgba(255,255,255,.12)',
                  opacity: unlocked ? 1 : 0.55,
                }}
              >
                {!unlocked ? (
                  <>
                    <span aria-hidden>🔒</span>
                    <span className="mt-1 text-[8px] leading-tight text-text-muted">
                      {SLOT_LOCK_LABEL[slot] ?? 'Locked'}
                    </span>
                  </>
                ) : item ? (
                  <>
                    <span className="line-clamp-2 text-[10px] font-semibold text-text-primary">
                      {item.name}
                    </span>
                    <button
                      type="button"
                      disabled={mutating}
                      className="mt-1 text-[9px] text-accent hover:underline disabled:opacity-50"
                      onClick={() => void onUnequip(slot)}
                    >
                      Unequip
                    </button>
                  </>
                ) : (
                  <span className="text-[9px] capitalize text-text-muted">
                    {slot.replace('_', ' ')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {gearChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {gearChips.map(([stat, val]) => (
              <span
                key={stat}
                className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-semibold capitalize text-success"
              >
                +{val} {stat}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Bag</h4>
          <span className="text-[10px] text-text-muted">
            {inventory.bagUsed} / {inventory.maxBagSize}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(inventory.bag ?? []).map((item) => (
            <button
              key={item.instanceId}
              type="button"
              onClick={() => setSelectedId(item.instanceId === selectedId ? null : item.instanceId)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg p-1 text-center transition-transform hover:scale-105 ${
                selectedId === item.instanceId ? 'ring-1 ring-accent' : ''
              }`}
              style={{
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${rarityColor(item.rarity)}`,
              }}
              title={item.name}
            >
              <span className="line-clamp-2 text-[8px] leading-tight text-text-secondary">
                {item.name}
              </span>
              {item.quantity > 1 ? (
                <span className="text-[8px] text-text-muted">×{item.quantity}</span>
              ) : null}
            </button>
          ))}
          {Array.from({
            length: Math.max(0, (inventory.maxBagSize ?? 0) - (inventory.bag?.length ?? 0)),
          }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="aspect-square rounded-lg border border-white/5 bg-white/[.01]"
            />
          ))}
        </div>
      </section>

      {selected ? (
        <div
          className="space-y-2 rounded-lg p-3"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${rarityColor(selected.rarity)}`,
          }}
        >
          <p className="font-serif text-sm font-bold" style={{ color: rarityColor(selected.rarity) }}>
            {selected.name}
          </p>
          <p className="text-[10px] capitalize text-text-muted">
            {selected.rarity} · {selected.category}
            {selected.equipped ? ` · equipped (${selected.equippedSlot})` : ''}
          </p>
          {selected.description ? (
            <p className="text-[11px] text-text-secondary">{selected.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(selected.statModifiers || {}).map(([stat, val]) => (
              <span
                key={stat}
                className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-semibold capitalize text-success"
              >
                {val > 0 ? '+' : ''}
                {val} {stat}
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            {!selected.equipped ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={mutating}
                onClick={() => void onEquip(selected.instanceId)}
              >
                Equip
              </Button>
            ) : null}
            {selected.category === 'consumable' && selected.equipped ? (
              <Button
                variant="outline"
                size="sm"
                disabled={mutating}
                onClick={() => void onUse(selected.instanceId)}
              >
                Use
              </Button>
            ) : null}
            {!selected.equipped ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={mutating}
                onClick={() => {
                  setSelectedId(null);
                  void onDiscard(selected.instanceId);
                }}
              >
                Discard
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---- Loot tab ---- */

function LootTab({ campaignId, active }: { campaignId: string; active: boolean }) {
  const [table, setTable] = useState<LootTableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || table || loading) return;
    setLoading(true);
    fetchLootTable(campaignId)
      .then(setTable)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load loot table'))
      .finally(() => setLoading(false));
  }, [active, table, loading, campaignId]);

  if (loading) return <p className="p-4 text-xs text-text-secondary">Loading loot table…</p>;
  if (error) return <p className="p-4 text-xs text-danger">{error}</p>;
  if (!table) return null;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-serif text-sm font-bold text-text-primary">{table.label}</h3>
        <p className="text-[10px] text-text-muted">Items that can drop in this dungeon</p>
      </div>

      <div className="space-y-1.5">
        {(table.items ?? []).map((item) => (
          <div
            key={item.slug}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/[.03] px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-serif text-[13px] text-text-primary">{item.name}</p>
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

      {table.relicReward ? (
        <div
          className="space-y-1 rounded-lg p-3"
          style={{ background: 'rgba(139,92,246,.08)', border: '1px solid #8B5CF6' }}
        >
          <p className="text-[8px] font-bold uppercase tracking-wider text-[#8B5CF6]">
            Chapter completion reward
          </p>
          <p className="font-serif text-sm font-bold text-text-primary">{table.relicReward.name}</p>
          <p className="text-[10px] text-text-secondary">{table.relicReward.description}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ---- Drawer shell ---- */

const TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: 'character', label: 'Character' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'loot', label: 'Loot Table' },
];

export function CharacterDrawer(props: CharacterDrawerProps) {
  const { campaignId, open, tab, onTabChange, onClose } = props;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:static md:z-auto md:w-[320px] md:shrink-0"
      style={{
        background: 'rgba(15,23,42,.95)',
        borderLeft: '1px solid rgba(255,255,255,.06)',
        backdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-label="Character drawer"
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="flex flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`flex-1 border-b-2 px-1 pb-1.5 pt-1 text-[11px] font-semibold transition-colors ${
                tab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-white/5 hover:text-text-primary"
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'character' ? (
          <CharacterTab
            character={props.character}
            loading={props.characterLoading}
            error={props.characterError}
          />
        ) : null}
        {tab === 'inventory' ? (
          <InventoryTab
            inventory={props.inventory}
            loading={props.inventoryLoading}
            mutating={props.mutating}
            onEquip={props.onEquip}
            onUnequip={props.onUnequip}
            onUse={props.onUse}
            onDiscard={props.onDiscard}
          />
        ) : null}
        {tab === 'loot' ? <LootTab campaignId={campaignId} active={open && tab === 'loot'} /> : null}
      </div>
    </div>
  );
}
