import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NatalWheel } from '../chart/NatalWheel';
import { ExpandableWheelFrame } from '../chart/ExpandableWheelFrame';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/layout';
import { WHEEL_COLORS } from '../../constants/wheel-constants';
import { mapSnapshotToWheel } from '../../lib/my-sky-mappers';
import type { EphemerisSnapshot } from '../../types/my-sky';

export type TodayTransitWheelProps = {
  natalSnapshot: EphemerisSnapshot | null;
  transitSnapshot: EphemerisSnapshot | null;
};

export function TodayTransitWheel({ natalSnapshot, transitSnapshot }: TodayTransitWheelProps) {
  const { width } = useWindowDimensions();
  const natalWheel = natalSnapshot ? mapSnapshotToWheel(natalSnapshot) : null;
  const transitWheel = transitSnapshot ? mapSnapshotToWheel(transitSnapshot) : null;
  if (!natalWheel || !transitWheel) return null;

  const wheelSize = width - layout.screenPadding * 2;

  return (
    <View style={styles.container}>
      <ExpandableWheelFrame wheelSize={wheelSize}>
        {(size) => (
          <NatalWheel
            size={size}
            placements={natalWheel.placements}
            aspects={natalWheel.aspects}
            cusps={natalWheel.cusps}
            ascendantLongitude={natalWheel.ascendantLongitude}
            transitPlacements={transitWheel.placements}
          />
        )}
      </ExpandableWheelFrame>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent.DEFAULT }]} />
          <Text style={styles.legendText}>Natal positions</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: WHEEL_COLORS.transitGlyphFill }]} />
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
