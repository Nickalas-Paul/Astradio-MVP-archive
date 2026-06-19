import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { formatMessageTime } from '../../lib/signal-display';
import type { DmMessage } from '../../types/community-messages';
import { PostAudioSection } from './PostAudioSection';

type MessageBubbleProps = {
  message: DmMessage;
  isSender: boolean;
};

export function MessageBubble({ message, isSender }: MessageBubbleProps) {
  const audioLabel = message.audioLabel?.trim() || 'Audio attached';

  return (
    <View style={[styles.row, isSender ? styles.rowSender : styles.rowPeer]}>
      <View style={[styles.bubble, isSender ? styles.bubbleSender : styles.bubblePeer]}>
        {message.body?.trim() ? (
          <Text style={styles.body}>{message.body}</Text>
        ) : null}
        {message.audioExportId ? (
          <PostAudioSection exportId={message.audioExportId} label={audioLabel} />
        ) : null}
        <Text style={styles.time}>{formatMessageTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

export function LoadOlderFooter({
  loading,
  onPress,
}: {
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.loadOlder} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={colors.accent.DEFAULT} size="small" />
      ) : (
        <Text style={styles.loadOlderText}>Load older messages</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  rowSender: {
    alignItems: 'flex-end',
  },
  rowPeer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleSender: {
    backgroundColor: 'rgba(14, 150, 150, 0.2)',
    borderBottomRightRadius: 4,
  },
  bubblePeer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  body: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    lineHeight: 21,
  },
  time: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    marginTop: 6,
  },
  loadOlder: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadOlderText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
});
