'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';

export type SandboxEntryMode = 'solo' | 'pair' | 'whatif' | 'group';

export interface SandboxEntryCard {
  id: SandboxEntryMode;
  title: string;
  description: string;
  slotCount: number;
  icon: ReactNode;
}

const SoloIcon = () => (
  <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden className="text-text-muted">
    <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="14" cy="11" r="3" fill="currentColor" opacity="0.5" />
  </svg>
);

const PairIcon = () => (
  <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden className="text-text-muted">
    <circle cx="10" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const WhatIfIcon = () => (
  <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden className="text-text-muted">
    <path
      d="M14 4l2.2 6.8H23l-5.5 4 2.1 6.7L14 17.4 8.4 21.5l2.1-6.7-5.5-4h6.8L14 4z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const GroupIcon = () => (
  <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden className="text-text-muted">
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
    slotCount: 1,
    icon: <SoloIcon />,
  },
  {
    id: 'pair',
    title: 'How do two charts connect?',
    description: 'Two charts side by side. See what happens between them and hear the connection.',
    slotCount: 2,
    icon: <PairIcon />,
  },
  {
    id: 'whatif',
    title: 'What if?',
    description: 'Start from a blank chart. Place planets anywhere. Hear what the configuration sounds like.',
    slotCount: 1,
    icon: <WhatIfIcon />,
  },
  {
    id: 'group',
    title: 'Group chemistry',
    description: 'Three or more charts in the same room. What does the group dynamic sound like?',
    slotCount: 3,
    icon: <GroupIcon />,
  },
];

export interface SandboxEntryCardsProps {
  onSelect: (mode: SandboxEntryMode, slotCount: number) => void;
  onContinue: () => void;
  hasExistingComposition: boolean;
}

export function SandboxEntryCards({ onSelect, onContinue, hasExistingComposition }: SandboxEntryCardsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {ENTRY_CARDS.map((card) => (
          <Card
            key={card.id}
            elevation="resting"
            size="md"
            className="min-h-[180px] flex flex-col transition-all duration-200 hover:border-accent/50 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-h3 font-serif text-text-primary pr-2">{card.title}</h3>
              <div className="shrink-0">{card.icon}</div>
            </div>
            <p className="text-body-sm text-text-secondary flex-1 mb-4">{card.description}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => onSelect(card.id, card.slotCount)}
            >
              Start
            </Button>
          </Card>
        ))}
      </div>

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
