import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { PendingIntent } from '../../types/community';
import { UserAvatar } from './UserAvatar';

type PendingIntentCardProps = {
  intent: PendingIntent;
  variant: 'incoming' | 'outgoing';
  onAccept?: (intentId: string) => Promise<void>;
  onDecline?: (intentId: string) => Promise<void>;
  onCancel?: (intentId: string) => Promise<void>;
  disabled?: boolean;
};

function formatSentDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PendingIntentCard({
  intent,
  variant,
  onAccept,
  onDecline,
  onCancel,
  disabled = false,
}: PendingIntentCardProps) {
  const [busyAction, setBusyAction] = useState<'accept' | 'decline' | 'cancel' | null>(null);

  const isIncoming = variant === 'incoming';
  const displayName = isIncoming
    ? intent.fromDisplayName?.trim() || 'Someone'
    : intent.toDisplayName?.trim() || 'Someone';
  const handle = isIncoming ? intent.fromHandle?.trim() : intent.toHandle?.trim();
  const peerUserId = isIncoming ? intent.fromUserId : intent.toUserId;

  const runAction = async (
    action: 'accept' | 'decline' | 'cancel',
    fn?: (id: string) => Promise<void>
  ) => {
    if (!fn || disabled || busyAction) return;
    setBusyAction(action);
    try {
      await fn(intent.id);
    } finally {
      setBusyAction(null);
    }
  };

  const isBusy = busyAction !== null || disabled;

  return (
    <View style={styles.card}>
      <UserAvatar userId={peerUserId} displayName={displayName} size={40} />
      <View style={styles.textBlock}>
        <Text style={styles.name}>{displayName}</Text>
        {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
        {intent.createdAt ? (
          <Text style={styles.date}>Sent {formatSentDate(intent.createdAt)}</Text>
        ) : null}
      </View>
      {isIncoming ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => void runAction('decline', onDecline)}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.declineButton,
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}
          >
            {busyAction === 'decline' ? (
              <ActivityIndicator size="small" color={colors.text.secondary} />
            ) : (
              <Text style={styles.declineText}>Decline</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void runAction('accept', onAccept)}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}
          >
            {busyAction === 'accept' ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => void runAction('cancel', onCancel)}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
            isBusy && styles.disabled,
          ]}
        >
          {busyAction === 'cancel' ? (
            <ActivityIndicator size="small" color={colors.text.secondary} />
          ) : (
            <Text style={styles.cancelText}>Cancel</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  handle: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 1,
  },
  date: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  acceptText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
  },
  declineButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  declineText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  cancelButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
