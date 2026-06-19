import type { RelationalIntent } from '../constants/community-constants';
import { api } from './api';
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
  return api<CommunityInventoryResponse>(
    `/api/community/inventory?userId=${encodeURIComponent(userId)}`
  );
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
