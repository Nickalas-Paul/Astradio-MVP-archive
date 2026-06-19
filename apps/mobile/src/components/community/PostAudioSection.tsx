import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../lib/api';
import { getExpoAv } from '../../lib/expo-av-guard';
import { getToken } from '../../lib/token-storage';
import { colors } from '../../constants/colors';

type PostAudioSectionProps = {
  exportId: string;
  label?: string | null;
};

type ExpoAvModule = NonNullable<ReturnType<typeof getExpoAv>>;

function PostAudioPlayerInner({
  exportId,
  label,
  expoAv,
}: PostAudioSectionProps & { expoAv: ExpoAvModule }) {
  const { Audio } = expoAv;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef<InstanceType<ExpoAvModule['Audio']['Sound']> | null>(null);

  useEffect(() => {
    return () => {
      void (async () => {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
      })();
    };
  }, []);

  const togglePlayback = async () => {
    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      if (!soundRef.current) {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const { sound } = await Audio.Sound.createAsync(
          { uri: `${API_BASE}/api/exports/${exportId}`, headers },
          { shouldPlay: false }
        );
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) setIsPlaying(false);
        });
        soundRef.current = sound;
      }
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable style={styles.audioRow} onPress={() => void togglePlayback()} disabled={isLoading}>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.accent.DEFAULT} />
      ) : (
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      )}
      <Text style={styles.audioLabel} numberOfLines={1}>
        {label?.trim() || 'Listen'}
      </Text>
    </Pressable>
  );
}

export function PostAudioSection({ exportId, label }: PostAudioSectionProps) {
  const expoAv = getExpoAv();
  if (!expoAv) {
    return (
      <View style={styles.audioRow}>
        <Text style={styles.audioLabelMuted}>Audio requires full build</Text>
      </View>
    );
  }
  return <PostAudioPlayerInner exportId={exportId} label={label} expoAv={expoAv} />;
}

const styles = StyleSheet.create({
  audioRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playIcon: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },
  audioLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  audioLabelMuted: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
});
