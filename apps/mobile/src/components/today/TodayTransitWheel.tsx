import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NatalWheel } from '../chart/NatalWheel';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import { mapSnapshotToWheel } from '../../lib/my-sky-mappers';
import type { EphemerisSnapshot } from '../../types/my-sky';

const MAX_WHEEL_SIZE = 300;
const TRANSIT_LEGEND_COLOR = '#94A3B8';

export type TodayTransitWheelProps = {
  natalSnapshot: EphemerisSnapshot | null;
  transitSnapshot: EphemerisSnapshot | null;
};

export function TodayTransitWheel({ natalSnapshot, transitSnapshot }: TodayTransitWheelProps) {
  const { width } = useWindowDimensions();
  const natalWheel = natalSnapshot ? mapSnapshotToWheel(natalSnapshot) : null;
  const transitWheel = transitSnapshot ? mapSnapshotToWheel(transitSnapshot) : null;
  if (!natalWheel || !transitWheel) return null;

  const wheelSize = Math.min(width - AUTH_HORIZONTAL_PADDING * 2, MAX_WHEEL_SIZE);

  return (
    <View style={styles.container}>
      <NatalWheel
        size={wheelSize}
        placements={natalWheel.placements}
        aspects={natalWheel.aspects}
        cusps={natalWheel.cusps}
        ascendantLongitude={natalWheel.ascendantLongitude}
        transitPlacements={transitWheel.placements}
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent.DEFAULT }]} />
          <Text style={styles.legendText}>Natal positions</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: TRANSIT_LEGEND_COLOR }]} />
          <Text style={styles.legendText}>Transiting positions</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 8,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
  },
});
