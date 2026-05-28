'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '../../core/api-base';
import { Card } from '@/components/shared/Card';
import {
  formatSignalAnchorContext,
  formatSignalSentRelativeTime,
  formatSignalTemplateLabel,
  outgoingSignalStatusLabel,
} from '@/lib/signal-display';

type IncomingSignalRow = {
  id: string;
  anchorType: string;
  anchorId: string;
  templateId: string;
  status: string;
  replyCount: number;
  maxReplies: number;
  expiresAt: string;
  createdAt: string;
};

type OutgoingSignalRow = IncomingSignalRow & {
  recipientUserId: string;
  recipientDisplayName: string;
};

export function SignalsPanel({ currentUserId }: { currentUserId: string | null }) {
  const [incoming, setIncoming] = useState<IncomingSignalRow[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingSignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUserId) {
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = getApiBaseUrl() || '';
      const [inR, outR] = await Promise.all([
        fetch(`${base}/api/community/signals`, { credentials: 'same-origin', cache: 'no-store' }),
        fetch(`${base}/api/community/signals/sent`, { credentials: 'same-origin', cache: 'no-store' }),
      ]);
      const inJ = await inR.json().catch(() => ({}));
      const outJ = await outR.json().catch(() => ({}));
      if (!inR.ok) {
        setError(typeof inJ.error === 'string' ? inJ.error : `Signals ${inR.status}`);
        setIncoming([]);
        setOutgoing([]);
        return;
      }
      setIncoming(Array.isArray(inJ.items) ? inJ.items : []);
      if (outR.ok) {
        setOutgoing(Array.isArray(outJ.items) ? outJ.items : []);
      } else {
        setOutgoing([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signals failed');
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const react = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/signals/${encodeURIComponent(id)}/react`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (r.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  if (!currentUserId) {
    return (
      <div className="rounded-lg border border-border bg-surface-1 p-4 text-sm text-subtext">
        Sign in to view Signals (structured, context-anchored actions — not chat).
      </div>
    );
  }

  return (
    <Card as="section" className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text">Signals</h3>
        <p className="text-xs text-subtext mt-1">
          Purpose-driven prompts and acknowledgments. No DMs.{' '}
          <Link href="/community?tab=feed" className="text-accent-light hover:underline">
            Feed
          </Link>{' '}
          links here when a response is needed.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-caption font-medium uppercase tracking-wide text-accent-light font-sans">
            Incoming
          </h4>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm px-3 py-1.5 rounded-lg bg-bgElev border border-border text-subtext hover:text-text"
          >
            Refresh
          </button>
        </div>
        {loading && <p className="text-sm text-subtext">Loading…</p>}
        {error && <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>}
        {!loading && incoming.length === 0 && !error && (
          <p className="text-sm text-subtext">No incoming signals.</p>
        )}
        <ul className="space-y-2">
          {incoming.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bgElev p-3 text-sm shadow-sm"
            >
              <div>
                <span className="text-text font-medium">{formatSignalTemplateLabel(s.templateId)}</span>
                <span className="text-subtext text-xs ml-2">
                  {s.anchorType} · {s.anchorId.slice(0, 12)}…
                </span>
                <p className="text-xs text-subtext mt-1">
                  Replies {s.replyCount}/{s.maxReplies} · expires {new Date(s.expiresAt).toLocaleString()}
                </p>
              </div>
              {s.status === 'open' && s.replyCount < s.maxReplies && (
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => void react(s.id)}
                  className="px-3 py-1.5 rounded-lg bg-accent-muted text-accent-light text-sm border border-accent/40 disabled:opacity-50"
                >
                  {busy === s.id ? '…' : 'Acknowledge'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-secondary font-sans">
          Sent
        </h4>
        {!loading && outgoing.length === 0 && (
          <p className="text-sm text-subtext">No sent signals.</p>
        )}
        <ul className="space-y-2">
          {outgoing.map((s) => {
            const statusLabel = outgoingSignalStatusLabel(s.status, s.replyCount);
            return (
              <li
                key={s.id}
                className="rounded-lg border border-border/80 bg-surface-0 p-3 text-sm space-y-1"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-text font-medium font-sans">
                    To {s.recipientDisplayName || s.recipientUserId}
                  </p>
                  <span
                    className={`text-caption font-sans ${
                      statusLabel === 'Acknowledged'
                        ? 'text-accent-light'
                        : 'text-text-muted'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="text-body-sm text-text-secondary font-sans">
                  {formatSignalTemplateLabel(s.templateId)}
                </p>
                <p className="text-caption text-text-muted font-sans">
                  {formatSignalSentRelativeTime(String(s.createdAt))}
                  <span className="mx-1.5" aria-hidden>
                    ·
                  </span>
                  {formatSignalAnchorContext(s.anchorType, s.anchorId)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </Card>
  );
}
