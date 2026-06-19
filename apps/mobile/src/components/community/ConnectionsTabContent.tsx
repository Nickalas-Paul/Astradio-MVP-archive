import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { isInventoryCoreEmpty } from '../../lib/community-match-utils';
import type { InventoryPair, PendingIntent } from '../../types/community';
import { ConnectionCard } from './ConnectionCard';
import { PendingIntentsSection } from './PendingIntentsSection';

type ConnectionsTabContentProps = {
  pairs: InventoryPair[];
  pendingIncoming: PendingIntent[];
  pendingOutgoing: PendingIntent[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onSwitchToDiscovery: () => void;
  onAccept: (intentId: string) => Promise<void>;
  onDecline: (intentId: string) => Promise<void>;
  onCancel: (intentId: string) => Promise<void>;
  mutationBusy?: boolean;
};

export function ConnectionsTabContent({
  pairs,
  pendingIncoming,
  pendingOutgoing,
  loading,
  error,
  onRefresh,
  onSwitchToDiscovery,
  onAccept,
  onDecline,
  onCancel,
  mutationBusy = false,
}: ConnectionsTabContentProps) {
  const isEmpty = isInventoryCoreEmpty(pairs.length, pendingIncoming.length, pendingOutgoing.length);

  if (loading && !pairs.length && !pendingIncoming.length && !pendingOutgoing.length) {
    return <Text style={styles.loadingText}>Loading inventory…</Text>;
  }

  if (error && isEmpty) {
    return (
      <View style={styles.errorBlock}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => void onRefresh()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No connections yet</Text>
        <Text style={styles.emptyBody}>
          Explore Discovery to find people whose charts resonate with yours.
        </Text>
        <Pressable
          onPress={onSwitchToDiscovery}
          style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
        >
          <Text style={styles.emptyButtonText}>Explore Discovery</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Connections</Text>
          <Text style={styles.subtitle}>
            Accepted one-to-one links and pending requests. Discovery matches stay in Discovery until
            you request and accept a connection.
          </Text>
        </View>
        <Pressable
          onPress={() => void onRefresh()}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <PendingIntentsSection
        incoming={pendingIncoming}
        outgoing={pendingOutgoing}
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
        mutationBusy={mutationBusy}
      />

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>One-to-one</Text>
        {pairs.length === 0 ? (
          <Text style={styles.mutedText}>No saved pair connections yet.</Text>
        ) : (
          pairs.map((pair) => <ConnectionCard key={pair.id} pair={pair} />)
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    lineHeight: 18,
  },
  refreshButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  refreshText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  section: {
    marginTop: 8,
  },
  sectionHeading: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 10,
  },
  mutedText: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    paddingVertical: 24,
    textAlign: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  errorText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontFamily: 'Cormorant-SemiBold',
    marginBottom: 8,
  },
  emptyBody: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  pressed: {
    opacity: 0.85,
  },
});
