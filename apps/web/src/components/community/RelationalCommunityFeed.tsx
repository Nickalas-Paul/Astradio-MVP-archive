'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '../../core/api-base';
import { useRelationalCommunityFeed, type ProfilePrimaryChart } from '../../core/social/hooks';
import { ValidatedExportAudioPlayer } from './ValidatedExportAudioPlayer';
import { finalizeRelationalReadingSurfaces } from '../../lib/relational-reading-enforcement';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

type FeedAudioUiState = 'idle' | 'generating' | 'ready' | 'error';

type FeedAudioUi = {
  state: FeedAudioUiState;
  exportId: string | null;
  error: string | null;
};

function getAudioExportId(artifact: Record<string, unknown> | undefined): string | null {
  const audio = artifact?.audio;
  if (!audio || typeof audio !== 'object') return null;
  const id = (audio as Record<string, unknown>).export_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function activationLinePrefix(line: { text: string; prefix?: string }): string {
  if (typeof line.prefix === 'string' && line.prefix.trim()) return line.prefix.trim();
  const dash = line.text.indexOf('—');
  if (dash > 0) return line.text.slice(0, dash).trim();
  return '';
}

function activationLineExpandedBody(line: { text: string; expanded_text?: string }): string {
  if (typeof line.expanded_text === 'string' && line.expanded_text.trim()) return line.expanded_text.trim();
  const dash = line.text.indexOf('—');
  if (dash > 0) return line.text.slice(dash + 1).trim();
  return line.text;
}

function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'you_bring':
      return "What you're bringing";
    case 'they_bring':
      return "What they're bringing";
    case 'tests_both':
      return "What's testing you both";
    default:
      return 'Active today';
  }
}

interface RelationalCommunityFeedProps {
  userId: string | null;
  primaryChart: ProfilePrimaryChart | null;
  className?: string;
  /** When true, page header (title + refresh) is rendered by the parent. */
  hideHeader?: boolean;
}

function FeedLoadingSkeleton() {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="Loading feed">
      {[0, 1, 2].map((i) => (
        <Card key={i} elevation="resting" padding="p-5" className="animate-pulse space-y-3">
          <div className="h-5 bg-bgElev rounded w-2/5" />
          <div className="h-3 bg-bgElev rounded w-3/5" />
          <div className="space-y-2 pt-1">
            <div className="h-3 bg-bgElev rounded w-full" />
            <div className="h-3 bg-bgElev rounded w-5/6" />
            <div className="h-3 bg-bgElev rounded w-4/5" />
          </div>
        </Card>
      ))}
    </ul>
  );
}

export function RelationalCommunityFeed({
  userId,
  primaryChart,
  className = '',
  hideHeader = false,
}: RelationalCommunityFeedProps) {
  const router = useRouter();
  const { data, isLoading, error, refresh } = useRelationalCommunityFeed(userId, primaryChart);
  const [artifactByFeedId, setArtifactByFeedId] = useState<Record<string, Record<string, unknown>>>({});
  const [openByFeedId, setOpenByFeedId] = useState<Record<string, boolean>>({});
  const [busyByFeedId, setBusyByFeedId] = useState<Record<string, boolean>>({});
  const [saveStatusByFeedId, setSaveStatusByFeedId] = useState<Record<string, string>>({});
  const [audioUiByFeedId, setAudioUiByFeedId] = useState<Record<string, FeedAudioUi>>({});

  /** Must run unconditionally — same hook order when loading vs loaded (Rules of Hooks). */
  const items = userId ? (data?.items ?? []) : [];
  const finalizedFeedCollapsed = useMemo(
    () =>
      finalizeRelationalReadingSurfaces({
        kind: 'feed_collapsed_batch',
        items,
      }),
    [items]
  );
  const collapsedByFeedId = useMemo(() => {
    if (finalizedFeedCollapsed.kind !== 'feed_collapsed_batch') return new Map();
    return new Map(finalizedFeedCollapsed.items.map((row) => [row.feed_item_id, row] as const));
  }, [finalizedFeedCollapsed]);

  if (!userId) {
    return (
      <Card elevation="resting" padding="p-5" className={`text-body-sm text-text-secondary ${className}`}>
        Sign in to load the feed.
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <div className={`space-y-4 ${className}`}>
        {!hideHeader && (
          <div className="space-y-1">
            <h2 className="text-h2 font-semibold text-text-primary">Feed</h2>
            <p className="text-body-sm text-text-secondary">Live Transit Feed</p>
          </div>
        )}
        <FeedLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200 ${className}`}
      >
        {error}
        <Button type="button" variant="ghost" size="sm" className="ml-2" onClick={() => refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const transitLock = (data?.transit_lock ?? {}) as {
    ts?: string;
    lat?: number;
    lon?: number;
    tz?: string;
  };

  const fetchForecastArtifact = async (
    item: (typeof items)[number],
    opts: { generateAudio: boolean; openPanel?: boolean }
  ): Promise<string | null> => {
    if (item.connection_kind === 'campaign_group') return null;
    const base = getApiBaseUrl();
    const transitDatetime = String(transitLock.ts || '').trim();
    const lat = Number(transitLock.lat);
    const lon = Number(transitLock.lon);
    const timezone = String(transitLock.tz || 'UTC').trim();
    if (!transitDatetime || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: 'Refresh the feed and try again.' }));
      return null;
    }
    const scopePath =
      item.connection_kind === 'pair'
        ? `/api/relationships/${encodeURIComponent(item.binding_id)}/forecast`
        : `/api/groups/${encodeURIComponent(item.binding_id)}/forecast`;
    const qs = new URLSearchParams({
      transitDatetime,
      transitLatitude: String(lat),
      transitLongitude: String(lon),
      transitTimezone: timezone,
      compose: '1',
      generateAudio: opts.generateAudio ? '1' : '0',
    });
    const feedId = item.feed_item_id;
    if (opts.openPanel) {
      setOpenByFeedId({ [feedId]: true });
    }
    setBusyByFeedId((prev) => ({ ...prev, [feedId]: true }));
    if (!opts.generateAudio) {
      setSaveStatusByFeedId((prev) => ({ ...prev, [feedId]: '' }));
    }
    try {
      const r = await fetch(`${base || ''}${scopePath}?${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        const msg = typeof j.error === 'string' ? j.error : `Render failed (${r.status})`;
        if (opts.generateAudio) {
          setAudioUiByFeedId((prev) => ({
            ...prev,
            [feedId]: { state: 'error', exportId: null, error: msg },
          }));
        } else {
          setSaveStatusByFeedId((prev) => ({ ...prev, [feedId]: msg }));
        }
        return null;
      }
      const artifact = (j.artifact && typeof j.artifact === 'object' ? j.artifact : null) as
        | Record<string, unknown>
        | null;
      const weather = (j.weather && typeof j.weather === 'object' ? j.weather : null) as Record<string, unknown> | null;
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
        const artifactText =
          artifact && artifact.text && typeof artifact.text === 'object' && !Array.isArray(artifact.text)
            ? (artifact.text as Record<string, unknown>)
            : null;
        const textExpl =
          artifactText &&
          artifactText.explanation &&
          typeof artifactText.explanation === 'object' &&
          !Array.isArray(artifactText.explanation)
            ? (artifactText.explanation as Record<string, unknown>)
            : null;
        const topExpl =
          artifact &&
          artifact.explanation &&
          typeof artifact.explanation === 'object' &&
          !Array.isArray(artifact.explanation)
            ? (artifact.explanation as Record<string, unknown>)
            : null;
        // eslint-disable-next-line no-console
        console.debug('[community-feed] open artifact diagnostic', {
          feed_item_id: item.feed_item_id,
          binding_id: item.binding_id,
          connection_kind: item.connection_kind,
          forecast_url: `${scopePath}?${qs.toString()}`,
          artifact_text_present: !!(artifact && artifact.text),
          text_explanation_sections_count: Array.isArray(textExpl?.sections) ? textExpl.sections.length : 0,
          text_sections_count: Array.isArray(artifactText?.sections) ? artifactText.sections.length : 0,
          explanation_sections_count: Array.isArray(topExpl?.sections) ? topExpl.sections.length : 0,
          audio_export_id:
            artifact &&
            artifact.audio &&
            typeof artifact.audio === 'object' &&
            typeof (artifact.audio as Record<string, unknown>).export_id === 'string'
              ? ((artifact.audio as Record<string, unknown>).export_id as string)
              : null,
          audio_export_error:
            artifact &&
            artifact.audio &&
            typeof artifact.audio === 'object' &&
            typeof (artifact.audio as Record<string, unknown>).export_error === 'string'
              ? ((artifact.audio as Record<string, unknown>).export_error as string)
              : null,
        });
      }
      const stored: Record<string, unknown> = {
        ...(artifact || {}),
        weather,
        dailyArtifactIdentity:
          j && typeof j === 'object' && j.artifact && typeof j.artifact === 'object'
            ? (j.artifact as Record<string, unknown>).dailyArtifactIdentity
            : null,
      };
      setArtifactByFeedId((prev) => ({ ...prev, [feedId]: stored }));
      const exportId = opts.generateAudio ? getAudioExportId(stored) : null;
      if (opts.generateAudio) {
        if (exportId) {
          setAudioUiByFeedId((prev) => ({
            ...prev,
            [feedId]: { state: 'ready', exportId, error: null },
          }));
        } else {
          const audioErr =
            stored.audio &&
            typeof stored.audio === 'object' &&
            typeof (stored.audio as Record<string, unknown>).export_error === 'string'
              ? String((stored.audio as Record<string, unknown>).export_error).trim()
              : '';
          setAudioUiByFeedId((prev) => ({
            ...prev,
            [feedId]: {
              state: 'error',
              exportId: null,
              error: audioErr || 'Audio forecast could not be generated. Please try again.',
            },
          }));
        }
      } else {
        setAudioUiByFeedId((prev) => ({
          ...prev,
          [feedId]: { state: 'idle', exportId: null, error: null },
        }));
      }
      await refresh();
      return exportId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Render failed';
      if (opts.generateAudio) {
        setAudioUiByFeedId((prev) => ({
          ...prev,
          [feedId]: { state: 'error', exportId: null, error: msg },
        }));
      } else {
        setSaveStatusByFeedId((prev) => ({ ...prev, [feedId]: msg }));
      }
      return null;
    } finally {
      setBusyByFeedId((prev) => ({ ...prev, [feedId]: false }));
    }
  };

  const openAndRenderArtifact = async (item: (typeof items)[number]) => {
    await fetchForecastArtifact(item, { generateAudio: false, openPanel: true });
  };

  const generateFeedAudio = async (item: (typeof items)[number]) => {
    const feedId = item.feed_item_id;
    setAudioUiByFeedId((prev) => ({
      ...prev,
      [feedId]: { state: 'generating', exportId: null, error: null },
    }));
    await fetchForecastArtifact(item, { generateAudio: true });
  };

  const toggleExpandedFeed = (item: (typeof items)[number]) => {
    if (item.connection_kind === 'campaign_group') return;
    const id = item.feed_item_id;
    if (openByFeedId[id]) {
      setOpenByFeedId({});
      return;
    }
    if (artifactByFeedId[id]) {
      setOpenByFeedId({ [id]: true });
      return;
    }
    void openAndRenderArtifact(item);
  };

  const saveArtifact = async (item: (typeof items)[number]) => {
    const artifact = artifactByFeedId[item.feed_item_id];
    if (!artifact) return;
    const dai =
      artifact.dailyArtifactIdentity && typeof artifact.dailyArtifactIdentity === 'object'
        ? (artifact.dailyArtifactIdentity as Record<string, unknown>)
        : null;
    const identityBindingId = typeof dai?.bindingId === 'string' ? dai.bindingId : null;
    const base = getApiBaseUrl();
    setBusyByFeedId((prev) => ({ ...prev, [item.feed_item_id]: true }));
    setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: '' }));
    try {
      const bindingId = identityBindingId || item.binding_id;
      const rawText = artifact.text;
      const textForSave =
        typeof rawText === 'string'
          ? rawText
          : rawText && typeof rawText === 'object' && !Array.isArray(rawText)
            ? (rawText as Record<string, unknown>)
            : null;
      const payload = {
        scopeKind:
          item.connection_kind === 'pair' ? 'pair' : item.connection_kind === 'relational_group' ? 'group' : null,
        bindingId,
        relationshipId: item.connection_kind === 'pair' ? bindingId : null,
        groupId: item.connection_kind === 'relational_group' ? bindingId : null,
        chartIdsOrdered:
          Array.isArray(dai?.chartIdsOrdered) && (dai?.chartIdsOrdered as unknown[]).every((c) => typeof c === 'string')
            ? (dai.chartIdsOrdered as string[])
            : item.chart_ids_ordered,
        transit_snapshot_hash:
          artifact.dailyArtifactIdentity &&
          typeof artifact.dailyArtifactIdentity === 'object' &&
          typeof (artifact.dailyArtifactIdentity as Record<string, unknown>).transitSnapshotHash === 'string'
            ? ((artifact.dailyArtifactIdentity as Record<string, unknown>).transitSnapshotHash as string)
            : item.transit_snapshot_hash,
        relational_weather_state_hash: item.relational_weather_state_hash,
        renderedArtifact: {
          planHash: typeof artifact.planHash === 'string' ? artifact.planHash : null,
          compositionId: typeof artifact.compositionId === 'string' ? artifact.compositionId : null,
          text: textForSave,
          exportJobId:
            artifact.audio &&
            typeof artifact.audio === 'object' &&
            typeof (artifact.audio as Record<string, unknown>).export_id === 'string'
              ? (artifact.audio as Record<string, unknown>).export_id
              : null,
        },
        chart_ids_ordered_hash:
          artifact.dailyArtifactIdentity &&
          typeof artifact.dailyArtifactIdentity === 'object' &&
          typeof (artifact.dailyArtifactIdentity as Record<string, unknown>).chartIdsOrderedHash === 'string'
            ? ((artifact.dailyArtifactIdentity as Record<string, unknown>).chartIdsOrderedHash as string)
            : null,
        canonical_day_bucket:
          artifact.dailyArtifactIdentity &&
          typeof artifact.dailyArtifactIdentity === 'object' &&
          typeof (artifact.dailyArtifactIdentity as Record<string, unknown>).canonicalDayBucket === 'string'
            ? ((artifact.dailyArtifactIdentity as Record<string, unknown>).canonicalDayBucket as string)
            : null,
        daily_artifact_id:
          artifact.dailyArtifactIdentity &&
          typeof artifact.dailyArtifactIdentity === 'object' &&
          typeof (artifact.dailyArtifactIdentity as Record<string, unknown>).dailyArtifactId === 'string'
            ? ((artifact.dailyArtifactIdentity as Record<string, unknown>).dailyArtifactId as string)
            : null,
        weather: artifact.weather && typeof artifact.weather === 'object' ? artifact.weather : null,
      };
      if (!payload.scopeKind) {
        setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: 'This feed scope is not saveable.' }));
        return;
      }
      const r = await fetch(`${base || ''}/api/community/artifacts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        inserted?: number;
        repaired?: number;
        textRepaired?: number;
        exportReachable?: boolean;
        repairReason?: string;
        ok?: boolean;
      };
      if (!r.ok) {
        setSaveStatusByFeedId((prev) => ({
          ...prev,
          [item.feed_item_id]: j.error || `Save failed (${r.status})`,
        }));
        return;
      }
      const inserted = j.inserted;
      const repaired = j.repaired;
      const textRepaired = j.textRepaired;
      const reason = j.repairReason ? ` (${j.repairReason})` : '';
      let msg = 'Library updated';
      if (inserted === 1) msg = 'Saved to Library';
      else if (inserted === 0 && repaired !== 1 && textRepaired !== 1) msg = 'Already in Library';
      else if (repaired === 1 || textRepaired === 1) msg = 'Library updated';
      setSaveStatusByFeedId((prev) => ({
        ...prev,
        [item.feed_item_id]: `${msg}${reason}`,
      }));
    } catch (e) {
      setSaveStatusByFeedId((prev) => ({
        ...prev,
        [item.feed_item_id]: e instanceof Error ? e.message : 'Save failed',
      }));
    } finally {
      setBusyByFeedId((prev) => ({ ...prev, [item.feed_item_id]: false }));
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {!hideHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-h2 font-semibold text-text-primary">Feed</h2>
            <p className="text-body-sm text-text-secondary">Live Transit Feed</p>
            <p className="text-caption text-text-muted max-w-2xl">
              Connections ranked by how active they are for you right now.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => refresh()} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      )}

      {!isLoading && items.length === 0 ? (
        <Card elevation="resting" padding="p-6" className="text-center">
          <p className="text-body-sm text-text-secondary">
            No active transits shaping your connections today.
            <br />
            Check back tomorrow.
          </p>
        </Card>
      ) : null}

      {items.length > 0 ? (
        <ul className={`space-y-4 ${isLoading && data ? 'opacity-60 pointer-events-none' : ''}`}>
          {items.map((item) => {
            const identity =
              typeof item.connection_identity_line === 'string' && item.connection_identity_line.trim()
                ? item.connection_identity_line
                : item.connection_kind === 'pair'
                  ? 'Connection'
                  : item.connection_kind === 'relational_group'
                    ? 'Group'
                    : 'Campaign';
            const row = collapsedByFeedId.get(item.feed_item_id);
            const cd = item.collapsed_display;
            const betaLines =
              item.connection_kind === 'pair' &&
              cd &&
              Array.isArray(cd.activation_lines) &&
              cd.activation_lines.length === 3 &&
              cd.activation_lines.every((l) => typeof l.text === 'string' && l.text.trim().length > 0) &&
              typeof cd.enhanced_title === 'string' &&
              cd.enhanced_title.trim().length > 0
                ? cd.activation_lines
                : null;
            const primary = row?.primary_line ?? 'This connection is active in your feed for this moment.';
            const micro = row?.micro_tag ?? '';
            const descriptor = row?.activation_descriptor ?? 'Active between you';
            const rankBar = Math.max(0, Math.min(1, item.ranking?.activation_effective ?? 0));
            const surfacingLine = row?.surfacing_explanation ?? null;
            const isExpanded = Boolean(openByFeedId[item.feed_item_id]);
            const isGroup = item.connection_kind === 'relational_group';
            const partnerName =
              cd?.enhanced_title?.trim() ||
              (typeof item.connection_identity_line === 'string' && item.connection_identity_line.trim()
                ? item.connection_identity_line.trim()
                : identity);
            const canExpand = item.connection_kind !== 'campaign_group';

            return (
              <li key={item.feed_item_id}>
                <Card
                  key={`${item.feed_item_id}-${isExpanded ? 'expanded' : 'collapsed'}`}
                  elevation={isExpanded ? 'raised' : 'resting'}
                  padding={isExpanded ? 'p-6' : 'p-5'}
                  className={`space-y-4 ${isExpanded ? 'border-l-2 border-l-accent' : ''}`}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          {isGroup ? (
                            <p className="text-caption font-medium uppercase tracking-wide text-text-secondary">
                              Group
                            </p>
                          ) : null}
                          <h3 className="font-serif text-h3 font-semibold text-text-primary leading-snug break-words">
                            {isGroup
                              ? partnerName
                              : `Your relationship with ${partnerName}`}
                          </h3>
                          <p className="text-body-sm text-text-secondary">Today&apos;s transit weather report</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpandedFeed(item)}
                        >
                          Collapse
                        </Button>
                      </div>

                      {busyByFeedId[item.feed_item_id] && !artifactByFeedId[item.feed_item_id] ? (
                        <p className="text-body-sm text-text-secondary">Loading today&apos;s transits…</p>
                      ) : null}

                      {artifactByFeedId[item.feed_item_id] ? (
                        <>
                          {(() => {
                            const art = artifactByFeedId[item.feed_item_id];
                            const freshness =
                              art.freshness && typeof art.freshness === 'object'
                                ? (art.freshness as Record<string, unknown>)
                                : null;
                            if (freshness?.isHistorical !== true) return null;
                            return (
                              <p className="text-caption text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-lg px-3 py-2">
                                Historical saved reading. Generated with an earlier expression version. Expand again to
                                refresh this connection.
                              </p>
                            );
                          })()}

                          {(() => {
                            const art = artifactByFeedId[item.feed_item_id];
                            const finalized = finalizeRelationalReadingSurfaces({
                              kind: 'expanded_artifact',
                              artifact: art,
                              weather: art.weather && typeof art.weather === 'object' ? art.weather : undefined,
                              context: { feed_item_id: item.feed_item_id, binding_id: item.binding_id },
                            });
                            if (finalized.kind !== 'expanded_artifact') return null;

                            const activationOnly = finalized.slots.activation?.trim() ?? '';
                            const sonicForecast =
                              typeof cd?.sonic_forecast_text === 'string' && cd.sonic_forecast_text.trim()
                                ? cd.sonic_forecast_text.trim()
                                : '';
                            const audioUi = audioUiByFeedId[item.feed_item_id] ?? {
                              state: 'idle' as const,
                              exportId: null,
                              error: null,
                            };
                            const hasSpotlight =
                              (betaLines && betaLines.length === 3) || Boolean(activationOnly);

                            return (
                              <div className="space-y-6">
                                {hasSpotlight ? (
                                  <section className="space-y-4">
                                    <h2 className="reading-section-header">Today&apos;s Transit Spotlight</h2>
                                    {betaLines && betaLines.length === 3
                                      ? betaLines.map((line, idx) => (
                                          <div
                                            key={`${item.feed_item_id}-spot-${idx}`}
                                            className="space-y-2"
                                          >
                                            <p className="text-caption font-medium uppercase tracking-wide text-accent-light">
                                              {getRoleLabel(line.role)}
                                            </p>
                                            {activationLinePrefix(line) ? (
                                              <p className="text-body-sm text-text-secondary">
                                                {activationLinePrefix(line)}
                                              </p>
                                            ) : null}
                                            <div className="text-body text-text-primary leading-relaxed">
                                              <IdentityMarkdown content={activationLineExpandedBody(line)} />
                                            </div>
                                          </div>
                                        ))
                                      : (
                                        <div className="text-body text-text-primary leading-relaxed">
                                          <IdentityMarkdown content={activationOnly} />
                                        </div>
                                      )}
                                  </section>
                                ) : null}

                                <div className="border-t border-border" aria-hidden />

                                <section className="rounded-lg border border-border bg-surface-0 p-4 space-y-4">
                                  <h2 className="reading-section-header">Hear today&apos;s forecast</h2>
                                  {sonicForecast ? (
                                    <div className="text-body-sm text-text-secondary leading-relaxed">
                                      <IdentityMarkdown content={sonicForecast} />
                                    </div>
                                  ) : null}

                                  {audioUi.state === 'ready' && audioUi.exportId ? (
                                    <div className="space-y-3">
                                      <p className="text-body-sm text-text-secondary">
                                        Your audio forecast is ready.
                                      </p>
                                      <ValidatedExportAudioPlayer exportId={audioUi.exportId} />
                                    </div>
                                  ) : audioUi.state === 'generating' ? (
                                    <Button
                                      type="button"
                                      variant="audio"
                                      size="sm"
                                      loading
                                      disabled
                                    >
                                      Generating forecast…
                                    </Button>
                                  ) : audioUi.state === 'error' ? (
                                    <div className="space-y-2">
                                      <p className="text-body-sm text-amber-600 dark:text-amber-300" role="alert">
                                        {audioUi.error ||
                                          'Audio forecast unavailable. Try again tomorrow.'}
                                      </p>
                                      <Button
                                        type="button"
                                        variant="audio"
                                        size="sm"
                                        onClick={() => void generateFeedAudio(item)}
                                        disabled={busyByFeedId[item.feed_item_id]}
                                      >
                                        Try again
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="audio"
                                      size="sm"
                                      onClick={() => void generateFeedAudio(item)}
                                      disabled={busyByFeedId[item.feed_item_id]}
                                    >
                                      Generate audio forecast
                                    </Button>
                                  )}
                                </section>
                              </div>
                            );
                          })()}

                          {canExpand ? (
                            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/community?tab=connections&signals=1')}
                              >
                                Signals
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void saveArtifact(item)}
                                disabled={busyByFeedId[item.feed_item_id]}
                              >
                                {busyByFeedId[item.feed_item_id] ? 'Saving…' : 'Save to Library'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpandedFeed(item)}
                              >
                                Collapse
                              </Button>
                            </div>
                          ) : null}

                          {saveStatusByFeedId[item.feed_item_id] ? (
                            <p className="text-caption text-text-muted">{saveStatusByFeedId[item.feed_item_id]}</p>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          {isGroup ? (
                            <p className="text-caption font-medium uppercase tracking-wide text-text-secondary">
                              Group
                            </p>
                          ) : null}
                          <h3 className="text-h4 font-semibold text-text-primary leading-snug break-words">
                            {partnerName}
                          </h3>
                          <p className="text-caption text-text-muted">
                            Today&apos;s transits shaping your connection
                          </p>
                        </div>
                      </div>

                      {betaLines && betaLines.length === 3 ? (
                        <ul className="list-none space-y-3 pl-0">
                          {betaLines.map((line, idx) => (
                            <li key={`${item.feed_item_id}-ln-${idx}`} className="space-y-1">
                              <p className="text-caption font-medium uppercase tracking-wide text-accent-light">
                                {getRoleLabel(line.role)}
                              </p>
                              <div className="text-body-sm text-text-primary leading-relaxed min-w-0 break-words">
                                <IdentityMarkdown content={line.text} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-body-sm text-text-primary leading-relaxed max-w-full break-words">
                            {primary}
                          </p>
                          {micro ? (
                            <p className="text-caption font-medium text-text-muted tracking-wide">{micro}</p>
                          ) : null}
                          {!betaLines ? (
                            <p className="text-caption text-text-muted">{descriptor}</p>
                          ) : null}
                        </div>
                      )}

                      {surfacingLine ? (
                        <p className="text-caption text-text-secondary leading-snug max-w-xl">{surfacingLine}</p>
                      ) : null}

                      <div
                        className="h-1 rounded-full bg-border overflow-hidden max-w-[200px]"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full bg-accent/40 rounded-full transition-[width]"
                          style={{ width: `${rankBar * 100}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push('/community?tab=connections&signals=1')}
                        >
                          Signals
                        </Button>
                        {canExpand ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpandedFeed(item)}
                            disabled={busyByFeedId[item.feed_item_id]}
                            loading={
                              busyByFeedId[item.feed_item_id] && !artifactByFeedId[item.feed_item_id]
                            }
                          >
                            {busyByFeedId[item.feed_item_id] && !artifactByFeedId[item.feed_item_id]
                              ? 'Loading…'
                              : "View today's transits"}
                          </Button>
                        ) : null}
                      </div>
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
