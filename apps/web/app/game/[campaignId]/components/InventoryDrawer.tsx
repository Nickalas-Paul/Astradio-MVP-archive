'use client';

import { useMemo } from 'react';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import type { InventoryResponse } from '@/lib/game-api';

const SLOT_ORDER = [
  'weapon',
  'armor',
  'accessory',
  'consumable_1',
  'consumable_2',
  'relic',
] as const;

function rarityBorder(rarity: string): string {
  const r = rarity.toLowerCase();
  if (r === 'legendary') return 'border-l-rarity-legendary';
  if (r === 'rare') return 'border-l-rarity-rare';
  if (r === 'uncommon') return 'border-l-rarity-uncommon';
  return 'border-l-rarity-common';
}

function slotUnlocked(slotsUnlocked: string[], slot: string): boolean {
  if (slot === 'consumable_1') return slotsUnlocked.includes('consumable') || slotsUnlocked.includes('consumable_1');
  if (slot === 'consumable_2') return slotsUnlocked.includes('consumable_2');
  return slotsUnlocked.includes(slot);
}

export interface InventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  inventory: InventoryResponse | null;
  loading?: boolean;
  mutating?: boolean;
  onEquip: (instanceId: string) => Promise<void>;
  onUnequip: (slot: string) => Promise<void>;
  onUse: (instanceId: string) => Promise<void>;
  onDiscard: (instanceId: string) => Promise<void>;
}

export function InventoryDrawer({
  open,
  onClose,
  inventory,
  loading,
  mutating,
  onEquip,
  onUnequip,
  onUse,
  onDiscard,
}: InventoryDrawerProps) {
  const gearLine = useMemo(() => {
    if (!inventory) return '';
    return Object.entries(inventory.statBonusesFromGear || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`)
      .join(', ');
  }, [inventory]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-stretch sm:justify-end" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-lg sm:h-full sm:max-h-none sm:rounded-none sm:rounded-l-none sm:border-l">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-serif text-h3 text-text-primary">Inventory</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {loading && !inventory ? (
            <p className="text-body-sm text-text-secondary">Loading inventory…</p>
          ) : null}

          {inventory ? (
            <>
              <div>
                <div className="mb-1 flex justify-between text-caption text-text-muted">
                  <span>Bag</span>
                  <span>
                    {inventory.bagUsed} / {inventory.maxBagSize}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${Math.min(100, (inventory.bagUsed / Math.max(1, inventory.maxBagSize)) * 100)}%`,
                    }}
                  />
                </div>
                {gearLine ? (
                  <p className="mt-2 text-caption text-accent">Gear: {gearLine}</p>
                ) : null}
              </div>

              <section className="space-y-2">
                <h3 className="text-h4 font-semibold">Equipped</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SLOT_ORDER.map((slot) => {
                    const unlocked = slotUnlocked(inventory.slotsUnlocked, slot);
                    const item = inventory.equipped[slot];
                    return (
                      <Card
                        key={slot}
                        elevation="flat"
                        size="sm"
                        className={!unlocked ? 'opacity-50' : item ? '' : 'border-dashed'}
                      >
                        <p className="text-caption capitalize text-text-muted">{slot.replace('_', ' ')}</p>
                        {!unlocked ? (
                          <p className="text-body-sm text-text-muted">Locked</p>
                        ) : item ? (
                          <>
                            <p className="truncate text-body-sm font-medium">{item.name}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={mutating}
                              className="mt-1 !min-h-0 px-0 py-1 text-caption"
                              onClick={() => void onUnequip(slot)}
                            >
                              Unequip
                            </Button>
                          </>
                        ) : (
                          <p className="text-body-sm text-text-muted">Empty</p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-h4 font-semibold">Bag</h3>
                {inventory.bag.length === 0 ? (
                  <p className="text-body-sm text-text-muted">Bag is empty</p>
                ) : (
                  inventory.bag.map((item) => (
                    <Card
                      key={item.instanceId}
                      elevation="resting"
                      size="sm"
                      className={`border-l-4 ${rarityBorder(item.rarity)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary">
                            {item.name}
                            {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                          </p>
                          <p className="text-caption capitalize text-text-muted">
                            {item.rarity} · {item.category}
                            {item.equipped ? ` · equipped (${item.equippedSlot})` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!item.equipped ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={mutating}
                            onClick={() => void onEquip(item.instanceId)}
                          >
                            Equip
                          </Button>
                        ) : null}
                        {item.category === 'consumable' && item.equipped ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={mutating}
                            onClick={() => void onUse(item.instanceId)}
                          >
                            Use
                          </Button>
                        ) : null}
                        {!item.equipped ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={mutating}
                            onClick={() => void onDiscard(item.instanceId)}
                          >
                            Discard
                          </Button>
                        ) : null}
                      </div>
                    </Card>
                  ))
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
