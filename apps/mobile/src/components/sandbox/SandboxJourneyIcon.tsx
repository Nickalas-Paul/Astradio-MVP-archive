import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { SandboxJourneyType } from '../../types/sandbox';

type JourneyIconTheme = {
  color: string;
  bg: string;
};

const JOURNEY_ICON_THEMES: Record<SandboxJourneyType, JourneyIconTheme> = {
  solo: { color: '#0e9696', bg: 'rgba(14,150,150,0.1)' },
  pair: { color: '#E8C56D', bg: 'rgba(232,197,109,0.1)' },
  whatif: { color: '#D4836D', bg: 'rgba(212,131,109,0.1)' },
  group: { color: '#8FAFD4', bg: 'rgba(143,175,212,0.1)' },
};

function SoloIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="9" stroke={color} strokeWidth="1.5" />
      <Circle cx="14" cy="11" r="3" fill={color} opacity={0.5} />
    </Svg>
  );
}

function PairIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 28 28" fill="none">
      <Circle cx="10" cy="14" r="7" stroke={color} strokeWidth="1.5" />
      <Circle cx="18" cy="14" r="7" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

function WhatIfIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 28 28" fill="none">
      <Path
        d="M14 4l2.2 6.8H23l-5.5 4 2.1 6.7L14 17.4 8.4 21.5l2.1-6.7-5.5-4h6.8L14 4z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function GroupIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 28 28" fill="none">
      <Circle cx="8" cy="12" r="5" stroke={color} strokeWidth="1.5" />
      <Circle cx="20" cy="12" r="5" stroke={color} strokeWidth="1.5" />
      <Circle cx="14" cy="20" r="5" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

export function SandboxJourneyIcon({ journey }: { journey: SandboxJourneyType }) {
  const theme = JOURNEY_ICON_THEMES[journey];
  const icon =
    journey === 'solo' ? (
      <SoloIcon color={theme.color} />
    ) : journey === 'pair' ? (
      <PairIcon color={theme.color} />
    ) : journey === 'whatif' ? (
      <WhatIfIcon color={theme.color} />
    ) : (
      <GroupIcon color={theme.color} />
    );

  return <View style={[styles.badge, { backgroundColor: theme.bg }]}>{icon}</View>;
}

const styles = StyleSheet.create({
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
});
