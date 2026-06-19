import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptRequest as acceptRequestApi,
  acknowledgeSignal as acknowledgeSignalApi,
  declineRequest as declineRequestApi,
  fetchConversations,
  fetchIncomingSignals,
  fetchRecentSignals,
  fetchSentSignals,
} from '../lib/community-messages-fetch';
import { formatApiError } from '../lib/format-api-error';
import { useAuthStore } from '../store/auth';
import type {
  DmConversation,
  DmRequest,
  IncomingSignal,
  RecentActivity,
  SentSignal,
} from '../types/community-messages';

const POLL_MS = 30_000;

export function useCommunityMessages(enabled: boolean) {
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [requests, setRequests] = useState<DmRequest[]>([]);
  const [incomingSignals, setIncomingSignals] = useState<IncomingSignal[]>([]);
  const [sentSignals, setSentSignals] = useState<SentSignal[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !authUserId) return;
    setLoading(true);
    setError(null);
    try {
      const [convData, incoming, sent, recent] = await Promise.all([
        fetchConversations(authUserId),
        fetchIncomingSignals(authUserId),
        fetchSentSignals(authUserId),
        fetchRecentSignals(authUserId),
      ]);
      setConversations(convData.conversations);
      setRequests(convData.requests);
      setIncomingSignals(incoming);
      setSentSignals(sent);
      setRecentActivity(recent);
      loadedRef.current = true;
    } catch (err) {
      setError(formatApiError(err, 'Could not load messages'));
    } finally {
      setLoading(false);
    }
  }, [authUserId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (loadedRef.current) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !authUserId) return;
    const interval = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, authUserId, refresh]);

  const acceptRequest = useCallback(
    async (id: string) => {
      if (!authUserId) return;
      await acceptRequestApi(id, authUserId);
      await refresh();
    },
    [authUserId, refresh]
  );

  const declineRequest = useCallback(
    async (id: string) => {
      if (!authUserId) return;
      await declineRequestApi(id, authUserId);
      await refresh();
    },
    [authUserId, refresh]
  );

  const acknowledgeSignal = useCallback(
    async (id: string) => {
      if (!authUserId) return;
      await acknowledgeSignalApi(id, authUserId);
      setIncomingSignals((prev) => prev.filter((s) => s.id !== id));
      const [sent, recent] = await Promise.all([
        fetchSentSignals(authUserId),
        fetchRecentSignals(authUserId),
      ]);
      setSentSignals(sent);
      setRecentActivity(recent);
    },
    [authUserId]
  );

  return {
    conversations,
    requests,
    incomingSignals,
    sentSignals,
    recentActivity,
    loading,
    error,
    refresh,
    acceptRequest,
    declineRequest,
    acknowledgeSignal,
  };
}
