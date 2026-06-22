import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FOUNDER_USER_ID } from '../../constants/community-constants';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import type { InventoryPair } from '../../types/community';
import { UserAvatar } from './UserAvatar';
import { PeerBigThreeGlyphs } from './PeerBigThreeGlyphs';

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
        <UserAvatar
          userId={pair.peerUserId}
          displayName={displayName}
          size={40}
        />
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {displayName}
              {handle ? <Text style={styles.handle}> @{handle}</Text> : null}
            </Text>
            <PeerBigThreeGlyphs bigThree={pair.peerBigThree} />
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
        <View style={styles.secondaryActions}>
          <Pressable
            onPress={() => console.log('hear connection', pair.id)}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Text style={styles.ghostButtonText}>Hear this connection</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: layout.card.backgroundColor,
    borderRadius: layout.card.borderRadius,
    borderWidth: layout.card.borderWidth,
    borderColor: layout.card.borderColor,
    padding: layout.card.padding,
    marginBottom: layout.cardGap,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
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
    gap: 8,
    marginTop: 4,
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    width: '100%',
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
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
