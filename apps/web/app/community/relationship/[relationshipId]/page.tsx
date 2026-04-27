'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { useProfile } from '@/core/social/hooks';
import { getApiBaseUrl } from '@/core/api-base';
import { ValidatedExportAudioPlayer } from '@/components/community/ValidatedExportAudioPlayer';
import { hasCompatibilityReadingSurface } from '@/lib/compatibility-reading-surface';

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
  explanation?: { sections?: Array<{ title?: string; text?: string; bullets?: string[] }> };
  exportJobId?: string;
  planHash?: string;
  compositionId?: string;
};

function peerFromInventory(
  inv: { pairs?: Array<Record<string, unknown>> } | null,
  relationshipId: string
) {
  const p = inv?.pairs?.find((x) => String(x.id) === relationshipId);
  if (!p) return null;
  return {
    displayName: (p.peerDisplayName as string) || '',
    handle: (p.peerHandle as string) || '',
  };
}

function artifactStatusLine(
  comparison: ComparisonJson | null,
  exportId: string | null,
  exportVerifiedReachable: boolean | null
) {
  if (!comparison) return 'Reading not generated';
  if (exportId && exportVerifiedReachable === true) return 'Reading available · sound record on file';
  return 'Reading available';
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

export default function CommunityRelationshipArtifactPage() {
  const params = useParams();
  const relationshipId = typeof params?.relationshipId === 'string' ? params.relationshipId : '';
  const { user, loading: profileLoading } = useProfile();

  const [relationship, setRelationship] = useState<RelationshipRow | null>(null);
  const [comparison, setComparison] = useState<ComparisonJson | null>(null);
  const [peer, setPeer] = useState<{ displayName: string; handle: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [materializeError, setMaterializeError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  /** null = idle or checking; true/false after HEAD /api/exports/:id (no full WAV). */
  const [exportReachable, setExportReachable] = useState<boolean | null>(null);

  const materializeOnceRef = useRef(false);

  const loadPairContext = useCallback(
    async (relId: string) => {
      const invR = await fetch('/api/community/inventory', { credentials: 'same-origin' });
      if (invR.ok) {
        const inv = (await invR.json()) as { pairs?: Array<Record<string, unknown>> };
        setPeer(peerFromInventory(inv, relId));
      } else {
        setPeer(null);
      }
    },
    []
  );

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

  const exId =
    comparison && typeof comparison.exportJobId === 'string' && comparison.exportJobId.trim()
      ? comparison.exportJobId.trim()
      : null;

  useEffect(() => {
    if (!exId || !/^[a-f0-9]{64}$/.test(exId)) {
      setExportReachable(null);
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
        setExportReachable(r.status === 204 || r.status === 200);
      } catch {
        if (!cancelled) setExportReachable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exId]);

  const { short, long, bullets } = comparison ? renderCompatText(comparison) : { short: '', long: '', bullets: [] as string[] };
  const hasReadingSurface = comparison
    ? hasCompatibilityReadingSurface(comparison.explanation ?? null, comparison.compatibilityText)
    : false;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link href="/community" className="text-subtext hover:text-text text-sm">
          ← Back to Community
        </Link>

        {loadError && !relationship && phase === 'error' && (
          <div>
            <p className="text-red-500">{loadError}</p>
            {loadError.includes('Sign in') ? null : (
              <Link href="/community" className="text-emerald-500 hover:underline text-sm">
                Return to Community
              </Link>
            )}
          </div>
        )}

        {phase === 'ready' && relationship && (
          <>
            <header className="space-y-1">
              <h1 className="text-2xl font-bold text-text">
                {peer?.displayName || 'Connection'}
                {peer?.handle ? <span className="text-subtext font-normal text-lg"> @{peer.handle}</span> : null}
              </h1>
              <p className="text-sm text-subtext">Label: {String(relationship.label || '')}</p>
              {comparison?.relationshipMode ? (
                <p className="text-sm text-text">Mode: {String(comparison.relationshipMode)}</p>
              ) : null}
              <p className="text-sm text-subtext">
                Artifact: {artifactStatusLine(comparison, exId, exportReachable)}
              </p>
              {exId && exportReachable === false ? (
                <p className="text-sm text-amber-600 dark:text-amber-300">
                  Sound record not in storage (export pointer exists but the file was not found).
                </p>
              ) : null}
            </header>

            {materializeError && <p className="text-amber-600 dark:text-amber-300 text-sm">{materializeError}</p>}

            {comparison && hasReadingSurface && (
              <section className="rounded-lg border border-border bg-surface-1 p-4 space-y-4">
                <h2 className="text-lg font-medium text-text">Reading</h2>
                {Array.isArray(comparison.explanation?.sections) && comparison.explanation!.sections!.length > 0 ? (
                  <div className="space-y-4">
                    {comparison.explanation!.sections!.map((s, i) => (
                      <div key={i}>
                        {s.title ? <h3 className="text-sm font-medium text-text mb-1">{s.title}</h3> : null}
                        {s.text ? <p className="text-sm text-text whitespace-pre-wrap">{s.text}</p> : null}
                        {Array.isArray(s.bullets) && s.bullets.length > 0 ? (
                          <ul className="list-disc pl-5 text-sm text-text space-y-1">
                            {s.bullets.map((b, j) => (
                              <li key={j}>{b}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {short ? <p className="text-sm text-text whitespace-pre-wrap">{short}</p> : null}
                    {long ? (
                      <p className="text-sm text-text whitespace-pre-wrap border-t border-border/60 pt-3 mt-2">{long}</p>
                    ) : null}
                    {bullets.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm text-text space-y-1">
                        {bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </section>
            )}

            {comparison && !hasReadingSurface && !materializeError && (
              <p className="text-sm text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2">
                Stored reading text is missing or incomplete for this connection. Use “materialize” from the server or open
                a new compatibility reading from Community.
              </p>
            )}

            {exId && exportReachable === true && (
              <section className="space-y-2">
                <h2 className="text-lg font-medium text-text">Sound</h2>
                <ValidatedExportAudioPlayer exportId={exId} />
              </section>
            )}

            {comparison?.planHash && String(comparison.planHash).length > 0 && !String(comparison.planHash).includes('__') ? (
              <p className="text-xs text-subtext">Composition: {String(comparison.compositionId || comparison.planHash).slice(0, 16)}…</p>
            ) : null}
          </>
        )}

        {(phase === 'loading' || profileLoading) && user?.id && (
          <p className="text-subtext">Loading…</p>
        )}
      </div>
    </AppShell>
  );
}
