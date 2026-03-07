'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useProfile, useUserSearch, useProfileChart, type ProfileChartSection, type DirectoryUser } from '../../core/social/hooks';
import { getApiBaseUrl } from '../../core/api-base';
import { hasRealChart } from '../../core/social/constants';

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
    <div className="space-y-4">
      {sorted.map((sec) => (
        <section key={sec.id} className="rounded-lg border border-border bg-bgElev p-3">
          <h4 className="text-sm font-semibold text-text mb-2">{SECTION_TITLES[sec.id] ?? sec.title}</h4>
          <div className="text-subtext text-xs leading-relaxed whitespace-pre-wrap">{sec.text}</div>
          {sec.bullets?.length ? (
            <ul className="mt-2 list-disc list-inside text-subtext text-xs space-y-0.5">
              {sec.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
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
  return (Array.isArray(planets) && planets.length > 0) || (Array.isArray(houses) && houses.length >= 12);
}

export function UserSearchPanel() {
  const [q, setQ] = useState('');
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<{ chartId: string; planHash?: string; error?: string } | null>(null);

  const { primaryChart } = useProfile();
  const { users, loading, error, refresh } = useUserSearch({ q, limit: 15 });
  const { data: profileChartData, loading: profileLoading, error: profileError } = useProfileChart(selectedChartId);
  const chartAId = hasRealChart(primaryChart) ? primaryChart.id : null;

  const handleCompare = async (target: DirectoryUser) => {
    if (!chartAId) {
      setCompareResult({ chartId: target.chartId, error: 'Add your birth chart in Profile first. Matches use your stored chart only.' });
      return;
    }
    setCompareResult(null);
    try {
      const base = getApiBaseUrl();
      const r = await fetch(`${base || ''}/api/comparisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chartAId,
          chartBId: target.chartId,
          relationshipMode: 'friends',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCompareResult({ chartId: target.chartId, error: data?.error || `Failed (${r.status})` });
        return;
      }
      setCompareResult({ chartId: target.chartId, planHash: data.planHash });
    } catch (e) {
      setCompareResult({ chartId: target.chartId, error: e instanceof Error ? e.message : 'Request failed' });
    }
  };

  return (
    <div className="card space-y-6">
      <h2 className="text-xl font-semibold text-text">Find people</h2>
      <p className="text-sm text-subtext">Search by name or user ID. View profile or run a compatibility comparison.</p>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input flex-1"
        />
        <button type="button" onClick={() => refresh()} disabled={loading} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
          Search
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <div className="text-subtext text-sm">Loading…</div>}

      {!loading && users.length === 0 && q && <p className="text-subtext text-sm">No users found.</p>}

      {!loading && users.length > 0 && (
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.userId}
              className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-bgElev"
            >
              <div>
                <span className="font-medium text-text">{u.displayName}</span>
                <span className="text-subtext text-sm ml-2">{u.userId}</span>
                {u.label && <span className="text-subtext text-xs ml-2">· {u.label}</span>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChartId(selectedChartId === u.chartId ? null : u.chartId)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-bgElev border border-border text-subtext hover:text-text"
                >
                  {selectedChartId === u.chartId ? 'Hide profile' : 'View profile'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCompare(u)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-emerald/20 text-emerald border border-emerald/40 hover:bg-emerald/30"
                >
                  Compare
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {compareResult && (
        <div className="p-3 rounded-lg border border-border bg-bgElev text-sm">
          {compareResult.error ? (
            <p className="text-red-400">{compareResult.error}</p>
          ) : (
            <p className="text-emerald">Comparison created. Plan hash: {compareResult.planHash?.slice(0, 12)}…</p>
          )}
        </div>
      )}

      {selectedChartId && (
        <div className="border-t border-border pt-6 mt-6">
          <h3 className="text-lg font-semibold text-text mb-4">Profile</h3>
          {profileLoading && <div className="text-subtext text-sm">Loading chart…</div>}
          {profileError && <p className="text-subtext text-sm">{profileError}</p>}
          {profileChartData && (
            <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
              <div>
                {profileChartData.snapshot && snapshotSafeForWheel(profileChartData.snapshot) ? (
                  <WheelCanvas
                    chartData={profileChartData.snapshot as any}
                    isLoading={false}
                    className="max-w-full"
                  />
                ) : (
                  <div className="aspect-square bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
                    Chart data received; wheel needs planets/houses.
                  </div>
                )}
              </div>
              <div className="min-w-0">
                {profileChartData.explainer?.sections?.length ? (
                  <ExplainerSections sections={profileChartData.explainer.sections} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
