'use client';

import { useState } from 'react';
import { SignalsPanel } from '@/components/community/SignalsPanel';
import { ConversationList } from '@/components/community/messages/ConversationList';

type MessagesTabProps = {
  currentUserId: string | null;
  selectedConversationId: string | null;
  onOpenConversation: (conversationId: string) => void;
  onMetaChange?: (meta: { unreadTotal: number }) => void;
  refreshSignal?: number;
  onSwitchToConnections?: () => void;
};

export function MessagesTab({
  currentUserId,
  selectedConversationId,
  onOpenConversation,
  onMetaChange,
  refreshSignal = 0,
  onSwitchToConnections,
}: MessagesTabProps) {
  const [, setSignalsMeta] = useState({ loading: true, empty: true });

  if (selectedConversationId) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SignalsPanel currentUserId={currentUserId} onMetaChange={setSignalsMeta} />
      <ConversationList
        currentUserId={currentUserId}
        onOpenConversation={onOpenConversation}
        onMetaChange={onMetaChange}
        refreshSignal={refreshSignal}
        onSwitchToConnections={onSwitchToConnections}
      />
    </div>
  );
}
