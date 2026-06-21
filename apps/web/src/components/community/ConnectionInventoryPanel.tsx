'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '../../core/api-base';
import { FOUNDER_USER_ID } from '../../core/founder-config';
import { useCommunityInventory, type CommunityInventoryV1 } from '../../core/social/hooks';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { MessagePeerButton } from '@/components/community/messages/MessagePeerButton';
import { ConnectionOverflowMenu } from '@/components/community/ConnectionOverflowMenu';
import { PeerBigThreeGlyphs } from '@/components/community/PeerBigThreeGlyphs';
import type { PeerBigThreeSigns } from '@/lib/sign-glyph-utils';

import { PeerAvatar } from '@/components/community/PeerAvatar';
/** Inventory is conservative: export id does not mean playable audio. */
function inventoryArtifactStatusCopy(status: string) {
  if (status === 'audio_available') return 'Reading available · sound record on file';
  if (status === 'text_available') return 'Reading available';
  return 'Reading not composed';
}

type Props = {
  currentUserId: string | null;
  /** Viewer's primary chart ID for /listen deep links. */
  viewerChartId?: string | null;
  /** Increment from parent after connection/group actions to pull latest inventory without remounting. */
  refreshSignal?: number;
  /** Report inventory load/empty state for unified zero-state coordination. */
  onMetaChange?: (meta: { loading: boolean; empty: boolean }) => void;
};

export function isInventoryCoreEmpty(data: CommunityInventoryV1): boolean {
  const pending =
    (data.pendingIncomingIntents?.length ?? 0) > 0 ||
    (data.pendingOutgoingIntents?.length ?? 0) > 0 ||
    (data.pendingRelationalGroupInvites?.length ?? 0) > 0;
  if (pending) return false;
  return (
    (data.pairs?.length ?? 0) === 0 &&
    (data.relationalGroups?.length ?? 0) === 0 &&
    (data.campaigns?.length ?? 0) === 0
  );
}

export function ConnectionsUnifiedEmpty({ onSwitchToDiscovery }: { onSwitchToDiscovery: () => void }) {
  return (
    <Card size="lg" className="text-center space-y-4 max-w-lg mx-auto">
      <p className="text-h3 font-serif text-text-primary">No connections yet</p>
      <p className="text-body-sm text-text-secondary">
        Connections form when you explore compatibility with someone. Start in Discovery, or hear what any two
        charts sound like together.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onSwitchToDiscovery}>
          Explore Discovery
        </Button>
        <Link href="/listen">
          <Button type="button" variant="ghost" size="sm">
            Hear a connection
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function viewerChartIdFromPair(pair: Record<string, unknown>, peerChartId: string | null): string | null {
  const low = typeof pair.chartIdLow === 'string' ? pair.chartIdLow.trim() : '';
  const high = typeof pair.chartIdHigh === 'string' ? pair.chartIdHigh.trim() : '';
  const peer = peerChartId?.trim() || '';
  if (!low || !high) return null;
  if (peer === low) return high;
  if (peer === high) return low;
  return null;
}

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

  if (err) return <p className="text-xs text-warning">{err}</p>;
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

export function ConnectionInventoryPanel({
  currentUserId,
  viewerChartId,
  refreshSignal,
  onMetaChange,
}: Props) {
  const router = useRouter();
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

  useEffect(() => {
    if (!onMetaChange) return;
    if (loading) {
      onMetaChange({ loading: true, empty: true });
      return;
    }
    onMetaChange({
      loading: false,
      empty: data ? isInventoryCoreEmpty(data as CommunityInventoryV1) : true,
    });
  }, [loading, data, onMetaChange]);

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
      <Card className="space-y-2">
        <h3 className="text-lg font-semibold text-text-primary">Connections</h3>
        <p className="text-sm text-text-secondary">Sign in to see your saved connections and requests.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
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
      {error && <p className="text-sm text-danger">{error}</p>}

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
                  <Card
                    as="li"
                    key={String(inv.id)}
                    elevation="raised"
                    padding="p-3"
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-sm text-text-primary">
                      {typeof inv.groupName === 'string' && inv.groupName.trim()
                        ? inv.groupName.trim()
                        : 'Group invite'}
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
                  </Card>
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
                  <Card
                    as="li"
                    key={String(intent.id)}
                    elevation="raised"
                    padding="p-3"
                    className="flex flex-wrap items-center justify-between gap-2"
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
                  </Card>
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
                {(data as CommunityInventoryV1).pairs.map((p: Record<string, unknown>) => {
                  const peerDisplayName = (p.peerDisplayName as string) || 'Connection';
                  return (
                  <Card
                    as="li"
                    key={String(p.id)}
                    elevation="raised"
                    interactive
                    className="space-y-2"
                  >
                    <div className="flex items-start gap-3">
                      <PeerAvatar
                        peerUserId={typeof p.peerUserId === 'string' ? p.peerUserId : null}
                        displayName={peerDisplayName}
                      />
                      <div className="flex flex-1 flex-wrap items-start justify-between gap-2 min-w-0">
                        <div className="text-sm font-medium text-text-primary flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="inline-flex flex-wrap items-center gap-x-1">
                            {peerDisplayName}{' '}
                            {(p.peerHandle as string) ? (
                              <span className="text-text-secondary font-normal">@{p.peerHandle as string}</span>
                            ) : null}
                            <PeerBigThreeGlyphs bigThree={p.peerBigThree as PeerBigThreeSigns | undefined} />
                          </span>
                          {p.label ? (
                            <span className="text-xs bg-accent/10 text-accent rounded-full px-2 py-0.5 font-medium">
                              {String(p.label)}
                            </span>
                          ) : null}
                          {FOUNDER_USER_ID &&
                          typeof p.peerUserId === 'string' &&
                          p.peerUserId.trim() === FOUNDER_USER_ID ? (
                            <span className="text-[10px] uppercase tracking-wide text-text-secondary/80 font-normal px-1.5 py-0.5 rounded-full border border-border/60">
                              Founder
                            </span>
                          ) : null}
                        </div>
                        {typeof p.peerUserId === 'string' && p.peerUserId.trim() ? (
                          <ConnectionOverflowMenu
                            relationshipId={String(p.id)}
                            peerDisplayName={peerDisplayName}
                            peerUserId={String(p.peerUserId)}
                            onActionComplete={() => refresh()}
                          />
                        ) : null}
                      </div>
                    </div>
                    {(() => {
                      const status = String(p.artifactStatus || 'not_generated');
                      const readingAvailable =
                        status === 'text_available' ||
                        status === 'audio_available' ||
                        status === 'available';
                      if (!readingAvailable) return null;
                      return (
                        <p className="flex items-center gap-1.5">
                          {status === 'audio_available' ? (
                            <svg
                              className="w-3.5 h-3.5 text-accent shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-2c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                              />
                            </svg>
                          ) : null}
                          <span className="text-xs text-accent">Reading available</span>
                        </p>
                      );
                    })()}
                    <div className="flex flex-wrap gap-2 pt-1 items-center">
                      <Link
                        href={`/community/relationship/${encodeURIComponent(String(p.id))}`}
                        className="btn-outline text-xs px-3 py-2 min-h-[44px] inline-flex items-center justify-center w-full sm:w-auto"
                      >
                        Open connection
                      </Link>
                      {typeof p.peerUserId === 'string' && p.peerUserId.trim() ? (
                        <MessagePeerButton peerUserId={String(p.peerUserId)} iconOnly />
                      ) : null}
                      {(() => {
                        const peerChartId =
                          typeof p.peerChartId === 'string' && p.peerChartId.trim() ? p.peerChartId.trim() : null;
                        const chartA =
                          viewerChartId?.trim() ||
                          viewerChartIdFromPair(p, peerChartId);
                        if (!chartA || !peerChartId) return null;
                        return (
                          <Button
                            type="button"
                            variant="audio"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => {
                              router.push(
                                `/listen?chartA=${encodeURIComponent(chartA)}&chartB=${encodeURIComponent(peerChartId)}&relationshipId=${encodeURIComponent(String(p.id))}`
                              );
                            }}
                          >
                            Hear this connection
                          </Button>
                        );
                      })()}
                    </div>
                    {/* PairWeatherPreview removed for beta - theme tags need humanized display */}
                  </Card>
                  );
                })}
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
                    <Card
                      as="li"
                      key={String(g.id)}
                      elevation="raised"
                      interactive
                      className="text-sm text-text-primary space-y-2"
                    >
                      <div>{String(g.name)}</div>
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
                    </Card>
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
                  <Card
                    as="li"
                    key={String(c.campaignId)}
                    elevation="raised"
                    padding="p-3"
                    className="text-sm text-text-primary"
                  >
                    {typeof c.title === 'string' && c.title.trim()
                      ? c.title.trim()
                      : typeof c.mode === 'string' && c.mode.trim()
                        ? `${c.mode.trim().charAt(0).toUpperCase()}${c.mode.trim().slice(1).toLowerCase()} campaign`
                        : 'Campaign'}
                  </Card>
                ))}
              </ul>
            )}
          </section>

          {process.env.NODE_ENV === 'development' &&
            (data as CommunityInventoryV1).feedSkeleton?.length > 0 && (
            <section className="rounded-lg border border-dashed border-border p-3 space-y-1">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Transits skeleton (no ranking)</h4>
              <p className="text-xs text-text-secondary">
                {(data as CommunityInventoryV1).feedSkeleton.length} item(s), deterministic sort keys for future FYP.
              </p>
            </section>
            )}
        </>
      )}
    </Card>
  );
}
