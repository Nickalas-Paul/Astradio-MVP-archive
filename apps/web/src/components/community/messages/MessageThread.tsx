'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/shared/Button';
import { useAudioPlayerStore } from '@/store';
import { CommunityAudioArtifactPicker } from '@/components/community/posts/CommunityAudioArtifactPicker';
import { AudioAttachIcon } from '@/components/community/posts/community-post-icons';
import { getApiBaseUrl } from '@/core/api-base';
import {
  formatMessageTime,
  MESSAGE_MAX,
  sendDmMessage,
  useDmConversation,
  useDmMessageStream,
  type DmMessage,
} from '@/core/social/dm-thread-hooks';
import { peerDisplayLabel, type DmPeer } from '@/core/social/dm-hooks';

type MessageThreadProps = {
  conversationId: string;
  currentUserId: string | null;
  onBack: () => void;
  onRefreshList?: () => void;
};

function PeerAvatarSmall({ peer }: { peer: DmPeer | null }) {
  const name = peerDisplayLabel(peer);
  if (peer?.avatarUrl) {
    return <img src={peer.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover bg-surface-2" />;
  }
  return (
    <div className="h-9 w-9 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-semibold">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function MessageThread({ conversationId, currentUserId, onBack, onRefreshList }: MessageThreadProps) {
  const {
    conversation,
    messages,
    hasMore,
    loading,
    loadingMore,
    error,
    loadOlder,
    appendMessage,
    refreshLatest,
  } = useDmConversation(conversationId, currentUserId);

  const [draft, setDraft] = useState('');
  const [audioExportId, setAudioExportId] = useState<string | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!loading && messages.length) {
      scrollToBottom();
    }
  }, [loading, conversationId, messages.length, scrollToBottom]);

  useEffect(() => {
    if (!moderationError) return;
    const t = window.setTimeout(() => setModerationError(null), 5000);
    return () => window.clearTimeout(t);
  }, [moderationError]);

  const onStreamMessage = useCallback(
    (payload: { conversationId?: string; messageId?: string }) => {
      if (payload.conversationId === conversationId) {
        void refreshLatest();
        void fetch(
          `${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(conversationId)}/read`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }
        );
        onRefreshList?.();
      } else {
        onRefreshList?.();
      }
    },
    [conversationId, refreshLatest, onRefreshList]
  );

  useDmMessageStream(Boolean(currentUserId), conversationId, currentUserId, onStreamMessage);

  const canSend =
    Boolean(currentUserId) &&
    conversation?.status === 'active' &&
    (draft.trim().length > 0 || audioExportId);

  const handleSend = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setModerationError(null);
    try {
      const result = await sendDmMessage(conversationId, {
        body: draft.trim(),
        audioExportId: audioExportId || undefined,
        audioLabel: audioLabel || undefined,
      });
      if (!result.ok) {
        if (result.error === 'content_moderation_failed') {
          setModerationError(result.message || 'Your message contains language that violates community guidelines.');
        }
        return;
      }
      appendMessage(result.message);
      setDraft('');
      setAudioExportId(null);
      setAudioLabel(null);
      onRefreshList?.();
      scrollToBottom();
    } finally {
      setSending(false);
    }
  };

  const acceptRequest = async () => {
    const r = await fetch(
      `${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(conversationId)}/accept`,
      { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    if (r.ok) {
      await refreshLatest();
      onRefreshList?.();
    }
  };

  const declineRequest = async () => {
    const r = await fetch(
      `${getApiBaseUrl() || ''}/api/dm/conversations/${encodeURIComponent(conversationId)}/decline`,
      { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    );
    if (r.ok) {
      onRefreshList?.();
      onBack();
    }
  };

  const reportMessage = async (messageId: string) => {
    const r = await fetch(`${getApiBaseUrl() || ''}/api/community/report`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'message',
        targetId: messageId,
        reason: 'inappropriate',
      }),
    });
    if (r.ok) {
      setReportedIds((prev) => new Set(prev).add(messageId));
      setMenuOpenId(null);
    }
  };

  if (!currentUserId) {
    return <p className="text-sm text-text-secondary">Sign in to view this conversation.</p>;
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading conversation…</p>;
  }

  if (error || !conversation) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="text-sm text-accent hover:underline">
          Back to messages
        </button>
        <p className="text-sm text-red-400">{error || 'Conversation not found'}</p>
      </div>
    );
  }

  const peerName = peerDisplayLabel(conversation.peer);
  const isRecipient = conversation.status === 'requested' && conversation.initiatedBy !== currentUserId;
  const isInitiatorWaiting = conversation.status === 'requested' && conversation.initiatedBy === currentUserId;
  const composeEnabled = conversation.status === 'active';

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[60vh]">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <button type="button" onClick={onBack} className="text-sm text-accent hover:underline shrink-0">
          Back to messages
        </button>
        <PeerAvatarSmall peer={conversation.peer} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary font-sans truncate">{peerName}</p>
          {conversation.peer?.handle ? (
            <p className="text-caption text-text-muted">@{conversation.peer.handle}</p>
          ) : null}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-text-secondary/80 px-1.5 py-0.5 rounded-full border border-border/60">
          Friend
        </span>
      </div>

      <div ref={threadRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[200px] max-h-[55vh]">
        {hasMore ? (
          <button
            type="button"
            onClick={() => loadOlder()}
            disabled={loadingMore}
            className="text-sm text-accent hover:underline w-full text-center py-2"
          >
            {loadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        ) : null}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isSender={m.senderId === currentUserId}
            menuOpen={menuOpenId === m.id}
            onToggleMenu={() => setMenuOpenId((prev) => (prev === m.id ? null : m.id))}
            onReport={() => void reportMessage(m.id)}
            reported={reportedIds.has(m.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {isRecipient ? (
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-body-sm text-text-secondary">
            This is a message request from {peerName}. You are not currently connected.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={() => void acceptRequest()}>
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-400 border-red-400/40"
              onClick={() => void declineRequest()}
            >
              Decline
            </Button>
          </div>
        </div>
      ) : null}

      {isInitiatorWaiting ? (
        <p className="text-body-sm text-text-muted border-t border-border pt-4">
          Waiting for {peerName} to accept your message request.
        </p>
      ) : null}

      {composeEnabled ? (
        <div className="border-t border-border pt-4 space-y-2 sticky bottom-0 bg-bg pb-2">
          {audioExportId && audioLabel ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-0 px-3 py-1.5 text-xs text-text-secondary">
              <AudioAttachIcon />
              <span className="truncate max-w-[12rem]">{audioLabel}</span>
              <button
                type="button"
                onClick={() => {
                  setAudioExportId(null);
                  setAudioLabel(null);
                }}
                className="text-text-secondary hover:text-text-primary"
                aria-label="Remove audio"
              >
                ×
              </button>
            </div>
          ) : null}

          {moderationError ? (
            <p className="text-xs text-red-400" role="alert">
              {moderationError}
            </p>
          ) : null}

          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX))}
              rows={1}
              placeholder="Write a message…"
              className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary resize-none min-h-[44px] max-h-[4.5rem]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              onClick={() => setAudioPickerOpen(true)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 shrink-0"
              aria-label="Attach audio from Library"
            >
              <AudioAttachIcon />
            </button>
            <Button type="button" variant="primary" size="sm" disabled={!canSend || sending} loading={sending} onClick={() => void handleSend()}>
              Send
            </Button>
          </div>
          {draft.length > 800 ? (
            <p className="text-caption text-text-muted text-right">{draft.length}/{MESSAGE_MAX}</p>
          ) : null}
        </div>
      ) : null}

      <CommunityAudioArtifactPicker
        open={audioPickerOpen}
        onClose={() => setAudioPickerOpen(false)}
        onSelect={(artifact) => {
          setAudioExportId(artifact.exportId);
          setAudioLabel(artifact.label);
          setAudioPickerOpen(false);
        }}
      />
    </div>
  );
}

function MessageBubble({
  message,
  isSender,
  menuOpen,
  onToggleMenu,
  onReport,
  reported,
}: {
  message: DmMessage;
  isSender: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onReport: () => void;
  reported: boolean;
}) {
  const playTrack = useAudioPlayerStore((s) => s.playTrack);

  return (
    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative max-w-[85%] sm:max-w-[70%] ${isSender ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isSender ? 'bg-accent/20 text-text-primary' : 'bg-surface-1 text-text-primary'
          }`}
        >
          {message.body?.trim() ? (
            <p className="text-body-sm whitespace-pre-wrap break-words">{message.body}</p>
          ) : null}
          {message.audioExportId ? (
            <div className="mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 min-h-0 h-auto"
                onClick={() =>
                  playTrack({
                    exportId: message.audioExportId!,
                    label: message.audioLabel?.trim() || 'Shared Audio',
                    source: 'dm',
                  })
                }
              >
                Listen
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-text-muted mt-1">{formatMessageTime(message.createdAt)}</p>
        </div>
        {!isSender ? (
          <div className="relative self-start">
            <button
              type="button"
              onClick={onToggleMenu}
              className="text-caption text-text-muted hover:text-text-secondary px-1"
              aria-label="Message options"
            >
              ···
            </button>
            {menuOpen ? (
              <div className="absolute left-0 top-full mt-1 z-10 rounded-lg border border-border bg-surface-1 shadow-soft py-1 min-w-[8rem]">
                {reported ? (
                  <p className="text-xs text-text-muted px-3 py-2">Message reported</p>
                ) : (
                  <button
                    type="button"
                    onClick={onReport}
                    className="w-full text-left text-xs text-text-secondary hover:text-text-primary px-3 py-2"
                  >
                    Report
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
