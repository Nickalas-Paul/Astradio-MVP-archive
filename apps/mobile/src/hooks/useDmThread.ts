import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchThread,
  markRead,
  sendMessage as sendMessageApi,
} from '../lib/community-messages-fetch';
import { formatApiError } from '../lib/format-api-error';
import { useAuthStore } from '../store/auth';
import type { DmConversationDetail, DmMessage } from '../types/community-messages';

const POLL_MS = 10_000;

export function useDmThread(conversationId: string | null, enabled = true) {
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [conversation, setConversation] = useState<DmConversationDetail | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestIdRef = useRef<string | null>(null);

  const load = useCallback(
    async (before?: string) => {
      if (!conversationId || !authUserId || !enabled) {
        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      if (before) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await fetchThread(conversationId, authUserId, before);
        if (before) {
          setMessages((prev) => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
          setConversation(data.conversation);
          latestIdRef.current = data.messages[data.messages.length - 1]?.id ?? null;
          markRead(conversationId, authUserId);
        }
        setHasMore(data.hasMore);
      } catch (err) {
        setError(formatApiError(err, 'Could not load conversation'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [authUserId, conversationId, enabled]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const pollLatest = useCallback(async () => {
    if (!conversationId || !authUserId || !enabled) return;
    try {
      const data = await fetchThread(conversationId, authUserId);
      const latest = data.messages[data.messages.length - 1];
      if (!latest) return;
      if (latestIdRef.current && latest.id === latestIdRef.current) return;

      setMessages(data.messages);
      setConversation(data.conversation);
      setHasMore(data.hasMore);
      latestIdRef.current = latest.id;
      markRead(conversationId, authUserId);
    } catch {
      // polling is best-effort
    }
  }, [authUserId, conversationId, enabled]);

  useEffect(() => {
    if (!enabled || !conversationId || !authUserId) return;
    const interval = setInterval(() => {
      void pollLatest();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, conversationId, authUserId, pollLatest]);

  const loadOlder = useCallback(() => {
    const oldest = messages[0];
    if (!oldest || loadingMore || !hasMore) return;
    void load(oldest.id);
  }, [hasMore, load, loadingMore, messages]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!conversationId || !authUserId) throw new Error('not_authenticated');
      const result = await sendMessageApi(conversationId, body, authUserId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.message.id)) return prev;
        return [...prev, result.message];
      });
      latestIdRef.current = result.message.id;
      return result.message;
    },
    [authUserId, conversationId]
  );

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    conversation,
    messages,
    hasMore,
    loading,
    loadingMore,
    error,
    loadOlder,
    sendMessage,
    refresh,
  };
}
