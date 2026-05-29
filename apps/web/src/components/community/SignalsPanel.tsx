'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '../../core/api-base';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import {
  formatIncomingSignalTransitContext,
  formatSignalReceivedRelativeTime,
  formatSignalSentRelativeTime,
  formatSignalTemplateWithDescription,
  outgoingSignalStatusLabel,
  formatSignalAnchorContext,
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
  senderUserId?: string | null;
  senderDisplayName?: string | null;
  senderHandle?: string | null;
};

type OutgoingSignalRow = IncomingSignalRow & {
  recipientUserId: string;
  recipientDisplayName: string;
};

const ACKNOWLEDGED_DISPLAY_MS = 2000;
const ACKNOWLEDGED_FADE_MS = 500;

function resolveSenderDisplayName(s: IncomingSignalRow): string {
  if (typeof s.senderDisplayName === 'string' && s.senderDisplayName.trim()) {
    return s.senderDisplayName.trim();
  }
  const body = s as IncomingSignalRow & { body?: { senderUserId?: string } };
  if (body.body?.senderUserId) {
    return 'Someone';
  }
  return 'Unknown sender';
}

export function SignalsPanel({ currentUserId }: { currentUserId: string | null }) {
  const [incoming, setIncoming] = useState<IncomingSignalRow[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingSignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(() => new Set());
  const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fadingIdsRef = useRef(fadingIds);
  fadingIdsRef.current = fadingIds;

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
      const items = Array.isArray(inJ.items) ? (inJ.items as IncomingSignalRow[]) : [];
      setIncoming(items.filter((s) => !fadingIdsRef.current.has(s.id)));
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

  useEffect(() => {
    const timers = removeTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const scheduleRemoveAfterAck = (id: string) => {
    const existing = removeTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setFadingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setTimeout(() => {
        setIncoming((prev) => prev.filter((s) => s.id !== id));
        setAcknowledgedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setFadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        removeTimersRef.current.delete(id);
      }, ACKNOWLEDGED_FADE_MS);
    }, ACKNOWLEDGED_DISPLAY_MS);
    removeTimersRef.current.set(id, t);
  };

  const react = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/signals/${encodeURIComponent(id)}/react`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        setAcknowledgedIds((prev) => new Set(prev).add(id));
        scheduleRemoveAfterAck(id);
        const outR = await fetch(`${getApiBaseUrl() || ''}/api/community/signals/sent`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const outJ = await outR.json().catch(() => ({}));
        if (outR.ok) {
          setOutgoing(Array.isArray(outJ.items) ? outJ.items : []);
        }
      }
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
          <p className="text-sm text-subtext">
            No incoming signals. When someone acknowledges a transit between you, it will appear here.
          </p>
        )}
        <ul className="space-y-3">
          {incoming.map((s) => {
            const senderName = resolveSenderDisplayName(s);
            const { label, description } = formatSignalTemplateWithDescription(s.templateId);
            const isAcknowledged = acknowledgedIds.has(s.id);
            const isFading = fadingIds.has(s.id);
            const canReact =
              !isAcknowledged && s.status === 'open' && s.replyCount < s.maxReplies;

            return (
              <li
                key={s.id}
                className={`transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}
              >
                <Card
                  elevation="raised"
                  padding="p-4"
                  className="border-l-2 border-l-accent space-y-3"
                >
                  <div className="space-y-1">
                    <p className="font-serif text-h3 font-semibold text-text-primary leading-snug">
                      {senderName}
                    </p>
                    <p className="text-body-sm text-text-secondary font-sans">
                      <span className="font-medium text-text-primary">{label}</span>
                      {description ? (
                        <span className="text-text-secondary"> — {description}</span>
                      ) : null}
                    </p>
                    <p className="text-caption text-text-muted font-sans">
                      {formatSignalReceivedRelativeTime(String(s.createdAt))}
                    </p>
                    <p className="text-caption text-text-muted font-sans">
                      {formatIncomingSignalTransitContext(senderName, s.anchorType, s.anchorId)}
                    </p>
                  </div>

                  {isAcknowledged ? (
                    <p className="text-body-sm text-accent-light font-sans flex items-center gap-2">
                      <span aria-hidden>✓</span>
                      Acknowledged
                    </p>
                  ) : canReact ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={busy === s.id}
                      loading={busy === s.id}
                      onClick={() => void react(s.id)}
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                </Card>
              </li>
            );
          })}
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
                  {formatSignalTemplateWithDescription(s.templateId).label}
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
