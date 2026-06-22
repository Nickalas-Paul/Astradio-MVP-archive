import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { dismissFtue, isFtueDismissed, sandboxCardHintKey } from '../../lib/ftue-storage';
import type { SandboxJourneyType } from '../../types/sandbox';

type SandboxCardHintProps = {
  journeyId: SandboxJourneyType;
  hintText: string;
};

export function SandboxCardHint({ journeyId, hintText }: SandboxCardHintProps) {
  const storageKey = sandboxCardHintKey(journeyId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isFtueDismissed(storageKey).then((dismissed) => {
      if (!cancelled && !dismissed) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  if (!visible) return null;

  const handleDismiss = () => {
    void dismissFtue(storageKey);
    setVisible(false);
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{hintText}</Text>
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss hint"
        hitSlop={8}
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
      >
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: `${colors.accent.DEFAULT}0D`,
    borderWidth: 1,
    borderColor: `${colors.accent.DEFAULT}33`,
  },
  text: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Manrope-Regular',
  },
  dismiss: {
    flexShrink: 0,
  },
  dismissText: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  pressed: {
    opacity: 0.85,
  },
});
