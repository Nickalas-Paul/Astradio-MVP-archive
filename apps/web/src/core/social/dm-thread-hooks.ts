'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';
import { peerDisplayLabel, type DmPeer } from '@/core/social/dm-hooks';

export type DmMessage = {
  id: string;
  senderId: string;
  body: string;
  audioExportId?: string | null;
  audioLabel?: string | null;
  createdAt: string;
  readAt?: string | null;
};

export type DmConversationDetail = {
  id: string;
  status: string;
  initiatedBy: string;
  peer: DmPeer | null;
};

export function useDmConversation(conversationId: string | null, currentUserId: string | null) {
  const [conversation, setConversation] = useState<DmConversationDetail | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before?: string) => {
      if (!conversationId || !currentUserId) {
        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }
      if (before) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (before) qs.set('before', before);
        const r = await fetch(
          `${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(conversationId)}?${qs}`,
          { credentials: 'same-origin', cache: 'no-store' }
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(typeof j.error === 'string' ? j.error : `Failed (${r.status})`);
          return;
        }
        const nextMessages = Array.isArray(j.messages) ? (j.messages as DmMessage[]) : [];
        if (before) {
          setMessages((prev) => [...nextMessages, ...prev]);
        } else {
          setMessages(nextMessages);
          setConversation(j.conversation as DmConversationDetail);
          void fetch(
            `${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(conversationId)}/read`,
            {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }
          );
        }
        setHasMore(Boolean(j.hasMore));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load thread');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversationId, currentUserId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadOlder = useCallback(() => {
    const oldest = messages[0];
    if (!oldest || loadingMore || !hasMore) return;
    void load(oldest.id);
  }, [messages, loadingMore, hasMore, load]);

  const appendMessage = useCallback((msg: DmMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const refreshLatest = useCallback(() => {
    void load();
  }, [load]);

  return {
    conversation,
    messages,
    hasMore,
    loading,
    loadingMore,
    error,
    loadOlder,
    appendMessage,
    refreshLatest,
    setConversation,
  };
}

export function useDmMessageStream(
  enabled: boolean,
  conversationId: string | null,
  currentUserId: string | null,
  onMessage: (payload: { conversationId?: string; messageId?: string }) => void
) {
  useEffect(() => {
    if (!enabled || !conversationId || !currentUserId || typeof EventSource === 'undefined') return;
    const es = new EventSource(`${getApiBaseUrl() || ''}/api/community/events/stream`);
    const handler = (ev: Event) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          conversationId?: string;
          messageId?: string;
          recipientUserId?: string;
        };
        if (data.recipientUserId && data.recipientUserId !== currentUserId) return;
        onMessage(data);
      } catch {
        // ignore malformed events
      }
    };
    es.addEventListener('message', handler);
    return () => {
      es.removeEventListener('message', handler);
      es.close();
    };
  }, [enabled, conversationId, currentUserId, onMessage]);
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const MESSAGE_MAX = 1000;

export async function sendDmMessage(
  conversationId: string,
  body: { body: string; audioExportId?: string; audioLabel?: string }
): Promise<{ ok: true; message: DmMessage } | { ok: false; error: string; message?: string }> {
  const r = await fetch(`${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    return {
      ok: false,
      error: typeof j.error === 'string' ? j.error : 'send_failed',
      message: typeof j.message === 'string' ? j.message : undefined,
    };
  }
  return { ok: true, message: j.message as DmMessage };
}

export { MESSAGE_MAX };
