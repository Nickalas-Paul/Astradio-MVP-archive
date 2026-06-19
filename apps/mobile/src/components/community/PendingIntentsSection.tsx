import { PendingIntentCard } from './PendingIntentCard';
import { colors } from '../../constants/colors';
import type { PendingIntent } from '../../types/community';
import { StyleSheet, Text, View } from 'react-native';

type PendingIntentsSectionProps = {
  incoming: PendingIntent[];
  outgoing: PendingIntent[];
  onAccept: (intentId: string) => Promise<void>;
  onDecline: (intentId: string) => Promise<void>;
  onCancel: (intentId: string) => Promise<void>;
  mutationBusy?: boolean;
};

export function PendingIntentsSection({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onCancel,
  mutationBusy = false,
}: PendingIntentsSectionProps) {
  if (!incoming.length && !outgoing.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {incoming.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.heading}>Incoming requests</Text>
          {incoming.map((intent) => (
            <PendingIntentCard
              key={intent.id}
              intent={intent}
              variant="incoming"
              onAccept={onAccept}
              onDecline={onDecline}
              disabled={mutationBusy}
            />
          ))}
        </View>
      ) : null}

      {outgoing.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.heading}>Outgoing requests</Text>
          {outgoing.map((intent) => (
            <PendingIntentCard
              key={intent.id}
              intent={intent}
              variant="outgoing"
              onCancel={onCancel}
              disabled={mutationBusy}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  block: {
    marginBottom: 16,
  },
  heading: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 10,
  },
});
