import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { InventoryPair } from '../../types/community';
import { UserAvatar } from './UserAvatar';

type ConnectionCardProps = {
  pair: InventoryPair;
};

function formatLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Connection';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function ConnectionCard({ pair }: ConnectionCardProps) {
  const displayName = pair.peerDisplayName?.trim() || 'Connection';
  const handle = pair.peerHandle?.trim();

  const onPress = () => {
    console.log('navigate to', pair.id);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <UserAvatar
        userId={pair.peerUserId}
        displayName={displayName}
        size={44}
      />
      <View style={styles.textBlock}>
        <Text style={styles.name}>{displayName}</Text>
        {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{formatLabel(pair.label)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
  },
  handle: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
    textTransform: 'capitalize',
  },
});
