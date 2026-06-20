import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { NatalWheel } from '../chart/NatalWheel';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { mapSnapshotToWheel } from '../../lib/my-sky-mappers';
import type { EphemerisSnapshot } from '../../types/my-sky';

const MAX_WHEEL_SIZE = 300;

type TodaySkyWheelProps = {
  snapshot: EphemerisSnapshot | null;
};

export function TodaySkyWheel({ snapshot }: TodaySkyWheelProps) {
  const { width } = useWindowDimensions();
  const wheel = snapshot ? mapSnapshotToWheel(snapshot) : null;
  if (!wheel) return null;

  const wheelSize = Math.min(width - AUTH_HORIZONTAL_PADDING * 2, MAX_WHEEL_SIZE);

  return (
    <View style={styles.container}>
      <NatalWheel
        size={wheelSize}
        placements={wheel.placements}
        aspects={wheel.aspects}
        cusps={wheel.cusps}
        ascendantLongitude={wheel.ascendantLongitude}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 8,
  },
});
