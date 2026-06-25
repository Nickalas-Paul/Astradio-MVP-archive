import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { resolveLocalExportUri } from '../../lib/export-audio-local';
import { useAudioStore } from '../../store/audio';
import { colors } from '../../constants/colors';

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

  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);
  const lastStatusPositionRef = useRef(0);
  const seekInProgressRef = useRef(false);
  const loadingTrackIdRef = useRef<string | null>(null);

  const releasePlayer = () => {
    statusSubRef.current?.remove();
    statusSubRef.current = null;
    playerRef.current?.remove();
    playerRef.current = null;
  };

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    });
  }, []);

  useEffect(() => {
    return () => {
      releasePlayer();
    };
  }, []);

  useEffect(() => {
    const exportId = currentTrack?.exportId ?? null;
    loadingTrackIdRef.current = exportId;
    let cancelled = false;

    void (async () => {
      releasePlayer();

      if (!exportId || cancelled) {
        return;
      }

      try {
        const localUri = await resolveLocalExportUri(exportId);
        const player = createAudioPlayer(localUri, { updateInterval: 250 });

        if (cancelled || loadingTrackIdRef.current !== exportId) {
          player.remove();
          return;
        }

        playerRef.current = player;
        lastStatusPositionRef.current = 0;

        statusSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              setError('Could not play audio');
              setLoading(false);
            }
            return;
          }

          if (status.didJustFinish) {
            useAudioStore.getState().stop();
            return;
          }

          const nextPosition = status.currentTime;
          const nextDuration = status.duration;
          lastStatusPositionRef.current = nextPosition;

          if (seekInProgressRef.current) return;

          setPlaybackStatus({
            isPlaying: status.playing,
            position: nextPosition,
            duration: nextDuration,
          });
          setLoading(false);
        });

        if (useAudioStore.getState().isPlaying) {
          player.play();
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled && loadingTrackIdRef.current === exportId) {
          setError('Could not play audio');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      releasePlayer();
    };
  }, [currentTrack?.exportId, setError, setLoading, setPlaybackStatus]);

  useEffect(() => {
    if (isLoading || !playerRef.current) return;

    const player = playerRef.current;
    try {
      if (player.playing && !isPlaying) {
        player.pause();
      } else if (!player.playing && isPlaying) {
        player.play();
      }
    } catch {
      setError('Could not play audio');
    }
  }, [isPlaying, isLoading, setError]);

  useEffect(() => {
    if (isLoading || !playerRef.current) return;

    if (Math.abs(position - lastStatusPositionRef.current) < 0.25) {
      return;
    }

    const player = playerRef.current;
    seekInProgressRef.current = true;

    void (async () => {
      try {
        await player.seekTo(position);
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
