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
    hint: 'Enter any birthday and hear what the sky sounded like at that exact moment.',
    slotCount: 1,
  },
  {
    id: 'pair',
    title: 'How do two charts connect?',
    description: 'Two charts side by side. See what happens between them and hear the connection.',
    hint: "Compare any two people's charts and hear the sound of their connection.",
    slotCount: 2,
  },
  {
    id: 'whatif',
    title: 'What if?',
    description: 'Start from a blank chart. Place planets anywhere. Hear what the configuration sounds like.',
    hint: 'The Moon Landing. Your graduation. Last Tuesday. Any date and place has a unique sky.',
    slotCount: 1,
  },
  {
    id: 'group',
    title: 'Group chemistry',
    description: 'Three or more charts in the same room. What does the group dynamic sound like?',
    hint: 'Put your whole friend group in one chart and hear what happens when all your charts overlap.',
    slotCount: 3,
  },
];

export const SANDBOX_MAX_SLOTS = 8;

export const SANDBOX_HERO_SUBTITLE =
  'Build charts, explore connections, and hear what the configurations sound like.';
