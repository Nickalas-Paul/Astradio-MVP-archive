export type DmPeer = {
  userId: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

export type DmConversation = {
  id: string;
  peer: DmPeer | null;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  initiatedBy: string;
  createdAt?: string;
};

export type DmRequest = {
  id: string;
  peer: DmPeer | null;
  status: string;
  lastMessagePreview: string | null;
  createdAt: string;
  initiatedBy: string;
};

export type DmConversationsResponse = {
  conversations: DmConversation[];
  requests: DmRequest[];
};

export type DmMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  audioExportId: string | null;
  audioLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DmConversationDetail = {
  id: string;
  status: string;
  initiatedBy: string;
  peer: DmPeer | null;
};

export type DmThreadResponse = {
  conversation: DmConversationDetail;
  messages: DmMessage[];
  hasMore: boolean;
};

export type SendMessageResponse = {
  message: DmMessage;
};

export type CreateConversationResponse = {
  conversationId: string;
  existing?: boolean;
  status?: string;
  conversation?: unknown;
  message?: DmMessage;
};

export type SignalItemBase = {
  id: string;
  anchorType: string;
  anchorId: string;
  templateId: string;
  status: string;
  replyCount: number;
  maxReplies: number;
  expiresAt?: string;
  createdAt: string;
};

export type IncomingSignal = SignalItemBase & {
  senderUserId?: string | null;
  senderDisplayName?: string | null;
  senderHandle?: string | null;
  peerDisplayName?: string | null;
  body?: Record<string, unknown>;
};

export type SentSignal = SignalItemBase & {
  recipientUserId: string;
  recipientDisplayName: string;
  peerDisplayName?: string | null;
  body?: Record<string, unknown>;
};

export type RecentActivity = {
  id: string;
  templateId: string;
  peerDisplayName?: string | null;
  createdAt: string;
};

export type IncomingSignalsResponse = {
  version: string;
  items: IncomingSignal[];
};

export type SentSignalsResponse = {
  version: string;
  items: SentSignal[];
};

export type RecentSignalsResponse = {
  version: string;
  items: RecentActivity[];
};
