'use client';

import { useEffect, useState } from 'react';
import type { RelationalIntent } from '@/lib/relational-intent';

type Cluster = {
  id: string;
  label: string;
  band: string;
  members: Array<{ userId: string; chartId: string; displayName?: string; descriptors?: string[] }>;
  why: { bullets: string[] };
};

export function DiscoveryClustersBanner({ onDismiss }: { onDismiss: () => void }) {
  const [intent, setIntent] = useState<RelationalIntent | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('compat_intent_results') : null;
      if (!raw) return;
      const data = JSON.parse(raw) as { intent?: RelationalIntent; clusters?: Cluster[] };
      if (data.intent) setIntent(data.intent);
      if (Array.isArray(data.clusters)) setClusters(data.clusters);
    } catch {
      /* ignore */
    }
  }, []);

  if (clusters.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald/30 bg-emerald/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-text">Intent clusters{intent ? ` · ${intent}` : ''}</h3>
        <button type="button" onClick={onDismiss} className="text-sm text-subtext hover:text-text underline">
          Dismiss
        </button>
      </div>
      <ul className="space-y-4">
        {clusters.map((c) => (
          <li key={c.id} className="rounded-lg border border-border bg-bgElev p-3 space-y-2">
            <p className="font-medium text-text">{c.label}</p>
            <ul className="text-sm text-subtext space-y-1">
              {c.members.slice(0, 8).map((m) => (
                <li key={`${m.userId}-${m.chartId}`}>
                  {m.displayName ?? m.userId.slice(-6)} — {m.descriptors?.join(', ') ?? '—'}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
