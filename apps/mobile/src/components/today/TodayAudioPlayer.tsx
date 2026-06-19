import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../lib/api';
import { getExpoAv } from '../../lib/expo-av-guard';
import { getToken } from '../../lib/token-storage';
import { colors } from '../../constants/colors';

type TodayAudioPlayerProps = {
  exportId: string;
};

type ExpoAvModule = NonNullable<ReturnType<typeof getExpoAv>>;

function AudioUnavailable() {
  return (
    <View style={styles.container}>
      <Text style={styles.unavailable}>Audio playback requires full build</Text>
    </View>
  );
}

function TodayAudioPlayerInner({
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
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
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
      if (!status.isLoaded) {
        throw new Error('Audio failed to load');
      }
      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch {
      setError('Could not play audio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => void togglePlayback()}
        disabled={isLoading}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, isLoading && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function TodayAudioPlayer({ exportId }: TodayAudioPlayerProps) {
  const expoAv = getExpoAv();
  if (!expoAv) {
    return <AudioUnavailable />;
  }

  return <TodayAudioPlayerInner exportId={exportId} expoAv={expoAv} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  unavailable: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingVertical: 12,
  },
  button: {
    minHeight: 48,
    minWidth: 120,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  error: {
    marginTop: 8,
    color: colors.error,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
});
