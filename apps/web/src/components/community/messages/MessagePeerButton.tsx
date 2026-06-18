'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { MessagesTabIcon } from '@/components/community/posts/community-post-icons';
import { openOrCreateDmConversation } from '@/core/social/dm-hooks';

type MessagePeerButtonProps = {
  peerUserId: string | null | undefined;
  variant?: 'outline' | 'ghost';
  size?: 'sm' | 'md';
  iconOnly?: boolean;
  className?: string;
};

export function MessagePeerButton({
  peerUserId,
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
  className = '',
}: MessagePeerButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const peerId = typeof peerUserId === 'string' ? peerUserId.trim() : '';
  if (!peerId) return null;

  const openMessage = async () => {
    setBusy(true);
    try {
      const conversationId = await openOrCreateDmConversation(peerId);
      if (!conversationId) return;
      router.push(`/community?tab=messages&conversation=${encodeURIComponent(conversationId)}`);
    } finally {
      setBusy(false);
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void openMessage()}
        className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50 ${className}`.trim()}
        aria-label="Message"
      >
        <MessagesTabIcon />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={busy}
      loading={busy}
      className={`min-h-[44px] ${className}`.trim()}
      onClick={() => void openMessage()}
    >
      <span className="inline-flex items-center gap-2">
        <MessagesTabIcon />
        Message
      </span>
    </Button>
  );
}
