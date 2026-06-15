'use client';

import { useState } from 'react';
import { Card } from '@/components/shared/Card';
import {
  SIGNAL_TYPE_PILL_CLASS,
  formatSignalActivityRelativeTime,
  formatSignalHistoryDate,
  formatSignalHistoryTimeSpan,
  formatSignalTemplateLabel,
  signalHistoryStatusLabel,
} from '@/lib/signal-display';

export type SignalHistorySummary = {
  total: number;
  byTemplate: Record<string, number>;
  sentByUserA?: number;
  sentByUserB?: number;
  acknowledgedCount: number;
  mostRecentAt?: string | null;
  oldestAt?: string | null;
};

export type SignalHistoryRow = {
  id: string;
  senderUserId?: string | null;
  recipientUserId: string;
  templateId: string;
  status: string;
  replyCount: number;
  createdAt: string;
};

type SignalHistorySectionProps = {
  peerDisplayName: string;
  viewerUserId: string;
  summary: SignalHistorySummary;
  signals: SignalHistoryRow[];
};

const TIMELINE_VISIBLE = 20;

function templatePills(byTemplate: Record<string, number>): Array<{ id: string; label: string; count: number }> {
  return Object.entries(byTemplate)
    .map(([id, count]) => ({ id, label: formatSignalTemplateLabel(id), count }))
    .sort((a, b) => b.count - a.count);
}

export function SignalHistorySection({
  peerDisplayName,
  viewerUserId,
  summary,
  signals,
}: SignalHistorySectionProps) {
  const [showAll, setShowAll] = useState(false);
  if (!summary.total || summary.total <= 0) return null;

  const timeSpan = formatSignalHistoryTimeSpan(summary.oldestAt ?? null, summary.mostRecentAt ?? null);
  const pills = templatePills(summary.byTemplate);
  const visible = showAll ? signals : signals.slice(0, TIMELINE_VISIBLE);
  const peerName = peerDisplayName.trim() || 'them';

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium text-text-primary">Signal History</h2>

      <Card elevation="resting" padding="p-5" className="space-y-4">
        <p className="text-body-sm text-text-secondary font-sans">
          You and {peerName} have exchanged {summary.total} signal{summary.total === 1 ? '' : 's'}
          {timeSpan ? ` over ${timeSpan}` : ''}.
        </p>

        {pills.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pills.map((p) => (
              <li key={p.id} className={SIGNAL_TYPE_PILL_CLASS}>
                {p.label} ({p.count})
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-caption text-text-muted font-sans">
          {summary.acknowledgedCount} of {summary.total} acknowledged
        </p>
      </Card>

      <ul className="divide-y divide-border/60">
        {visible.map((s) => {
          const sentByYou = s.senderUserId === viewerUserId;
          const who = sentByYou ? 'You' : peerName;
          const typeLabel = formatSignalTemplateLabel(s.templateId);
          const statusLabel = signalHistoryStatusLabel(s.status, s.replyCount);
          const statusClass =
            statusLabel === 'Acknowledged' ? 'text-accent' : 'text-text-muted';

          return (
            <li key={s.id} className="py-2 text-caption text-text-muted font-sans">
              {formatSignalHistoryDate(s.createdAt)} · {who} sent {typeLabel} ·{' '}
              <span className={statusClass}>{statusLabel}</span>
            </li>
          );
        })}
      </ul>

      {signals.length > TIMELINE_VISIBLE && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-sm text-accent hover:underline font-sans"
        >
          Show more ({signals.length - TIMELINE_VISIBLE} more)
        </button>
      ) : null}
    </section>
  );
}

export function SignalRecentActivityList({
  items,
}: {
  items: Array<{
    id: string;
    peerDisplayName?: string | null;
    templateId: string;
    createdAt: string;
  }>;
}) {
  if (!items.length) return null;

  return (
    <ul className="divide-y divide-border/60">
      {items.map((s) => {
        const peer = s.peerDisplayName?.trim() || 'Someone';
        const typeLabel = formatSignalTemplateLabel(s.templateId);
        return (
          <li key={s.id} className="py-2 text-caption text-text-muted font-sans">
            {peer} · {typeLabel} · {formatSignalActivityRelativeTime(s.createdAt)}
          </li>
        );
      })}
    </ul>
  );
}
