import { Image, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../lib/api';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import type { ProfileUser } from '../../types/my-sky';

type ProfileHeaderProps = {
  user: ProfileUser;
  bigThree: string | null;
};

function avatarUri(avatarUrl?: string): string | null {
  if (!avatarUrl?.trim()) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${API_BASE}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`;
}

export function ProfileHeader({ user, bigThree }: ProfileHeaderProps) {
  const initial = (user.displayName || '?').charAt(0).toUpperCase();
  const handle = user.handle?.trim();
  const uri = avatarUri(user.avatarUrl);

  return (
    <View style={styles.container}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.textBlock}>
        <Text style={styles.displayName}>{user.displayName}</Text>
        {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
        {bigThree ? <Text style={styles.bigThree}>{bigThree}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.cardGap,
    marginBottom: layout.sectionGap,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.text.primary,
    fontSize: 20,
    fontFamily: 'Manrope-SemiBold',
  },
  textBlock: {
    flex: 1,
  },
  displayName: {
    color: colors.text.primary,
    fontSize: 24,
    fontFamily: 'Cormorant-SemiBold',
  },
  handle: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  bigThree: {
    color: colors.text.secondary,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 6,
  },
});
