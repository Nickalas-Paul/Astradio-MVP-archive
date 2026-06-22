import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { NatalWheel } from '../chart/NatalWheel';
import { ExpandableWheelFrame } from '../chart/ExpandableWheelFrame';
import { layout } from '../../constants/layout';
import { mapSnapshotToWheel } from '../../lib/my-sky-mappers';
import type { EphemerisSnapshot } from '../../types/my-sky';

type TodaySkyWheelProps = {
  snapshot: EphemerisSnapshot | null;
};

export function TodaySkyWheel({ snapshot }: TodaySkyWheelProps) {
  const { width } = useWindowDimensions();
  const wheel = snapshot ? mapSnapshotToWheel(snapshot) : null;
  if (!wheel) return null;

  const wheelSize = width - layout.screenPadding * 2;

  return (
    <View style={styles.container}>
      <ExpandableWheelFrame wheelSize={wheelSize}>
        {(size) => (
          <NatalWheel
            size={size}
            placements={wheel.placements}
            aspects={wheel.aspects}
            cusps={wheel.cusps}
            ascendantLongitude={wheel.ascendantLongitude}
          />
        )}
      </ExpandableWheelFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 8,
  },
});
