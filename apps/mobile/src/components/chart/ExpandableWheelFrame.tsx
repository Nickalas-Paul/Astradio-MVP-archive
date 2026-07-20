import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';

export type WheelViewMode = 'chart' | 'aura';

type ExpandableWheelFrameProps = {
  wheelSize: number;
  children: (size: number) => ReactNode;
  /** When set, shows Chart | Aura toggle and swaps content for Aura mode. */
  auraContent?: (size: number) => ReactNode;
};

export function ExpandableWheelFrame({
  wheelSize,
  children,
  auraContent,
}: ExpandableWheelFrameProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<WheelViewMode>('chart');
  const { width, height } = useWindowDimensions();
  const largeSize = Math.min(width - 48, height - 160);
  const showAuraToggle = typeof auraContent === 'function';
  const renderContent = (size: number) =>
    mode === 'aura' && auraContent ? auraContent(size) : children(size);

  return (
    <>
      <View style={styles.frame}>
        {showAuraToggle ? (
          <View style={styles.toggleRow}>
            <View style={styles.toggle} accessibilityRole="tablist">
              <Pressable
                onPress={() => setMode('chart')}
                style={[styles.toggleBtn, mode === 'chart' && styles.toggleBtnActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'chart' }}
              >
                <Text style={[styles.toggleText, mode === 'chart' && styles.toggleTextActive]}>
                  Chart
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('aura')}
                style={[styles.toggleBtn, mode === 'aura' && styles.toggleBtnActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'aura' }}
              >
                <Text style={[styles.toggleText, mode === 'aura' && styles.toggleTextActive]}>
                  Aura
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {mode === 'aura' && showAuraToggle ? (
          <View style={styles.auraInline}>
            {renderContent(wheelSize)}
            <Pressable
              onPress={() => setExpanded(true)}
              style={styles.expandChip}
              accessibilityRole="button"
              accessibilityLabel="Expand Aura visualization"
            >
              <Text style={styles.expandChipText}>Expand</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel="Expand chart wheel"
          >
            {renderContent(wheelSize)}
          </Pressable>
        )}
      </View>

      <Modal
        visible={expanded}
        animationType="fade"
        transparent
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <Pressable style={styles.backdrop} onPress={() => setExpanded(false)}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setExpanded(false)}
              accessibilityRole="button"
              accessibilityLabel="Close expanded wheel"
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
            <View style={styles.wheelWrap} onStartShouldSetResponder={() => true}>
              {renderContent(largeSize)}
            </View>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    width: '100%',
  },
  toggleRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingRight: 4,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    minHeight: 28,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent.DEFAULT,
  },
  toggleText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  auraInline: {
    alignItems: 'center',
    width: '100%',
  },
  expandChip: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  expandChipText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Medium',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  wheelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.text.primary,
    fontSize: 18,
    fontFamily: 'Manrope-Regular',
    lineHeight: 20,
  },
});
