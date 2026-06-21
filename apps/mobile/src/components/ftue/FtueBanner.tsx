import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import { dismissFtue, isFtueDismissed } from '../../lib/ftue-storage';

type FtueBannerProps = {
  storageKey: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function FtueBanner({ storageKey, message, actionLabel, onAction }: FtueBannerProps) {
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
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={handleDismiss} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.dismissText}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: layout.card.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.DEFAULT,
    padding: layout.card.padding,
    marginBottom: layout.sectionGap,
  },
  message: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Manrope-Regular',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 12,
  },
  actionText: {
    color: colors.accent.DEFAULT,
    fontSize: 14,
    fontFamily: 'Manrope-Medium',
  },
  dismissText: {
    color: colors.text.muted,
    fontSize: 13,
    fontFamily: 'Manrope-Medium',
  },
  pressed: {
    opacity: 0.85,
  },
});
