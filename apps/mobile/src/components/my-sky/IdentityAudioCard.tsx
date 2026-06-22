import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getExpoAv } from '../../lib/expo-av-guard';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { colors } from '../../constants/colors';

type IdentityAudioCardProps = {
  exportId: string;
};

function AudioUnavailable() {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Identity Soundtrack</Text>
      <Text style={styles.unavailable}>Audio playback requires full build</Text>
    </View>
  );
}

function IdentityAudioCardControls({ exportId }: IdentityAudioCardProps) {
  const { handlePlay, isThisPlaying, isThisLoading } = useAudioPlayback({
    exportId,
    label: 'Your Identity',
    source: 'identity',
  });

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Your Sound</Text>
      <Pressable
        onPress={handlePlay}
        disabled={isThisLoading}
        style={({ pressed }) => [
          styles.hearButton,
          pressed && styles.pressed,
          isThisLoading && styles.disabled,
        ]}
      >
        <Text style={styles.hearButtonText}>
          {isThisLoading ? 'Loading…' : isThisPlaying ? 'Playing your chart' : 'Hear your chart'}
        </Text>
      </Pressable>
    </View>
  );
}

export function IdentityAudioCard({ exportId }: IdentityAudioCardProps) {
  if (!getExpoAv()) {
    return <AudioUnavailable />;
  }

  return <IdentityAudioCardControls exportId={exportId} />;
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
  hearButton: {
    minHeight: 44,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: 'Manrope-SemiBold',
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
});
