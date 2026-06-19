import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../lib/api';
import { getExpoAv } from '../../lib/expo-av-guard';
import { getToken } from '../../lib/token-storage';
import { colors } from '../../constants/colors';

type IdentityAudioCardProps = {
  exportId: string;
};

type ExpoAvModule = NonNullable<ReturnType<typeof getExpoAv>>;

function AudioUnavailable() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Identity Soundtrack</Text>
      <Text style={styles.unavailable}>Audio playback requires full build</Text>
    </View>
  );
}

function IdentityAudioCardInner({
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
    <View style={styles.card}>
      <Text style={styles.heading}>Your Sound</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => void togglePlayback()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.playButton,
            pressed && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          <Text style={styles.playButtonText}>
            {isLoading ? '…' : isPlaying ? '❚❚' : '▶'}
          </Text>
        </Pressable>
        <Text style={styles.label}>Identity Soundtrack</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function IdentityAudioCard({ exportId }: IdentityAudioCardProps) {
  const expoAv = getExpoAv();
  if (!expoAv) {
    return <AudioUnavailable />;
  }
  return <IdentityAudioCardInner exportId={exportId} expoAv={expoAv} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
  },
  heading: {
    color: colors.accent.DEFAULT,
    fontSize: 12,
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  label: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
  },
  unavailable: {
    color: colors.text.muted,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    marginTop: 8,
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
});
