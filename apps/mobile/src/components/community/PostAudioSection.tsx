import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getExpoAv } from '../../lib/expo-av-guard';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import type { AudioSource } from '../../store/audio';
import { colors } from '../../constants/colors';

type PostAudioSectionProps = {
  exportId: string;
  label?: string | null;
  source?: Extract<AudioSource, 'post' | 'dm'>;
};

function PostAudioPlayerControls({ exportId, label, source }: PostAudioSectionProps) {
  const trackLabel = label?.trim() || 'Community Audio';
  const { handlePlay, isThisPlaying, isThisLoading } = useAudioPlayback({
    exportId,
    label: trackLabel,
    source: source ?? 'post',
  });

  return (
    <Pressable style={styles.audioRow} onPress={handlePlay} disabled={isThisLoading}>
      {isThisLoading ? (
        <ActivityIndicator size="small" color={colors.accent.DEFAULT} />
      ) : (
        <Text style={styles.playIcon}>{isThisPlaying ? '⏸' : '▶'}</Text>
      )}
      <Text style={styles.audioLabel} numberOfLines={1}>
        {trackLabel}
      </Text>
    </Pressable>
  );
}

export function PostAudioSection({ exportId, label, source }: PostAudioSectionProps) {
  if (!getExpoAv()) {
    return (
      <View style={styles.audioRow}>
        <Text style={styles.audioLabelMuted}>Audio requires full build</Text>
      </View>
    );
  }

  return <PostAudioPlayerControls exportId={exportId} label={label} source={source} />;
}

const styles = StyleSheet.create({
  audioRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playIcon: {
    color: colors.accent.DEFAULT,
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },
  audioLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  audioLabelMuted: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
  },
});
