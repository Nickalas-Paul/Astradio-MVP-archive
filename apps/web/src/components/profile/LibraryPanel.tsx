'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import Link from 'next/link';
import { ExplainerSections } from './shared/ExplainerSections';
import { blobUrlFromComposePayload } from './shared/profile-audio-utils';
import {
  explanationFromCompatibilityText,
  librarySourceLabel,
  parseSandboxState,
} from './shared/profile-library-utils';
import { mapExplanationToSections } from './shared/profile-reading-utils';
import { normalizeLocalTime, sandboxStateCompleteForTransit } from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { hasCompatibilityReadingSurface, type ExplanationLike } from '../../lib/compatibility-reading-surface';
import { IdentityMarkdown } from '../shared/IdentityMarkdown';
import { Card } from '../shared/Card';
import { Button } from '@/components/shared/Button';
import { EXPANDED_READING_RENDER_ORDER, EXPANDED_SLOT_LABELS } from '../../lib/community-feed-reading-layout';
import { finalizeRelationalReadingSurfaces, type ExpandedSlotId } from '../../lib/relational-reading-enforcement';

export type LibraryPanelHandle = {
  refresh: () => Promise<void>;
};

export interface LibraryPanelProps {
  chartId: string | null;
  /** When true, load list (matches prior tab-gated fetch). Panel stays mounted for imperative refresh. */
  shouldLoad?: boolean;
}

export const LibraryPanel = forwardRef<LibraryPanelHandle, LibraryPanelProps>(function LibraryPanel(
  { shouldLoad = true },
  ref,
) {
  const [libraryRows, setLibraryRows] = useState<Array<Record<string, unknown>>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryOpenId, setLibraryOpenId] = useState<string | null>(null);
  const [libraryDetailLoading, setLibraryDetailLoading] = useState(false);
  const [libraryDetailRow, setLibraryDetailRow] = useState<Record<string, unknown> | null>(null);
  const [libraryReconstructLoading, setLibraryReconstructLoading] = useState(false);
  const [libraryReconstructResult, setLibraryReconstructResult] = useState<Record<string, unknown> | null>(null);
  const [libraryReconstructError, setLibraryReconstructError] = useState<string | null>(null);
  const [libraryDetailAudioUrl, setLibraryDetailAudioUrl] = useState<string | null>(null);
  const [libraryAudioMissingFromStore, setLibraryAudioMissingFromStore] = useState<boolean | null>(null);
  const [libraryRelationalWeatherTextMissing, setLibraryRelationalWeatherTextMissing] = useState(false);
  const [libraryHistoricalArtifact, setLibraryHistoricalArtifact] = useState(false);
  const [libraryCommunityReadingArtifact, setLibraryCommunityReadingArtifact] = useState<Record<string, unknown> | null>(
    null,
  );

  const refreshLibrary = useCallback(async () => {
    const base = getApiBaseUrl();
    setLibraryLoading(true);
    try {
      const r = await fetch(`${base || ''}/api/sandbox/compositions?limit=50`, {
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => []);
      setLibraryRows(Array.isArray(j) ? j : []);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const openLibraryRow = async (id: string) => {
    setLibraryOpenId(id);
    setLibraryDetailRow(null);
    setLibraryReconstructResult(null);
    setLibraryReconstructError(null);
    setLibraryAudioMissingFromStore(null);
    setLibraryRelationalWeatherTextMissing(false);
    setLibraryHistoricalArtifact(false);
    setLibraryCommunityReadingArtifact(null);
    if (libraryDetailAudioUrl) {
      URL.revokeObjectURL(libraryDetailAudioUrl);
      setLibraryDetailAudioUrl(null);
    }
    setLibraryDetailLoading(true);
    setLibraryReconstructLoading(false);
    const base = getApiBaseUrl();
    try {
      const r = await fetch(`${base || ''}/api/sandbox/compositions/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });
      const row = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setLibraryReconstructError(
          typeof row.error === 'string' ? row.error : `Failed to load composition (${r.status})`,
        );
        return;
      }
      setLibraryDetailRow(row);
      const source = row.source;
      const ps = parseSandboxState(row.sandbox_state);
      if (source === 'profile_identity' || ps?.kind === 'profile_identity') {
        setLibraryDetailLoading(false);
        return;
      }
      if (source === 'community_relationship' || ps?.kind === 'community_relationship') {
        const cmpId =
          (typeof ps?.comparisonId === 'string' && ps.comparisonId.trim()) ||
          (typeof row.object_identity_hash === 'string' && row.object_identity_hash.trim()) ||
          '';
        if (!cmpId) {
          setLibraryReconstructError('Missing comparison reference for this relationship artifact.');
          return;
        }
        setLibraryReconstructLoading(true);
        const cmpRes = await fetch(`${base || ''}/api/comparisons/${encodeURIComponent(cmpId)}`, {
          credentials: 'same-origin',
        });
        const cmp = (await cmpRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!cmpRes.ok) {
          setLibraryReconstructError(
            typeof cmp.error === 'string' ? cmp.error : `Failed to load comparison (${cmpRes.status})`,
          );
          return;
        }
        setLibraryReconstructResult({
          explanation: explanationFromCompatibilityText(cmp.compatibilityText),
        });
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
          if (url) setLibraryDetailAudioUrl(url);
        }
        return;
      }
      if (source === 'community_group' || ps?.kind === 'community_group') {
        const groupId = typeof ps?.groupId === 'string' ? ps.groupId : '';
        if (!groupId) {
          setLibraryReconstructError('Missing group reference for this group relationship artifact.');
          return;
        }
        setLibraryReconstructLoading(true);
        const gr = await fetch(
          `${base || ''}/api/community/relational-group/${encodeURIComponent(groupId)}/stored-artifact`,
          { credentials: 'same-origin' },
        );
        const gj = (await gr.json().catch(() => ({}))) as Record<string, unknown>;
        if (!gr.ok) {
          setLibraryReconstructError(
            typeof gj.error === 'string' ? gj.error : `Failed to load group artifact (${gr.status})`,
          );
          return;
        }
        const readingText =
          typeof (gj.readingSnapshot as { text?: unknown } | null)?.text === 'string'
            ? ((gj.readingSnapshot as { text?: string }).text ?? '')
            : '';
        setLibraryReconstructResult({
          explanation: {
            sections: [{ sectionId: 'community', title: 'Group relationship artifact', text: readingText }],
          },
        });
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
          if (url) setLibraryDetailAudioUrl(url);
        }
        return;
      }
      if (source === 'community_relational_weather' || ps?.kind === 'community_relational_weather') {
        const report = row.report as
          | { text?: unknown; weather?: unknown; freshness?: { historicalReason?: unknown; isHistorical?: unknown } }
          | undefined;
        const reportExpressionVersion =
          report &&
          report.freshness &&
          typeof (report.freshness as { expressionVersion?: unknown }).expressionVersion === 'string'
            ? String((report.freshness as { expressionVersion?: unknown }).expressionVersion).trim()
            : '';
        const sandboxExpressionVersion =
          ps && typeof ps.expressionVersion === 'string' ? ps.expressionVersion.trim() : '';
        const versionMissing = !reportExpressionVersion && !sandboxExpressionVersion;
        const freshnessHistorical =
          report?.freshness?.isHistorical === true ||
          (typeof report?.freshness?.historicalReason === 'string' && report.freshness.historicalReason.trim().length > 0) ||
          (typeof ps?.historicalReason === 'string' && ps.historicalReason.trim().length > 0) ||
          versionMissing;
        setLibraryHistoricalArtifact(freshnessHistorical);
        const textValue = report?.text;
        const textMissing = textValue == null;
        setLibraryRelationalWeatherTextMissing(textMissing);
        if (textMissing) {
          setLibraryCommunityReadingArtifact(null);
          setLibraryReconstructResult(null);
          setLibraryDetailLoading(false);
          const eid = row.export_id;
          if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
            try {
              const headRes = await fetch(`${base || ''}/api/exports/${encodeURIComponent(eid)}`, {
                method: 'HEAD',
                credentials: 'same-origin',
              });
              if (headRes.status !== 204 && headRes.status !== 200) {
                setLibraryAudioMissingFromStore(true);
              } else {
                const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
                if (url) {
                  setLibraryDetailAudioUrl(url);
                  setLibraryAudioMissingFromStore(false);
                } else {
                  setLibraryAudioMissingFromStore(true);
                }
              }
            } catch {
              setLibraryAudioMissingFromStore(true);
            }
          } else {
            setLibraryAudioMissingFromStore(null);
          }
          return;
        }
        const artifactPayload: Record<string, unknown> = {
          weather: report?.weather ?? undefined,
        };
        if (typeof textValue === 'object' && textValue !== null && !Array.isArray(textValue)) {
          artifactPayload.text = textValue as Record<string, unknown>;
        } else if (typeof textValue === 'string') {
          artifactPayload.text = { short: textValue };
        } else {
          artifactPayload.text = { short: '' };
        }
        setLibraryCommunityReadingArtifact(artifactPayload);
        setLibraryReconstructResult({ explanation: null });
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          try {
            const headRes = await fetch(`${base || ''}/api/exports/${encodeURIComponent(eid)}`, {
              method: 'HEAD',
              credentials: 'same-origin',
            });
            if (headRes.status !== 204 && headRes.status !== 200) {
              setLibraryAudioMissingFromStore(true);
            } else {
              const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
              if (url) {
                setLibraryDetailAudioUrl(url);
                setLibraryAudioMissingFromStore(false);
              } else {
                setLibraryAudioMissingFromStore(true);
              }
            }
          } catch {
            setLibraryAudioMissingFromStore(true);
          }
        } else {
          setLibraryAudioMissingFromStore(null);
        }
        return;
      }
      if (source === 'profile_active' || ps?.kind === 'profile_active') {
        if (!ps || !sandboxStateCompleteForTransit(ps)) {
          setLibraryReconstructError(
            'This bookmark was saved before transit details were stored. Generate a new report from Today and save again.',
          );
          return;
        }
        setLibraryReconstructLoading(true);
        const st = ps;
        const r2 = await fetch(`${base || ''}/api/profile/active-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            chartId: st.chartId,
            calendarDate: st.calendarDate,
            localTime: normalizeLocalTime(st.localTime),
            location: st.location,
            generateAudio: false,
          }),
        });
        const j = (await r2.json().catch(() => ({}))) as Record<string, unknown>;
        if (!r2.ok) {
          setLibraryReconstructError(
            typeof j.error === 'string' ? j.error : `Reconstruction failed (${r2.status})`,
          );
          return;
        }
        setLibraryReconstructResult(j);
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
          if (url) setLibraryDetailAudioUrl(url);
        }
      }
    } catch (e) {
      setLibraryReconstructError(e instanceof Error ? e.message : 'Failed to open');
    } finally {
      setLibraryDetailLoading(false);
      setLibraryReconstructLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({ refresh: refreshLibrary }), [refreshLibrary]);

  useEffect(() => {
    if (!shouldLoad) return;
    void refreshLibrary();
  }, [shouldLoad, refreshLibrary]);

  return (
<div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Saved profile and community artifacts (text first; audio when export is available). Older engine versions are shown as historical snapshots.
            </p>
            {libraryLoading ? (
              <p className="text-sm text-text-secondary">Loading…</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {libraryRows.map((row) => (
                    <Card
                      as="li"
                      key={String(row.id)}
                      elevation="raised"
                      interactive
                      className="text-sm flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 justify-between min-w-0"
                    >
                      <span>
                        <span className="text-text-secondary">{String(row.created_at)}</span>
                        {' · '}
                        <span>{librarySourceLabel(row.source)}</span>
                        {' · '}
                        <span>{String(row.composition_type ?? '—')}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-accent w-full sm:w-auto min-h-[44px] shrink-0"
                        onClick={() => void openLibraryRow(String(row.id))}
                      >
                        View
                      </Button>
                    </Card>
                  ))}
                  {libraryRows.length === 0 && (
                    <li>
                      <Card size="lg" className="text-center space-y-4 max-w-md mx-auto">
                        <p className="text-body text-text-secondary">Your library is empty.</p>
                        <p className="text-body-sm text-text-muted">
                          Generate your daily transit on Today, then use &quot;Save to Library&quot; to keep readings
                          and soundtracks here.
                        </p>
                        <Link href="/today">
                          <Button type="button" variant="outline" size="sm">
                            Go to Today
                          </Button>
                        </Link>
                      </Card>
                    </li>
                  )}
                </ul>
                {libraryOpenId && (
                  <Card elevation="raised" className="!rounded space-y-3 mt-4">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-text-primary">
                        {libraryDetailRow ? librarySourceLabel(libraryDetailRow.source) : 'Saved artifact'}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-text-secondary hover:text-text-primary px-2 py-1"
                        onClick={() => {
                          setLibraryOpenId(null);
                          setLibraryDetailRow(null);
                          setLibraryReconstructResult(null);
                          setLibraryReconstructError(null);
                          setLibraryAudioMissingFromStore(null);
                          setLibraryRelationalWeatherTextMissing(false);
                          setLibraryHistoricalArtifact(false);
                          setLibraryCommunityReadingArtifact(null);
                          if (libraryDetailAudioUrl) {
                            URL.revokeObjectURL(libraryDetailAudioUrl);
                            setLibraryDetailAudioUrl(null);
                          }
                        }}
                      >
                        Close
                      </Button>
                    </div>
                    {libraryDetailLoading && <p className="text-sm text-text-secondary">Loading…</p>}
                    {libraryHistoricalArtifact && (
                      <div className="text-sm text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-lg px-3 py-2 space-y-2">
                        <p>Historical saved artifact.</p>
                        <p>Generated with an earlier expression version.</p>
                        <a
                          href="/today"
                          className="inline-block px-3 py-1 rounded border border-amber-500/50 text-xs hover:bg-amber-500/10"
                        >
                          Generate current version
                        </a>
                      </div>
                    )}
                    {libraryReconstructError && (
                      <p className="text-sm text-red-500">{libraryReconstructError}</p>
                    )}
                    {libraryDetailRow != null &&
                      (libraryDetailRow.source === 'profile_identity' ||
                        parseSandboxState(libraryDetailRow.sandbox_state)?.kind === 'profile_identity') ? (
                        <p className="text-sm text-text-secondary">
                          Identity comes from your birth chart. Open the Identity tab to view it.
                        </p>
                      ) : null}
                    {libraryReconstructLoading && (
                      <p className="text-sm text-text-secondary">Loading report…</p>
                    )}
                    {libraryCommunityReadingArtifact &&
                    (libraryDetailRow?.source === 'community_relational_weather' ||
                      parseSandboxState(libraryDetailRow?.sandbox_state)?.kind === 'community_relational_weather') ? (
                      <div className="space-y-4">
                        {(() => {
                          const art = libraryCommunityReadingArtifact;
                          const w =
                            art.weather && typeof art.weather === 'object' ? (art.weather as Record<string, unknown>) : undefined;
                          const finalized = finalizeRelationalReadingSurfaces({
                            kind: 'expanded_artifact',
                            artifact: art,
                            weather: w,
                          });
                          const slots =
                            finalized.kind === 'expanded_artifact'
                              ? finalized.slots
                              : ({
                                  summary: '',
                                  support: '',
                                  tension: '',
                                  activation: '',
                                  whatToDo: '',
                                  audio: '',
                                } as Record<ExpandedSlotId, string>);
                          return (
                            <div className="space-y-4">
                              {EXPANDED_READING_RENDER_ORDER.map((slot: ExpandedSlotId) => {
                                const body = slots[slot];
                                if (!body?.trim()) return null;
                                return (
                                  <section key={slot} className="space-y-1">
                                    <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                                      {EXPANDED_SLOT_LABELS[slot]}
                                    </h4>
                                    <IdentityMarkdown content={body} />
                                  </section>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                    {libraryReconstructResult != null &&
                      libraryReconstructResult.explanation != null &&
                      !libraryCommunityReadingArtifact &&
                      hasCompatibilityReadingSurface(
                        libraryReconstructResult.explanation as ExplanationLike,
                        undefined,
                      ) && (
                        <ExplainerSections
                          sections={mapExplanationToSections(libraryReconstructResult.explanation)}
                        />
                      )}
                    {libraryReconstructResult != null &&
                      libraryReconstructResult.explanation != null &&
                      !libraryCommunityReadingArtifact &&
                      !hasCompatibilityReadingSurface(
                        libraryReconstructResult.explanation as ExplanationLike,
                        undefined,
                      ) &&
                      !libraryReconstructError && (
                        <p className="text-sm text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2">
                          Stored reading text for this artifact is missing or empty. Generate a new compatibility reading or
                          contact support.
                        </p>
                      )}
                    {libraryDetailRow &&
                      (libraryDetailRow.source === 'community_relational_weather' ||
                        parseSandboxState(libraryDetailRow.sandbox_state)?.kind === 'community_relational_weather') &&
                      libraryRelationalWeatherTextMissing && (
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                          Reading text was not stored for this bookmark. Re-save from Today, or
                          ask an operator to run a library repair.
                        </p>
                      )}
                    {libraryDetailRow &&
                      (libraryDetailRow.source === 'community_relational_weather' ||
                        parseSandboxState(libraryDetailRow.sandbox_state)?.kind === 'community_relational_weather') &&
                      libraryAudioMissingFromStore === true && (
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                          Audio record missing from storage (export pointer exists but file was not found).
                        </p>
                      )}
                    {libraryDetailAudioUrl && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-text-secondary">Listen to this reading</p>
                        <audio controls src={libraryDetailAudioUrl} className="w-full max-w-md" preload="metadata" />
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
  );
});
