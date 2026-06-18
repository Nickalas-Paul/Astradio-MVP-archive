'use client';

import { useEffect } from 'react';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { getApiBaseUrl } from '@/core/api-base';
import {
  formatDmRelativeTime,
  peerDisplayLabel,
  type DmConversationRow,
  type DmRequestRow,
  useDmConversations,
} from '@/core/social/dm-hooks';

function PeerAvatar({ peer, className = '' }: { peer: DmRequestRow['peer']; className?: string }) {
  const name = peerDisplayLabel(peer);
  const initial = name.charAt(0).toUpperCase();
  if (peer?.avatarUrl) {
    return (
      <img
        src={peer.avatarUrl}
        alt=""
        className={`h-10 w-10 rounded-full object-cover bg-surface-2 ${className}`.trim()}
      />
    );
  }
  return (
    <div
      className={`h-10 w-10 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-semibold ${className}`.trim()}
      aria-hidden
    >
      {initial}
    </div>
  );
}

type ConversationListProps = {
  currentUserId: string | null;
  onOpenConversation: (conversationId: string) => void;
  onMetaChange?: (meta: { unreadTotal: number }) => void;
  refreshSignal?: number;
};

export function ConversationList({
  currentUserId,
  onOpenConversation,
  onMetaChange,
  refreshSignal = 0,
}: ConversationListProps) {
  const { data, loading, error, refresh, unreadTotal } = useDmConversations(Boolean(currentUserId));

  useEffect(() => {
    if (refreshSignal > 0) void refresh();
  }, [refreshSignal, refresh]);

  useEffect(() => {
    onMetaChange?.({ unreadTotal });
  }, [unreadTotal, onMetaChange]);

  const acceptRequest = async (id: string) => {
    const r = await fetch(`${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (r.ok) {
      await refresh();
      onOpenConversation(id);
    }
  };

  const declineRequest = async (id: string) => {
    const r = await fetch(`${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(id)}/decline`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (r.ok) await refresh();
  };

  if (!currentUserId) {
    return (
      <Card className="text-sm text-text-secondary">
        Sign in to view messages.
      </Card>
    );
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading conversations…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        {error}
        <Button type="button" variant="ghost" size="sm" className="ml-2" onClick={() => void refresh()}>
          Retry
        </Button>
      </p>
    );
  }

  const hasRequests = data.requests.length > 0;
  const hasConversations = data.conversations.length > 0;

  if (!hasRequests && !hasConversations) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        No conversations yet. Start one from a connection&apos;s profile.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {hasRequests ? (
        <section className="space-y-3">
          <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted font-sans">
            Message requests
          </h4>
          <ul className="space-y-2">
            {data.requests.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                onAccept={() => void acceptRequest(req.id)}
                onDecline={() => void declineRequest(req.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted font-sans">
          Conversations
        </h4>
        {hasConversations ? (
          <ul className="space-y-2">
            {data.conversations.map((conv) => (
              <ConversationRow key={conv.id} conversation={conv} onOpen={() => onOpenConversation(conv.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-caption text-text-muted">No active conversations.</p>
        )}
      </section>
    </div>
  );
}

function RequestRow({
  request,
  onAccept,
  onDecline,
}: {
  request: DmRequestRow;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = peerDisplayLabel(request.peer);
  return (
    <li className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <PeerAvatar peer={request.peer} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary font-sans">{name}</p>
          {request.lastMessagePreview ? (
            <p className="text-body-sm text-text-secondary line-clamp-2 mt-1">{request.lastMessagePreview}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={onAccept}>
          Accept
        </Button>
        <Button type="button" variant="outline" size="sm" className="text-red-400 border-red-400/40" onClick={onDecline}>
          Decline
        </Button>
      </div>
    </li>
  );
}

function ConversationRow({
  conversation,
  onOpen,
}: {
  conversation: DmConversationRow;
  onOpen: () => void;
}) {
  const name = peerDisplayLabel(conversation.peer);
  const unread = (conversation.unreadCount || 0) > 0;
  const handle = conversation.peer?.handle?.trim();

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-lg border border-border bg-surface-1 p-4 hover:border-accent/40 transition-colors flex items-start gap-3"
      >
        <PeerAvatar peer={conversation.peer} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-sans truncate ${unread ? 'font-semibold text-text-primary' : 'font-medium text-text-primary'}`}>
              {name}
              {handle ? (
                <span className="text-text-muted font-normal text-body-sm"> @{handle}</span>
              ) : null}
            </p>
            <span className="shrink-0 flex items-center gap-1.5">
              {unread ? <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" /> : null}
              <span className="text-caption text-text-muted">{formatDmRelativeTime(conversation.lastMessageAt)}</span>
            </span>
          </div>
          {conversation.lastMessagePreview ? (
            <p className={`text-body-sm mt-1 line-clamp-1 ${unread ? 'text-text-primary' : 'text-text-secondary'}`}>
              {conversation.lastMessagePreview}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  );
}
