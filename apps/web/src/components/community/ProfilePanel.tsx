'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useProfile, useProfileChart, type ProfileChartSection } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { LocationFinder } from '../sandbox/LocationFinder';
import { useCompositionStore, type LastNatalComposeResult } from '../../store';
import { useHydrateCompositionUrls } from '../../hooks/useHydrateCompositionUrls';
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

/** User-facing message for soundtrack failure (maps technical export_error to readable text). */
function userFacingSoundtrackMessage(exportError: string | null): string {
  if (!exportError?.trim()) return 'Your soundtrack could not be generated. You can try again later.';
  const e = exportError.toLowerCase();
  if (e.includes('render_failed') || e.includes('recitation') || e.includes('blocked')) return 'Your soundtrack couldn\'t be generated for this chart. You can try again later.';
  if (e.includes('provider_not_configured') || e.includes('provider')) return 'Audio generation is not configured right now.';
  if (e.includes('chart') || e.includes('snapshot')) return 'Chart data was unavailable. Try again or check your birth details.';
  return 'Your soundtrack could not be generated. You can try again later.';
}

/** Phase 8G: when soundtrack is unavailable — user-facing message and optional retry. */
function SoundtrackStatusBlock({ chartId, onRetry }: { chartId: string; onRetry?: () => void }) {
  const lastNatalComposeResult = useCompositionStore((s) => s.lastNatalComposeResult);
  const job = useNatalBaselineJob(chartId);
  if (job?.status?.stage === 'ready' && job.status.url) return null;
  if (!lastNatalComposeResult || lastNatalComposeResult.chartId !== chartId || lastNatalComposeResult.status !== 'failed') return null;
  const r: LastNatalComposeResult = lastNatalComposeResult;
  const message = userFacingSoundtrackMessage(r.export_error);
  return (
    <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2 text-left">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition"
        >
          Retry soundtrack
        </button>
      )}
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

function setNatalComposeResult(
  chartId: string,
  status: 'ok' | 'failed',
  opts: { provider_used: string | null; export_error: string | null; export_attempted: boolean; has_audio_payload: boolean }
): void {
  useCompositionStore.getState().setLastNatalComposeResult({
    chartId,
    status,
    provider_used: opts.provider_used,
    export_error: opts.export_error,
    export_attempted: opts.export_attempted,
    has_audio_payload: opts.has_audio_payload,
  });
}

/** After profile creation: fetch chart snapshot, run natal compose, add to composition history so it appears in Saved Tracks. */
async function triggerNatalComposition(chartId: string): Promise<void> {
  const base = getApiBaseUrl();

  // Step 1: fetch profile chart snapshot. In very fresh sessions the chart may not be immediately readable;
  // classify failures explicitly so the profile can show a truthful status instead of silently skipping compose.
  let snapshot: any = null;
  let lastChartError: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const chartRes = await fetch(
        `${base || ''}/api/profile/chart?chartId=${encodeURIComponent(chartId)}`,
        { credentials: 'same-origin' }
      );
      if (!chartRes.ok) {
        const body = await chartRes.json().catch(() => ({}));
        lastChartError = body?.error || `chart_request_failed (${chartRes.status})`;
      } else {
        const chartData = await chartRes.json().catch(() => null);
        const maybeSnapshot = chartData?.snapshot;
        if (maybeSnapshot && typeof maybeSnapshot === 'object' && Array.isArray(maybeSnapshot.planets) && Array.isArray(maybeSnapshot.houses)) {
          snapshot = maybeSnapshot;
          lastChartError = null;
          break;
        }
        lastChartError = 'chart_snapshot_unavailable';
      }
    } catch (e) {
      lastChartError = e instanceof Error ? e.message : 'chart_request_failed';
    }
    if (attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (!snapshot) {
    setNatalComposeResult(chartId, 'failed', {
      provider_used: null,
      export_error: lastChartError || 'chart_snapshot_unavailable',
      export_attempted: false,
      has_audio_payload: false,
    });
    return;
  }

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
  if (!composeRes.ok) {
    const errBody = await composeRes.json().catch(() => ({}));
    setNatalComposeResult(chartId, 'failed', {
      provider_used: null,
      export_error: errBody?.error || `compose_request_failed (${composeRes.status})`,
      export_attempted: false,
      has_audio_payload: false,
    });
    return;
  }
  const composePayload = await composeRes.json().catch(() => null);
  if (typeof window !== 'undefined' && window.location.search.includes('natal_debug=1')) {
    const audio = composePayload?.audio;
    const summary = {
      hasBase64: typeof audio?.base64 === 'string' && audio.base64.length > 0,
      base64Length: typeof audio?.base64 === 'string' ? audio.base64.length : 0,
      export_id: composePayload?.export_id ?? audio?.export_id ?? null,
      export_error: audio?.export_error ?? null,
      export_attempted: audio?.export_attempted ?? null,
      audio_export_available: audio?.audio_export_available ?? null,
      httpStatus: composeRes.status,
    };
    console.log('[NATAL_COMPOSE_RESPONSE]', JSON.stringify(summary));
  }
  const providerUsed = composePayload?.audio?.provider_used ?? null;
  const exportError = composePayload?.audio?.export_error ?? null;
  const exportAttempted = !!composePayload?.audio?.export_attempted;
  const base64 = composePayload?.audio?.base64;
  const hasBase64 = typeof base64 === 'string' && base64.length > 0;
  const exportId = composePayload?.export_id ?? composePayload?.audio?.export_id ?? null;
  const hasExportId = typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId);
  const has_audio_payload = hasBase64 || hasExportId;

  if (!composePayload || typeof composePayload !== 'object') {
    setNatalComposeResult(chartId, 'failed', {
      provider_used: null,
      export_error: 'invalid_response',
      export_attempted: false,
      has_audio_payload: false,
    });
    return;
  }

  // Promote based on usable audio, not provider/export flags. Backend may return 200 with audio
  // but provider_used !== 'lyria' or export_error set (e.g. export_disabled); we still show the track.
  const addJobToHistory = useCompositionStore.getState().addJobToHistory;
  const jobId = `natal_${chartId}_${Date.now()}`;
  let audioUrl = '';
  if (hasBase64) {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      audioUrl = URL.createObjectURL(blob);
    } catch (_) {}
  }
  if (!audioUrl && hasExportId) {
    try {
      const exportRes = await fetch(`${base || ''}/api/exports/${exportId}`, { credentials: 'same-origin' });
      if (exportRes.ok) {
        const ab = await exportRes.arrayBuffer();
        if (ab.byteLength > 0) {
          const blob = new Blob([ab], { type: exportRes.headers.get('content-type') || 'audio/wav' });
          audioUrl = URL.createObjectURL(blob);
        }
      }
    } catch (_) {}
  }

  if (!audioUrl) {
    setNatalComposeResult(chartId, 'failed', {
      provider_used: providerUsed ?? null,
      export_error: exportError ?? (providerUsed ? null : 'provider_not_configured'),
      export_attempted: exportAttempted,
      has_audio_payload,
    });
    return;
  }

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
    exportId: typeof exportId === 'string' ? exportId : undefined,
  };
  addJobToHistory(job);
  setNatalComposeResult(chartId, 'ok', {
    provider_used: providerUsed,
    export_error: null,
    export_attempted: exportAttempted,
    has_audio_payload: true,
  });
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
  const [createChartTz, setCreateChartTz] = useState('');
  const [createChartLocationLabel, setCreateChartLocationLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [natalComposeInProgress, setNatalComposeInProgress] = useState(false);

  useHydrateCompositionUrls();

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

  // No session: register or log in (account creation is POST /api/auth/register only).
  if (user === null) {
    const chartPayload = {
      label: createChartLabel.trim() || 'My Natal',
      date: createChartDate,
      time: createChartTime,
      lat: Number(createChartLat),
      lon: Number(createChartLon),
      timezone: createChartTz || 'UTC',
    };
    const chartReady =
      createChartDate &&
      createChartTime &&
      createChartLat !== '' &&
      createChartLon !== '' &&
      createChartTz !== '' &&
      Number.isFinite(Number(createChartLat)) &&
      Number.isFinite(Number(createChartLon));
    const canRegister =
      registerEmail.trim().includes('@') &&
      registerPassword.length >= 8 &&
      createName.trim() &&
      chartReady;
    const canLogin = loginEmail.trim().includes('@') && loginPassword.length >= 1;

    return (
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-6"
        >
          <h2 className="text-xl font-semibold text-text">Sign in to Astradio</h2>
          <p className="text-sm text-subtext">
            Register with email and password, or log in to continue. Your natal chart is saved with your account.
          </p>
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                authTab === 'register' ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
              }`}
              onClick={() => {
                setAuthTab('register');
                setAuthError(null);
              }}
            >
              Register
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                authTab === 'login' ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
              }`}
              onClick={() => {
                setAuthTab('login');
                setAuthError(null);
              }}
            >
              Log in
            </button>
          </div>

          {authTab === 'login' ? (
            <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4 max-w-md">
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="input w-full"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="input w-full"
              />
              {authError && <p className="text-red-500 text-xs">{authError}</p>}
              <button
                type="button"
                disabled={authBusy || !canLogin}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthError(null);
                  try {
                    const r = await fetch('/api/auth/login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'same-origin',
                      body: JSON.stringify({
                        email: loginEmail.trim(),
                        password: loginPassword,
                      }),
                    });
                    const data = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      setAuthError(typeof data.error === 'string' ? data.error : 'Login failed');
                      return;
                    }
                    setLoginPassword('');
                    await refresh();
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                {authBusy ? 'Signing in…' : 'Log in'}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="input w-full"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password (min 8 characters)"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="input w-full"
                />
              </div>
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
                    setCreateChartTz(r.timezone || 'UTC');
                  }}
                  onClear={() => {
                    setCreateChartLocationLabel('');
                    setCreateChartLat('');
                    setCreateChartLon('');
                    setCreateChartTz('');
                  }}
                  placeholder="Birth place (city, region, or address)"
                />
              </div>
              {(createError || authError) && (
                <p className="text-red-500 text-xs">{authError || createError}</p>
              )}
              <button
                type="button"
                disabled={creating || authBusy || !canRegister}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                onClick={async () => {
                  setCreating(true);
                  setCreateError(null);
                  setAuthError(null);
                  try {
                    const body = {
                      email: registerEmail.trim(),
                      password: registerPassword,
                      displayName: createName.trim(),
                      handle: createHandle.trim() || undefined,
                      chart: chartPayload,
                    };
                    const r = await fetch('/api/auth/register', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'same-origin',
                      body: JSON.stringify(body),
                    });
                    const data = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      const msg =
                        typeof data.error === 'string'
                          ? data.error
                          : typeof data.message === 'string'
                            ? data.message
                            : 'Registration failed';
                      setAuthError(msg);
                      return;
                    }
                    const newChartId = data?.primaryChart?.id ?? null;
                    setRegisterPassword('');
                    setCreateName('');
                    setCreateHandle('');
                    setCreateChartLabel('');
                    setCreateChartDate('');
                    setCreateChartTime('12:00');
                    setCreateChartLat('');
                    setCreateChartLon('');
                    setCreateChartTz('');
                    setCreateChartLocationLabel('');
                    await refresh();
                    if (newChartId) {
                      setNatalComposeInProgress(true);
                      triggerNatalComposition(newChartId).finally(() => setNatalComposeInProgress(false));
                    }
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating || authBusy ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          )}
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
          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToConnections && realChart && (
              <button
                type="button"
                onClick={onSwitchToConnections}
                className="px-5 py-2.5 rounded-full bg-emerald text-bg font-medium text-sm shadow-md hover:opacity-90 transition-opacity"
              >
                Find connections
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-border text-subtext text-sm hover:bg-bgElev"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                await refresh();
              }}
            >
              Log out
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,400px)_1fr]">
          <div>
            {noRealChart ? (
              <div className="max-w-full space-y-4 rounded-2xl border border-border bg-bgElev p-4">
                <p className="text-sm font-medium text-text">Add your birth chart</p>
                <p className="text-xs text-subtext">Required for profile wheel, matches, and soundtrack.</p>
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
                  />
                  <input
                    type="time"
                    value={createChartTime}
                    onChange={(e) => setCreateChartTime(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <LocationFinder
                  value={createChartLocationLabel}
                  onSelect={(r) => {
                    setCreateChartLocationLabel(r.label);
                    setCreateChartLat(String(r.lat));
                    setCreateChartLon(String(r.lon));
                    setCreateChartTz(r.timezone || 'UTC');
                  }}
                  onClear={() => {
                    setCreateChartLocationLabel('');
                    setCreateChartLat('');
                    setCreateChartLon('');
                    setCreateChartTz('');
                  }}
                  placeholder="Birth place (city, region, or address)"
                />
                {createError && <p className="text-red-500 text-xs">{createError}</p>}
                <button
                  type="button"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                  onClick={async () => {
                    setCreating(true);
                    setCreateError(null);
                    try {
                      const body = {
                        chart: {
                          label: createChartLabel.trim() || 'My Natal',
                          date: createChartDate,
                          time: createChartTime,
                          location: {
                            source: 'geofinder',
                            label: createChartLocationLabel,
                            lat: Number(createChartLat),
                            lon: Number(createChartLon),
                            timezone: createChartTz || 'UTC',
                            resolvedAt: new Date().toISOString(),
                          },
                        },
                      };
                      const r = await fetch('/api/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(body),
                      });
                      const data = await r.json().catch(() => ({}));
                      if (!r.ok) {
                        setCreateError(typeof data.error === 'string' ? data.error : 'Failed to save chart');
                        return;
                      }
                      const newChartId = data?.primaryChart?.id ?? null;
                      setCreateChartLabel('');
                      setCreateChartDate('');
                      setCreateChartTime('12:00');
                      setCreateChartLat('');
                      setCreateChartLon('');
                      setCreateChartTz('');
                      setCreateChartLocationLabel('');
                      await refresh();
                      if (newChartId) {
                        setNatalComposeInProgress(true);
                        triggerNatalComposition(newChartId).finally(() => setNatalComposeInProgress(false));
                      }
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  {creating ? 'Saving…' : 'Save birth chart'}
                </button>
                <Link href="/sandbox" className="block text-sm text-emerald hover:underline">
                  Open Sandbox
                </Link>
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
              <>
                {natalComposeInProgress && (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Generating your soundtrack…</p>
                    <p className="text-xs text-subtext mt-1">This may take a moment.</p>
                  </div>
                )}
                <NatalBaselinePlayer chartId={realChart.id} displayName={user?.displayName} />
                <SoundtrackStatusBlock
                  chartId={realChart.id}
                  onRetry={() => {
                    setNatalComposeInProgress(true);
                    triggerNatalComposition(realChart.id).finally(() => setNatalComposeInProgress(false));
                  }}
                />
              </>
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

        {/* Phase 8G: privacy / discoverability — only when backend returns flags */}
        {(user?.discoverable !== undefined || user?.show_in_feed !== undefined) && (
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-text">Community visibility</h3>
            <p className="text-xs text-subtext">Control how others can find you. Off = hidden from search or feed.</p>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={user?.discoverable !== false}
                  disabled={privacySaving}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setPrivacySaving(true);
                    try {
                      const r = await fetch('/api/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ discoverable: val }),
                        credentials: 'same-origin',
                      });
                      if (r.ok) await refresh();
                    } finally {
                      setPrivacySaving(false);
                    }
                  }}
                  className="rounded border-border"
                />
                <span className="text-sm text-text">Show in community search</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={user?.show_in_feed !== false}
                  disabled={privacySaving}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setPrivacySaving(true);
                    try {
                      const r = await fetch('/api/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ show_in_feed: val }),
                        credentials: 'same-origin',
                      });
                      if (r.ok) await refresh();
                    } finally {
                      setPrivacySaving(false);
                    }
                  }}
                  className="rounded border-border"
                />
                <span className="text-sm text-text">Show in community feed</span>
              </label>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
