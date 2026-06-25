import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/auth';

export type SaveToLibraryButtonProps = {
  exportId: string;
  source: string;
  compositionType?: string;
  sandboxState?: Record<string, unknown>;
  label?: string;
  objectIdentityHash?: string;
  onSaved?: () => void;
};

type UiState = 'idle' | 'saving' | 'saved' | 'error';

function isValidExportId(exportId: string): boolean {
  return /^[a-f0-9]{64}$/.test(exportId.trim());
}

export function SaveToLibraryButton({
  exportId,
  source,
  compositionType = 'A',
  sandboxState = {},
  label,
  objectIdentityHash,
  onSaved,
}: SaveToLibraryButtonProps) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [uiState, setUiState] = useState<UiState>('idle');

  useEffect(() => {
    if (uiState !== 'error') return;
    const timer = setTimeout(() => setUiState('idle'), 3000);
    return () => clearTimeout(timer);
  }, [uiState]);

  const eid = String(exportId || '').trim();
  if (!isValidExportId(eid)) {
    return null;
  }

  const handleSave = async () => {
    if (!userId || uiState === 'saving' || uiState === 'saved') return;

    const hash = objectIdentityHash?.trim() || eid;
    setUiState('saving');

    try {
      await api(
        `/api/sandbox/compositions?userId=${encodeURIComponent(userId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            sandbox_state: sandboxState,
            vector_hash: hash,
            seed: `save_${source}_${hash.slice(0, 16)}`,
            plan_hash: hash,
            report: {
              savedFrom: source,
              label: label || null,
              at: new Date().toISOString(),
            },
            export_id: eid,
            source,
            composition_type: compositionType,
            object_identity_hash: objectIdentityHash?.trim() || null,
          }),
        }
      );
      setUiState('saved');
      onSaved?.();
    } catch {
      setUiState('error');
    }
  };

  const disabled = uiState === 'saving' || uiState === 'saved';
  const buttonLabel =
    uiState === 'saving'
      ? 'Saving...'
      : uiState === 'saved'
        ? 'Saved'
        : uiState === 'error'
          ? 'Save failed'
          : 'Save';

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void handleSave()}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          disabled && styles.buttonDisabled,
          pressed && !disabled && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  button: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent.DEFAULT,
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
  buttonTextDisabled: {
    color: colors.text.muted,
  },
});
