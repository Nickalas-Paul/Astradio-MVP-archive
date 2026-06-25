import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { colors } from '../../constants/colors';

type Props = {
  exportId: string;
};

export function SandboxAudioPlayer({ exportId }: Props) {
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

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
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
