import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getExpoAv } from '../../lib/expo-av-guard';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { colors } from '../../constants/colors';

type TodayAudioPlayerProps = {
  exportId: string;
};

function AudioUnavailable() {
  return (
    <View style={styles.container}>
      <Text style={styles.unavailable}>Audio playback requires full build</Text>
    </View>
  );
}

function TodayAudioPlayerControls({ exportId }: TodayAudioPlayerProps) {
  const { handlePlay, isThisPlaying, isThisLoading } = useAudioPlayback({
    exportId,
    label: "Today's Transit",
    source: 'transit',
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePlay}
        disabled={isThisLoading}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, isThisLoading && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {isThisLoading ? 'Loading...' : isThisPlaying ? 'Pause' : 'Play'}
        </Text>
      </Pressable>
    </View>
  );
}

export function TodayAudioPlayer({ exportId }: TodayAudioPlayerProps) {
  if (!getExpoAv()) {
    return <AudioUnavailable />;
  }

  return <TodayAudioPlayerControls exportId={exportId} />;
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
});
