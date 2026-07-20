/**
 * Deterministic reveal-consumable hints (no die roll exposure).
 */

import { hash32 } from './combat-resolver';

const HINTS = [
  'The odds favor boldness today',
  'Caution may serve you better',
  'A quiet approach opens the path',
  'Momentum is with you if you commit',
  'Patience reveals the weaker seam',
  'The pressure rewards a clear stance',
] as const;

export function buildRevealHint(params: {
  challengeFingerprint: string;
  calendarDate: string;
  revealActive: boolean;
}): string | null {
  if (!params.revealActive) return null;
  const seed = `${params.challengeFingerprint}|${params.calendarDate}|reveal`;
  const idx = hash32(seed) % HINTS.length;
  return HINTS[idx] ?? HINTS[0];
}
