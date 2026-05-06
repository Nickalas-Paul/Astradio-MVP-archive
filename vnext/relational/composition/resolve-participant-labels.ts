/**
 * Phase 6E — participant display labels for group aggregate projection (Sandbox / relational).
 * YOUR requires owner context + viewer_chart_id + ownership match; otherwise neutral labels only.
 */

import { getChartById } from '../../compat/chart-store';
import type { Chart } from '../../compat/types';

export type AggregateParticipantLabelV1 = {
  slotIndex: number;
  label: string;
  isViewer: boolean;
};

export type ResolveParticipantLabelsOpts = {
  viewerChartId?: string;
  /** When omitted, YOUR is never applied (neutral labels only). */
  labelResolutionOwnerId?: string;
};

function trimViewerId(raw: string | undefined): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** Pure label assignment from fetched chart rows (unit-tested). */
export function participantLabelsFromCharts(
  chartIdsOrdered: readonly (string | null)[],
  charts: readonly (Chart | undefined)[],
  opts?: ResolveParticipantLabelsOpts
): AggregateParticipantLabelV1[] {
  const viewerId = trimViewerId(opts?.viewerChartId);
  const ownerId = opts?.labelResolutionOwnerId?.trim() || undefined;

  const ownedSlotIndices: number[] = [];
  if (ownerId) {
    for (let i = 0; i < charts.length; i++) {
      const ch = charts[i];
      if (ch && ch.ownerId === ownerId) ownedSlotIndices.push(i);
    }
  }

  const ambiguousMultiOwnedWithoutViewer =
    !!ownerId && !viewerId && ownedSlotIndices.length > 1;

  let personSeq = 0;
  const nextPersonLabel = (): string => {
    personSeq += 1;
    return `Person ${personSeq}`;
  };

  const out: AggregateParticipantLabelV1[] = [];

  for (let i = 0; i < chartIdsOrdered.length; i++) {
    const cid = chartIdsOrdered[i];
    const ch = cid ? charts[i] : undefined;

    if (cid == null) {
      out.push({ slotIndex: i, label: nextPersonLabel(), isViewer: false });
      continue;
    }

    if (!ch) {
      out.push({ slotIndex: i, label: nextPersonLabel(), isViewer: false });
      continue;
    }

    const displayName = typeof ch.label === 'string' && ch.label.trim() ? ch.label.trim() : '';

    const canUseYour =
      !!viewerId &&
      !!ownerId &&
      cid === viewerId &&
      ch.ownerId === ownerId &&
      !ambiguousMultiOwnedWithoutViewer;

    if (canUseYour) {
      out.push({ slotIndex: i, label: 'YOUR', isViewer: true });
    } else if (displayName) {
      out.push({ slotIndex: i, label: displayName, isViewer: false });
    } else {
      out.push({ slotIndex: i, label: nextPersonLabel(), isViewer: false });
    }
  }

  return out;
}

/**
 * Parallel fetch chart rows; birth-only slots use `null` at that index.
 */
export async function resolveParticipantLabels(
  chartIdsOrdered: readonly (string | null)[],
  opts?: ResolveParticipantLabelsOpts
): Promise<AggregateParticipantLabelV1[]> {
  const charts: (Chart | undefined)[] = await Promise.all(
    chartIdsOrdered.map((id) => (id ? getChartById(id) : Promise.resolve(undefined)))
  );
  return participantLabelsFromCharts(chartIdsOrdered, charts, opts);
}
