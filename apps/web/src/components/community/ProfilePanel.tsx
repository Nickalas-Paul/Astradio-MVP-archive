'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useProfile, useProfileChart, type ProfileChartSection } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { LocationFinder } from '../sandbox/LocationFinder';
import { useCompositionStore, useUIStore } from '../../store';
import { getApiBaseUrl } from '../../core/api-base';
import type { CompositionJob } from '../../types';

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

/** Finds the ready natal baseline job for this chart in composition history.
 * Matches by request.chartA first; fallback matches by job id pattern natal_<chartId>_<timestamp>
 * so we find the job even after persist/rehydrate if request shape differs. */
function useNatalBaselineJob(chartId: string | null) {
  const { jobHistory } = useCompositionStore();
  if (!chartId) return null;
  const job = jobHistory.find((j) => {
    if (j.status.stage !== 'ready' || !j.id.startsWith('natal_')) return false;
    if (j.request.chartA === chartId) return true;
    return j.id.startsWith(`natal_${chartId}_`);
  });
  return job ?? null;
}

function natalTrackLabel(displayName: string | null | undefined): string {
  return displayName && displayName.trim() ? `My ${displayName.trim()} Soundtrack` : 'My Soundtrack';
}

function NatalBaselinePlayer({ chartId, displayName }: { chartId: string; displayName?: string | null }) {
  const job = useNatalBaselineJob(chartId);
  if (!job || job.status.stage !== 'ready') return null;
  const url = job.status.stage === 'ready' ? job.status.url : '';
  if (!url || typeof url !== 'string') return null;
  const label = natalTrackLabel(displayName);
  return (
    <div className="mt-4 rounded-lg border border-border bg-bgElev p-3 space-y-2">
      <p className="text-sm font-medium text-text">{label}</p>
      <audio
        controls
        src={url}
        className="w-full h-8 min-h-[32px]"
        preload="metadata"
        aria-label={label}
      />
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

/** After profile creation: fetch chart snapshot, run natal compose, add to composition history only when we have playable audio. */
async function triggerNatalComposition(chartId: string): Promise<void> {
  const base = getApiBaseUrl();
  const chartRes = await fetch(`${base || ''}/api/profile/chart?chartId=${encodeURIComponent(chartId)}`, { credentials: 'same-origin' });
  if (!chartRes.ok) return;
  const chartData = await chartRes.json().catch(() => null);
  const snapshot = chartData?.snapshot;
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot?.planets) || !Array.isArray(snapshot?.houses)) return;
  const composeRes = await fetch(`${base || ''}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      mode: 'sandbox',
      seed: `natal_${chartId}`,
      overriddenSnapshot: snapshot,
    }),
  });
  if (!composeRes.ok) return;
  const composePayload = await composeRes.json().catch(() => null);
  const jobId = `natal_${chartId}_${Date.now()}`;
  let audioUrl = '';
  const base64 = composePayload?.audio?.base64;
  if (typeof base64 === 'string' && base64.length > 0) {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      audioUrl = URL.createObjectURL(blob);
    } catch (_) {}
  }
  // Only add a "ready" job when we have playable audio. No fake success: if compose returned 200 but no artifact, do not add a soundtrack row.
  if (!audioUrl) {
    const exportError = composePayload?.audio?.export_error ?? null;
    const reason = exportError === 'export_disabled'
      ? 'Audio export is disabled on this server.'
      : exportError
        ? 'Audio generation failed.'
        : 'No audio artifact in response.';
    useUIStore.getState().addToast({ message: `Soundtrack could not be generated: ${reason}`, type: 'error', duration: 8000 });
    return;
  }
  const addJobToHistory = useCompositionStore.getState().addJobToHistory;
  const job: CompositionJob = {
    id: jobId,
    request: { chartA: chartId, genre: 'house', durationSec: 30 },
    status: {
      stage: 'ready',
      id: jobId,
      url: audioUrl,
      layers: [
        { key: 'melody', gain: 0.8 },
        { key: 'harmony', gain: 0.7 },
        { key: 'rhythm', gain: 0.75 },
        { key: 'texture', gain: 0.6 },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  addJobToHistory(job);
}

export interface ProfilePanelProps {
  onSwitchToConnections?: () => void;
}

export function ProfilePanel({ onSwitchToConnections }: ProfilePanelProps) {
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
              {(() => {
                const canSubmit = Boolean(
                  createName.trim() &&
                  createChartDate &&
                  createChartTime &&
                  createChartLat !== '' &&
                  createChartLon !== '' &&
                  Number.isFinite(Number(createChartLat)) &&
                  Number.isFinite(Number(createChartLon))
                );
                const disabled = creating || !canSubmit;
                return (
                  <button
                    type="button"
                    disabled={disabled}
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
                        const newChartId = data?.primaryChart?.id ?? null;
                        setCreateName(''); setCreateHandle('');
                        setCreateChartLabel(''); setCreateChartDate(''); setCreateChartTime('12:00');
                        setCreateChartLat(''); setCreateChartLon(''); setCreateChartLocationLabel('');
                        await refresh();
                        if (newChartId) {
                          triggerNatalComposition(newChartId).catch(() => {});
                        }
                      } finally {
                        setCreating(false);
                      }
                    }}
                    className={
                      disabled
                        ? 'px-4 py-2.5 rounded-lg bg-bgElev text-subtext text-sm font-medium border border-border cursor-not-allowed min-w-[140px]'
                        : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/40 min-w-[140px] hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-bg transition'
                    }
                  >
                    {creating ? 'Creating…' : 'Create profile'}
                  </button>
                );
              })()}
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
          {onSwitchToConnections && realChart && (
            <button
              type="button"
              onClick={onSwitchToConnections}
              className="px-5 py-2.5 rounded-full bg-emerald text-bg font-medium text-sm shadow-md hover:opacity-90 transition-opacity"
            >
              Find connections
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
            {realChart?.id && !noRealChart && (
              <NatalBaselinePlayer chartId={realChart.id} displayName={user?.displayName} />
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
