'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { BirthDataForm } from '@/components/sandbox/BirthDataForm';
import { ChartSearchCombobox } from '@/components/sandbox/ChartSearchCombobox';
import { SandboxReportSections } from '@/components/sandbox/SandboxReportSections';
import { SandboxAudioPanel } from '@/components/sandbox/SandboxAudioPanel';
import { extractSandboxResolvePayload } from '../sandbox/page-helpers';
import { useProfile } from '@/core/social/hooks';
import { hasRealChart } from '@/core/social/constants';
import { getApiBaseUrl } from '@/core/api-base';
import { getPlayableLyriaUrl } from '@/core/audio/lyria-playback';
import { chartApiOwnerDisplayLabel } from '@/lib/sandbox-bff-wire';
import { SANDBOX_COMPOSE_CONTROLS } from '@/lib/sandbox-composition-state';
import type { SandboxBirth, SandboxReport } from '@/types/sandbox';

type ChartSlot =
  | { kind: 'chart_id'; chartId: string; label: string }
  | { kind: 'birth'; birth: SandboxBirth; label: string };

type ChartBMode = 'search' | 'birth' | null;

function slotToWire(slot: ChartSlot): Record<string, unknown> {
  if (slot.kind === 'chart_id') {
    return { chart_id: slot.chartId, overrides: { planets: {} } };
  }
  return { ephemeris_birth: slot.birth, overrides: { planets: {} } };
}

function buildDisplayReport(
  resolved: NonNullable<ReturnType<typeof extractSandboxResolvePayload>>,
  seed: string,
  canonicalObjectHash: string | null
): SandboxReport {
  const explanationForSections = resolved.explanation as {
    sections?: unknown[];
    spec?: string;
    meta?: { canonical_object_hash?: string };
  };
  const sections = Array.isArray(explanationForSections?.sections)
    ? explanationForSections.sections!.map((s: unknown) => {
        const x = s as {
          sectionId?: string;
          id?: string;
          title?: string;
          text?: string;
          bullets?: string[];
          meta?: unknown;
        };
        return {
          id: x.sectionId || x.id || '',
          title: x.title || '',
          text: x.text || '',
          bullets: x.bullets,
          meta: x.meta,
        };
      })
    : [];

  return {
    features: [],
    personality: null as unknown as SandboxReport['personality'],
    guidance: null as unknown as SandboxReport['guidance'],
    explanation: {
      spec: explanationForSections?.spec || 'UnifiedSpecV1.1',
      sections,
    },
    ...(resolved.sandboxSynastryReport ? { sandboxSynastryReport: resolved.sandboxSynastryReport } : {}),
    seed,
    meta: {
      combinedHash: seed,
      canonical_object_hash:
        canonicalObjectHash ??
        explanationForSections?.meta?.canonical_object_hash ??
        undefined,
      data_classification: {
        explanation: 'semantic_projection_v1',
        features_personality_guidance: 'mechanical_support_non_authoritative',
      },
    },
  };
}

function ListenPageInner() {
  const searchParams = useSearchParams();
  const chartAParam = searchParams.get('chartA')?.trim() || '';
  const chartBParam = searchParams.get('chartB')?.trim() || '';

  const { user, primaryChart, loading: profileLoading } = useProfile();
  const viewerChartId = hasRealChart(primaryChart) ? primaryChart!.id : null;

  const [slotA, setSlotA] = useState<ChartSlot | null>(null);
  const [slotB, setSlotB] = useState<ChartSlot | null>(null);
  const [chartAMode, setChartAMode] = useState<'mine' | 'manual'>('mine');
  const [chartBMode, setChartBMode] = useState<ChartBMode>(null);
  const [chartBSearchId, setChartBSearchId] = useState('');
  const [chartBPendingId, setChartBPendingId] = useState<string | null>(null);
  const [chartBSearchError, setChartBSearchError] = useState<string | null>(null);
  const [chartBSearchLoading, setChartBSearchLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [displayReport, setDisplayReport] = useState<SandboxReport | null>(null);
  const [lastSubmittedBody, setLastSubmittedBody] = useState<Record<string, unknown> | null>(null);
  const [planSha256, setPlanSha256] = useState<string | null>(null);
  const [canonicalObjectHash, setCanonicalObjectHash] = useState<string | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [sandboxAudioSrc, setSandboxAudioSrc] = useState<string | null>(null);
  const [audioGenerateLoading, setAudioGenerateLoading] = useState(false);
  const [audioGenerateError, setAudioGenerateError] = useState<string | null>(null);
  const [exportUnavailableReason, setExportUnavailableReason] = useState<{
    summary: string;
    step?: string;
    message?: string;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedRef = useRef(false);

  const fetchChartLabel = useCallback(async (chartId: string): Promise<string> => {
    const base = getApiBaseUrl();
    const r = await fetch(`${base}/api/charts/${encodeURIComponent(chartId)}`, { credentials: 'same-origin' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return chartId;
    return chartApiOwnerDisplayLabel(data && typeof data === 'object' ? (data as Record<string, unknown>) : {});
  }, []);

  useEffect(() => {
    if (profileLoading) return;

    let cancelled = false;
    (async () => {
      setPrefillLoading(true);
      try {
        if (chartAParam) {
          const label = await fetchChartLabel(chartAParam);
          if (!cancelled) {
            setSlotA({ kind: 'chart_id', chartId: chartAParam, label });
            setChartAMode('mine');
          }
        } else if (viewerChartId && user) {
          const label =
            primaryChart?.label?.trim() ||
            user.displayName?.trim() ||
            (await fetchChartLabel(viewerChartId));
          if (!cancelled) {
            setSlotA({ kind: 'chart_id', chartId: viewerChartId, label });
            setChartAMode('mine');
          }
        }

        if (chartBParam) {
          const label = await fetchChartLabel(chartBParam);
          if (!cancelled) {
            setSlotB({ kind: 'chart_id', chartId: chartBParam, label });
            setChartBMode(null);
          }
        }
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    chartAParam,
    chartBParam,
    profileLoading,
    viewerChartId,
    user,
    primaryChart?.label,
    fetchChartLabel,
  ]);

  useEffect(() => {
    if (!exportId) {
      setSandboxAudioSrc(null);
      return;
    }
    const base = getApiBaseUrl() || '';
    const url = `${base}/api/exports/${exportId}`;
    try {
      setSandboxAudioSrc(getPlayableLyriaUrl({ url }));
    } catch {
      setSandboxAudioSrc(null);
    }
  }, [exportId]);

  const bothSlotsReady = Boolean(slotA && slotB);
  const showEntryFlow = !displayReport;

  const handleChartAManual = useCallback(async (birth: SandboxBirth) => {
    const label = birth.location?.label?.trim() || 'Chart A';
    setSlotA({ kind: 'birth', birth, label });
    setChartAMode('manual');
  }, []);

  const handleUseMyChart = useCallback(async () => {
    if (!viewerChartId || !user) return;
    const label =
      primaryChart?.label?.trim() || user.displayName?.trim() || (await fetchChartLabel(viewerChartId));
    setSlotA({ kind: 'chart_id', chartId: viewerChartId, label });
    setChartAMode('mine');
  }, [viewerChartId, user, primaryChart?.label, fetchChartLabel]);

  const handleChartBManual = useCallback(async (birth: SandboxBirth) => {
    const label = birth.location?.label?.trim() || 'Chart B';
    setSlotB({ kind: 'birth', birth, label });
    setChartBMode('birth');
  }, []);

  const handleImportChartB = useCallback(async () => {
    const rawId = chartBPendingId?.trim() || (chartBSearchId.trim().startsWith('chart_') ? chartBSearchId.trim() : '');
    if (!rawId) {
      setChartBSearchError('Search for a chart and pick a result');
      return;
    }
    setChartBSearchLoading(true);
    setChartBSearchError(null);
    try {
      const label = await fetchChartLabel(rawId);
      setSlotB({ kind: 'chart_id', chartId: rawId, label });
      setChartBMode('search');
      setChartBSearchId('');
      setChartBPendingId(null);
    } catch (e) {
      setChartBSearchError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setChartBSearchLoading(false);
    }
  }, [chartBPendingId, chartBSearchId, fetchChartLabel]);

  const runResolve = useCallback(async () => {
    if (!slotA || !slotB) return;

    setResolveLoading(true);
    setResolveError(null);
    setDisplayReport(null);
    setExportId(null);
    setExportUnavailableReason(null);
    setAudioGenerateError(null);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    const chartAId = slotA.kind === 'chart_id' ? slotA.chartId : null;
    const chartBId = slotB.kind === 'chart_id' ? slotB.chartId : null;
    const seed = `listen_${chartAId || 'manual'}_${chartBId || 'manual'}_${Date.now()}`;

    const body: Record<string, unknown> = {
      schema_version: '1',
      slots: [slotToWire(slotA), slotToWire(slotB)],
      active_slot_index: 0,
      compose_controls: { ...SANDBOX_COMPOSE_CONTROLS },
      output_kind: 'full',
      seed,
      generateAudio: false,
    };

    try {
      const base = getApiBaseUrl();
      const resolveRes = await fetch(`${base}/api/sandbox/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const resolveData = (await resolveRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!resolveRes.ok || resolveData.ok === false) {
        const msg =
          (resolveData.error as string) ||
          (resolveData.message as string) ||
          (typeof resolveData.code === 'string' ? resolveData.code : null) ||
          `Resolve failed (${resolveRes.status})`;
        setResolveError(String(msg));
        return;
      }

      const resolved = extractSandboxResolvePayload(resolveData);
      if (!resolved) {
        setResolveError('Response missing a valid aggregate payload with explanation and plan hash.');
        return;
      }

      const explanationForSections = resolved.explanation as {
        meta?: { canonical_object_hash?: string };
      };
      const objectHash =
        (typeof resolveData.canonical_object_hash === 'string' ? resolveData.canonical_object_hash : null) ??
        (typeof explanationForSections?.meta?.canonical_object_hash === 'string'
          ? explanationForSections.meta.canonical_object_hash
          : null);

      setLastSubmittedBody(body);
      setPlanSha256(resolved.planSha256);
      setCanonicalObjectHash(objectHash);
      setExportId(resolved.exportId);
      setDisplayReport(buildDisplayReport(resolved, seed, objectHash));
      resolvedRef.current = true;
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Resolve failed');
    } finally {
      setResolveLoading(false);
    }
  }, [slotA, slotB]);

  const handleGenerateAudio = useCallback(async () => {
    if (!lastSubmittedBody || !planSha256 || !canonicalObjectHash) {
      setAudioGenerateError('Generate a text reading first.');
      return;
    }

    setAudioGenerateLoading(true);
    setAudioGenerateError(null);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    try {
      const base = getApiBaseUrl();
      const audioBody = {
        ...lastSubmittedBody,
        generateAudio: true,
        expectedPlanSha256: planSha256,
        expectedObjectIdentityHash: canonicalObjectHash,
      };
      const resolveRes = await fetch(`${base}/api/sandbox/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(audioBody),
      });
      const resolveData = (await resolveRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!resolveRes.ok || resolveData.ok === false) {
        const msg =
          (resolveData.error as string) ||
          (resolveData.message as string) ||
          (typeof resolveData.code === 'string' ? resolveData.code : null) ||
          `Audio resolve failed (${resolveRes.status})`;
        setAudioGenerateError(String(msg));
        setExportUnavailableReason({ summary: 'Audio generation failed', message: String(msg) });
        return;
      }

      const resolved = extractSandboxResolvePayload(resolveData);
      const exportIdNext = resolved?.exportId ?? null;
      if (!exportIdNext) {
        setAudioGenerateError('Audio export unavailable.');
        setExportUnavailableReason({ summary: 'Export unavailable' });
        return;
      }

      setExportId(exportIdNext);
      setExportUnavailableReason(null);
    } catch (e) {
      setAudioGenerateError(e instanceof Error ? e.message : 'Audio generation failed');
    } finally {
      setAudioGenerateLoading(false);
    }
  }, [lastSubmittedBody, planSha256, canonicalObjectHash]);

  const handleStartOver = useCallback(() => {
    setDisplayReport(null);
    setResolveError(null);
    setLastSubmittedBody(null);
    setPlanSha256(null);
    setCanonicalObjectHash(null);
    setExportId(null);
    setSandboxAudioSrc(null);
    setAudioGenerateError(null);
    setExportUnavailableReason(null);
    resolvedRef.current = false;
  }, []);

  if (profileLoading || prefillLoading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6">
          <p className="text-text-secondary">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6 space-y-4 text-center">
          <h1 className="font-serif text-h1 font-bold text-text-primary">How Does Your Relationship Sound?</h1>
          <p className="text-text-secondary">Sign in to combine charts and hear your connection.</p>
          <Link href="/profile">
            <Button type="button" variant="primary" size="md">
              Sign in via My Sky
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <header className="text-center space-y-2">
          <h1 className="font-serif text-h1 font-bold text-text-primary">How Does Your Relationship Sound?</h1>
          <p className="text-lg text-text-secondary">
            Combine two charts. Read the connection. Hear its soundtrack.
          </p>
        </header>

        {showEntryFlow && (
          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Chart A</h2>
              {slotA ? (
                <Card elevation="raised" className="space-y-2">
                  <p className="text-sm font-medium text-text-primary">{slotA.label}</p>
                  <p className="text-xs text-text-secondary">
                    {slotA.kind === 'chart_id' ? `Chart ID: ${slotA.chartId}` : 'Manual birth data'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {viewerChartId && chartAMode !== 'mine' ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => void handleUseMyChart()}>
                        Use my chart
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSlotA(null);
                        setChartAMode(viewerChartId ? 'mine' : 'manual');
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {viewerChartId ? (
                    <Card
                      elevation="raised"
                      className={`cursor-pointer transition-colors ${chartAMode === 'mine' ? 'ring-2 ring-accent/40 border-accent/50' : ''}`}
                      onClick={() => void handleUseMyChart()}
                    >
                      <p className="text-sm font-semibold text-text-primary">Use my chart</p>
                      <p className="text-sm text-text-secondary mt-1">
                        {user.displayName || 'You'}
                        {primaryChart?.label ? ` · ${primaryChart.label}` : ''}
                      </p>
                    </Card>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-300">
                      No saved chart on your profile — enter birth data below.
                    </p>
                  )}
                  <Card
                    elevation="raised"
                    className={`cursor-pointer transition-colors ${chartAMode === 'manual' ? 'ring-2 ring-accent/40 border-accent/50' : ''}`}
                    onClick={() => setChartAMode('manual')}
                  >
                    <p className="text-sm font-semibold text-text-primary">Enter different birth data</p>
                    <p className="text-sm text-text-secondary mt-1">Date, time, and location for person A</p>
                  </Card>
                  {chartAMode === 'manual' && !slotA ? (
                    <div className="max-w-xl">
                      <BirthDataForm onSubmit={handleChartAManual} />
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Chart B</h2>
              {slotB ? (
                <Card elevation="raised" className="space-y-2">
                  <p className="text-sm font-medium text-text-primary">{slotB.label}</p>
                  <p className="text-xs text-text-secondary">
                    {slotB.kind === 'chart_id' ? `Chart ID: ${slotB.chartId}` : 'Manual birth data'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSlotB(null);
                      setChartBMode(null);
                    }}
                  >
                    Change
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card
                    elevation="raised"
                    className={`cursor-pointer transition-colors ${chartBMode === 'search' ? 'ring-2 ring-accent/40 border-accent/50' : ''}`}
                    onClick={() => setChartBMode('search')}
                  >
                    <p className="text-sm font-semibold text-text-primary">Search connections</p>
                    <p className="text-sm text-text-secondary mt-1">Find a connected user&apos;s chart</p>
                  </Card>
                  <Card
                    elevation="raised"
                    className={`cursor-pointer transition-colors ${chartBMode === 'birth' ? 'ring-2 ring-accent/40 border-accent/50' : ''}`}
                    onClick={() => setChartBMode('birth')}
                  >
                    <p className="text-sm font-semibold text-text-primary">Enter birth data</p>
                    <p className="text-sm text-text-secondary mt-1">For someone not on the platform</p>
                  </Card>
                  {chartBMode === 'search' ? (
                    <div className="sm:col-span-2 space-y-3 max-w-xl">
                      <ChartSearchCombobox
                        value={chartBSearchId}
                        onChange={(v) => {
                          setChartBSearchId(v);
                          setChartBPendingId(null);
                          if (chartBSearchError) setChartBSearchError(null);
                        }}
                        onSelectChartId={(id) => setChartBPendingId(id)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={chartBSearchLoading}
                        disabled={chartBSearchLoading}
                        onClick={() => void handleImportChartB()}
                      >
                        Import chart
                      </Button>
                      {chartBSearchError ? (
                        <p className="text-sm text-red-400" role="alert">
                          {chartBSearchError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {chartBMode === 'birth' ? (
                    <div className="sm:col-span-2 max-w-xl">
                      <BirthDataForm onSubmit={handleChartBManual} />
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
              <Button
                type="button"
                variant="audio"
                size="md"
                className="min-h-[44px] w-full sm:w-auto"
                disabled={!bothSlotsReady || resolveLoading}
                loading={resolveLoading}
                onClick={() => void runResolve()}
              >
                Hear this Relationship
              </Button>
            </div>

            {resolveLoading ? (
              <p className="text-center text-sm text-text-secondary">Reading your connection…</p>
            ) : null}

            {resolveError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3 text-center">
                <p className="text-sm text-red-400" role="alert">
                  {resolveError}
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void runResolve()}>
                  Try again
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {displayReport ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Your connection reading</h2>
              <Button type="button" variant="outline" size="sm" onClick={handleStartOver}>
                Choose different charts
              </Button>
            </div>
            <SandboxReportSections displayReport={displayReport} />
            <SandboxAudioPanel
              displayReport={displayReport}
              exportId={exportId}
              sandboxAudioSrc={sandboxAudioSrc}
              exportUnavailableReason={exportUnavailableReason}
              audioRef={audioRef}
              audioGenerateLoading={audioGenerateLoading}
              audioGenerateError={audioGenerateError}
              onGenerateAudio={() => void handleGenerateAudio()}
            />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ListenPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="max-w-3xl mx-auto p-6">
            <p className="text-text-secondary">Loading…</p>
          </div>
        </AppShell>
      }
    >
      <ListenPageInner />
    </Suspense>
  );
}
