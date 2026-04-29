'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../core/api-base';
import {
  useRelationalCommunityFeed,
  type ProfilePrimaryChart,
  type RelationalCommunityFeedItem,
} from '../../core/social/hooks';
import { ValidatedExportAudioPlayer } from './ValidatedExportAudioPlayer';
import { EXPANDED_READING_RENDER_ORDER, EXPANDED_SLOT_LABELS } from '../../lib/community-feed-reading-layout';
import { finalizeRelationalReadingSurfaces, type ExpandedSlotId } from '../../lib/relational-reading-enforcement';

interface RelationalCommunityFeedProps {
  userId: string | null;
  primaryChart: ProfilePrimaryChart | null;
  className?: string;
}

export function RelationalCommunityFeed({ userId, primaryChart, className = '' }: RelationalCommunityFeedProps) {
  const { data, isLoading, error, refresh } = useRelationalCommunityFeed(userId, primaryChart);
  const [artifactByFeedId, setArtifactByFeedId] = useState<Record<string, Record<string, unknown>>>({});
  const [openByFeedId, setOpenByFeedId] = useState<Record<string, boolean>>({});
  const [busyByFeedId, setBusyByFeedId] = useState<Record<string, boolean>>({});
  const [saveStatusByFeedId, setSaveStatusByFeedId] = useState<Record<string, string>>({});

  if (!userId) {
    return (
      <div className={`rounded-lg border border-border bg-surface-1 p-4 text-sm text-subtext ${className}`}>
        Sign in to load the feed.
      </div>
    );
  }

  if (isLoading && !data) {
    return <div className={`text-subtext text-sm p-4 ${className}`}>Loading feed…</div>;
  }

  if (error) {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200 ${className}`}
      >
        {error}
        <button type="button" onClick={() => refresh()} className="ml-3 underline text-emerald-600 dark:text-emerald-400">
          Retry
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];
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
  const transitLock = (data?.transit_lock ?? {}) as {
    ts?: string;
    lat?: number;
    lon?: number;
    tz?: string;
  };

  const openAndRenderArtifact = async (item: (typeof items)[number]) => {
    if (item.connection_kind === 'campaign_group') return;
    const base = getApiBaseUrl();
    const transitDatetime = String(transitLock.ts || '').trim();
    const lat = Number(transitLock.lat);
    const lon = Number(transitLock.lon);
    const timezone = String(transitLock.tz || 'UTC').trim();
    if (!transitDatetime || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: 'Refresh the feed and try again.' }));
      return;
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
    });
    setBusyByFeedId((prev) => ({ ...prev, [item.feed_item_id]: true }));
    setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: '' }));
    try {
      const r = await fetch(`${base || ''}${scopePath}?${qs.toString()}`, {
        credentials: 'same-origin',
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        const msg = typeof j.error === 'string' ? j.error : `Render failed (${r.status})`;
        setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: msg }));
        return;
      }
      const artifact = (j.artifact && typeof j.artifact === 'object' ? j.artifact : null) as
        | Record<string, unknown>
        | null;
      const weather = (j.weather && typeof j.weather === 'object' ? j.weather : null) as Record<string, unknown> | null;
      setArtifactByFeedId((prev) => ({
        ...prev,
        [item.feed_item_id]: {
          ...(artifact || {}),
          weather,
          dailyArtifactIdentity:
            j && typeof j === 'object' && j.artifact && typeof j.artifact === 'object'
              ? (j.artifact as Record<string, unknown>).dailyArtifactIdentity
              : null,
        },
      }));
      setOpenByFeedId((prev) => ({ ...prev, [item.feed_item_id]: true }));
      await refresh();
    } catch (e) {
      setSaveStatusByFeedId((prev) => ({
        ...prev,
        [item.feed_item_id]: e instanceof Error ? e.message : 'Render failed',
      }));
    } finally {
      setBusyByFeedId((prev) => ({ ...prev, [item.feed_item_id]: false }));
    }
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-text">Feed</h3>
          <p className="text-xs text-subtext mt-0.5">Live Transit Feed</p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Refresh
        </button>
      </div>
      <p className="text-xs text-subtext max-w-2xl">
        Connections ranked by how active they are for you right now.{' '}
        <Link href="/community?tab=connections" className="text-emerald hover:underline">
          Open Signals
        </Link>{' '}
        for structured actions.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-subtext">No established connections yet. Use Discovery to request connections or join groups.</p>
      ) : (
        <ul className="space-y-3">
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
            const primary = row?.primary_line ?? 'This connection is active in your feed for this moment.';
            const micro = row?.micro_tag ?? '';
            const descriptor = row?.activation_descriptor ?? 'Active between you';
            const rankBar = Math.max(0, Math.min(1, item.ranking?.activation_effective ?? 0));
            const surfacingLine = row?.surfacing_explanation ?? null;

            return (
              <li
                key={item.feed_item_id}
                className="rounded-lg border border-border bg-surface-1 p-4 space-y-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text">{identity}</p>
                  <p className="text-sm text-text leading-snug">{primary}</p>
                  {micro ? (
                    <p className="text-xs font-medium text-subtext tracking-wide" aria-hidden="true">
                      {micro}
                    </p>
                  ) : null}
                  <p className="text-xs text-subtext">{descriptor}</p>
                  {surfacingLine ? (
                    <p className="text-xs text-text/90 leading-snug max-w-xl">{surfacingLine}</p>
                  ) : null}
                  <div
                    className="h-1 rounded-full bg-border overflow-hidden max-w-[200px]"
                    aria-hidden="true"
                    title=""
                  >
                    <div
                      className="h-full bg-emerald/50 rounded-full transition-[width]"
                      style={{ width: `${rankBar * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs items-center pt-1 border-t border-border/50">
                  <Link
                    href="/community?tab=connections&signals=1"
                    className="text-emerald hover:underline font-medium"
                  >
                    Signals
                  </Link>
                  {item.connection_kind !== 'campaign_group' && (
                    <button
                      type="button"
                      className="text-emerald hover:underline font-medium disabled:opacity-50"
                      onClick={() => void openAndRenderArtifact(item)}
                      disabled={busyByFeedId[item.feed_item_id]}
                    >
                      {busyByFeedId[item.feed_item_id] ? 'Opening…' : 'Open'}
                    </button>
                  )}
                </div>

                {openByFeedId[item.feed_item_id] && artifactByFeedId[item.feed_item_id] && (
                  <div className="rounded border border-border/70 bg-bgElev p-3 space-y-3">
                    <p className="text-xs font-semibold text-text">Connection reading</p>
                    {(() => {
                      const freshness =
                        artifactByFeedId[item.feed_item_id].freshness &&
                        typeof artifactByFeedId[item.feed_item_id].freshness === 'object'
                          ? (artifactByFeedId[item.feed_item_id].freshness as Record<string, unknown>)
                          : null;
                      const isHistorical = freshness?.isHistorical === true;
                      if (!isHistorical) return null;
                      return (
                        <p className="text-xs text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded px-2 py-1">
                          Historical saved reading. Generated with an earlier expression version. Open again to refresh
                          this connection.
                        </p>
                      );
                    })()}
                    {(() => {
                      const art = artifactByFeedId[item.feed_item_id];
                      const finalized = finalizeRelationalReadingSurfaces({
                        kind: 'expanded_artifact',
                        artifact: art,
                        weather:
                          art.weather && typeof art.weather === 'object' ? art.weather : undefined,
                      });
                      const slots =
                        finalized.kind === 'expanded_artifact'
                          ? finalized.slots
                          : ({ summary: '', support: '', tension: '', activation: '', whatToDo: '', audio: '' } as Record<
                              ExpandedSlotId,
                              string
                            >);
                      return (
                        <div className="space-y-4">
                          {EXPANDED_READING_RENDER_ORDER.map((slot) => {
                            const body = slots[slot];
                            if (!body?.trim()) return null;
                            return (
                              <section key={slot} className="space-y-1">
                                <h4 className="text-xs font-semibold text-text uppercase tracking-wide">
                                  {EXPANDED_SLOT_LABELS[slot]}
                                </h4>
                                <p className="text-xs text-text whitespace-pre-wrap leading-relaxed">{body}</p>
                              </section>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <ValidatedExportAudioPlayer
                      exportId={
                        artifactByFeedId[item.feed_item_id].audio &&
                        typeof artifactByFeedId[item.feed_item_id].audio === 'object' &&
                        typeof (artifactByFeedId[item.feed_item_id].audio as Record<string, unknown>).export_id ===
                        'string'
                          ? ((artifactByFeedId[item.feed_item_id].audio as Record<string, unknown>).export_id as string)
                          : null
                      }
                    />
                    {(() => {
                      const audio = artifactByFeedId[item.feed_item_id].audio;
                      if (!audio || typeof audio !== 'object') return null;
                      const a = audio as Record<string, unknown>;
                      const ex = typeof a.export_error === 'string' && a.export_error.trim() ? a.export_error.trim() : '';
                      const exId = typeof a.export_id === 'string' ? a.export_id.trim() : '';
                      if (!ex || exId) return null;
                      return (
                        <p className="text-sm text-amber-600 dark:text-amber-300" role="status">
                          Audio file was not stored for playback: {ex}. Inline generation may still have succeeded; refresh
                          after storage is available.
                        </p>
                      );
                    })()}
                    {item.connection_kind !== 'campaign_group' && (
                      <button
                        type="button"
                        className="px-2 py-1 rounded border border-border text-xs text-emerald hover:bg-bgElev disabled:opacity-50"
                        onClick={() => void saveArtifact(item)}
                        disabled={busyByFeedId[item.feed_item_id]}
                      >
                        {busyByFeedId[item.feed_item_id] ? 'Saving…' : 'Save to Library'}
                      </button>
                    )}
                    {saveStatusByFeedId[item.feed_item_id] && (
                      <p className="text-xs text-subtext">{saveStatusByFeedId[item.feed_item_id]}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
