'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '../../core/api-base';
import { Card } from '@/components/shared/Card';

type SignalRow = {
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

export function SignalsPanel({ currentUserId }: { currentUserId: string | null }) {
  const [items, setItems] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUserId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/signals`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : `Signals ${r.status}`);
        setItems([]);
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signals failed');
      setItems([]);
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
    <Card as="section" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-text">Signals</h3>
          <p className="text-xs text-subtext">
            Purpose-driven prompts and acknowledgments. No DMs.{' '}
            <Link href="/community?tab=feed" className="text-accent-light hover:underline">
              Feed
            </Link>{' '}
            links here when a response is needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="text-sm px-3 py-1.5 rounded-lg bg-bgElev border border-border text-subtext hover:text-text"
        >
          Refresh
        </button>
      </div>
      {loading && <p className="text-sm text-subtext">Loading…</p>}
      {error && <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>}
      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-subtext">No open Signals. When relational events require action, they appear here.</p>
      )}
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bgElev p-3 text-sm">
            <div>
              <span className="text-text font-medium capitalize">{s.templateId.replace(/_/g, ' ')}</span>
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
                onClick={() => react(s.id)}
                className="px-3 py-1.5 rounded-lg bg-accent-muted text-accent-light text-sm border border-accent/40 disabled:opacity-50"
              >
                {busy === s.id ? '…' : 'Acknowledge'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
