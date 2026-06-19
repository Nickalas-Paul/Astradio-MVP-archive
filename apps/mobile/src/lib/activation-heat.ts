import { colors } from '../constants/colors';

export type ActivationHeatLevel = 'high' | 'active' | 'mild';

/** Mirrors apps/web RelationalCommunityFeed percentile thresholds on activation_effective. */
export function computeActivationThresholds(scores: number[]): {
  highThreshold: number;
  mildThreshold: number;
  hasSpread: boolean;
} {
  const activationScores = scores
    .map((score) => Math.max(0, Math.min(1, score)))
    .sort((a, b) => b - a);

  let highThreshold =
    activationScores.length >= 4
      ? (activationScores[Math.floor(activationScores.length * 0.25)] ?? 0.65)
      : 0.65;

  let mildThreshold =
    activationScores.length >= 4
      ? (activationScores[Math.floor(activationScores.length * 0.75)] ?? 0.35)
      : 0.35;

  const hasSpread =
    activationScores.length >= 2 &&
    activationScores[0]! - activationScores[activationScores.length - 1]! > 0.01;

  if (!hasSpread) {
    highThreshold = 2;
    mildThreshold = -1;
  }

  return { highThreshold, mildThreshold, hasSpread };
}

export function activationHeatLevel(
  activation: number,
  highThreshold: number,
  mildThreshold: number
): ActivationHeatLevel {
  if (highThreshold >= 2) {
    return 'mild';
  }
  if (activation >= highThreshold) {
    return 'high';
  }
  if (activation > mildThreshold) {
    return 'active';
  }
  return 'mild';
}

export function activationHeatLabel(level: ActivationHeatLevel): string {
  switch (level) {
    case 'high':
      return 'High';
    case 'active':
      return 'Active';
    default:
      return 'Mild';
  }
}

/** Web: border-l-amber-400 / border-l-accent / border-l-slate-600 */
export const ACTIVATION_HEAT_COLORS: Record<
  ActivationHeatLevel,
  { border: string; label: string; bar: string; cardTint?: string }
> = {
  high: {
    border: '#fbbf24',
    label: '#fbbf24',
    bar: '#fbbf24',
    cardTint: 'rgba(251, 191, 36, 0.06)',
  },
  active: {
    border: colors.accent.DEFAULT,
    label: colors.accent.DEFAULT,
    bar: colors.accent.DEFAULT,
  },
  mild: {
    border: '#475569',
    label: colors.text.muted,
    bar: '#475569',
  },
};
