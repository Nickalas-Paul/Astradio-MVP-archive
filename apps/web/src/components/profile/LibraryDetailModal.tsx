'use client';

import { useEffect } from 'react';
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
  if (source === 'community_relationship' || kind === 'community_relationship') return 'connection';
  if (source === 'community_group' || kind === 'community_group') return 'connection';
  if (source === 'community_relational_weather' || kind === 'community_relational_weather') return 'connection';
  if (source === 'community_post_audio' || kind === 'community_post_audio') return 'post';
  return 'sandbox';
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
}: LibraryDetailModalProps) {
  const playTrack = useAudioPlayerStore((s) => s.playTrack);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const exportId = row && isValidLibraryExportId(row.export_id) ? row.export_id : null;
  const compositionType =
    row && typeof row.composition_type === 'string' ? row.composition_type.trim() : '';
  const createdAtLabel = row ? formatLibraryCreatedAt(row.created_at) : '';

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
          <div className="min-w-0 space-y-1">
            <h2 id="library-detail-title" className="text-h3 font-serif text-text-primary">
              {row ? librarySourceLabel(row.source) : 'Saved artifact'}
            </h2>
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

          {row != null &&
            (row.source === 'profile_identity' ||
              parseSandboxState(row.sandbox_state)?.kind === 'profile_identity') &&
            audioMissingFromStore !== false ? (
              <p className="text-sm text-text-secondary">
                Identity comes from your birth chart. Open the Identity tab to compose or play your soundtrack.
              </p>
            ) : null}

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
            hasCompatibilityReadingSurface(reconstructResult.explanation as ExplanationLike, undefined) && (
              <ExplainerSections sections={mapExplanationToSections(reconstructResult.explanation)} />
            )}

          {reconstructResult != null &&
            reconstructResult.explanation != null &&
            !communityReadingArtifact &&
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
          <div className="pt-4 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {compositionType ? (
              <span className="px-2 py-0.5 rounded border border-border/60 bg-bgElev/50">
                {compositionType}
              </span>
            ) : null}
            {createdAtLabel ? <span>Saved {createdAtLabel}</span> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
