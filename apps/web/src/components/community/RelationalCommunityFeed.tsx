'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getApiBaseUrl } from '../../core/api-base';
import { useRelationalCommunityFeed, type ProfilePrimaryChart } from '../../core/social/hooks';
import { ValidatedExportAudioPlayer } from './ValidatedExportAudioPlayer';

interface RelationalCommunityFeedProps {
  userId: string | null;
  primaryChart: ProfilePrimaryChart | null;
  className?: string;
}

/**
 * Relational weather over established connections only (pairs, relational groups, campaigns).
 * Ordering is server-defined; no client-side resorting.
 */
export function RelationalCommunityFeed({ userId, primaryChart, className = '' }: RelationalCommunityFeedProps) {
  const { data, isLoading, error, refresh } = useRelationalCommunityFeed(userId, primaryChart);
  const [artifactByFeedId, setArtifactByFeedId] = useState<Record<string, Record<string, unknown>>>({});
  const [openByFeedId, setOpenByFeedId] = useState<Record<string, boolean>>({});
  const [busyByFeedId, setBusyByFeedId] = useState<Record<string, boolean>>({});
  const [saveStatusByFeedId, setSaveStatusByFeedId] = useState<Record<string, string>>({});

  const artifactText = (artifact: Record<string, unknown>): { text: string; bullets: string[] } => {
    const raw = artifact.text;
    if (typeof raw === 'string') return { text: raw, bullets: [] };
    if (!raw || typeof raw !== 'object') return { text: '', bullets: [] };
    const obj = raw as { short?: unknown; long?: unknown; bullets?: unknown };
    const short = typeof obj.short === 'string' ? obj.short : '';
    const long = typeof obj.long === 'string' ? obj.long : '';
    const bullets = Array.isArray(obj.bullets) ? obj.bullets.map((b) => String(b)) : [];
    return { text: [short, long].filter(Boolean).join('\n\n'), bullets };
  };

  if (!userId) {
    return (
      <div className={`rounded-lg border border-border bg-surface-1 p-4 text-sm text-subtext ${className}`}>
        Sign in to load your relational feed.
      </div>
    );
  }

  if (isLoading && !data) {
    return <div className={`text-subtext text-sm p-4 ${className}`}>Loading relational feed…</div>;
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200 ${className}`}>
        {error}
        <button type="button" onClick={() => refresh()} className="ml-3 underline text-emerald-600 dark:text-emerald-400">
          Retry
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];
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
      setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: 'Missing transit lock; refresh feed.' }));
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
      const weather = (j.weather && typeof j.weather === 'object' ? j.weather : null) as
        | Record<string, unknown>
        | null;
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
    const base = getApiBaseUrl();
    setBusyByFeedId((prev) => ({ ...prev, [item.feed_item_id]: true }));
    setSaveStatusByFeedId((prev) => ({ ...prev, [item.feed_item_id]: '' }));
    try {
      const payload = {
        scopeKind: item.connection_kind === 'pair' ? 'pair' : item.connection_kind === 'relational_group' ? 'group' : null,
        bindingId: item.binding_id,
        relationshipId: item.connection_kind === 'pair' ? item.binding_id : null,
        groupId: item.connection_kind === 'relational_group' ? item.binding_id : null,
        chartIdsOrdered: item.chart_ids_ordered,
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
          text: typeof artifact.text === 'string' ? artifact.text : null,
          exportJobId:
            artifact.audio && typeof artifact.audio === 'object' && typeof (artifact.audio as Record<string, unknown>).export_id === 'string'
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
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setSaveStatusByFeedId((prev) => ({
          ...prev,
          [item.feed_item_id]: j.error || `Save failed (${r.status})`,
        }));
        return;
      }
      setSaveStatusByFeedId((prev) => ({
        ...prev,
        [item.feed_item_id]: 'Saved to Library',
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
        <h3 className="text-lg font-semibold text-text">Relational weather</h3>
        <button
          type="button"
          onClick={() => refresh()}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Refresh
        </button>
      </div>
      <p className="text-xs text-subtext">
        Ranked by effective activation (weather + relational), then relational intensity, for your established connections at this moment (
        <span className="font-mono text-text/80">{data?.sort_tuple_version ?? '—'}</span>
        ). Not discovery.{' '}
        <Link href="/community?tab=connections" className="text-emerald hover:underline">
          Open Signals
        </Link>{' '}
        for structured actions.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-subtext">No established connections yet. Use Discovery to request connections or join groups.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.feed_item_id}
              className="rounded-lg border border-border bg-surface-1 p-4 space-y-1"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-text capitalize">{item.connection_kind.replace('_', ' ')}</span>
                <span className="text-subtext font-mono text-xs truncate max-w-[200px]" title={item.binding_id}>
                  {item.binding_id}
                </span>
              </div>
              <p className="text-xs text-subtext font-mono break-all">
                Charts: {item.chart_ids_ordered.join(', ')}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-subtext pt-1">
                <span>effective: {item.ranking.activation_effective.toFixed(4)}</span>
                <span>weather: {item.ranking.weather_activation_intensity.toFixed(4)}</span>
                <span>relational: {item.ranking.overall_relational_intensity.toFixed(4)}</span>
                <span>
                  artifact:{' '}
                  {item.artifactStatus === 'available'
                    ? 'available'
                    : item.artifactStatus === 'partial'
                      ? 'Artifact needs refresh'
                      : item.artifactStatus === 'failed'
                        ? 'Artifact unavailable'
                        : 'not generated'}
                </span>
                <Link
                  href="/community?tab=connections&signals=1"
                  className="text-emerald hover:underline"
                >
                  Signals
                </Link>
                {item.connection_kind !== 'campaign_group' && (
                  <button
                    type="button"
                    className="text-emerald hover:underline"
                    onClick={() => void openAndRenderArtifact(item)}
                    disabled={busyByFeedId[item.feed_item_id]}
                  >
                    {busyByFeedId[item.feed_item_id] ? 'Rendering…' : 'Open artifact'}
                  </button>
                )}
              </div>
              {openByFeedId[item.feed_item_id] && artifactByFeedId[item.feed_item_id] && (
                <div className="rounded border border-border/70 bg-bgElev p-3 space-y-2">
                  <p className="text-xs font-semibold text-text">Relational weather artifact</p>
                  {(() => {
                    const view = artifactText(artifactByFeedId[item.feed_item_id]);
                    return (
                      <>
                        <p className="text-xs text-subtext whitespace-pre-wrap">
                          {view.text || 'No text block returned.'}
                        </p>
                        {view.bullets.length > 0 && (
                          <ul className="list-disc pl-5 text-xs text-subtext space-y-1">
                            {view.bullets.map((b, idx) => (
                              <li key={`${item.feed_item_id}-b-${idx}`}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    );
                  })()}
                  <ValidatedExportAudioPlayer
                    exportId={
                      artifactByFeedId[item.feed_item_id].audio &&
                      typeof artifactByFeedId[item.feed_item_id].audio === 'object' &&
                      typeof (artifactByFeedId[item.feed_item_id].audio as Record<string, unknown>).export_id === 'string'
                        ? ((artifactByFeedId[item.feed_item_id].audio as Record<string, unknown>).export_id as string)
                        : null
                    }
                  />
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
          ))}
        </ul>
      )}
    </div>
  );
}
