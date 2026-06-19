import { useCallback, useEffect, useState } from 'react';
import {
  acceptIntent as acceptIntentApi,
  cancelIntent as cancelIntentApi,
  declineIntent as declineIntentApi,
  fetchInventory,
  fetchMatches,
  fetchProfileChartId,
  searchUsers as searchUsersApi,
  sendConnectIntent as sendConnectIntentApi,
} from '../lib/community-fetch';
import { formatApiError } from '../lib/format-api-error';
import { useAuthStore } from '../store/auth';
import type {
  CommunityInventoryResponse,
  InventoryPair,
  MatchResult,
  PendingIntent,
  SearchUser,
} from '../types/community';

export function useCommunityData() {
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [inventory, setInventory] = useState<CommunityInventoryResponse | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!authUserId) {
      setInventory(null);
      setMatches([]);
      setUserId(null);
      setChartId(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profile = await fetchProfileChartId();
      setUserId(profile.userId);
      setChartId(profile.chartId);

      const [inventoryData, matchesData] = await Promise.all([
        fetchInventory(profile.userId),
        fetchMatches(profile.chartId),
      ]);

      setInventory(inventoryData);
      setMatches(matchesData.matches ?? []);
    } catch (err) {
      setError(formatApiError(err, 'Could not load Community'));
      setInventory(null);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const searchUsers = useCallback(
    async (query: string): Promise<SearchUser[]> => {
      const uid = userId ?? authUserId;
      if (!uid) return [];
      const q = query.trim();
      if (q.length < 2) return [];

      setSearchLoading(true);
      try {
        return await searchUsersApi(q, uid);
      } finally {
        setSearchLoading(false);
      }
    },
    [userId, authUserId]
  );

  const runMutation = useCallback(
    async (action: () => Promise<unknown>) => {
      setMutationBusy(true);
      try {
        await action();
        await refresh();
      } finally {
        setMutationBusy(false);
      }
    },
    [refresh]
  );

  const sendConnect = useCallback(
    async (toUserId: string, toChartId: string) => {
      const uid = userId ?? authUserId;
      const cid = chartId;
      if (!uid || !cid) {
        throw { status: 400, error: 'primary_chart_required' };
      }
      await runMutation(() =>
        sendConnectIntentApi({
          fromUserId: uid,
          fromChartId: cid,
          toUserId,
          toChartId,
          relationshipKind: 'friend',
        })
      );
    },
    [userId, authUserId, chartId, runMutation]
  );

  const acceptIntent = useCallback(
    async (intentId: string) => {
      const uid = userId ?? authUserId;
      if (!uid) throw { status: 401, error: 'not_authenticated' };
      await runMutation(() => acceptIntentApi(intentId, uid));
    },
    [userId, authUserId, runMutation]
  );

  const declineIntent = useCallback(
    async (intentId: string) => {
      const uid = userId ?? authUserId;
      if (!uid) throw { status: 401, error: 'not_authenticated' };
      await runMutation(() => declineIntentApi(intentId, uid));
    },
    [userId, authUserId, runMutation]
  );

  const cancelIntent = useCallback(
    async (intentId: string) => {
      const uid = userId ?? authUserId;
      if (!uid) throw { status: 401, error: 'not_authenticated' };
      await runMutation(() => cancelIntentApi(intentId, uid));
    },
    [userId, authUserId, runMutation]
  );

  const pairs: InventoryPair[] = inventory?.pairs ?? [];
  const pendingIncoming: PendingIntent[] = inventory?.pendingIncomingIntents ?? [];
  const pendingOutgoing: PendingIntent[] = inventory?.pendingOutgoingIntents ?? [];

  return {
    inventory,
    pairs,
    matches,
    pendingIncoming,
    pendingOutgoing,
    userId: userId ?? authUserId,
    chartId,
    loading,
    error,
    searchLoading,
    mutationBusy,
    refresh,
    searchUsers,
    sendConnect,
    acceptIntent,
    declineIntent,
    cancelIntent,
  };
}
