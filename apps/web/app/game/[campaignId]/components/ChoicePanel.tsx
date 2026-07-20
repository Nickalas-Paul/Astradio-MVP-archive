'use client';

import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import type { EncounterChoice } from '@/lib/game-api';

export interface ChoicePanelProps {
  choices: EncounterChoice[];
  onChoose: (choiceId: string) => void;
  disabled: boolean;
  selectedId: string | null;
}

function riskClass(risk: string): string {
  const r = risk.toLowerCase();
  if (r.includes('high')) return 'text-warning';
  if (r.includes('low')) return 'text-text-muted';
  return 'text-text-secondary';
}

function modLabel(mod: number): { text: string; className: string } {
  if (mod > 0) return { text: `+${mod}`, className: 'text-success' };
  if (mod < 0) return { text: String(mod), className: 'text-danger' };
  return { text: '+0', className: 'text-text-muted' };
}

export function ChoicePanel({ choices, onChoose, disabled, selectedId }: ChoicePanelProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h4 font-semibold text-text-primary">Your response</h2>
        <p className="mt-1 text-body-sm text-text-secondary">
          Each path leans on a different strength. Choose how you meet the pressure.
        </p>
      </div>
      <div className="grid gap-4">
        {choices.map((choice, index) => {
          const selected = selectedId === choice.id;
          const dimmed = Boolean(selectedId) && !selected;
          const mod = modLabel(choice.currentModifier);
          return (
            <Card
              key={choice.id}
              elevation="resting"
              size="md"
              selected={selected}
              className={`transition-opacity duration-base ${dimmed ? 'opacity-40' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption text-text-muted">{index + 1}</span>
                    <h3 className="font-semibold text-text-primary">{choice.label}</h3>
                  </div>
                  <p className="text-body-sm text-text-secondary">{choice.symbolicGesture}</p>
                  <div className="flex flex-wrap gap-3 text-caption">
                    <span className={riskClass(choice.riskProfile)}>
                      Risk: {choice.riskProfile || 'Moderate'}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="capitalize text-text-secondary">
                      {choice.primaryStat}{' '}
                      <span className={`font-medium ${mod.className}`}>{mod.text}</span>
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={disabled || Boolean(selectedId)}
                  onClick={() => onChoose(choice.id)}
                  className="shrink-0"
                >
                  Choose
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
