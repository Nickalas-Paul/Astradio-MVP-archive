import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { API_BASE } from '../../lib/api';
import { getToken } from '../../lib/token-storage';
import { colors } from '../../constants/colors';

type UserAvatarProps = {
  userId?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
  style?: ViewStyle | ImageStyle;
};

function resolveAvatarUri(userId: string | null | undefined, avatarUrl?: string | null): string | null {
  if (avatarUrl?.trim()) {
    if (avatarUrl.startsWith('http')) return avatarUrl;
    return `${API_BASE}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`;
  }
  if (userId?.trim()) {
    return `${API_BASE}/api/profile/avatar/${encodeURIComponent(userId.trim())}`;
  }
  return null;
}

export function UserAvatar({
  userId,
  displayName,
  avatarUrl,
  size = 44,
  style,
}: UserAvatarProps) {
  const initial = (displayName || '?').charAt(0).toUpperCase();
  const uri = resolveAvatarUri(userId, avatarUrl);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (cancelled) return;
      setAuthHeaders(token ? { Authorization: `Bearer ${token}` } : undefined);
      setFailed(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const radius = size / 2;

  if (!uri || failed) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: radius },
          style,
        ]}
      >
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri, headers: authHeaders }}
      style={[
        { width: size, height: size, borderRadius: radius },
        style as ImageStyle | undefined,
      ]}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.text.primary,
    fontFamily: 'Manrope-SemiBold',
  },
});
