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

type ExpandableWheelFrameProps = {
  wheelSize: number;
  children: (size: number) => ReactNode;
};

export function ExpandableWheelFrame({ wheelSize, children }: ExpandableWheelFrameProps) {
  const [expanded, setExpanded] = useState(false);
  const { width, height } = useWindowDimensions();
  const largeSize = Math.min(width - 48, height - 120);

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel="Expand chart wheel"
      >
        {children(wheelSize)}
      </Pressable>

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
              {children(largeSize)}
            </View>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
