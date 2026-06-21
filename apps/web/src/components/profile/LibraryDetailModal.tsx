'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExplainerSections } from './shared/ExplainerSections';
import {
  formatLibraryCreatedAt,
  libraryRowSummary,
  librarySourceLabel,
  parseSandboxState,
} from './shared/profile-library-utils';
import { mapExplanationToSections } from './shared/profile-reading-utils';
import { hasCompatibilityReadingSurface, type ExplanationLike } from '../../lib/compatibility-reading-surface';
import { IdentityMarkdown } from '../shared/IdentityMarkdown';
import { Card } from '../shared/Card';
import { Button } from '@/components/shared/Button';
import { getApiBaseUrl } from '@/core/api-base';
import { useAudioPlayerStore, type AudioSource } from '@/store';
import { EXPANDED_READING_RENDER_ORDER, EXPANDED_SLOT_LABELS } from '../../lib/community-feed-reading-layout';
import { finalizeRelationalReadingSurfaces, type ExpandedSlotId } from '../../lib/relational-reading-enforcement';

function isValidLibraryExportId(eid: unknown): eid is string {
  return typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid);
}

function libraryAudioSource(row: Record<string, unknown>): AudioSource {
  const source = row.source;
  const ps = parseSandboxState(row.sandbox_state);
  const kind = ps?.kind ?? source;
  if (source === 'profile_identity' || kind === 'profile_identity') return 'identity';
  if (source === 'profile_active' || kind === 'profile_active') return 'transit';
  if (source === 'sky' || kind === 'sky_summary') return 'sky';
  if (source === 'community_relationship' || kind === 'community_relationship') return 'connection';
  if (source === 'community_group' || kind === 'community_group') return 'connection';
  if (source === 'community_relational_weather' || kind === 'community_relational_weather') return 'connection';
  if (source === 'community_post_audio' || kind === 'community_post_audio') return 'post';
  return 'sandbox';
}

function isMetadataOnlyReport(report: unknown): boolean {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return false;
  const keys = Object.keys(report as Record<string, unknown>);
  if (keys.length === 0) return true;
  const metadataKeys = new Set(['savedFrom', 'label', 'at']);
  return keys.every((k) => metadataKeys.has(k));
}

function reportExplanation(report: unknown): unknown {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const obj = report as Record<string, unknown>;
  if (obj.explanation) return obj.explanation;
  if (Array.isArray(obj.sections)) return { sections: obj.sections };
  return null;
}

function reportMarkdownText(report: unknown): string | null {
  if (typeof report === 'string' && report.trim()) return report.trim();
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const obj = report as Record<string, unknown>;
  if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
  if (obj.text && typeof obj.text === 'object' && !Array.isArray(obj.text)) {
    const textObj = obj.text as { short?: string; long?: string };
    const combined = [textObj.short, textObj.long].filter(Boolean).join('\n\n').trim();
    if (combined) return combined;
  }
  return null;
}

function renderStoredReportContent(report: unknown, emptyMessage: string) {
  const markdown = reportMarkdownText(report);
  if (markdown) {
    return <IdentityMarkdown content={markdown} />;
  }

  const explanation = reportExplanation(report);
  if (
    explanation &&
    hasCompatibilityReadingSurface(explanation as ExplanationLike, undefined)
  ) {
    return <ExplainerSections sections={mapExplanationToSections(explanation)} />;
  }

  if (isMetadataOnlyReport(report) || report == null) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return <p className="text-sm text-text-secondary">{emptyMessage}</p>;
}

export interface LibraryDetailModalProps {
  isOpen: boolean;
  row: Record<string, unknown> | null;
  isLoading: boolean;
  reconstructLoading: boolean;
  reconstructResult: Record<string, unknown> | null;
  error: string | null;
  audioMissingFromStore: boolean | null;
  relationalWeatherTextMissing: boolean;
  historicalArtifact: boolean;
  communityReadingArtifact: Record<string, unknown> | null;
  onClose: () => void;
  onDeleted?: () => void;
  onRenamed?: () => void;
}

export function LibraryDetailModal({
  isOpen,
  row,
  isLoading,
  reconstructLoading,
  reconstructResult,
  error,
  audioMissingFromStore,
  relationalWeatherTextMissing,
  historicalArtifact,
  communityReadingArtifact,
  onClose,
  onDeleted,
  onRenamed,
}: LibraryDetailModalProps) {
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savedDisplayLabel, setSavedDisplayLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setDeleteConfirm(false);
    setDeleteLoading(false);
    setDeleteError(null);
    setIsEditing(false);
    setEditLabel('');
    setRenameLoading(false);
    setRenameError(null);
    setSavedDisplayLabel(null);
  }, [isOpen]);

  const handleRename = useCallback(async () => {
    const rowId = row?.id;
    if (typeof rowId !== 'string' || !rowId.trim()) return;
    setRenameLoading(true);
    setRenameError(null);
    try {
      const base = getApiBaseUrl();
      const trimmed = editLabel.trim();
      const res = await fetch(`${base || ''}/api/sandbox/compositions/${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_label: trimmed || null }),
      });
      if (!res.ok) throw new Error('Rename failed');
      const data = (await res.json().catch(() => ({}))) as { display_label?: string | null };
      setSavedDisplayLabel(
        typeof data.display_label === 'string' ? data.display_label : trimmed || null,
      );
      setIsEditing(false);
      onRenamed?.();
    } catch {
      setRenameError('Could not rename');
    } finally {
      setRenameLoading(false);
    }
  }, [row?.id, editLabel, onRenamed]);

  const handleDelete = useCallback(async () => {
    const rowId = row?.id;
    if (typeof rowId !== 'string' || !rowId.trim()) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base || ''}/api/sandbox/compositions/${encodeURIComponent(rowId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Delete failed');
      onClose();
      onDeleted?.();
    } catch {
      setDeleteError('Could not remove this item. Try again.');
    } finally {
      setDeleteLoading(false);
    }
  }, [row?.id, onClose, onDeleted]);

  if (!isOpen) return null;

  const exportId = row && isValidLibraryExportId(row.export_id) ? row.export_id : null;
  const compositionType =
    row && typeof row.composition_type === 'string' ? row.composition_type.trim() : '';
  const createdAtLabel = row ? formatLibraryCreatedAt(row.created_at) : '';
  const sandboxState = row ? parseSandboxState(row.sandbox_state) : null;
  const source = row ? String(row.source ?? '') : '';
  const isIdentity = source === 'profile_identity' || sandboxState?.kind === 'profile_identity';
  const isSandbox = source === 'sandbox';
  const isSky = source === 'sky' || sandboxState?.kind === 'sky_summary';
  const skyDateLabel =
    (typeof sandboxState?.date === 'string' && sandboxState.date.trim()) || createdAtLabel || 'this date';

  const derivedTitle = row
    ? libraryRowSummary(row) || librarySourceLabel(row.source)
    : 'Saved artifact';
  const displayName =
    savedDisplayLabel ??
    (typeof row?.display_label === 'string' && row.display_label.trim() ? row.display_label.trim() : null) ??
    derivedTitle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      role="presentation"
      onClick={onClose}
    >
      <Card
        elevation="floating"
        size="md"
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/60">
          <div className="min-w-0 space-y-1 flex-1">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => {
                  if (!row) return;
                  setEditLabel(
                    savedDisplayLabel ??
                      (typeof row.display_label === 'string' ? row.display_label : '') ??
                      '',
                  );
                  setIsEditing(true);
                }}
                className="text-left text-h3 font-serif text-text-primary hover:text-accent transition-colors"
                title="Click to rename"
              >
                {displayName}
                {row ? <span className="ml-2 text-xs text-text-muted">✎</span> : null}
              </button>
            ) : (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder={derivedTitle || 'Name this track'}
                    maxLength={100}
                    autoFocus
                    className="bg-transparent border border-border rounded px-2 py-1 text-sm text-text-primary focus:border-accent outline-none w-full max-w-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRename()}
                    disabled={renameLoading}
                  >
                    {renameLoading ? '…' : 'Save'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
                {renameError ? <p className="text-sm text-red-400">{renameError}</p> : null}
              </div>
            )}
            {createdAtLabel ? (
              <p className="text-xs text-text-muted">{createdAtLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-text-secondary hover:text-text-primary min-h-[44px] min-w-[44px] px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="py-4 space-y-4">
          {exportId && row ? (
            <Button
              type="button"
              variant="audio"
              size="sm"
              onClick={() =>
                playTrack({
                  exportId,
                  label: libraryRowSummary(row) || librarySourceLabel(row.source),
                  source: libraryAudioSource(row),
                })
              }
            >
              Listen
            </Button>
          ) : null}

          {isLoading ? <p className="text-sm text-text-secondary">Loading…</p> : null}

          {historicalArtifact ? (
            <div className="text-sm text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-lg px-3 py-2 space-y-2">
              <p>Historical saved artifact.</p>
              <p>Composed with an earlier expression version.</p>
              <a
                href="/today"
                className="inline-block px-3 py-1 rounded border border-amber-500/50 text-xs hover:bg-amber-500/10"
              >
                Compose current version
              </a>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          {row != null && isIdentity ? (
            <p className="text-sm text-text-secondary">
              {exportId
                ? 'Your identity soundtrack. Visit My Sky for the full reading.'
                : 'Your identity reading lives on the Identity tab.'}
            </p>
          ) : null}

          {row != null && isSandbox && !isLoading
            ? renderStoredReportContent(
                row.report,
                'This reading was saved without text content.',
              )
            : null}

          {row != null && isSky && !isLoading
            ? renderStoredReportContent(
                row.report,
                `Today's Sky for ${skyDateLabel}. Hear the soundtrack or visit Today for the current sky.`,
              )
            : null}

          {row != null &&
            (row.source === 'community_post_audio' ||
              parseSandboxState(row.sandbox_state)?.kind === 'community_post_audio') ? (
              <p className="text-sm text-text-secondary">
                {typeof parseSandboxState(row.sandbox_state)?.originalLabel === 'string'
                  ? String(parseSandboxState(row.sandbox_state)?.originalLabel)
                  : 'Saved from a community post'}
              </p>
            ) : null}

          {reconstructLoading ? <p className="text-sm text-text-secondary">Loading report…</p> : null}

          {communityReadingArtifact &&
          (row?.source === 'community_relational_weather' ||
            parseSandboxState(row?.sandbox_state)?.kind === 'community_relational_weather') ? (
            <div className="space-y-4">
              {(() => {
                const art = communityReadingArtifact;
                const w =
                  art.weather && typeof art.weather === 'object'
                    ? (art.weather as Record<string, unknown>)
                    : undefined;
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

          {reconstructResult != null &&
            reconstructResult.explanation != null &&
            !communityReadingArtifact &&
            !isSandbox &&
            !isSky &&
            hasCompatibilityReadingSurface(reconstructResult.explanation as ExplanationLike, undefined) && (
              <ExplainerSections sections={mapExplanationToSections(reconstructResult.explanation)} />
            )}

          {reconstructResult != null &&
            reconstructResult.explanation != null &&
            !communityReadingArtifact &&
            !isSandbox &&
            !isSky &&
            !hasCompatibilityReadingSurface(reconstructResult.explanation as ExplanationLike, undefined) &&
            !error && (
              <p className="text-sm text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2">
                Stored reading text for this artifact is missing or empty. Compose a new compatibility reading or
                contact support.
              </p>
            )}

          {row &&
            (row.source === 'community_relational_weather' ||
              parseSandboxState(row.sandbox_state)?.kind === 'community_relational_weather') &&
            relationalWeatherTextMissing && (
              <p className="text-sm text-amber-600 dark:text-amber-300">
                Reading text was not stored for this bookmark. Re-save from Today, or ask an operator to run a library
                repair.
              </p>
            )}

          {row &&
            (row.source === 'community_relational_weather' ||
              parseSandboxState(row.sandbox_state)?.kind === 'community_relational_weather') &&
            audioMissingFromStore === true && (
              <p className="text-sm text-amber-600 dark:text-amber-300">
                Audio record missing from storage (export pointer exists but file was not found).
              </p>
            )}
        </div>

        {row ? (
          <>
            <div className="pt-4 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              {compositionType ? (
                <span className="px-2 py-0.5 rounded border border-border/60 bg-bgElev/50">
                  {compositionType}
                </span>
              ) : null}
              {createdAtLabel ? <span>Saved {createdAtLabel}</span> : null}
            </div>

            <div className="border-t border-border pt-3 mt-4">
              {!deleteConfirm ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => setDeleteConfirm(true)}
                >
                  Remove from Library
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-text-secondary">Remove this item?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-400"
                    onClick={() => void handleDelete()}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? 'Removing…' : 'Confirm'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {deleteError ? <p className="text-sm text-red-400 mt-1">{deleteError}</p> : null}
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
