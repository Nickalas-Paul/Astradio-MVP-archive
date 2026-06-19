import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../lib/api';
import { getExpoAv } from '../../lib/expo-av-guard';
import { getToken } from '../../lib/token-storage';
import { colors } from '../../constants/colors';

type Props = {
  exportId: string;
};

type ExpoAvModule = NonNullable<ReturnType<typeof getExpoAv>>;

function AudioUnavailable() {
  return (
    <Text style={styles.hint}>Audio playback requires a full build (not available in Expo Go).</Text>
  );
}

function SandboxAudioPlayerInner({
  exportId,
  expoAv,
}: {
  exportId: string;
  expoAv: ExpoAvModule;
}) {
  const { Audio } = expoAv;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const ensureSound = async () => {
    if (soundRef.current) return soundRef.current;
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
    return soundRef.current;
  };

  const togglePlayback = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const sound = await ensureSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) throw new Error('Audio failed to load');
      if (status.isPlaying) await sound.pauseAsync();
      else await sound.playAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Playback failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.playBtn} onPress={() => void togglePlayback()} disabled={isLoading}>
        <Text style={styles.playLabel}>
          {isLoading ? 'Loading…' : isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SandboxAudioPlayer({ exportId }: Props) {
  const expoAv = getExpoAv();
  if (!expoAv) {
    return (
      <View style={styles.wrap}>
        <AudioUnavailable />
      </View>
    );
  }
  return <SandboxAudioPlayerInner exportId={exportId} expoAv={expoAv} />;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  hint: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  error: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  playBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: colors.accent.DEFAULT,
  },
});
