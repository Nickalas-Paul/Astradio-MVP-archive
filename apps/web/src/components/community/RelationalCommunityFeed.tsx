'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../core/api-base';
import { useRelationalCommunityFeed, type ProfilePrimaryChart } from '../../core/social/hooks';
import { ValidatedExportAudioPlayer } from './ValidatedExportAudioPlayer';
import { finalizeRelationalReadingSurfaces } from '../../lib/relational-reading-enforcement';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';

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

function musicalParagraphFromArtifact(artifact: Record<string, unknown>): string {
  const text = artifact.text;
  if (!text || typeof text !== 'object' || Array.isArray(text)) return '';
  const mp = (text as Record<string, unknown>).musicalParagraph;
  return typeof mp === 'string' && mp.trim() ? mp.trim() : '';
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
}

export function RelationalCommunityFeed({ userId, primaryChart, className = '' }: RelationalCommunityFeedProps) {
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
      setOpenByFeedId((prev) => ({ ...prev, [feedId]: true }));
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
      setOpenByFeedId((prev) => ({ ...prev, [id]: false }));
      return;
    }
    if (artifactByFeedId[id]) {
      setOpenByFeedId((prev) => ({ ...prev, [id]: true }));
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

            return (
              <li
                key={item.feed_item_id}
                className="rounded-lg border border-border bg-surface-1 p-4 space-y-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text">{identity}</p>
                  {betaLines && cd?.enhanced_title ? (
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-text leading-snug max-w-full">
                          {cd.enhanced_title.length > 60 ? `${cd.enhanced_title.slice(0, 57)}…` : cd.enhanced_title}
                        </h4>
                        <p className="text-xs text-subtext">Today&apos;s transits shaping your connection</p>
                      </div>
                      <ul className="list-none space-y-3 pl-0 max-w-full">
                        {betaLines.map((line, idx) => (
                          <li key={`${item.feed_item_id}-ln-${idx}`} className="space-y-1">
                            <p className="text-xs font-medium text-subtext uppercase tracking-wide">
                              {getRoleLabel(line.role)}
                            </p>
                            <div className="flex items-start gap-2 text-sm text-text leading-relaxed">
                              <span className="text-subtext mt-0.5 shrink-0" aria-hidden>
                                •
                              </span>
                              <div className="min-w-0 break-words whitespace-normal">
                                <IdentityMarkdown content={line.text} />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-text leading-relaxed max-w-full break-words">{primary}</p>
                      {micro ? (
                        <p className="text-xs font-medium text-subtext tracking-wide" aria-hidden="true">
                          {micro}
                        </p>
                      ) : null}
                    </>
                  )}
                  {!betaLines ? <p className="text-xs text-subtext">{descriptor}</p> : null}
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
                      className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-50"
                      onClick={() => toggleExpandedFeed(item)}
                      disabled={busyByFeedId[item.feed_item_id] && !openByFeedId[item.feed_item_id]}
                    >
                      {busyByFeedId[item.feed_item_id] && !artifactByFeedId[item.feed_item_id]
                        ? 'Loading…'
                        : openByFeedId[item.feed_item_id]
                          ? 'Collapse'
                          : "View today's transits"}
                    </button>
                  )}
                </div>

                {openByFeedId[item.feed_item_id] && (
                  <div className="rounded border border-border/70 bg-bgElev p-4 space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-lg font-semibold text-text leading-snug">
                        {cd?.enhanced_title?.trim() || identity}
                      </h4>
                      <p className="text-sm text-subtext">Today&apos;s transit weather report</p>
                    </div>

                    {busyByFeedId[item.feed_item_id] && !artifactByFeedId[item.feed_item_id] ? (
                      <p className="text-sm text-subtext">Loading today&apos;s transits…</p>
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
                            <p className="text-xs text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded px-2 py-1">
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

                          const whatToDo = finalized.slots.whatToDo?.trim() ?? '';
                          const activationOnly = finalized.slots.activation?.trim() ?? '';
                          const musicalParagraph = musicalParagraphFromArtifact(art);
                          const audioUi = audioUiByFeedId[item.feed_item_id] ?? {
                            state: 'idle' as const,
                            exportId: null,
                            error: null,
                          };

                          return (
                            <div className="space-y-6">
                              {betaLines && betaLines.length === 3 ? (
                                <section>
                                  <h2 className="reading-section-header mb-3 first:mt-0">
                                    Today&apos;s Transit Spotlight
                                  </h2>
                                  {betaLines.map((line, idx) => (
                                    <div key={`${item.feed_item_id}-spot-${idx}`} className="space-y-2 mb-6 last:mb-0">
                                      <h3 className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                                        {getRoleLabel(line.role)}
                                      </h3>
                                      {activationLinePrefix(line) ? (
                                        <p className="text-sm text-subtext">{activationLinePrefix(line)}</p>
                                      ) : null}
                                      <IdentityMarkdown content={activationLineExpandedBody(line)} />
                                    </div>
                                  ))}
                                </section>
                              ) : activationOnly ? (
                                <section>
                                  <h2 className="reading-section-header mb-3 first:mt-0">
                                    Today&apos;s Transit Spotlight
                                  </h2>
                                  <IdentityMarkdown content={activationOnly} />
                                </section>
                              ) : null}

                              {whatToDo ? (
                                <section>
                                  <h2 className="reading-section-header mb-3">What To Do</h2>
                                  <IdentityMarkdown content={whatToDo} />
                                </section>
                              ) : null}

                              <section className="border-t border-border pt-6 space-y-3">
                                <h2 className="reading-section-header mb-3">Hear today&apos;s forecast</h2>
                                {musicalParagraph ? <IdentityMarkdown content={musicalParagraph} /> : null}
                                {audioUi.state === 'ready' && audioUi.exportId ? (
                                  <div className="space-y-3">
                                    <p className="text-sm text-subtext">Your audio forecast is ready.</p>
                                    <ValidatedExportAudioPlayer exportId={audioUi.exportId} />
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <button
                                      type="button"
                                      className="btn-audio mt-1"
                                      onClick={() => void generateFeedAudio(item)}
                                      disabled={audioUi.state === 'generating' || busyByFeedId[item.feed_item_id]}
                                    >
                                      {audioUi.state === 'generating' ? (
                                        <>
                                          <svg
                                            className="w-4 h-4 animate-spin"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            aria-hidden
                                          >
                                            <circle
                                              className="opacity-25"
                                              cx="12"
                                              cy="12"
                                              r="10"
                                              stroke="currentColor"
                                              strokeWidth="4"
                                            />
                                            <path
                                              className="opacity-75"
                                              fill="currentColor"
                                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                          </svg>
                                          Generating forecast…
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                          Generate audio forecast
                                        </>
                                      )}
                                    </button>
                                    {audioUi.state === 'error' && audioUi.error ? (
                                      <p className="text-sm text-amber-600 dark:text-amber-300" role="alert">
                                        {audioUi.error}
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </section>
                            </div>
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
                        {saveStatusByFeedId[item.feed_item_id] ? (
                          <p className="text-xs text-subtext">{saveStatusByFeedId[item.feed_item_id]}</p>
                        ) : null}
                      </>
                    ) : null}
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
