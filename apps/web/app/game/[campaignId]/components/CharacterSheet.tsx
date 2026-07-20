'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useGameCharacter } from '@/hooks/useGameCharacter';
import type { StatBlock } from '@/lib/game-api';

const STAT_KEYS: (keyof StatBlock)[] = [
  'vitality',
  'resilience',
  'cunning',
  'charm',
  'intuition',
  'willpower',
];

export interface CharacterSheetProps {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}

export function CharacterSheet({ campaignId, open, onClose }: CharacterSheetProps) {
  const { character, loading, error } = useGameCharacter(campaignId, open);
  const [showTrace, setShowTrace] = useState(false);
  const [showTemperament, setShowTemperament] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-bg p-4 shadow-lg sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-h3 text-text-primary">Character</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {loading ? <p className="text-body-sm text-text-secondary">Loading character…</p> : null}
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}

        {character ? (
          <div className="space-y-6">
            <div>
              <p className="font-serif text-h2 text-text-primary">{character.className}</p>
              <p className="text-body-sm text-text-secondary">
                {character.subclassName} · {character.risingName} rising
              </p>
              <span className="mt-2 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-caption capitalize text-accent">
                {character.primaryElement}
              </span>
            </div>

            <section className="space-y-3">
              <h3 className="text-h4 font-semibold">Stats</h3>
              {STAT_KEYS.map((key) => {
                const base = character.baseStats[key];
                const eff = character.effectiveStats[key];
                const gear = character.effectiveStats.bonuses?.[key] ?? 0;
                const buff = character.effectiveStats.buffs?.[key] ?? 0;
                const pct = Math.round((eff / 20) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="capitalize text-text-secondary">{key}</span>
                      <span className="text-text-primary">
                        {eff}
                        <span className="text-text-muted">
                          {' '}
                          (base {base}
                          {gear ? ` +${gear} gear` : ''}
                          {buff ? ` +${buff} buff` : ''})
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {character.effectiveStats.woundedPenalty ? (
                <p className="text-caption text-danger">Wounded: stats reduced by 25%</p>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-h4 font-semibold">Equipped</h3>
              {character.equippedItems.length === 0 ? (
                <p className="text-body-sm text-text-muted">Nothing equipped</p>
              ) : (
                character.equippedItems.map((item) => (
                  <Card key={item.instanceId} elevation="flat" size="sm">
                    <p className="text-caption capitalize text-text-muted">{item.slot}</p>
                    <p className="font-medium text-text-primary">{item.name}</p>
                  </Card>
                ))
              )}
            </section>

            <section>
              <button
                type="button"
                className="text-body-sm text-accent hover:underline"
                onClick={() => setShowTrace((v) => !v)}
              >
                {showTrace ? 'Hide' : 'Why these stats?'}
              </button>
              {showTrace ? (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-1 p-3 text-caption text-text-muted">
                  {JSON.stringify(character.statTrace, null, 2)}
                </pre>
              ) : null}
            </section>

            <section>
              <button
                type="button"
                className="text-body-sm text-accent hover:underline"
                onClick={() => setShowTemperament((v) => !v)}
              >
                {showTemperament ? 'Hide' : 'Temperament'}
              </button>
              {showTemperament ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-caption text-text-secondary">
                  {Object.entries(character.temperament || {}).map(([k, v]) => (
                    <span key={k} className="capitalize">
                      {k}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
