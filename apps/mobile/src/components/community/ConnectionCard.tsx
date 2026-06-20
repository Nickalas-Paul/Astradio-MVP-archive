import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FOUNDER_USER_ID } from '../../constants/community-constants';
import { colors } from '../../constants/colors';
import type { InventoryPair } from '../../types/community';

type ConnectionCardProps = {
  pair: InventoryPair;
};

function formatLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Connection';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function readingAvailable(status: string): boolean {
  return status === 'text_available' || status === 'audio_available' || status === 'available';
}

export function ConnectionCard({ pair }: ConnectionCardProps) {
  const router = useRouter();
  const displayName = pair.peerDisplayName?.trim() || 'Connection';
  const handle = pair.peerHandle?.trim();
  const status = String(pair.artifactStatus || 'not_generated');
  const isFounder =
    typeof pair.peerUserId === 'string' && pair.peerUserId.trim() === FOUNDER_USER_ID;

  const openConnection = () => {
    router.push({
      pathname: '/community/[relationshipId]',
      params: {
        relationshipId: pair.id,
        peerDisplayName: displayName,
        peerHandle: handle ?? '',
        label: pair.label ?? '',
      },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {displayName}
            {handle ? <Text style={styles.handle}> @{handle}</Text> : null}
          </Text>
          {pair.label ? (
            <View style={styles.labelBadge}>
              <Text style={styles.labelBadgeText}>{formatLabel(pair.label)}</Text>
            </View>
          ) : null}
          {isFounder ? (
            <View style={styles.founderBadge}>
              <Text style={styles.founderBadgeText}>Founder</Text>
            </View>
          ) : null}
        </View>
      </View>

      {readingAvailable(status) ? (
        <Text style={styles.readingStatus}>Reading available</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={openConnection}
          style={({ pressed }) => [styles.actionButton, styles.outlineButton, pressed && styles.pressed]}
        >
          <Text style={styles.outlineButtonText}>Open connection</Text>
        </Pressable>
        <Pressable
          onPress={() => console.log('hear connection', pair.id)}
          style={({ pressed }) => [styles.actionButton, styles.ghostButton, pressed && styles.pressed]}
        >
          <Text style={styles.ghostButtonText}>Hear this connection</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  topRow: {
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  handle: {
    color: colors.text.secondary,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
  },
  labelBadge: {
    backgroundColor: `${colors.accent.DEFAULT}1A`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelBadgeText: {
    color: colors.accent.DEFAULT,
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
    textTransform: 'capitalize',
  },
  founderBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  founderBadgeText: {
    color: colors.text.secondary,
    fontSize: 9,
    fontFamily: 'Manrope-Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  readingStatus: {
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  outlineButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  outlineButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  ghostButton: {
    backgroundColor: colors.surfaceLight,
  },
  ghostButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  pressed: {
    opacity: 0.85,
  },
});
