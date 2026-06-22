import type { SandboxJourneyType } from '../types/sandbox';

/** Verbatim from web SandboxEntryCards.tsx ENTRY_CARDS (text fields only). */
export type SandboxEntryCardDef = {
  id: SandboxJourneyType;
  title: string;
  description: string;
  hint: string;
  slotCount: number;
};

export const SANDBOX_ENTRY_CARDS: SandboxEntryCardDef[] = [
  {
    id: 'solo',
    title: 'What does this chart sound like?',
    description: 'Import your chart or enter birth data. One chart, one reading, one soundtrack.',
    hint: 'Every chart has a frequency. Every frequency has a sound.',
    slotCount: 1,
  },
  {
    id: 'pair',
    title: 'How do two charts connect?',
    description: 'Two charts side by side. See what happens between them and hear the connection.',
    hint: 'Two charts in the same room produce a third sound that belongs to neither.',
    slotCount: 2,
  },
  {
    id: 'whatif',
    title: 'What if?',
    description: 'Start from a blank chart. Place planets anywhere. Hear what the configuration sounds like.',
    hint: 'Any date. Any location. Any moment in time has a sky, and every sky has a sound.',
    slotCount: 1,
  },
  {
    id: 'group',
    title: 'Group chemistry',
    description: 'Three or more charts in the same room. What does the group dynamic sound like?',
    hint: 'Three or more voices layered. The ensemble creates something none of them carry alone.',
    slotCount: 3,
  },
];

export const SANDBOX_MAX_SLOTS = 8;

export const SANDBOX_HERO_SUBTITLE =
  'Build charts, explore connections, and hear what the configurations sound like.';
