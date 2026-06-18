'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';

export type DmPeer = {
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

export type DmConversationRow = {
  id: string;
  peer: DmPeer | null;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  initiatedBy: string;
  createdAt?: string;
};

export type DmRequestRow = {
  id: string;
  peer: DmPeer | null;
  status: string;
  lastMessagePreview: string | null;
  createdAt: string;
  initiatedBy: string;
};

export type DmConversationsResponse = {
  conversations: DmConversationRow[];
  requests: DmRequestRow[];
};

export function useDmConversations(enabled = true) {
  const [data, setData] = useState<DmConversationsResponse>({ conversations: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData({ conversations: [], requests: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/dm/conversations`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const j = (await r.json().catch(() => ({}))) as DmConversationsResponse & { error?: string };
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : `Failed (${r.status})`);
        setData({ conversations: [], requests: [] });
        return;
      }
      setData({
        conversations: Array.isArray(j.conversations) ? j.conversations : [],
        requests: Array.isArray(j.requests) ? j.requests : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations');
      setData({ conversations: [], requests: [] });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unreadTotal =
    data.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0) + data.requests.length;

  return { data, loading, error, refresh, unreadTotal };
}

export function formatDmRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function peerDisplayLabel(peer: DmPeer | null | undefined): string {
  if (!peer) return 'Unknown';
  if (peer.displayName?.trim()) return peer.displayName.trim();
  if (peer.handle?.trim()) return `@${peer.handle.trim()}`;
  return 'Someone';
}

/** Create or resolve a conversation with a peer; returns conversation id. */
export async function openOrCreateDmConversation(recipientUserId: string): Promise<string | null> {
  const peerId = String(recipientUserId || '').trim();
  if (!peerId) return null;
  const r = await fetch(`${getApiBaseUrl() || ''}/api/dm/conversations`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientUserId: peerId, body: '' }),
  });
  const j = (await r.json().catch(() => ({}))) as { conversationId?: string; error?: string };
  if (!r.ok) return null;
  return typeof j.conversationId === 'string' ? j.conversationId : null;
}
