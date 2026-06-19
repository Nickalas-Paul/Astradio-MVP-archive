import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { TodayAudioPlayer } from '../today/TodayAudioPlayer';

type ConnectionAudioPlayerProps = {
  visible: boolean;
  exportId: string | null;
  audioAvailable: boolean;
  audioGenerating: boolean;
  onGenerate: () => Promise<void>;
};

export function ConnectionAudioPlayer({
  visible,
  exportId,
  audioAvailable,
  audioGenerating,
  onGenerate,
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
        <TodayAudioPlayer exportId={exportId} />
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
                ? String((err as { error?: string }).error ?? 'Could not generate audio')
                : 'Could not generate audio';
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
          <Text style={styles.generateText}>Generate Soundtrack</Text>
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
