'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '../../core/api-base';
import { useCommunityInventory, type CommunityInventoryV1 } from '../../core/social/hooks';
import { Button } from '@/components/shared/Button';

/** Inventory is conservative: export id does not mean playable audio. */
function inventoryArtifactStatusCopy(status: string) {
  if (status === 'audio_available') return 'Reading available · sound record on file';
  if (status === 'text_available') return 'Reading available';
  return 'Reading not generated';
}

type Props = {
  currentUserId: string | null;
  /** Increment from parent after connection/group actions to pull latest inventory without remounting. */
  refreshSignal?: number;
};

function PairWeatherPreview({
  relationshipId,
  userId,
}: {
  relationshipId: string;
  userId: string;
}) {
  const [feedItem, setFeedItem] = useState<{ weather?: { stateHash?: string; themes?: string[] } } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!relationshipId || !userId) return;
    const ac = new AbortController();
    const qs = new URLSearchParams({
      transitDatetime: new Date().toISOString(),
      transitLatitude: '0',
      transitLongitude: '0',
      transitTimezone: 'UTC',
      userId,
    });
    fetch(`${getApiBaseUrl() || ''}/api/relationships/${encodeURIComponent(relationshipId)}/forecast?${qs}`, {
      credentials: 'same-origin',
      signal: ac.signal,
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErr(typeof j.error === 'string' ? j.error : `forecast ${r.status}`);
          return;
        }
        setFeedItem(j.feedItem ? { weather: (j.feedItem as { weather?: { stateHash?: string; themes?: string[] } }).weather } : null);
      })
      .catch(() => setErr('forecast failed'));
    return () => ac.abort();
  }, [relationshipId, userId]);

  if (err) return <p className="text-xs text-amber-600 dark:text-amber-400">{err}</p>;
  if (!feedItem?.weather) return <p className="text-xs text-text-secondary">Loading weather…</p>;
  const w = feedItem.weather;
  if (process.env.NODE_ENV !== 'development') {
    if (!w.themes?.length) return null;
    return <p className="text-xs text-text-secondary">{w.themes.slice(0, 3).join(', ')}</p>;
  }
  return (
    <p className="text-xs text-text-secondary font-mono">
      Weather: {(w.stateHash || '').slice(0, 12)}…
      {w.themes && w.themes.length > 0 ? ` · ${w.themes.slice(0, 3).join(', ')}` : null}
    </p>
  );
}

export function ConnectionInventoryPanel({ currentUserId, refreshSignal }: Props) {
  const { data, loading, error, refresh } = useCommunityInventory();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [acceptGroup, setAcceptGroup] = useState<string | null>(null);

  useEffect(() => {
    if (refreshSignal != null && refreshSignal > 0) {
      void refresh();
    }
  }, [refreshSignal, refresh]);

  const acceptIntent = async (intentId: string) => {
    setAccepting(intentId);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/connection-intents/${encodeURIComponent(intentId)}/accept`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.error('accept failed', j);
      }
      await refresh();
    } finally {
      setAccepting(null);
    }
  };

  const declineIntent = async (intentId: string) => {
    setDeclining(intentId);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/connection-intents/${encodeURIComponent(intentId)}/decline`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.error('decline failed', j);
      }
      await refresh();
    } finally {
      setDeclining(null);
    }
  };

  const cancelIntent = async (intentId: string) => {
    setCancelling(intentId);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/connection-intents/${encodeURIComponent(intentId)}/cancel`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.error('cancel failed', j);
      }
      await refresh();
    } finally {
      setCancelling(null);
    }
  };

  const acceptGroupInvite = async (groupId: string, inviteId: string) => {
    const key = `${groupId}:${inviteId}`;
    setAcceptGroup(key);
    try {
      const r = await fetch(
        `${getApiBaseUrl() || ''}/api/groups/${encodeURIComponent(groupId)}/invites/${encodeURIComponent(inviteId)}/accept`,
        { method: 'POST', credentials: 'same-origin' }
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.error('group invite accept failed', j);
      }
      await refresh();
    } finally {
      setAcceptGroup(null);
    }
  };

  if (!currentUserId) {
    return (
      <div className="card space-y-2">
        <h3 className="text-lg font-semibold text-text-primary">Connections</h3>
        <p className="text-sm text-text-secondary">Sign in to see your saved connections and requests.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Connections</h3>
          <p className="text-sm text-text-secondary">
            Accepted one-to-one links, relational chart groups, and campaigns. Discovery matches stay in Discovery until you request and accept a
            connection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="px-3 py-1.5 rounded-lg text-sm bg-bgElev text-text-secondary border border-border hover:text-text-primary"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-text-secondary">Loading inventory…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && (
        <>
          {(data as CommunityInventoryV1).pendingIncomingIntents?.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-text-primary">Incoming requests</h4>
              <ul className="space-y-2">
                {(data as CommunityInventoryV1).pendingIncomingIntents.map((intent: Record<string, unknown>) => {
                  const fromDisplayName =
                    typeof intent.fromDisplayName === 'string' && intent.fromDisplayName.trim()
                      ? intent.fromDisplayName.trim()
                      : typeof intent.from_display_name === 'string' && intent.from_display_name.trim()
                        ? intent.from_display_name.trim()
                        : null;
                  const kindRaw = intent.relationshipKind ?? intent.relationship_kind;
                  const kindLabel =
                    typeof kindRaw === 'string' && kindRaw.trim()
                      ? kindRaw.trim().charAt(0).toUpperCase() + kindRaw.trim().slice(1).toLowerCase()
                      : null;
                  return (
                  <li
                    key={String(intent.id)}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5"
                  >
                    <span className="text-sm text-text-primary">
                      {fromDisplayName ?? 'Unknown user'}
                      {kindLabel ? (
                        <span className="ml-2 text-xs text-text-secondary">· {kindLabel}</span>
                      ) : null}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={accepting === intent.id}
                        loading={accepting === intent.id}
                        onClick={() => acceptIntent(String(intent.id))}
                      >
                        Accept
                      </Button>
                      <button
                        type="button"
                        disabled={declining === intent.id}
                        onClick={() => declineIntent(String(intent.id))}
                        className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                      >
                        {declining === intent.id ? '…' : 'Decline'}
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(data as CommunityInventoryV1).pendingRelationalGroupInvites?.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-text-primary">Group invites</h4>
              <ul className="space-y-2">
                {(data as CommunityInventoryV1).pendingRelationalGroupInvites.map((inv: Record<string, unknown>) => (
                  <li
                    key={String(inv.id)}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-bgElev"
                  >
                    <span className="text-sm text-text-secondary">
                      Group <span className="font-mono text-xs">{String(inv.groupId).slice(-10)}</span>
                    </span>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={acceptGroup === `${inv.groupId}:${inv.id}`}
                      loading={acceptGroup === `${inv.groupId}:${inv.id}`}
                      onClick={() => acceptGroupInvite(String(inv.groupId), String(inv.id))}
                    >
                      Accept invite
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(data as CommunityInventoryV1).pendingOutgoingIntents?.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-text-primary">Outgoing requests</h4>
              <ul className="space-y-2">
                {(data as CommunityInventoryV1).pendingOutgoingIntents.map((intent: Record<string, unknown>) => {
                  const toDisplayName =
                    typeof intent.toDisplayName === 'string' && intent.toDisplayName.trim()
                      ? intent.toDisplayName.trim()
                      : typeof intent.to_display_name === 'string' && intent.to_display_name.trim()
                        ? intent.to_display_name.trim()
                        : null;
                  const kindRaw = intent.relationshipKind ?? intent.relationship_kind;
                  const kindLabel =
                    typeof kindRaw === 'string' && kindRaw.trim()
                      ? kindRaw.trim().charAt(0).toUpperCase() + kindRaw.trim().slice(1).toLowerCase()
                      : null;
                  return (
                  <li
                    key={String(intent.id)}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-bgElev"
                  >
                    <span className="text-sm text-text-primary">
                      {toDisplayName ?? 'Unknown user'}
                      {kindLabel ? (
                        <span className="ml-2 text-xs text-text-secondary">· {kindLabel}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={cancelling === intent.id}
                      onClick={() => cancelIntent(String(intent.id))}
                      className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-50"
                    >
                      {cancelling === intent.id ? '…' : 'Cancel'}
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-text-primary">One-to-one</h4>
            {(data as CommunityInventoryV1).pairs?.length === 0 ? (
              <p className="text-sm text-text-secondary">No saved pair connections yet.</p>
            ) : (
              <ul className="space-y-3">
                {(data as CommunityInventoryV1).pairs.map((p: Record<string, unknown>) => (
                  <li
                    key={String(p.id)}
                    className="card-interactive p-4 rounded-lg border border-border bg-bgElev space-y-2"
                  >
                    <div className="text-sm font-medium text-text-primary">
                      {(p.peerDisplayName as string) || 'Connection'}{' '}
                      {(p.peerHandle as string) ? (
                        <span className="text-text-secondary font-normal">@{p.peerHandle as string}</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-text-secondary">Label: {String(p.label || '')}</p>
                    <p className="text-xs text-text-secondary">
                      Artifacts:{' '}
                      <span className="text-text-primary">{inventoryArtifactStatusCopy(String(p.artifactStatus || 'not_generated'))}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        href={`/community/relationship/${encodeURIComponent(String(p.id))}`}
                        className="btn-outline text-xs px-3 py-2 min-h-[44px] inline-flex items-center justify-center w-full sm:w-auto"
                      >
                        Open connection
                      </Link>
                    </div>
                    {currentUserId && <PairWeatherPreview relationshipId={String(p.id)} userId={currentUserId} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-text-primary">Relational groups (charts)</h4>
            {(data as CommunityInventoryV1).relationalGroups?.length === 0 ? (
              <p className="text-sm text-text-secondary">None yet. Use Discovery to create a group from selected people.</p>
            ) : (
              <ul className="space-y-2">
                {(data as CommunityInventoryV1).relationalGroups.map((g: Record<string, unknown>) => {
                  const gSlug = (g.slug as string | undefined) || (g.id as string);
                  return (
                    <li
                      key={String(g.id)}
                      className="card-interactive p-4 rounded-lg border border-border bg-bgElev text-sm text-text-primary space-y-2"
                    >
                      <div>
                        {String(g.name)}{' '}
                        <span className="text-xs text-text-secondary font-mono">({String(g.id).slice(-8)})</span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        Artifacts:{' '}
                        <span className="text-text-primary">{inventoryArtifactStatusCopy(String(g.artifactStatus || 'not_generated'))}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/community/group/${encodeURIComponent(gSlug)}`}
                          className="btn-outline text-xs px-3 py-2 min-h-[44px] inline-flex items-center justify-center w-full sm:w-auto"
                        >
                          Open group
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-text-primary">Campaigns</h4>
            {(data as CommunityInventoryV1).campaigns?.length === 0 ? (
              <p className="text-sm text-text-secondary">No campaigns linked to you yet.</p>
            ) : (
              <ul className="space-y-2">
                {(data as CommunityInventoryV1).campaigns.map((c: Record<string, unknown>) => (
                  <li key={String(c.campaignId)} className="p-3 rounded-lg border border-border bg-bgElev text-sm">
                    <span className="text-text-primary">{String(c.mode)}</span>{' '}
                    <span className="text-xs text-text-secondary font-mono">{String(c.campaignId).slice(-12)}</span>
                    {c.groupId ? <span className="text-xs text-text-secondary block mt-1">Group: {String(c.groupId)}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {process.env.NODE_ENV === 'development' &&
            (data as CommunityInventoryV1).feedSkeleton?.length > 0 && (
            <section className="rounded-lg border border-dashed border-border p-3 space-y-1">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Feed skeleton (no ranking)</h4>
              <p className="text-xs text-text-secondary">
                {(data as CommunityInventoryV1).feedSkeleton.length} item(s) — deterministic sort keys for future FYP.
              </p>
            </section>
            )}
        </>
      )}
    </div>
  );
}
