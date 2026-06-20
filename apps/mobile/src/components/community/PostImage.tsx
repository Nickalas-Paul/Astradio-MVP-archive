import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { API_BASE } from '../../lib/api';
import { getToken } from '../../lib/token-storage';
import { colors } from '../../constants/colors';

type PostImageProps = {
  postId: string;
  imageUrl: string;
};

function resolveImageUri(imageUrl: string): string {
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

export function PostImage({ postId, imageUrl }: PostImageProps) {
  const uri = resolveImageUri(imageUrl);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>();
  const [authReady, setAuthReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (cancelled) return;
      setAuthHeaders(token ? { Authorization: `Bearer ${token}` } : {});
      setAuthReady(true);
      setFailed(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uri, postId]);

  if (failed) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={colors.text.muted} />
      </View>
    );
  }

  if (!authReady) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={colors.accent.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri, headers: authHeaders }}
        style={styles.image}
        contentFit="cover"
        accessibilityLabel="Post image"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  placeholder: {
    marginTop: 12,
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
