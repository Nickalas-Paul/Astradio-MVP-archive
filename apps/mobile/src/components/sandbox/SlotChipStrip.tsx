import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { SANDBOX_MAX_SLOTS } from '../../constants/sandbox-entry-cards';
import { projectSlotChips } from '../../lib/sandbox-slot-utils';
import type { SandboxSlot } from '../../types/sandbox';

type SlotChipStripProps = {
  slots: SandboxSlot[];
  activeSlotIndex: number;
  onSelectSlot: (index: number) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onClearSlot: (index: number) => void;
};

export function SlotChipStrip({
  slots,
  activeSlotIndex,
  onSelectSlot,
  onAddSlot,
  onRemoveSlot,
  onClearSlot,
}: SlotChipStripProps) {
  const rows = projectSlotChips(slots);
  const canAdd = slots.length < SANDBOX_MAX_SLOTS;
  const canRemove = slots.length > 1;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {rows.map((row) => {
        const active = row.index === activeSlotIndex;
        const chipStyle = [
          styles.chip,
          row.isManualStyle ? styles.chipManual : styles.chipSolid,
          active ? styles.chipActive : null,
        ];

        return (
          <View key={row.index} style={chipStyle}>
            <Pressable
              onPress={() => onSelectSlot(row.index)}
              style={styles.chipLabelPress}
              accessibilityRole="button"
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
                {row.label}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onClearSlot(row.index)}
              style={styles.chipAction}
              accessibilityRole="button"
              accessibilityLabel="Clear slot"
            >
              <Text style={styles.chipActionText}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => onRemoveSlot(row.index)}
              disabled={!canRemove}
              style={[styles.chipAction, !canRemove && styles.chipActionDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Remove slot"
            >
              <Text style={[styles.chipActionText, !canRemove && styles.chipActionTextDisabled]}>
                Remove
              </Text>
            </Pressable>
          </View>
        );
      })}

      {canAdd ? (
        <Pressable
          onPress={onAddSlot}
          style={[styles.chip, styles.addChip]}
          accessibilityRole="button"
          accessibilityLabel="Add slot"
        >
          <Text style={styles.addChipText}>+</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxWidth: 220,
    gap: 4,
  },
  chipSolid: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  chipManual: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${colors.border}cc`,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: colors.accent.DEFAULT,
    borderWidth: 2,
    backgroundColor: `${colors.accent.DEFAULT}18`,
  },
  chipLabelPress: {
    flexShrink: 1,
    minWidth: 48,
  },
  chipLabel: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
  chipLabelActive: {
    fontFamily: 'Manrope-SemiBold',
  },
  chipAction: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${colors.border}cc`,
    backgroundColor: colors.surfaceLight,
  },
  chipActionDisabled: {
    opacity: 0.4,
  },
  chipActionText: {
    color: colors.text.secondary,
    fontSize: 10,
    fontFamily: 'Manrope-Medium',
  },
  chipActionTextDisabled: {
    color: colors.text.muted,
  },
  addChip: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    borderColor: colors.accent.DEFAULT,
    borderStyle: 'dashed',
  },
  addChipText: {
    color: colors.accent.DEFAULT,
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    lineHeight: 22,
  },
});
