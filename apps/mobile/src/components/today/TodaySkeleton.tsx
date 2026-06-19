import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';

function PulseBlock({ height }: { height: number }) {
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

  return <Animated.View style={[styles.block, { height, opacity }]} />;
}

export function TodaySkeleton() {
  return (
    <View style={styles.container}>
      <PulseBlock height={28} />
      <View style={styles.gap} />
      <PulseBlock height={120} />
      <View style={styles.gap} />
      <PulseBlock height={96} />
      <View style={styles.gap} />
      <PulseBlock height={96} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  gap: {
    height: 16,
  },
});
