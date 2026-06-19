import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getExpoAv } from '../../lib/expo-av-guard';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { colors } from '../../constants/colors';

type Props = {
  exportId: string;
};

function AudioUnavailable() {
  return (
    <Text style={styles.hint}>Audio playback requires a full build (not available in Expo Go).</Text>
  );
}

function SandboxAudioPlayerControls({ exportId }: Props) {
  const { handlePlay, isThisPlaying, isThisLoading } = useAudioPlayback({
    exportId,
    label: 'Sandbox Composition',
    source: 'sandbox',
  });

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.playBtn} onPress={handlePlay} disabled={isThisLoading}>
        <Text style={styles.playLabel}>
          {isThisLoading ? 'Loading…' : isThisPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
        </Text>
      </Pressable>
    </View>
  );
}

export function SandboxAudioPlayer({ exportId }: Props) {
  if (!getExpoAv()) {
    return (
      <View style={styles.wrap}>
        <AudioUnavailable />
      </View>
    );
  }

  return <SandboxAudioPlayerControls exportId={exportId} />;
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
