import { api } from './api';
import type {
  CreateConversationResponse,
  DmConversationsResponse,
  DmThreadResponse,
  IncomingSignalsResponse,
  RecentSignalsResponse,
  SendMessageResponse,
  SentSignalsResponse,
} from '../types/community-messages';

function withUserId(path: string, userId?: string | null): string {
  if (!userId?.trim()) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}userId=${encodeURIComponent(userId.trim())}`;
}

function withUserBody(userId: string, body: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...body, userId });
}

export async function fetchConversations(userId: string): Promise<DmConversationsResponse> {
  const data = await api<DmConversationsResponse>(
    withUserId('/api/dm/conversations', userId)
  );
  return {
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
    requests: Array.isArray(data.requests) ? data.requests : [],
  };
}

export async function fetchThread(
  conversationId: string,
  userId: string,
  before?: string
): Promise<DmThreadResponse> {
  const qs = new URLSearchParams();
  if (before?.trim()) qs.set('before', before.trim());
  const query = qs.toString();
  const path = `/api/dm/conversations/${encodeURIComponent(conversationId)}${query ? `?${query}` : ''}`;
  const data = await api<DmThreadResponse>(withUserId(path, userId));
  return {
    conversation: data.conversation,
    messages: Array.isArray(data.messages) ? data.messages : [],
    hasMore: Boolean(data.hasMore),
  };
}

export async function sendMessage(
  conversationId: string,
  body: string,
  userId: string
): Promise<SendMessageResponse> {
  return api<SendMessageResponse>(
    `/api/dm/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      body: withUserBody(userId, { body }),
    }
  );
}

export async function markRead(conversationId: string, userId: string): Promise<void> {
  void api(
    `/api/dm/conversations/${encodeURIComponent(conversationId)}/read`,
    {
      method: 'POST',
      body: withUserBody(userId, {}),
    }
  ).catch(() => {});
}

export async function createConversation(
  recipientUserId: string,
  userId: string
): Promise<CreateConversationResponse> {
  return api<CreateConversationResponse>('/api/dm/conversations', {
    method: 'POST',
    body: withUserBody(userId, { recipientUserId, body: '' }),
  });
}

export async function acceptRequest(conversationId: string, userId: string): Promise<void> {
  await api(`/api/dm/conversations/${encodeURIComponent(conversationId)}/accept`, {
    method: 'POST',
    body: withUserBody(userId, {}),
  });
}

export async function declineRequest(conversationId: string, userId: string): Promise<void> {
  await api(`/api/dm/conversations/${encodeURIComponent(conversationId)}/decline`, {
    method: 'POST',
    body: withUserBody(userId, {}),
  });
}

export async function fetchIncomingSignals(userId: string): Promise<IncomingSignalsResponse['items']> {
  const data = await api<IncomingSignalsResponse>(withUserId('/api/community/signals', userId));
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchSentSignals(userId: string): Promise<SentSignalsResponse['items']> {
  const data = await api<SentSignalsResponse>(withUserId('/api/community/signals/sent', userId));
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchRecentSignals(userId: string): Promise<RecentSignalsResponse['items']> {
  const data = await api<RecentSignalsResponse>(withUserId('/api/community/signals/recent', userId));
  return Array.isArray(data.items) ? data.items : [];
}

export async function acknowledgeSignal(signalId: string, userId: string): Promise<void> {
  await api(`/api/community/signals/${encodeURIComponent(signalId)}/react`, {
    method: 'POST',
    body: withUserBody(userId, {}),
  });
}
