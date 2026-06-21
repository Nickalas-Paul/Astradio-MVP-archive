'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  explanationFromCompatibilityText,
  libraryRowSummary,
  librarySourceLabel,
  parseSandboxState,
} from './shared/profile-library-utils';
import { normalizeLocalTime, sandboxStateCompleteForTransit } from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { Card } from '../shared/Card';
import { Button } from '@/components/shared/Button';
import { useAudioPlayerStore, type AudioSource } from '@/store';
import { groupLibraryRows } from '@/lib/library/library-groups';
import { LibraryDetailModal } from './LibraryDetailModal';

function isValidLibraryExportId(eid: unknown): eid is string {
  return typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid);
}

function isValidExportId(id: string): boolean {
  return /^[a-f0-9]{64}$/.test(id);
}

function libraryAudioSource(row: Record<string, unknown>): AudioSource {
  const source = row.source;
  const ps = parseSandboxState(row.sandbox_state);
  const kind = ps?.kind ?? source;
  if (source === 'profile_identity' || kind === 'profile_identity') return 'identity';
  if (source === 'profile_active' || kind === 'profile_active') return 'transit';
  if (source === 'community_relationship' || kind === 'community_relationship') return 'connection';
  if (source === 'community_group' || kind === 'community_group') return 'connection';
  if (source === 'community_relational_weather' || kind === 'community_relational_weather') return 'connection';
  if (source === 'community_post_audio' || kind === 'community_post_audio') return 'post';
  if (source === 'sky' || kind === 'sky_summary') return 'sky';
  return 'sandbox';
}

async function exportExistsInStore(base: string, eid: string): Promise<boolean> {
  try {
    const headRes = await fetch(`${base || ''}/api/exports/${encodeURIComponent(eid)}`, {
      method: 'HEAD',
      credentials: 'same-origin',
    });
    return headRes.status === 204 || headRes.status === 200;
  } catch {
    return false;
  }
}

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
  const [libraryAudioMissingFromStore, setLibraryAudioMissingFromStore] = useState<boolean | null>(null);
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const [libraryRelationalWeatherTextMissing, setLibraryRelationalWeatherTextMissing] = useState(false);
  const [libraryHistoricalArtifact, setLibraryHistoricalArtifact] = useState(false);
  const [libraryCommunityReadingArtifact, setLibraryCommunityReadingArtifact] = useState<Record<string, unknown> | null>(
    null,
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupLibraryRows(libraryRows), [libraryRows]);

  const dispatchLibraryAudio = useCallback(
    (row: Record<string, unknown>, exportId: string) => {
      playTrack({
        exportId,
        label: libraryRowSummary(row) || librarySourceLabel(row.source),
        source: libraryAudioSource(row),
      });
    },
    [playTrack],
  );

  const closeLibraryRow = useCallback(() => {
    setLibraryOpenId(null);
    setLibraryDetailRow(null);
    setLibraryReconstructResult(null);
    setLibraryReconstructError(null);
    setLibraryAudioMissingFromStore(null);
    setLibraryRelationalWeatherTextMissing(false);
    setLibraryHistoricalArtifact(false);
    setLibraryCommunityReadingArtifact(null);
    setLibraryDetailLoading(false);
    setLibraryReconstructLoading(false);
  }, []);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
        const eid = row.export_id;
        if (isValidLibraryExportId(eid)) {
          const exists = await exportExistsInStore(base, eid);
          if (!exists) {
            setLibraryAudioMissingFromStore(true);
          } else {
            setLibraryAudioMissingFromStore(false);
            dispatchLibraryAudio(row, eid);
          }
        }
        setLibraryDetailLoading(false);
        return;
      }
      if (source === 'community_post_audio' || ps?.kind === 'community_post_audio') {
        const eid = row.export_id;
        if (isValidLibraryExportId(eid)) {
          dispatchLibraryAudio(row, eid);
        }
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
        if (isValidLibraryExportId(eid)) {
          dispatchLibraryAudio(row, eid);
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
        if (isValidLibraryExportId(eid)) {
          dispatchLibraryAudio(row, eid);
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
          if (isValidLibraryExportId(eid)) {
            const exists = await exportExistsInStore(base, eid);
            if (!exists) {
              setLibraryAudioMissingFromStore(true);
            } else {
              setLibraryAudioMissingFromStore(false);
              dispatchLibraryAudio(row, eid);
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
        if (isValidLibraryExportId(eid)) {
          const exists = await exportExistsInStore(base, eid);
          if (!exists) {
            setLibraryAudioMissingFromStore(true);
          } else {
            setLibraryAudioMissingFromStore(false);
            dispatchLibraryAudio(row, eid);
          }
        } else {
          setLibraryAudioMissingFromStore(null);
        }
        return;
      }
      if (source === 'profile_active' || ps?.kind === 'profile_active') {
        if (!ps || !sandboxStateCompleteForTransit(ps)) {
          setLibraryReconstructError(
            'This bookmark was saved before transit details were stored. Compose a new report from Today and save again.',
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
        if (isValidLibraryExportId(eid)) {
          dispatchLibraryAudio(row, eid);
        }
      }
      if (source === 'sandbox') {
        const eid = row.export_id;
        if (isValidLibraryExportId(eid)) {
          dispatchLibraryAudio(row, eid);
        }
        setLibraryDetailLoading(false);
        return;
      }
      if (source === 'sky' || ps?.kind === 'sky_summary') {
        const eid = row.export_id;
        if (isValidLibraryExportId(eid)) {
          dispatchLibraryAudio(row, eid);
        }
        setLibraryDetailLoading(false);
        return;
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
    <>
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Your saved readings and soundtracks, organized by type.
        </p>

        {libraryLoading ? <p className="text-sm text-text-secondary">Loading library…</p> : null}

        {!libraryLoading
          ? groups.map((group) => (
              <section key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleSection(group.key)}
                  className="flex items-center justify-between w-full text-left py-2"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-accent">{group.label}</h3>
                    <span className="text-xs text-text-muted">{group.rows.length}</span>
                  </div>
                  <span className="text-text-muted text-xs">
                    {collapsedSections.has(group.key) ? '▸' : '▾'}
                  </span>
                </button>

                {!collapsedSections.has(group.key) ? (
                  group.rows.length === 0 ? (
                    <p className="text-sm text-text-muted pl-2 py-2">{group.emptyMessage}</p>
                  ) : (
                    <ul className="space-y-2">
                      {group.rows.map((row) => (
                        <Card
                          as="li"
                          key={String(row.id)}
                          elevation="raised"
                          interactive
                          className="text-sm flex items-center justify-between px-4 py-3 min-w-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isValidExportId(String(row.export_id ?? '')) ? (
                              <span className="text-accent text-xs shrink-0" aria-hidden>
                                ♫
                              </span>
                            ) : null}
                            <span className="text-text-secondary truncate">{libraryRowSummary(row)}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs shrink-0 min-h-[44px]"
                            onClick={() => void openLibraryRow(String(row.id))}
                          >
                            View
                          </Button>
                        </Card>
                      ))}
                    </ul>
                  )
                ) : null}
              </section>
            ))
          : null}
      </div>

      <LibraryDetailModal
        isOpen={libraryOpenId !== null}
        row={libraryDetailRow}
        isLoading={libraryDetailLoading}
        reconstructLoading={libraryReconstructLoading}
        reconstructResult={libraryReconstructResult}
        error={libraryReconstructError}
        audioMissingFromStore={libraryAudioMissingFromStore}
        relationalWeatherTextMissing={libraryRelationalWeatherTextMissing}
        historicalArtifact={libraryHistoricalArtifact}
        communityReadingArtifact={libraryCommunityReadingArtifact}
        onClose={closeLibraryRow}
        onDeleted={() => void refreshLibrary()}
      />
    </>
  );
});
