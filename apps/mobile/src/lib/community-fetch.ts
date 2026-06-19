import type { RelationalIntent } from '../constants/community-constants';
import { API_BASE, api, type ApiError } from './api';
import { getToken } from './token-storage';
import type {
  CommunityInventoryResponse,
  ConnectIntentResponse,
  IntentActionResponse,
  MatchesResponse,
  SearchResponse,
} from '../types/community';
import type { ProfileResponse } from '../types/my-sky';

export async function fetchProfileChartId(): Promise<{ userId: string; chartId: string }> {
  const profile = await api<ProfileResponse>('/api/profile');
  if (!profile.user?.id) {
    throw { status: 401, error: 'not_authenticated' };
  }
  const chartId = profile.primaryChart?.id;
  if (!chartId) {
    throw { status: 400, error: 'primary_chart_required' };
  }
  return { userId: profile.user.id, chartId };
}

/** Engine inventory uses query userId (not req.user alone). */
export async function fetchInventory(userId: string): Promise<CommunityInventoryResponse> {
  const uid = userId.trim();
  if (!uid) throw { status: 400, error: 'user_id_required' };

  const token = await getToken();
  const path = `/api/community/inventory?userId=${encodeURIComponent(uid)}`;
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw {
        status: response.status,
        error: 'invalid_json',
        message: 'Could not load Community inventory',
      } satisfies ApiError;
    }
  }

  if (!response.ok) {
    const err =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as ApiError)
        : { error: 'inventory_failed' };
    throw { ...err, status: response.status };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw { status: response.status, error: 'empty_inventory_response' };
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.version !== 'community_inventory_v1') {
    throw { status: response.status, error: 'unexpected_inventory_version' };
  }

  return {
    version: 'community_inventory_v1',
    userId: String(payload.userId ?? uid),
    pairs: Array.isArray(payload.pairs) ? (payload.pairs as CommunityInventoryResponse['pairs']) : [],
    relationalGroups: Array.isArray(payload.relationalGroups) ? payload.relationalGroups : [],
    campaigns: Array.isArray(payload.campaigns) ? payload.campaigns : [],
    pendingIncomingIntents: Array.isArray(payload.pendingIncomingIntents)
      ? (payload.pendingIncomingIntents as CommunityInventoryResponse['pendingIncomingIntents'])
      : [],
    pendingOutgoingIntents: Array.isArray(payload.pendingOutgoingIntents)
      ? (payload.pendingOutgoingIntents as CommunityInventoryResponse['pendingOutgoingIntents'])
      : [],
    pendingRelationalGroupInvites: Array.isArray(payload.pendingRelationalGroupInvites)
      ? payload.pendingRelationalGroupInvites
      : [],
    feedSkeleton: Array.isArray(payload.feedSkeleton) ? payload.feedSkeleton : [],
  };
}

export async function searchUsers(query: string, userId: string): Promise<SearchResponse['users']> {
  const q = query.trim();
  if (q.length < 2) return [];
  const response = await api<SearchResponse>(
    `/api/community/search?q=${encodeURIComponent(q)}&userId=${encodeURIComponent(userId)}`
  );
  return Array.isArray(response.users) ? response.users : [];
}

export async function fetchMatches(
  chartId: string,
  mode: RelationalIntent = 'friend',
  limit = 10
): Promise<MatchesResponse> {
  return api<MatchesResponse>(
    `/api/compat/matches?chartId=${encodeURIComponent(chartId)}&mode=${encodeURIComponent(mode)}&limit=${limit}`
  );
}

export async function sendConnectIntent(input: {
  fromUserId: string;
  fromChartId: string;
  toUserId: string;
  toChartId: string;
  label?: string;
  relationshipKind?: string;
}): Promise<ConnectIntentResponse> {
  return api<ConnectIntentResponse>('/api/community/connect-intent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function acceptIntent(intentId: string, userId: string): Promise<IntentActionResponse> {
  return api<IntentActionResponse>(
    `/api/community/connection-intents/${encodeURIComponent(intentId)}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }
  );
}

export async function declineIntent(intentId: string, userId: string): Promise<IntentActionResponse> {
  return api<IntentActionResponse>(
    `/api/community/connection-intents/${encodeURIComponent(intentId)}/decline`,
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }
  );
}

export async function cancelIntent(intentId: string, userId: string): Promise<IntentActionResponse> {
  return api<IntentActionResponse>(
    `/api/community/connection-intents/${encodeURIComponent(intentId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }
  );
}
