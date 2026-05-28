'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '../../core/api-base';
import { useCommunityInventory, type CommunityInventoryV1 } from '../../core/social/hooks';
import type { RelationalIntent } from '../../lib/relational-intent';
import { trackFeatureUse } from '../../core/telemetry';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

export interface CommunitySearchUser {
  userId: string;
  displayName: string;
  handle?: string;
  chartId: string;
  bio?: string;
  avatarUrl?: string;
  chartHighlights?: string[];
  discoverableAs?: string;
}

interface DiscoveryUserSearchProps {
  currentUserId: string | null;
  seekerChartId: string | null;
  intent: RelationalIntent;
  onConnectionRequested?: () => void;
  inventoryRefreshSignal?: number;
}

function pendingOutgoingForUser(
  inventory: CommunityInventoryV1 | null,
  peerUserId: string,
  peerChartId: string,
  relationshipKind: RelationalIntent
): boolean {
  const list = inventory?.pendingOutgoingIntents;
  if (!list?.length) return false;
  return list.some((raw) => {
    const i = raw as Record<string, unknown>;
    const toUid = String(i.toUserId ?? i.to_user_id ?? '');
    const toCid = String(i.toChartId ?? i.to_chart_id ?? '');
    const rk = String(i.relationshipKind ?? i.relationship_kind ?? 'friend') as RelationalIntent;
    return toUid === peerUserId && toCid === peerChartId && rk === relationshipKind;
  });
}

function profilePath(user: CommunitySearchUser): string {
  const slug = (user.handle || user.userId).trim();
  return `/profile/${encodeURIComponent(slug)}`;
}

function avatarInitial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export function DiscoveryUserSearch({
  currentUserId,
  seekerChartId,
  intent,
  onConnectionRequested,
  inventoryRefreshSignal,
}: DiscoveryUserSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [users, setUsers] = useState<CommunitySearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const { data: inventory, refresh: refreshInventory } = useCommunityInventory();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (inventoryRefreshSignal != null && inventoryRefreshSignal > 0) {
      void refreshInventory();
    }
  }, [inventoryRefreshSignal, refreshInventory]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `${getApiBaseUrl() || ''}/api/community/search?${new URLSearchParams({ q }).toString()}`,
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) {
        setUsers([]);
        return;
      }
      const data = await r.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const handleRequestConnection = async (user: CommunitySearchUser) => {
    if (!seekerChartId || !currentUserId) {
      setRequestMsg('Sign in and add your natal chart to request a connection.');
      return;
    }
    if (pendingOutgoingForUser(inventory, user.userId, user.chartId, intent)) {
      return;
    }
    setRequestBusy(user.chartId);
    setRequestMsg(null);
    try {
      trackFeatureUse('compatibility', 'connection_request');
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/connect-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          toUserId: user.userId,
          fromChartId: seekerChartId,
          toChartId: user.chartId,
          relationshipKind: intent,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRequestMsg(typeof j.error === 'string' ? j.error : `Request failed (${r.status})`);
        return;
      }
      await refreshInventory();
      onConnectionRequested?.();
      setRequestMsg('Request sent');
    } catch (e) {
      setRequestMsg(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRequestBusy(null);
    }
  };

  const showResults = debouncedQuery.length >= 2;

  return (
    <section className="space-y-3 pb-6 border-b border-border/50" aria-label="User search">
      <div>
        <h3 className="text-body font-medium text-text-secondary">Find someone specific</h3>
        <p className="text-caption text-text-muted mt-1">Search by display name or handle</p>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name..."
        className="input w-full max-w-md"
        aria-label="Search users by name"
        autoComplete="off"
      />
      {requestMsg ? (
        <p className="text-body-sm text-text-secondary rounded-lg border border-border/60 bg-bgElev/50 px-3 py-2">
          {requestMsg}
        </p>
      ) : null}
      {showResults ? (
        <div className="space-y-3">
          {loading ? (
            <p className="text-body-sm text-text-muted">Searching…</p>
          ) : users.length === 0 ? (
            <p className="text-body-sm text-text-muted">No users found for &apos;{debouncedQuery}&apos;</p>
          ) : (
            <ul className="space-y-3">
              {users.map((user) => {
                const pending = pendingOutgoingForUser(inventory, user.userId, user.chartId, intent);
                const busy = requestBusy === user.chartId;
                const initial = avatarInitial(user.displayName);
                return (
                  <li key={user.userId}>
                    <Card elevation="resting" padding="p-4" className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatarUrl}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <span
                            className="w-11 h-11 rounded-full shrink-0 border border-border bg-surface-2 flex items-center justify-center font-serif text-h4 text-text-primary"
                            aria-hidden
                          >
                            {initial}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-serif text-h4 font-semibold text-text-primary truncate">
                            {user.displayName}
                          </p>
                          {user.bio ? (
                            <p className="text-body-sm text-text-muted line-clamp-1 mt-0.5">{user.bio}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Link
                          href={profilePath(user)}
                          className="btn-secondary inline-flex items-center justify-center text-center text-sm min-h-[44px] px-4 py-2"
                        >
                          View profile
                        </Link>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={!seekerChartId || !currentUserId || pending || busy}
                          loading={busy}
                          onClick={() => void handleRequestConnection(user)}
                        >
                          {pending ? 'Request pending' : 'Request connection'}
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
