'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { HISTORICAL_PRESETS, type HistoricalPreset } from '@/data/historical-presets';

export type SandboxEntryMode = 'solo' | 'pair' | 'whatif' | 'group';

export interface SandboxEntryCard {
  id: SandboxEntryMode;
  title: string;
  description: string;
  hint: string;
  slotCount: number;
  icon: ReactNode;
  iconColorClass: string;
  iconBgClass: string;
}

const HINT_KEY_PREFIX = 'astradio_sandbox_hint_';

function hintStorageKey(cardId: SandboxEntryMode): string {
  const keyId = cardId === 'solo' ? 'single' : cardId;
  return `${HINT_KEY_PREFIX}${keyId}`;
}

function isHintDismissed(cardId: SandboxEntryMode): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(hintStorageKey(cardId)) === 'dismissed';
  } catch {
    return true;
  }
}

const SoloIcon = ({ className }: { className?: string }) => (
  <svg width={48} height={48} viewBox="0 0 28 28" fill="none" aria-hidden className={className}>
    <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="11" r="3" fill="currentColor" opacity="0.5" />
  </svg>
);

const PairIcon = ({ className }: { className?: string }) => (
  <svg width={48} height={48} viewBox="0 0 28 28" fill="none" aria-hidden className={className}>
    <circle cx="10" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const WhatIfIcon = ({ className }: { className?: string }) => (
  <svg width={48} height={48} viewBox="0 0 28 28" fill="none" aria-hidden className={className}>
    <path
      d="M14 4l2.2 6.8H23l-5.5 4 2.1 6.7L14 17.4 8.4 21.5l2.1-6.7-5.5-4h6.8L14 4z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const GroupIcon = ({ className }: { className?: string }) => (
  <svg width={48} height={48} viewBox="0 0 28 28" fill="none" aria-hidden className={className}>
    <circle cx="8" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="20" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="20" r="5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ENTRY_CARDS: SandboxEntryCard[] = [
  {
    id: 'solo',
    title: 'What does this chart sound like?',
    description: 'Import your chart or enter birth data. One chart, one reading, one soundtrack.',
    hint: 'Enter any birthday and hear what the sky sounded like at that exact moment.',
    slotCount: 1,
    icon: <SoloIcon className="text-accent" />,
    iconColorClass: 'text-accent',
    iconBgClass: 'bg-accent/10',
  },
  {
    id: 'pair',
    title: 'How do two charts connect?',
    description: 'Two charts side by side. See what happens between them and hear the connection.',
    hint: "Compare any two people's charts and hear the sound of their connection.",
    slotCount: 2,
    icon: <PairIcon className="text-[#E8C56D]" />,
    iconColorClass: 'text-[#E8C56D]',
    iconBgClass: 'bg-[#E8C56D]/10',
  },
  {
    id: 'whatif',
    title: 'What if?',
    description: 'Start from a blank chart. Place planets anywhere. Hear what the configuration sounds like.',
    hint: 'The Moon Landing. Your graduation. Last Tuesday. Any date and place has a unique sky.',
    slotCount: 1,
    icon: <WhatIfIcon className="text-[#D4836D]" />,
    iconColorClass: 'text-[#D4836D]',
    iconBgClass: 'bg-[#D4836D]/10',
  },
  {
    id: 'group',
    title: 'Group chemistry',
    description: 'Three or more charts in the same room. What does the group dynamic sound like?',
    hint: 'Put your whole friend group in one chart and hear what happens when all your charts overlap.',
    slotCount: 3,
    icon: <GroupIcon className="text-[#8FAFD4]" />,
    iconColorClass: 'text-[#8FAFD4]',
    iconBgClass: 'bg-[#8FAFD4]/10',
  },
];

function JourneyEntryCard({
  card,
  onSelect,
}: {
  card: SandboxEntryCard;
  onSelect: () => void;
}) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setShowHint(!isHintDismissed(card.id));
  }, [card.id]);

  const dismissHint = useCallback(() => {
    try {
      localStorage.setItem(hintStorageKey(card.id), 'dismissed');
    } catch {
      // ignore quota / private mode
    }
    setShowHint(false);
  }, [card.id]);

  return (
    <Card
      elevation="resting"
      size="md"
      className="min-h-[180px] flex flex-col transition-all duration-200 hover:border-accent/50 hover:shadow-md"
    >
      <div className="flex flex-col items-center text-center flex-1">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${card.iconBgClass}`}
        >
          {card.icon}
        </div>
        <h3 className="text-h3 font-serif text-text-primary mb-3">{card.title}</h3>
        <p className="text-body-sm text-text-secondary flex-1 mb-4">{card.description}</p>
        {showHint ? (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 w-full mb-4 text-left">
            <p className="text-caption text-text-secondary flex-1">{card.hint}</p>
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Dismiss hint"
              className="text-text-muted hover:text-text-primary text-caption shrink-0"
            >
              ✕
            </button>
          </div>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onSelect}>
          Start
        </Button>
      </div>
    </Card>
  );
}

export interface SandboxEntryCardsProps {
  onSelect: (mode: SandboxEntryMode, slotCount: number, options?: { prefill?: HistoricalPreset }) => void;
  onPresetSelect: (preset: HistoricalPreset) => void;
  onContinue: () => void;
  hasExistingComposition: boolean;
}

export function SandboxEntryCards({
  onSelect,
  onPresetSelect,
  onContinue,
  hasExistingComposition,
}: SandboxEntryCardsProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {ENTRY_CARDS.map((card) => (
          <JourneyEntryCard
            key={card.id}
            card={card}
            onSelect={() => onSelect(card.id, card.slotCount)}
          />
        ))}
      </div>

      <section className="space-y-4 max-w-4xl mx-auto">
        <h3 className="font-serif text-h3 text-text-primary text-center">Historical Soundscapes</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {HISTORICAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetSelect(preset)}
              className="px-4 py-2 rounded-full border border-border hover:border-accent/60 bg-transparent hover:bg-accent/5 transition-colors text-body-sm text-text-secondary hover:text-text-primary"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {hasExistingComposition ? (
        <p className="text-center text-body-sm text-text-secondary">
          You have a composition in progress.{' '}
          <button
            type="button"
            onClick={onContinue}
            className="text-accent hover:underline underline-offset-2"
          >
            Continue where you left off →
          </button>
        </p>
      ) : null}
    </div>
  );
}
