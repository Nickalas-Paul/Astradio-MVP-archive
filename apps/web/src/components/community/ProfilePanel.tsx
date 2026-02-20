'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useProfile, useProfileChart, type ProfileChartSection } from '../../core/social/hooks';

const WheelCanvas = dynamic(
  () => import('../WheelCanvas').then((m) => m.default),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

const SECTION_ORDER = ['signatures', 'significance', 'musical'];
const SECTION_TITLES: Record<string, string> = {
  signatures: 'Astrology',
  significance: 'Personal Significance',
  musical: 'Music Theory',
};

function ExplainerSections({ sections }: { sections: ProfileChartSection[] }) {
  const sorted = [...sections].sort(
    (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)
  );
  return (
    <div className="space-y-6">
      {sorted.map((sec) => (
        <section key={sec.id} className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="text-lg font-semibold text-text mb-3">
            {SECTION_TITLES[sec.id] ?? sec.title}
          </h3>
          <div className="text-subtext text-sm leading-relaxed whitespace-pre-wrap">
            {sec.text}
          </div>
          {sec.bullets && sec.bullets.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
              {sec.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function snapshotSafeForWheel(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const o = snapshot as Record<string, unknown>;
  const planets = o.planets ?? o.positions;
  const houses = o.houses ?? o.cusps;
  const hasPlanets = Array.isArray(planets) && planets.length > 0;
  const hasHouses = Array.isArray(houses) && houses.length >= 12;
  return hasPlanets || hasHouses;
}

export interface ProfilePanelProps {
  onSwitchToMatches?: () => void;
}

export function ProfilePanel({ onSwitchToMatches }: ProfilePanelProps) {
  const { user, primaryChart, loading: profileLoading, error: profileError, refresh } = useProfile();
  const chartId = primaryChart?.id ?? null;
  const { data: chartData, loading: chartLoading, error: chartError } = useProfileChart(chartId);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createHandle, setCreateHandle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const isStub = user?.id === 'usr_stub_v1';

  if (profileLoading || !user) {
    return (
      <div className="card space-y-6">
        <div className="h-8 w-48 bg-bgElev rounded animate-pulse" />
        <div className="aspect-square max-w-md bg-bgElev rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 bg-bgElev rounded w-full animate-pulse" />
          <div className="h-4 bg-bgElev rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="card">
        <p className="text-subtext text-sm">{profileError}</p>
      </div>
    );
  }

  const loading = chartLoading;
  const error = chartError;
  const hasExplainer = chartData?.explainer?.sections?.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card space-y-6"
      >
        {isStub && createOpen && (
          <div className="rounded-lg border border-border bg-bgElev p-4 space-y-3">
            <h3 className="text-sm font-medium text-text">Create profile (dev)</h3>
            <p className="text-xs text-subtext">Persists on backend when ENGINE_BASE_URL and POSTGRES_URL are set.</p>
            <input
              placeholder="Display name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="input w-full"
            />
            <input
              placeholder="Handle (optional)"
              value={createHandle}
              onChange={(e) => setCreateHandle(e.target.value)}
              className="input w-full"
            />
            {createError && <p className="text-red-500 text-xs">{createError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={creating || !createName.trim()}
                onClick={async () => {
                  setCreating(true); setCreateError(null);
                  try {
                    const r = await fetch('/api/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ displayName: createName.trim(), handle: createHandle.trim() || undefined }),
                    });
                    const data = await r.json().catch(() => ({}));
                    if (!r.ok) { setCreateError(data?.error || 'Failed'); return; }
                    setCreateOpen(false); setCreateName(''); setCreateHandle('');
                    await refresh();
                  } finally {
                    setCreating(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text">{user.displayName}</h2>
            {primaryChart && (
              <p className="text-sm text-subtext mt-1">
                {primaryChart.label} · {primaryChart.date} {primaryChart.time}
              </p>
            )}
          </div>
          {isStub && !createOpen && (
            <button type="button" onClick={() => setCreateOpen(true)} className="px-4 py-2 rounded-lg border border-border text-sm text-text hover:bg-bgElev">
              Create profile
            </button>
          )}
          {onSwitchToMatches && !isStub && (
            <button
              type="button"
              onClick={onSwitchToMatches}
              className="px-5 py-2.5 rounded-full bg-emerald text-bg font-medium text-sm shadow-md hover:opacity-90 transition-opacity"
            >
              Find Matches
            </button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,400px)_1fr]">
          <div>
            {loading ? (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border animate-pulse" />
            ) : chartData?.snapshot && snapshotSafeForWheel(chartData.snapshot) ? (
              <WheelCanvas
                chartData={chartData.snapshot as any}
                isLoading={false}
                className="max-w-full"
              />
            ) : chartData?.snapshot ? (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
                Chart data received; add planets and houses for wheel view.
              </div>
            ) : (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
                {error || 'No chart data'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            {loading && !chartData && (
              <div className="space-y-4">
                <div className="h-20 bg-bgElev rounded animate-pulse" />
                <div className="h-20 bg-bgElev rounded animate-pulse" />
              </div>
            )}
            {error && !chartData && (
              <p className="text-subtext text-sm">{error}</p>
            )}
            {hasExplainer && (
              <ExplainerSections sections={chartData!.explainer.sections} />
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
