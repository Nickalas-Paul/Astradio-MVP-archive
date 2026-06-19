import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { API_BASE } from '../../lib/api';
import { getExpoAv } from '../../lib/expo-av-guard';
import { getToken } from '../../lib/token-storage';
import { useAudioStore } from '../../store/audio';
import { colors } from '../../constants/colors';

type ExpoAvModule = NonNullable<ReturnType<typeof getExpoAv>>;
type SoundInstance = InstanceType<ExpoAvModule['Audio']['Sound']>;

export default function MiniPlayer() {
  const currentTrack = useAudioStore((s) => s.currentTrack);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const isLoading = useAudioStore((s) => s.isLoading);
  const error = useAudioStore((s) => s.error);
  const duration = useAudioStore((s) => s.duration);
  const position = useAudioStore((s) => s.position);
  const setPlaybackStatus = useAudioStore((s) => s.setPlaybackStatus);
  const setLoading = useAudioStore((s) => s.setLoading);
  const setError = useAudioStore((s) => s.setError);
  const pause = useAudioStore((s) => s.pause);
  const resume = useAudioStore((s) => s.resume);
  const stop = useAudioStore((s) => s.stop);

  const soundRef = useRef<SoundInstance | null>(null);
  const lastStatusPositionRef = useRef(0);
  const seekInProgressRef = useRef(false);
  const loadingTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const expoAv = getExpoAv();
    if (!expoAv) return;
    void expoAv.Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }, []);

  useEffect(() => {
    return () => {
      void (async () => {
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
          } catch {
            // ignore unload errors on teardown
          }
          soundRef.current = null;
        }
      })();
    };
  }, []);

  useEffect(() => {
    const exportId = currentTrack?.exportId ?? null;
    loadingTrackIdRef.current = exportId;
    let cancelled = false;

    void (async () => {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {
          // ignore
        }
        soundRef.current = null;
      }

      if (!exportId || cancelled) {
        return;
      }

      const expoAv = getExpoAv();
      if (!expoAv) {
        setError('Audio playback requires full build');
        return;
      }

      try {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const { sound } = await expoAv.Audio.Sound.createAsync(
          { uri: `${API_BASE}/api/exports/${exportId}`, headers },
          { shouldPlay: true }
        );

        if (cancelled || loadingTrackIdRef.current !== exportId) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        lastStatusPositionRef.current = 0;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;

          if (status.didJustFinish) {
            useAudioStore.getState().stop();
            return;
          }

          const nextPosition = status.positionMillis / 1000;
          const nextDuration = (status.durationMillis ?? 0) / 1000;
          lastStatusPositionRef.current = nextPosition;

          if (seekInProgressRef.current) return;

          setPlaybackStatus({
            isPlaying: status.isPlaying,
            position: nextPosition,
            duration: nextDuration,
          });
        });

        if (!useAudioStore.getState().isPlaying) {
          await sound.pauseAsync();
        }

        setLoading(false);
      } catch {
        if (!cancelled && loadingTrackIdRef.current === exportId) {
          setError('Could not play audio');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.exportId, setError, setLoading, setPlaybackStatus]);

  useEffect(() => {
    if (isLoading || !soundRef.current) return;

    void (async () => {
      const sound = soundRef.current;
      if (!sound) return;

      try {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded) return;

        if (status.isPlaying && !isPlaying) {
          await sound.pauseAsync();
        } else if (!status.isPlaying && isPlaying) {
          await sound.playAsync();
        }
      } catch {
        setError('Could not play audio');
      }
    })();
  }, [isPlaying, isLoading, setError]);

  useEffect(() => {
    if (isLoading || !soundRef.current) return;

    if (Math.abs(position - lastStatusPositionRef.current) < 0.25) {
      return;
    }

    const sound = soundRef.current;
    seekInProgressRef.current = true;

    void (async () => {
      try {
        await sound.setPositionAsync(position * 1000);
        lastStatusPositionRef.current = position;
      } catch {
        setError('Could not seek audio');
      } finally {
        seekInProgressRef.current = false;
      }
    })();
  }, [position, isLoading, setError]);

  if (!currentTrack) {
    return null;
  }

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.bar}>
        <View style={styles.labelBlock}>
          <Text style={styles.label} numberOfLines={1}>
            {currentTrack.label}
          </Text>
          {error ? (
            <Text style={styles.errorText} numberOfLines={1}>
              {error}
            </Text>
          ) : null}
        </View>

        {error ? (
          <View style={styles.controlsSpacer} />
        ) : (
          <Pressable
            onPress={() => (isPlaying ? pause() : resume())}
            disabled={isLoading}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={() => stop()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          accessibilityLabel="Stop"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surfaceLight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.border,
    width: '100%',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.accent.DEFAULT,
  },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  labelBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  errorText: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  controlsSpacer: {
    width: 40,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: colors.text.muted,
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
  },
  pressed: {
    opacity: 0.85,
  },
});
