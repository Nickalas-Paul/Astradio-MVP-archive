import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import {
  formatSignalActivityRelativeTime,
  formatSignalReceivedRelativeTime,
  formatSignalSentRelativeTime,
  formatSignalTemplateWithDescription,
  outgoingSignalStatusLabel,
  peerDisplayLabel,
} from '../../lib/signal-display';
import type { IncomingSignal, RecentActivity, SentSignal } from '../../types/community-messages';

type SignalsSectionProps = {
  incomingSignals: IncomingSignal[];
  sentSignals: SentSignal[];
  recentActivity: RecentActivity[];
  loading: boolean;
  error: string | null;
  onAcknowledge: (signalId: string) => Promise<void>;
  onRefresh: () => void;
};

function resolveSenderName(signal: IncomingSignal): string {
  if (signal.senderDisplayName?.trim()) return signal.senderDisplayName.trim();
  if (signal.senderUserId) return 'Someone';
  return 'Unknown sender';
}

export function SignalsSection({
  incomingSignals,
  sentSignals,
  recentActivity,
  loading,
  error,
  onAcknowledge,
  onRefresh,
}: SignalsSectionProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasAny =
    incomingSignals.length > 0 || sentSignals.length > 0 || recentActivity.length > 0;
  if (!hasAny && !loading && !error) return null;

  const handleAck = async (id: string) => {
    setBusyId(id);
    try {
      await onAcknowledge(id);
    } catch {
      // parent hook surfaces errors via refresh failure; keep signal visible
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Signals</Text>
        <Pressable onPress={onRefresh} hitSlop={8}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Purpose-driven prompts tied to your relational weather.
      </Text>

      {loading ? <Text style={styles.muted}>Loading…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Incoming</Text>
        {incomingSignals.length === 0 ? (
          <Text style={styles.muted}>No incoming signals.</Text>
        ) : (
          incomingSignals.map((signal) => {
            const { label, description } = formatSignalTemplateWithDescription(signal.templateId);
            const canReact =
              signal.status === 'open' && signal.replyCount < signal.maxReplies;
            return (
              <View key={signal.id} style={styles.incomingCard}>
                <Text style={styles.senderName}>{resolveSenderName(signal)}</Text>
                <Text style={styles.templateText}>
                  <Text style={styles.templateLabel}>{label}</Text>
                  {description ? `: ${description}` : ''}
                </Text>
                <Text style={styles.muted}>
                  {formatSignalReceivedRelativeTime(signal.createdAt)}
                </Text>
                {canReact ? (
                  <Pressable
                    style={[styles.ackButton, busyId === signal.id && styles.ackDisabled]}
                    onPress={() => void handleAck(signal.id)}
                    disabled={busyId === signal.id}
                  >
                    {busyId === signal.id ? (
                      <ActivityIndicator size="small" color={colors.text.primary} />
                    ) : (
                      <Text style={styles.ackText}>Acknowledge</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabelMuted}>Sent</Text>
        {sentSignals.length === 0 ? (
          <Text style={styles.muted}>No sent signals.</Text>
        ) : (
          sentSignals.map((signal) => {
            const { label } = formatSignalTemplateWithDescription(signal.templateId);
            const statusLabel = outgoingSignalStatusLabel(signal.status, signal.replyCount);
            return (
              <View key={signal.id} style={styles.sentRow}>
                <View style={styles.sentHeader}>
                  <Text style={styles.sentTo}>
                    To {signal.recipientDisplayName || signal.recipientUserId}
                  </Text>
                  <Text
                    style={[
                      styles.statusLabel,
                      statusLabel === 'Acknowledged' && styles.statusAck,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
                <Text style={styles.templateText}>{label}</Text>
                <Text style={styles.muted}>{formatSignalSentRelativeTime(signal.createdAt)}</Text>
              </View>
            );
          })
        )}
      </View>

      {recentActivity.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabelMuted}>Recent activity</Text>
          {recentActivity.map((item) => {
            const { label } = formatSignalTemplateWithDescription(item.templateId);
            const peer = item.peerDisplayName?.trim() || 'Someone';
            return (
              <Text key={item.id} style={styles.recentRow}>
                {peer} · {label} · {formatSignalActivityRelativeTime(item.createdAt)}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  refresh: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 18,
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  sectionLabel: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  sectionLabelMuted: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  incomingCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent.DEFAULT,
    padding: 12,
    gap: 6,
  },
  senderName: {
    color: colors.text.primary,
    fontSize: 17,
    fontFamily: 'Cormorant-SemiBold',
  },
  templateText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },
  templateLabel: {
    color: colors.text.primary,
    fontFamily: 'Manrope-SemiBold',
  },
  ackButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  ackDisabled: {
    opacity: 0.7,
  },
  ackText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  sentRow: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  sentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  sentTo: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    flex: 1,
  },
  statusLabel: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  statusAck: {
    color: colors.accent.DEFAULT,
  },
  recentRow: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    paddingVertical: 4,
  },
  muted: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginBottom: 8,
  },
});
