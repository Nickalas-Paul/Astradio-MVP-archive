import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserAvatar } from './UserAvatar';
import { colors } from '../../constants/colors';
import { formatApiError } from '../../lib/format-api-error';
import { formatDmRelativeTime, peerDisplayLabel } from '../../lib/signal-display';
import type { DmConversation, DmRequest } from '../../types/community-messages';

type ConversationsListProps = {
  conversations: DmConversation[];
  requests: DmRequest[];
  onAcceptRequest: (id: string) => Promise<void>;
  onDeclineRequest: (id: string) => Promise<void>;
};

export function ConversationsList({
  conversations,
  requests,
  onAcceptRequest,
  onDeclineRequest,
}: ConversationsListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const openConversation = (conv: DmConversation) => {
    const name = peerDisplayLabel(conv.peer);
    const handle = conv.peer?.handle?.trim() ?? '';
    router.push({
      pathname: '/community/messages/[conversationId]',
      params: {
        conversationId: conv.id,
        peerDisplayName: name,
        peerHandle: handle,
      },
    });
  };

  const handleAccept = async (req: DmRequest) => {
    setBusyId(req.id);
    try {
      await onAcceptRequest(req.id);
      const name = peerDisplayLabel(req.peer);
      router.push({
        pathname: '/community/messages/[conversationId]',
        params: {
          conversationId: req.id,
          peerDisplayName: name,
          peerHandle: req.peer?.handle?.trim() ?? '',
        },
      });
    } catch (err) {
      Alert.alert('Could not accept', formatApiError(err, 'Something went wrong'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setBusyId(id);
    try {
      await onDeclineRequest(id);
    } catch (err) {
      Alert.alert('Could not decline', formatApiError(err, 'Something went wrong'));
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0 && conversations.length === 0) {
    return (
      <Text style={styles.empty}>
        No conversations yet. Message someone from their connection page.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {requests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Message Requests</Text>
          {requests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.row}>
                <UserAvatar
                  userId={req.peer?.userId}
                  displayName={peerDisplayLabel(req.peer)}
                  avatarUrl={req.peer?.avatarUrl}
                  size={40}
                />
                <View style={styles.meta}>
                  <Text style={styles.name}>{peerDisplayLabel(req.peer)}</Text>
                  {req.lastMessagePreview ? (
                    <Text style={styles.preview} numberOfLines={1}>
                      {req.lastMessagePreview}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.acceptBtn, busyId === req.id && styles.btnDisabled]}
                  onPress={() => void handleAccept(req)}
                  disabled={busyId === req.id}
                >
                  {busyId === req.id ? (
                    <ActivityIndicator size="small" color={colors.text.primary} />
                  ) : (
                    <Text style={styles.acceptText}>Accept</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.declineBtn}
                  onPress={() => void handleDecline(req.id)}
                  disabled={busyId === req.id}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Conversations</Text>
        {conversations.length === 0 ? (
          <Text style={styles.muted}>No active conversations.</Text>
        ) : (
          conversations.map((conv) => {
            const unread = (conv.unreadCount || 0) > 0;
            const handle = conv.peer?.handle?.trim();
            return (
              <Pressable key={conv.id} style={styles.convRow} onPress={() => openConversation(conv)}>
                <UserAvatar
                  userId={conv.peer?.userId}
                  displayName={peerDisplayLabel(conv.peer)}
                  avatarUrl={conv.peer?.avatarUrl}
                  size={40}
                />
                <View style={styles.meta}>
                  <View style={styles.topLine}>
                    <Text
                      style={[styles.name, unread && styles.nameUnread]}
                      numberOfLines={1}
                    >
                      {peerDisplayLabel(conv.peer)}
                      {handle ? (
                        <Text style={styles.handle}> @{handle}</Text>
                      ) : null}
                    </Text>
                    <View style={styles.timeRow}>
                      {unread ? <View style={styles.unreadDot} /> : null}
                      <Text style={styles.time}>{formatDmRelativeTime(conv.lastMessageAt)}</Text>
                    </View>
                  </View>
                  {conv.lastMessagePreview ? (
                    <Text
                      style={[styles.preview, unread && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {conv.lastMessagePreview}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  empty: {
    color: colors.text.muted,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 32,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
    flex: 1,
  },
  nameUnread: {
    fontFamily: 'Manrope-Bold',
  },
  handle: {
    color: colors.text.muted,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
  },
  preview: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
  },
  previewUnread: {
    color: colors.text.primary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.DEFAULT,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  declineBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    opacity: 0.7,
  },
  muted: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
});
