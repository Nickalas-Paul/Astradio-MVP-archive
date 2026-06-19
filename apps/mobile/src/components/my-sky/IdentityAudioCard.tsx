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
    label: 'Identity Soundtrack',
    source: 'identity',
  });

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Your Sound</Text>
      <View style={styles.row}>
        <Pressable
          onPress={handlePlay}
          disabled={isThisLoading}
          style={({ pressed }) => [
            styles.playButton,
            pressed && styles.pressed,
            isThisLoading && styles.disabled,
          ]}
        >
          <Text style={styles.playButtonText}>
            {isThisLoading ? '…' : isThisPlaying ? '❚❚' : '▶'}
          </Text>
        </Pressable>
        <Text style={styles.label}>Identity Soundtrack</Text>
      </View>
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
});
