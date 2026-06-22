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
  iconColorClass: string;
  iconBgClass: string;
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
    slotCount: 1,
    icon: <SoloIcon className="text-accent" />,
    iconColorClass: 'text-accent',
    iconBgClass: 'bg-accent/10',
  },
  {
    id: 'pair',
    title: 'How do two charts connect?',
    description: 'Two charts side by side. See what happens between them and hear the connection.',
    slotCount: 2,
    icon: <PairIcon className="text-[#E8C56D]" />,
    iconColorClass: 'text-[#E8C56D]',
    iconBgClass: 'bg-[#E8C56D]/10',
  },
  {
    id: 'whatif',
    title: 'What if?',
    description: 'Start from a blank chart. Place planets anywhere. Hear what the configuration sounds like.',
    slotCount: 1,
    icon: <WhatIfIcon className="text-[#D4836D]" />,
    iconColorClass: 'text-[#D4836D]',
    iconBgClass: 'bg-[#D4836D]/10',
  },
  {
    id: 'group',
    title: 'Group chemistry',
    description: 'Three or more charts in the same room. What does the group dynamic sound like?',
    slotCount: 3,
    icon: <GroupIcon className="text-[#8FAFD4]" />,
    iconColorClass: 'text-[#8FAFD4]',
    iconBgClass: 'bg-[#8FAFD4]/10',
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {ENTRY_CARDS.map((card) => (
          <Card
            key={card.id}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelect(card.id, card.slotCount)}
              >
                Start
              </Button>
            </div>
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
