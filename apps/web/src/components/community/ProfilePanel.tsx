'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useProfile, useProfileChart, type ProfileChartSection } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { LocationFinder } from '../sandbox/LocationFinder';

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
  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const { data: chartData, loading: chartLoading, error: chartError } = useProfileChart(chartId);
  const [createName, setCreateName] = useState('');
  const [createHandle, setCreateHandle] = useState('');
  const [createChartLabel, setCreateChartLabel] = useState('');
  const [createChartDate, setCreateChartDate] = useState('');
  const [createChartTime, setCreateChartTime] = useState('12:00');
  const [createChartLat, setCreateChartLat] = useState('');
  const [createChartLon, setCreateChartLon] = useState('');
  const [createChartLocationLabel, setCreateChartLocationLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (profileLoading) {
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

  // No session: show create-profile form only. No fake chart.
  if (user === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-6"
        >
          <h2 className="text-xl font-semibold text-text">Create a profile</h2>
          <p className="text-sm text-subtext">
            Astradio profiles are based on your natal chart. Enter your birth details to create your profile.
          </p>
          <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4">
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
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-text">Birth chart (required)</h3>
              <input
                placeholder="Label (e.g. My Natal)"
                value={createChartLabel}
                onChange={(e) => setCreateChartLabel(e.target.value)}
                className="input w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={createChartDate}
                  onChange={(e) => setCreateChartDate(e.target.value)}
                  className="input w-full"
                  required
                />
                <input
                  type="time"
                  value={createChartTime}
                  onChange={(e) => setCreateChartTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
              <LocationFinder
                value={createChartLocationLabel}
                onSelect={(r) => {
                  setCreateChartLocationLabel(r.label);
                  setCreateChartLat(String(r.lat));
                  setCreateChartLon(String(r.lon));
                }}
                onClear={() => {
                  setCreateChartLocationLabel('');
                  setCreateChartLat('');
                  setCreateChartLon('');
                }}
                placeholder="Birth place (city, region, or address)"
              />
            </div>
            {createError && <p className="text-red-500 text-xs">{createError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  creating ||
                  !createName.trim() ||
                  !createChartDate ||
                  !createChartTime ||
                  createChartLat === '' ||
                  createChartLon === '' ||
                  !Number.isFinite(Number(createChartLat)) ||
                  !Number.isFinite(Number(createChartLon))
                }
                aria-busy={creating}
                onClick={async () => {
                  setCreating(true); setCreateError(null);
                  try {
                    const body = {
                      displayName: createName.trim(),
                      handle: createHandle.trim() || undefined,
                      chart: {
                        label: createChartLabel.trim() || 'My Natal',
                        date: createChartDate,
                        time: createChartTime,
                        lat: Number(createChartLat),
                        lon: Number(createChartLon),
                      },
                    };
                    const r = await fetch('/api/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    const data = await r.json().catch(() => ({}));
                    if (!r.ok) { setCreateError(data?.error || 'Failed'); return; }
                    setCreateName(''); setCreateHandle('');
                    setCreateChartLabel(''); setCreateChartDate(''); setCreateChartTime('12:00');
                    setCreateChartLat(''); setCreateChartLon(''); setCreateChartLocationLabel('');
                    await refresh();
                  } finally {
                    setCreating(false);
                  }
                }}
                className={
                  creating ||
                  !createName.trim() ||
                  !createChartDate ||
                  !createChartTime ||
                  createChartLat === '' ||
                  createChartLon === '' ||
                  !Number.isFinite(Number(createChartLat)) ||
                  !Number.isFinite(Number(createChartLon))
                    ? 'px-4 py-2.5 rounded-lg bg-bgElev text-subtext text-sm font-medium border border-border cursor-not-allowed'
                    : 'px-4 py-2.5 rounded-lg bg-emerald text-bg text-sm font-medium shadow-md hover:brightness-110 focus:outline focus:ring-2 focus:ring-emerald focus:ring-offset-2 focus:ring-offset-bg transition'
                }
              >
                {creating ? 'Creating…' : 'Create profile'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const loading = chartLoading;
  const error = chartError;
  const hasExplainer = chartData?.explainer?.sections?.length;
  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text">{user.displayName}</h2>
            {realChart && (
              <p className="text-sm text-subtext mt-1">
                {primaryChart!.label} · {primaryChart!.date} {primaryChart!.time}
              </p>
            )}
            {noRealChart && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                No chart linked. Add your birth chart when creating a profile, or use the Sandbox to build a chart.
              </p>
            )}
          </div>
          {onSwitchToMatches && realChart && (
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
            {noRealChart ? (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex flex-col items-center justify-center text-center p-6 gap-2">
                <p className="text-subtext text-sm">No natal chart linked to your profile.</p>
                <p className="text-xs text-subtext">Create a new profile with birth data above, or build a chart in the Sandbox and link it when that flow is available.</p>
                <Link href="/sandbox" className="text-sm text-emerald hover:underline mt-2">Open Sandbox</Link>
              </div>
            ) : loading ? (
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
            {noRealChart && (
              <p className="text-subtext text-sm">Link a chart to see your astrology breakdown and use Matches.</p>
            )}
            {loading && !chartData && !noRealChart && (
              <div className="space-y-4">
                <div className="h-20 bg-bgElev rounded animate-pulse" />
                <div className="h-20 bg-bgElev rounded animate-pulse" />
              </div>
            )}
            {error && !chartData && !noRealChart && (
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
