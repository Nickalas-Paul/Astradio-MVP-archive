'use client';

import type { EncounterChoice } from '@/lib/game-api';

export interface ChoicePanelProps {
  choices: EncounterChoice[];
  onChoose: (choiceId: string) => void;
  disabled: boolean;
  selectedId: string | null;
}

const STAT_COLORS: Record<string, string> = {
  vitality: '#EF4444',
  resilience: '#F59E0B',
  cunning: '#0e9696',
  charm: '#EC4899',
  intuition: '#8B5CF6',
  willpower: '#3B82F6',
};

function normalizeRisk(risk: string): string {
  const r = (risk || '').toLowerCase();
  if (r.includes('high')) return 'High';
  if (r.includes('low')) return 'Low';
  return 'Moderate';
}

function modDisplay(mod: number): { text: string; color: string } {
  if (mod > 0) return { text: `+${mod}`, color: '#10B981' };
  if (mod < 0) return { text: String(mod), color: '#EF4444' };
  return { text: '+0', color: '#94A3B8' };
}

export function ChoicePanel({ choices, onChoose, disabled, selectedId }: ChoicePanelProps) {
  if (choices.length === 0) return null;
  const bestMod = Math.max(...choices.map((c) => c.currentModifier));

  return (
    <div className="grid grid-cols-1 gap-3 pt-2 auto-rows-fr md:grid-cols-2 lg:grid-cols-3">
      {choices.map((choice) => {
        const isBest = choice.currentModifier === bestMod;
        const selected = selectedId === choice.id;
        const mod = modDisplay(choice.currentModifier);
        const statColor = STAT_COLORS[choice.primaryStat?.toLowerCase()] ?? '#94A3B8';
        return (
          <button
            key={choice.id}
            type="button"
            disabled={disabled || Boolean(selectedId)}
            onClick={() => onChoose(choice.id)}
            className="group relative flex h-full w-full flex-col overflow-visible rounded-xl p-3 pt-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: isBest ? 'rgba(14,150,150,.08)' : 'rgba(255,255,255,.04)',
              border: selected
                ? '1px solid rgba(14,150,150,.6)'
                : isBest
                  ? '1px solid rgba(14,150,150,.3)'
                  : '1px solid rgba(255,255,255,.08)',
              boxShadow: isBest ? '0 0 16px rgba(14,150,150,.08)' : undefined,
            }}
          >
            {isBest ? (
              <span className="absolute -top-2 right-2 z-10 rounded-full bg-accent px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                Best odds
              </span>
            ) : null}

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-white">{choice.label}</span>
              <span className="text-[17px] font-bold" style={{ color: mod.color }}>
                {mod.text}
              </span>
            </div>

            <p className="mt-1.5 flex-1 text-xs leading-snug text-text-muted">
              {choice.symbolicGesture}
            </p>

            <div className="mt-2 flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: statColor }}
              >
                {choice.primaryStat}
              </span>
              <span className="text-[10px] text-text-muted">
                {normalizeRisk(choice.riskProfile)} risk
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
