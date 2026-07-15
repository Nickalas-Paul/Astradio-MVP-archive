'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useProfile } from '@/core/social/hooks';
import { hasRealChart } from '@/core/social/constants';
import { getApiBaseUrl } from '@/core/api-base';
import { fetchListenSlotSnapshot } from '@/lib/listen-chart-snapshot';
import { useAudioPlayerStore } from '@/store';
import { SaveToLibraryButton } from '@/components/shared/SaveToLibraryButton';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { MessagePeerButton } from '@/components/community/messages/MessagePeerButton';
import { ConnectionOverflowMenu } from '@/components/community/ConnectionOverflowMenu';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { hasCompatibilityReadingSurface } from '@/lib/compatibility-reading-surface';
import {
  SignalHistorySection,
  type SignalHistoryRow,
  type SignalHistorySummary,
} from '@/components/community/SignalHistorySection';
import { SonicBulletsSection } from '@/components/community/SonicBulletsSection';
import { extractAuraRawSnapshot } from '@/components/wheel/aura-raw-snapshot';

const WheelDisplay = dynamic(
  () => import('@/components/wheel/WheelDisplay').then((m) => ({ default: m.WheelDisplay })),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

type ReadingSection = { id?: string; title?: string; text?: string; bullets?: string[] };

type RelationshipRow = {
  id: string;
  ownerUserId: string;
  chartIdLow: string;
  chartIdHigh: string;
  label?: string;
  comparisonId?: string | null;
};

type ComparisonJson = {
  id?: string;
  relationshipMode?: string;
  compatibilityText?: { short?: string; long?: string; bullets?: string[] } | string;
  /** Present on POST create only; GET stored row is text-first. */
  explanation?: { sections?: ReadingSection[] };
  exportJobId?: string;
  planHash?: string;
  compositionId?: string;
};

type ConnectionAudioUiState = 'idle' | 'generating' | 'ready' | 'error';

const EXPORT_ID_RE = /^[a-f0-9]{64}$/;

function isSonicSection(section: ReadingSection): boolean {
  if (section.id === 'audio_staging') return true;
  if (section.title === 'How this sounds (listen metaphor)') return true;
  const text = typeof section.text === 'string' ? section.text : '';
  return text.includes("For this pair's listen") || text.includes('For this pair\u2019s listen');
}

function splitConnectionReadingSections(explanation: ComparisonJson['explanation']) {
  const sections = Array.isArray(explanation?.sections) ? explanation!.sections! : [];
  const sonic = sections.find(isSonicSection);
  const reading = sections.filter((s) => !isSonicSection(s));
  return {
    readingSections: reading,
    sonicText: typeof sonic?.text === 'string' && sonic.text.trim() ? sonic.text.trim() : null,
  };
}

function peerFromInventory(
  inv: { pairs?: Array<Record<string, unknown>> } | null,
  relationshipId: string
) {
  const p = inv?.pairs?.find((x) => String(x.id) === relationshipId);
  if (!p) return null;
  const peerChartId =
    typeof p.peerChartId === 'string' && p.peerChartId.trim() ? p.peerChartId.trim() : '';
  return {
    displayName: (p.peerDisplayName as string) || '',
    handle: (p.peerHandle as string) || '',
    userId: typeof p.peerUserId === 'string' && p.peerUserId.trim() ? p.peerUserId.trim() : '',
    peerChartId,
    chartIdLow: typeof p.chartIdLow === 'string' ? p.chartIdLow.trim() : '',
    chartIdHigh: typeof p.chartIdHigh === 'string' ? p.chartIdHigh.trim() : '',
  };
}

function viewerChartIdFromPair(peerChartId: string, chartIdLow: string, chartIdHigh: string): string | null {
  if (!chartIdLow || !chartIdHigh || !peerChartId) return null;
  if (peerChartId === chartIdLow) return chartIdHigh;
  if (peerChartId === chartIdHigh) return chartIdLow;
  return null;
}

function renderCompatText(c: ComparisonJson) {
  const raw = c.compatibilityText;
  if (typeof raw === 'string') {
    return { short: raw, long: '', bullets: [] as string[] };
  }
  if (raw && typeof raw === 'object') {
    return {
      short: raw.short || '',
      long: raw.long || '',
      bullets: Array.isArray(raw.bullets) ? raw.bullets : [],
    };
  }
  return { short: '', long: '', bullets: [] as string[] };
}

function relationshipLabelBadge(label: string | undefined): string | null {
  const s = String(label || '').trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function ConnectionReadingMarkdown({ content, className = '' }: { content: string; className?: string }) {
  if (!content.trim()) return null;
  return (
    <div className={`text-sm text-text-primary leading-relaxed ${className}`.trim()}>
      <IdentityMarkdown content={content} />
    </div>
  );
}

export default function CommunityRelationshipArtifactPage() {
  const params = useParams();
  const relationshipId = typeof params?.relationshipId === 'string' ? params.relationshipId : '';
  const { user, primaryChart, loading: profileLoading } = useProfile();
  const playTrack = useAudioPlayerStore((s) => s.playTrack);

  const [relationship, setRelationship] = useState<RelationshipRow | null>(null);
  const [comparison, setComparison] = useState<ComparisonJson | null>(null);
  const [peer, setPeer] = useState<{
    displayName: string;
    handle: string;
    userId: string;
    peerChartId: string;
    chartIdLow: string;
    chartIdHigh: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [materializeError, setMaterializeError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  /** null = idle or checking; true/false after HEAD /api/exports/:id (no full WAV). */
  const [exportReachable, setExportReachable] = useState<boolean | null>(null);
  const [audioUiState, setAudioUiState] = useState<ConnectionAudioUiState>('idle');
  const [audioExportId, setAudioExportId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [signalHistory, setSignalHistory] = useState<{
    summary: SignalHistorySummary;
    signals: SignalHistoryRow[];
  } | null>(null);
  const [viewerWheelSnapshot, setViewerWheelSnapshot] = useState<unknown>(null);
  const [peerWheelSnapshot, setPeerWheelSnapshot] = useState<unknown>(null);
  const [wheelsLoading, setWheelsLoading] = useState(false);
  const [viewerWheelUnavailable, setViewerWheelUnavailable] = useState<string | null>(null);
  const [peerWheelUnavailable, setPeerWheelUnavailable] = useState<string | null>(null);

  const materializeOnceRef = useRef(false);

  const loadPairContext = useCallback(async (relId: string) => {
    const invR = await fetch('/api/community/inventory', { credentials: 'same-origin' });
    if (invR.ok) {
      const inv = (await invR.json()) as { pairs?: Array<Record<string, unknown>> };
      setPeer(peerFromInventory(inv, relId));
    } else {
      setPeer(null);
    }
  }, []);

  useEffect(() => {
    if (!relationshipId) {
      setPhase('error');
      setLoadError('Invalid link');
      return;
    }
    if (profileLoading) {
      return;
    }
    if (!user?.id) {
      setPhase('error');
      setLoadError('Sign in to view this connection.');
      return;
    }

    let cancelled = false;
    (async () => {
      setPhase('loading');
      setLoadError(null);
      setMaterializeError(null);
      setComparison(null);
      setRelationship(null);
      setSignalHistory(null);

      await loadPairContext(relationshipId);
      if (cancelled) return;

      const rr = await fetch(`/api/relationships/${encodeURIComponent(relationshipId)}`, { credentials: 'same-origin' });
      if (cancelled) return;
      if (rr.status === 404) {
        setLoadError('Connection not found');
        setPhase('error');
        return;
      }
      if (!rr.ok) {
        setLoadError(`Could not load connection (${rr.status})`);
        setPhase('error');
        return;
      }
      const rel = (await rr.json()) as RelationshipRow;
      if (cancelled) return;
      setRelationship(rel);

      let comparisonId = rel.comparisonId || null;
      if (!comparisonId && !materializeOnceRef.current) {
        materializeOnceRef.current = true;
        const mr = await fetch(`/api/relationships/${encodeURIComponent(relationshipId)}/materialize`, {
          method: 'POST',
          credentials: 'same-origin',
        });
        const mj = (await mr.json().catch(() => ({}))) as { comparisonId?: string; error?: string };
        if (cancelled) return;
        if (mr.ok && typeof mj.comparisonId === 'string' && mj.comparisonId) {
          comparisonId = mj.comparisonId;
          setRelationship((prev) => (prev ? { ...prev, comparisonId } : prev));
        } else {
          setMaterializeError(typeof mj.error === 'string' ? mj.error : 'Could not create reading for this connection.');
        }
      }

      if (comparisonId) {
        const cr = await fetch(`/api/comparisons/${encodeURIComponent(comparisonId)}`, { credentials: 'same-origin' });
        if (cancelled) return;
        if (cr.ok) {
          setComparison((await cr.json()) as ComparisonJson);
        } else {
          setMaterializeError('Could not load comparison text.');
        }
      } else {
        setComparison(null);
      }

      if (cancelled) return;
      setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [relationshipId, user?.id, profileLoading, loadPairContext]);

  const chartPair = useMemo(() => {
    const low = relationship?.chartIdLow?.trim() || peer?.chartIdLow || '';
    const high = relationship?.chartIdHigh?.trim() || peer?.chartIdHigh || '';
    const peerChartId = peer?.peerChartId || '';
    const viewerFromInv = viewerChartIdFromPair(peerChartId, low, high);
    const viewerFromProfile =
      hasRealChart(primaryChart) && [low, high].includes(primaryChart.id) ? primaryChart.id : null;
    const viewerChartId = viewerFromProfile || viewerFromInv;
    if (!viewerChartId || !low || !high) return null;
    const peerChartIdResolved = viewerChartId === low ? high : low;
    return { viewerChartId, peerChartId: peerChartIdResolved };
  }, [relationship, peer, primaryChart]);

  const viewerWheelLabel = user?.displayName?.trim() || primaryChart?.label?.trim() || 'You';
  const peerWheelLabel = peer?.displayName?.trim() || 'Connection';

  useEffect(() => {
    if (!chartPair || phase !== 'ready') {
      setViewerWheelSnapshot(null);
      setPeerWheelSnapshot(null);
      setViewerWheelUnavailable(null);
      setPeerWheelUnavailable(null);
      setWheelsLoading(false);
      return;
    }

    let cancelled = false;
    setWheelsLoading(true);
    setViewerWheelSnapshot(null);
    setPeerWheelSnapshot(null);
    setViewerWheelUnavailable(null);
    setPeerWheelUnavailable(null);

    const base = getApiBaseUrl() || '';

    void (async () => {
      const [viewerResult, peerResult] = await Promise.all([
        fetchListenSlotSnapshot(base, {
          kind: 'chart_id',
          chartId: chartPair.viewerChartId,
          label: viewerWheelLabel,
        }),
        fetchListenSlotSnapshot(base, {
          kind: 'chart_id',
          chartId: chartPair.peerChartId,
          label: peerWheelLabel,
        }),
      ]);

      if (cancelled) return;

      if (viewerResult.status === 'ok') setViewerWheelSnapshot(viewerResult.snapshot);
      else setViewerWheelUnavailable(viewerResult.message);

      if (peerResult.status === 'ok') setPeerWheelSnapshot(peerResult.snapshot);
      else setPeerWheelUnavailable(peerResult.message);

      setWheelsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [chartPair, phase, viewerWheelLabel, peerWheelLabel]);

  useEffect(() => {
    if (!user?.id || !peer?.userId) {
      setSignalHistory(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/community/signals/history?peerUserId=${encodeURIComponent(peer.userId)}`,
          { credentials: 'same-origin', cache: 'no-store' }
        );
        if (cancelled) return;
        if (!r.ok) {
          setSignalHistory(null);
          return;
        }
        const data = (await r.json()) as {
          summary?: SignalHistorySummary;
          signals?: SignalHistoryRow[];
        };
        if (cancelled) return;
        const total = data.summary?.total ?? 0;
        if (total > 0 && data.summary) {
          setSignalHistory({
            summary: data.summary,
            signals: Array.isArray(data.signals) ? data.signals : [],
          });
        } else {
          setSignalHistory(null);
        }
      } catch {
        if (!cancelled) setSignalHistory(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, peer?.userId]);

  const exId =
    audioExportId ||
    (comparison && typeof comparison.exportJobId === 'string' && comparison.exportJobId.trim()
      ? comparison.exportJobId.trim()
      : null);

  useEffect(() => {
    if (!exId || !EXPORT_ID_RE.test(exId)) {
      setExportReachable(null);
      if (!exId) {
        setAudioUiState('idle');
      }
      return;
    }
    let cancelled = false;
    setExportReachable(null);
    const base = getApiBaseUrl() || '';
    (async () => {
      try {
        const r = await fetch(`${base}/api/exports/${encodeURIComponent(exId)}`, {
          method: 'HEAD',
          credentials: 'same-origin',
        });
        if (cancelled) return;
        const reachable = r.status === 204 || r.status === 200;
        setExportReachable(reachable);
        if (reachable) {
          setAudioUiState('ready');
          setAudioExportId(exId);
        }
      } catch {
        if (!cancelled) {
          setExportReachable(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exId]);

  const handleGenerateConnectionAudio = useCallback(async () => {
    if (!relationshipId) return;
    setAudioUiState('generating');
    setAudioError(null);
    try {
      const r = await fetch(`/api/relationships/${encodeURIComponent(relationshipId)}/audio`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await r.json().catch(() => ({}))) as {
        exportId?: string;
        status?: string;
        error?: string;
        message?: string;
      };
      const exportId = typeof data.exportId === 'string' ? data.exportId.trim() : '';
      if (!r.ok || !EXPORT_ID_RE.test(exportId)) {
        setAudioUiState('error');
        setAudioError(
          typeof data.error === 'string'
            ? data.error
            : typeof data.message === 'string'
              ? data.message
              : 'Could not compose connection audio.'
        );
        return;
      }
      setAudioExportId(exportId);
      setComparison((prev) => (prev ? { ...prev, exportJobId: exportId } : prev));
      setAudioUiState('ready');
      setExportReachable(null);
    } catch {
      setAudioUiState('error');
      setAudioError('Could not compose connection audio.');
    }
  }, [relationshipId]);

  const { short, long, bullets } = comparison ? renderCompatText(comparison) : { short: '', long: '', bullets: [] as string[] };
  const musicalBullets = bullets.filter((b) => String(b).trim().length > 0);
  const { readingSections, sonicText } = useMemo(
    () => splitConnectionReadingSections(comparison?.explanation),
    [comparison?.explanation]
  );
  const hasReadingSurface = comparison
    ? hasCompatibilityReadingSurface(comparison.explanation ?? null, comparison.compatibilityText)
    : false;
  const showConnectionAudio =
    phase === 'ready' && !!comparison && hasReadingSurface && !!relationship?.comparisonId;
  const audioReady = !!(exId && EXPORT_ID_RE.test(exId) && exportReachable === true);
  const audioPlayerExportId = audioReady ? exId : null;
  const labelBadge = relationshipLabelBadge(relationship?.label);

  /** Cap wheel SVG size at ~34% viewport height (desktop base 300px, mobile 200px). */
  const [wheelMaxSize, setWheelMaxSize] = useState(200);
  useEffect(() => {
    const update = () => {
      const vhCap = Math.floor(window.innerHeight * 0.34);
      const base = window.innerWidth >= 1024 ? 300 : 200;
      setWheelMaxSize(Math.min(base, vhCap));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const viewerRawSnapshot = useMemo(
    () => (viewerWheelSnapshot ? extractAuraRawSnapshot(viewerWheelSnapshot) : null),
    [viewerWheelSnapshot],
  );
  const peerRawSnapshot = useMemo(
    () => (peerWheelSnapshot ? extractAuraRawSnapshot(peerWheelSnapshot) : null),
    [peerWheelSnapshot],
  );

  const renderDualWheels = (maxSize: number, className = '') => (
    <div className={className}>
      {wheelsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" />
          <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-caption text-text-secondary mb-2">{viewerWheelLabel}</p>
            <WheelDisplay
              chartData={viewerWheelSnapshot}
              isLoading={false}
              maxSize={maxSize}
              className="w-full"
              emptyMessage={viewerWheelUnavailable ?? undefined}
              rawSnapshot={viewerRawSnapshot ?? undefined}
            />
          </div>
          <div>
            <p className="text-caption text-text-secondary mb-2">{peerWheelLabel}</p>
            <WheelDisplay
              chartData={peerWheelSnapshot}
              isLoading={false}
              maxSize={maxSize}
              className="w-full"
              emptyMessage={peerWheelUnavailable ?? undefined}
              rawSnapshot={peerRawSnapshot ?? undefined}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        <Link href="/community" className="text-text-secondary hover:text-text-primary text-sm">
          ← Back to Community
        </Link>

        {loadError && !relationship && phase === 'error' && (
          <div>
            <p className="text-red-500">{loadError}</p>
            {loadError.includes('Sign in') ? null : (
              <Link href="/community" className="text-accent hover:underline text-sm">
                Return to Community
              </Link>
            )}
          </div>
        )}

        {phase === 'ready' && relationship && (
          <>
            <header className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h1 className="text-h2 font-bold text-text-primary">
                    {peer?.displayName || 'Connection'}
                    {peer?.handle ? (
                      <span className="text-text-secondary font-normal text-lg"> @{peer.handle}</span>
                    ) : null}
                  </h1>
                  {labelBadge ? (
                    <span className="text-[10px] uppercase tracking-wide text-text-secondary/80 font-normal px-1.5 py-0.5 rounded-full border border-border/60">
                      {labelBadge}
                    </span>
                  ) : null}
                  {peer?.userId ? <MessagePeerButton peerUserId={peer.userId} /> : null}
                </div>
                {peer?.userId && relationship?.id ? (
                  <ConnectionOverflowMenu
                    relationshipId={relationship.id}
                    peerDisplayName={peer.displayName || 'Connection'}
                    peerUserId={peer.userId}
                  />
                ) : null}
              </div>
            </header>

            {materializeError && <p className="text-amber-600 dark:text-amber-300 text-sm">{materializeError}</p>}

            {chartPair ? (
              <div className="sticky top-20 z-30 -mx-6 px-6 py-4 mb-2 bg-bg border-b border-border/60 shadow-sm">
                {renderDualWheels(wheelMaxSize)}
              </div>
            ) : null}

            <div className="min-w-0 space-y-8">
                {comparison && hasReadingSurface && (
                  <Card as="section" elevation="resting" size="sm" className="space-y-4">
                    <h2 className="text-lg font-medium text-text-primary">Reading</h2>
                    {readingSections.length > 0 ? (
                      <div className="space-y-4">
                        {readingSections.map((s, i) => (
                          <div key={i}>
                            {s.title ? (
                              <h3 className="text-sm font-medium text-text-primary mb-2">{s.title}</h3>
                            ) : null}
                            {s.text ? <ConnectionReadingMarkdown content={s.text} /> : null}
                            {Array.isArray(s.bullets) && s.bullets.length > 0 ? (
                              <div className="space-y-3 mt-2">
                                {s.bullets.map((b, j) => (
                                  <ConnectionReadingMarkdown key={j} content={String(b)} />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {short ? <ConnectionReadingMarkdown content={short} /> : null}
                        {long ? (
                          <ConnectionReadingMarkdown content={long} className="border-t border-border/60 pt-3" />
                        ) : null}
                      </div>
                    )}
                    <SonicBulletsSection bullets={musicalBullets} />
                  </Card>
                )}

                {signalHistory && user?.id && peer?.userId ? (
                  <SignalHistorySection
                    peerDisplayName={peer.displayName || 'Connection'}
                    viewerUserId={user.id}
                    summary={signalHistory.summary}
                    signals={signalHistory.signals}
                  />
                ) : null}

                {showConnectionAudio && (
                  <Card as="section" elevation="resting" size="sm" className="space-y-4">
                    <h2 className="reading-section-header">Hear this connection</h2>
                    {sonicText ? (
                      <div className="text-body-sm text-text-secondary leading-relaxed">
                        <IdentityMarkdown content={sonicText} />
                      </div>
                    ) : null}

                    {audioPlayerExportId ? (
                      <div className="space-y-3">
                        <p className="text-body-sm text-text-secondary">Your connection soundtrack is ready.</p>
                        <Button
                          type="button"
                          variant="audio"
                          size="sm"
                          onClick={() =>
                            playTrack({
                              exportId: audioPlayerExportId,
                              label: peerWheelLabel,
                              source: 'connection',
                            })
                          }
                        >
                          Hear This Connection
                        </Button>
                        {relationship && relationship.comparisonId ? (
                          <SaveToLibraryButton
                            exportId={audioPlayerExportId}
                            source="community_relationship"
                            compositionType="A+B"
                            objectIdentityHash={relationship.comparisonId}
                            sandboxState={{
                              kind: 'community_relationship',
                              relationshipId: relationship.id,
                              comparisonId: relationship.comparisonId,
                              chartIdLow: relationship.chartIdLow,
                              chartIdHigh: relationship.chartIdHigh,
                            }}
                            label="Connection reading"
                          />
                        ) : null}
                      </div>
                    ) : audioUiState === 'generating' ? (
                      <Button type="button" variant="audio" size="sm" loading disabled>
                        Composing audio…
                      </Button>
                    ) : audioUiState === 'error' ? (
                      <div className="space-y-2">
                        <p className="text-body-sm text-amber-600 dark:text-amber-300" role="alert">
                          {audioError || 'Connection audio unavailable. Try again.'}
                        </p>
                        <Button type="button" variant="audio" size="sm" onClick={() => void handleGenerateConnectionAudio()}>
                          Try again
                        </Button>
                      </div>
                    ) : exId && exportReachable === false ? (
                      <div className="space-y-2">
                        <p className="text-body-sm text-amber-600 dark:text-amber-300">
                          Sound record not in storage. Compose a new soundtrack.
                        </p>
                        <Button type="button" variant="audio" size="sm" onClick={() => void handleGenerateConnectionAudio()}>
                          Hear this connection
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="audio" size="sm" onClick={() => void handleGenerateConnectionAudio()}>
                        Hear this connection
                      </Button>
                    )}
                  </Card>
                )}

                {comparison && !hasReadingSurface && !materializeError && (
                  <p className="text-sm text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2">
                    Stored reading text is missing or incomplete for this connection. Use “materialize” from the server or open
                    a new compatibility reading from Community.
                  </p>
                )}
            </div>
          </>
        )}

        {(phase === 'loading' || profileLoading) && user?.id && (
          <p className="text-text-secondary">Loading…</p>
        )}
      </div>
    </AppShell>
  );
}
