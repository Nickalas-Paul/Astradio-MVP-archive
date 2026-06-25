import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/format-api-error';
import { useAudioStore } from '../../store/audio';
import { colors } from '../../constants/colors';

type GenerateIdentityAudioButtonProps = {
  onGenerated: () => void | Promise<void>;
};

export function GenerateIdentityAudioButton({ onGenerated }: GenerateIdentityAudioButtonProps) {
  const playTrack = useAudioStore((s) => s.playTrack);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ identity_export_id?: string }>('/api/profile/identity-audio', {
        method: 'POST',
      });
      const exportId = data.identity_export_id;
      if (!exportId || !/^[a-f0-9]{64}$/.test(exportId)) {
        setError('Could not compose');
        return;
      }
      playTrack({ exportId, label: 'Identity Soundtrack', source: 'identity' });
      await onGenerated();
    } catch (err) {
      setError(formatApiError(err, 'Could not compose'));
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void handlePress()}
        disabled={loading}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text.primary} />
        ) : (
          <Text style={styles.buttonText}>Hear your chart</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  button: {
    minHeight: 48,
    minWidth: 160,
    backgroundColor: colors.accent.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
