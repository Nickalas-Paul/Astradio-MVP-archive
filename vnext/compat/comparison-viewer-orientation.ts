/**
 * Select viewer-oriented compatibility text for compat_pair comparisons.
 */

import type { Comparison, CompatibilityText, CompatibilityTextStructured } from './types';

export function normalizeCompatibilityTextStructured(raw: CompatibilityText | undefined): CompatibilityTextStructured {
  if (typeof raw === 'string') {
    return { short: raw, long: '', bullets: [] };
  }
  if (raw && typeof raw === 'object') {
    return {
      short: raw.short ?? '',
      long: raw.long ?? '',
      bullets: Array.isArray(raw.bullets) ? raw.bullets : [],
    };
  }
  return { short: '', long: '', bullets: [] };
}

export function compatibilityTextFromComposeResult(text: unknown): CompatibilityTextStructured {
  const t = text as { short?: string; long?: string; bullets?: unknown } | null | undefined;
  return {
    short: t?.short ?? '',
    long: t?.long ?? '',
    bullets: Array.isArray(t?.bullets) ? (t!.bullets as string[]) : [],
  };
}

export type ViewerOrientedComparisonText = {
  compatibilityText: CompatibilityTextStructured;
  seekerChartId: string;
  targetChartId: string;
  usedReverseOrientation: boolean;
};

/**
 * Forward text: seeker = chartA. Reverse text: seeker = chartB (when stored).
 * Falls back to forward when reverse is missing (legacy rows).
 */
export function viewerOrientedComparisonText(
  comparison: Pick<Comparison, 'chartAId' | 'chartBId' | 'compatibilityText' | 'compatibilityTextReverse'>,
  viewerChartId: string | null | undefined
): ViewerOrientedComparisonText {
  const forward = normalizeCompatibilityTextStructured(comparison.compatibilityText);
  const reverseRaw = comparison.compatibilityTextReverse;
  const reverse =
    reverseRaw != null ? normalizeCompatibilityTextStructured(reverseRaw as CompatibilityText) : null;

  const viewer = typeof viewerChartId === 'string' ? viewerChartId.trim() : '';
  if (viewer && viewer === comparison.chartBId && reverse) {
    return {
      compatibilityText: reverse,
      seekerChartId: comparison.chartBId,
      targetChartId: comparison.chartAId,
      usedReverseOrientation: true,
    };
  }

  return {
    compatibilityText: forward,
    seekerChartId: comparison.chartAId,
    targetChartId: comparison.chartBId,
    usedReverseOrientation: false,
  };
}
