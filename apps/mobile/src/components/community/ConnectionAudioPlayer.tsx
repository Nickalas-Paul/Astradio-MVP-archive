import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { SaveToLibraryButton } from '../shared/SaveToLibraryButton';
import { colors } from '../../constants/colors';

type ConnectionAudioPlayerProps = {
  visible: boolean;
  exportId: string | null;
  audioAvailable: boolean;
  audioGenerating: boolean;
  peerDisplayName?: string;
  onGenerate: () => Promise<void>;
  relationshipId?: string;
  comparisonId?: string | null;
  chartIdLow?: string;
  chartIdHigh?: string;
};

function ConnectionPlaybackControls({
  exportId,
  peerDisplayName,
}: {
  exportId: string;
  peerDisplayName?: string;
}) {
  const label = peerDisplayName?.trim()
    ? `${peerDisplayName.trim()} Connection`
    : 'Connection Soundtrack';

  const { handlePlay, isThisPlaying, isThisLoading } = useAudioPlayback({
    exportId,
    label,
    source: 'connection',
  });

  return (
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
        {isThisLoading ? 'Loading...' : isThisPlaying ? 'Pause' : 'Play'}
      </Text>
    </Pressable>
  );
}

export function ConnectionAudioPlayer({
  visible,
  exportId,
  audioAvailable,
  audioGenerating,
  peerDisplayName,
  onGenerate,
  relationshipId,
  comparisonId,
  chartIdLow,
  chartIdHigh,
}: ConnectionAudioPlayerProps) {
  const [error, setError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  if (audioAvailable && exportId) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Hear this connection</Text>
        <Text style={styles.subtitle}>Your connection soundtrack is ready.</Text>
        <ConnectionPlaybackControls exportId={exportId} peerDisplayName={peerDisplayName} />
        {relationshipId && comparisonId ? (
          <SaveToLibraryButton
            exportId={exportId}
            source="community_relationship"
            compositionType="A+B"
            label="Connection reading"
            objectIdentityHash={comparisonId}
            sandboxState={{
              kind: 'community_relationship',
              relationshipId,
              comparisonId,
              chartIdLow,
              chartIdHigh,
            }}
          />
        ) : (
          <SaveToLibraryButton
            exportId={exportId}
            source="community_relationship"
            compositionType="A+B"
            label="Connection reading"
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Hear this connection</Text>
      <Pressable
        onPress={() => {
          setError(null);
          void onGenerate().catch((err) => {
            const message =
              err && typeof err === 'object' && 'error' in err
                ? String((err as { error?: string }).error ?? 'Could not compose audio')
                : 'Could not compose audio';
            setError(message.replace(/_/g, ' '));
          });
        }}
        disabled={audioGenerating}
        style={({ pressed }) => [
          styles.generateButton,
          audioGenerating && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {audioGenerating ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <Text style={styles.generateText}>Compose Soundtrack</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  heading: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  playButton: {
    minHeight: 48,
    minWidth: 120,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  generateButton: {
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  generateText: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 10,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});
