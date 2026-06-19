import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserAvatar } from './UserAvatar';
import { LoadOlderFooter, MessageBubble } from './MessageBubble';
import { colors } from '../../constants/colors';
import { acceptRequest, declineRequest } from '../../lib/community-messages-fetch';
import { formatApiError } from '../../lib/format-api-error';
import { MESSAGE_MAX, peerDisplayLabel } from '../../lib/signal-display';
import { useAuthStore } from '../../store/auth';
import { useDmThread } from '../../hooks/useDmThread';
import type { DmMessage } from '../../types/community-messages';

type MessageThreadScreenProps = {
  conversationId: string;
  peerDisplayName?: string;
  peerHandle?: string;
};

export function MessageThreadScreen({
  conversationId,
  peerDisplayName,
  peerHandle,
}: MessageThreadScreenProps) {
  const router = useRouter();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const {
    conversation,
    messages,
    hasMore,
    loading,
    loadingMore,
    error,
    loadOlder,
    sendMessage,
    refresh,
  } = useDmThread(conversationId, Boolean(authUserId));

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);

  const peerName =
    peerDisplayLabel(conversation?.peer) !== 'Unknown'
      ? peerDisplayLabel(conversation?.peer)
      : peerDisplayName?.trim() || 'Conversation';
  const handle =
    conversation?.peer?.handle?.trim() || peerHandle?.trim().replace(/^@/, '') || '';

  const isRecipient =
    conversation?.status === 'requested' && conversation.initiatedBy !== authUserId;
  const isInitiatorWaiting =
    conversation?.status === 'requested' && conversation.initiatedBy === authUserId;
  const composeEnabled = conversation?.status === 'active';

  const invertedData = [...messages].reverse();

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(text);
      setDraft('');
    } catch (err) {
      Alert.alert('Could not send', formatApiError(err, 'Something went wrong'));
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    if (!authUserId) return;
    setRequestBusy(true);
    try {
      await acceptRequest(conversationId, authUserId);
      await refresh();
    } catch (err) {
      Alert.alert('Could not accept', formatApiError(err, 'Something went wrong'));
    } finally {
      setRequestBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!authUserId) return;
    setRequestBusy(true);
    try {
      await declineRequest(conversationId, authUserId);
      router.back();
    } catch (err) {
      Alert.alert('Could not decline', formatApiError(err, 'Something went wrong'));
    } finally {
      setRequestBusy(false);
    }
  };

  const renderItem = ({ item }: { item: DmMessage }) => (
    <MessageBubble message={item} isSender={item.senderId === authUserId} />
  );

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <UserAvatar
          userId={conversation?.peer?.userId}
          displayName={peerName}
          avatarUrl={conversation?.peer?.avatarUrl}
          size={36}
        />
        <View style={styles.headerMeta}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName}
          </Text>
          {handle ? <Text style={styles.headerHandle}>@{handle}</Text> : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.DEFAULT} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            style={styles.list}
            data={invertedData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              hasMore ? (
                <LoadOlderFooter loading={loadingMore} onPress={loadOlder} />
              ) : null
            }
          />

          {isRecipient ? (
            <View style={styles.requestBar}>
              <Text style={styles.requestText}>
                This is a message request from {peerName}. You are not currently connected.
              </Text>
              <View style={styles.requestActions}>
                <Pressable
                  style={[styles.acceptBtn, requestBusy && styles.btnDisabled]}
                  onPress={() => void handleAccept()}
                  disabled={requestBusy}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={styles.declineBtn}
                  onPress={() => void handleDecline()}
                  disabled={requestBusy}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {isInitiatorWaiting ? (
            <View style={styles.waitingBar}>
              <Text style={styles.waitingText}>
                Waiting for {peerName} to accept your message request.
              </Text>
            </View>
          ) : null}

          {composeEnabled ? (
            <View style={styles.composeBar}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={colors.text.muted}
                value={draft}
                onChangeText={(text) => setDraft(text.slice(0, MESSAGE_MAX))}
                multiline
                maxLength={MESSAGE_MAX}
              />
              <Pressable
                style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendDisabled]}
                onPress={() => void handleSend()}
                disabled={!draft.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <Text style={styles.sendText}>Send</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    color: colors.accent.DEFAULT,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  headerHandle: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  requestBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  requestText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  declineBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  acceptText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  declineText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  waitingBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  waitingText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
});
