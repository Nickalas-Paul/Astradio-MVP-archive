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
import { AudioLibraryPicker } from './AudioLibraryPicker';
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
  const [audioExportId, setAudioExportId] = useState<string | null>(null);
  const [audioLabel, setAudioLabel] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);

  const canSend = Boolean(draft.trim() || audioExportId);

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
    if (!canSend || sending) return;
    setSending(true);
    try {
      await sendMessage(
        draft.trim(),
        audioExportId ?? undefined,
        audioLabel ?? undefined
      );
      setDraft('');
      setAudioExportId(null);
      setAudioLabel(null);
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
            <View style={styles.composeWrap}>
              {audioExportId && audioLabel ? (
                <View style={styles.audioChip}>
                  <Text style={styles.audioChipIcon}>♪</Text>
                  <Text style={styles.audioChipLabel} numberOfLines={1}>
                    {audioLabel}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setAudioExportId(null);
                      setAudioLabel(null);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.audioChipRemove}>×</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composeBar}>
                <Pressable
                  style={({ pressed }) => [styles.attachBtn, pressed && styles.attachPressed]}
                  onPress={() => setPickerOpen(true)}
                  accessibilityLabel="Attach audio from Library"
                >
                  <Text style={styles.attachIcon}>♪</Text>
                </Pressable>
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
                  style={[styles.sendBtn, (!canSend || sending) && styles.sendDisabled]}
                  onPress={() => void handleSend()}
                  disabled={!canSend || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.text.primary} />
                  ) : (
                    <Text style={styles.sendText}>Send</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          <AudioLibraryPicker
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={({ exportId, label }) => {
              setAudioExportId(exportId);
              setAudioLabel(label);
            }}
          />
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
  composeWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  audioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  audioChipIcon: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
  },
  audioChipLabel: {
    flexShrink: 1,
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
    maxWidth: 220,
  },
  audioChipRemove: {
    color: colors.text.secondary,
    fontSize: 18,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachPressed: {
    opacity: 0.85,
    borderColor: colors.accent.DEFAULT,
  },
  attachIcon: {
    color: colors.text.secondary,
    fontSize: 18,
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
