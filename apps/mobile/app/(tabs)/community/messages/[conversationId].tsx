import { useLocalSearchParams } from 'expo-router';
import { MessageThreadScreen } from '../../../../src/components/community/MessageThreadScreen';

export default function ConversationThreadRoute() {
  const params = useLocalSearchParams<{
    conversationId: string;
    peerDisplayName?: string;
    peerHandle?: string;
  }>();

  const conversationId =
    typeof params.conversationId === 'string' ? params.conversationId : '';

  return (
    <MessageThreadScreen
      conversationId={conversationId}
      peerDisplayName={
        typeof params.peerDisplayName === 'string' ? params.peerDisplayName : undefined
      }
      peerHandle={typeof params.peerHandle === 'string' ? params.peerHandle : undefined}
    />
  );
}
