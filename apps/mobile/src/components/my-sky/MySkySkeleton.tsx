import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';

function PulseBlock({ height, width = '100%' as const }: { height: number; width?: `${number}%` }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { height, width, opacity }]} />;
}

export function MySkySkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <PulseBlock height={48} width="18%" />
        <View style={styles.headerText}>
          <PulseBlock height={22} />
          <View style={styles.gapSm} />
          <PulseBlock height={14} width="60%" />
        </View>
      </View>
      <View style={styles.gap} />
      <PulseBlock height={280} />
      <View style={styles.gap} />
      <PulseBlock height={18} width="40%" />
      <View style={styles.gapSm} />
      <PulseBlock height={120} />
      <View style={styles.gapSm} />
      <PulseBlock height={120} />
      <View style={styles.gap} />
      <PulseBlock height={18} width="30%" />
      <View style={styles.gapSm} />
      <PulseBlock height={56} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  gap: {
    height: 20,
  },
  gapSm: {
    height: 10,
  },
});
