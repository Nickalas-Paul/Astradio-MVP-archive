import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NatalWheel } from '../chart/NatalWheel';
import { AUTH_HORIZONTAL_PADDING } from '../../constants/auth-styles';
import { colors } from '../../constants/colors';
import type { MySkyScreenData } from '../../types/my-sky';

type DualWheelDisplayProps = {
  viewerLabel: string;
  peerLabel: string;
  viewerWheel: MySkyScreenData['wheel'];
  peerWheel: MySkyScreenData['wheel'];
  loading?: boolean;
  /** Optional cap on wheel diameter (e.g. ~35% of screen height). */
  maxWheelSize?: number;
};

export function DualWheelDisplay({
  viewerLabel,
  peerLabel,
  viewerWheel,
  peerWheel,
  loading = false,
  maxWheelSize,
}: DualWheelDisplayProps) {
  const { width, height } = useWindowDimensions();
  const gap = 16;
  const widthBased = Math.floor((width - AUTH_HORIZONTAL_PADDING * 2 - gap) / 2);
  const heightCap = Math.max(96, Math.floor(height * 0.35) - 28);
  const wheelSize = Math.min(widthBased, heightCap, maxWheelSize ?? widthBased);

  if (loading) {
    return (
      <View style={styles.row}>
        <View style={styles.column}>
          <View style={[styles.placeholder, { width: wheelSize, height: wheelSize }]} />
        </View>
        <View style={styles.column}>
          <View style={[styles.placeholder, { width: wheelSize, height: wheelSize }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { gap }]}>
      <View style={styles.column}>
        <Text style={styles.label}>{viewerLabel}</Text>
        {viewerWheel ? (
          <NatalWheel
            size={wheelSize}
            placements={viewerWheel.placements}
            aspects={viewerWheel.aspects}
            cusps={viewerWheel.cusps}
            ascendantLongitude={viewerWheel.ascendantLongitude}
          />
        ) : (
          <View style={[styles.placeholder, { width: wheelSize, height: wheelSize }]}>
            <Text style={styles.unavailable}>Wheel unavailable</Text>
          </View>
        )}
      </View>
      <View style={styles.column}>
        <Text style={styles.label}>{peerLabel}</Text>
        {peerWheel ? (
          <NatalWheel
            size={wheelSize}
            placements={peerWheel.placements}
            aspects={peerWheel.aspects}
            cusps={peerWheel.cusps}
            ascendantLongitude={peerWheel.ascendantLongitude}
          />
        ) : (
          <View style={[styles.placeholder, { width: wheelSize, height: wheelSize }]}>
            <Text style={styles.unavailable}>Wheel unavailable</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function DualWheelSkeleton() {
  const { width, height } = useWindowDimensions();
  const gap = 16;
  const widthBased = Math.floor((width - AUTH_HORIZONTAL_PADDING * 2 - gap) / 2);
  const heightCap = Math.max(96, Math.floor(height * 0.35) - 28);
  const wheelSize = Math.min(widthBased, heightCap);

  return (
    <View style={[styles.row, { gap }]}>
      <View style={[styles.placeholder, { width: wheelSize, height: wheelSize }]} />
      <View style={[styles.placeholder, { width: wheelSize, height: wheelSize }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
