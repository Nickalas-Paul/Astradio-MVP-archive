import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { getSignGlyphPath } from '../../constants/wheel-glyphs';

const SIGN_NAME_TO_INDEX: Record<string, number> = {
  aries: 0,
  taurus: 1,
  gemini: 2,
  cancer: 3,
  leo: 4,
  virgo: 5,
  libra: 6,
  scorpio: 7,
  sagittarius: 8,
  capricorn: 9,
  aquarius: 10,
  pisces: 11,
};

function signNameToIndex(name: string): number | null {
  const idx = SIGN_NAME_TO_INDEX[name.trim().toLowerCase()];
  return idx === undefined ? null : idx;
}

type PeerBigThree = {
  sun?: string;
  moon?: string;
  rising?: string;
};

function InlineSignGlyph({ signName, size = 15 }: { signName: string; size?: number }) {
  const signIndex = signNameToIndex(signName);
  const glyph = signIndex != null ? getSignGlyphPath(signIndex) : null;
  if (!glyph) return null;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={glyph.viewBox}
      preserveAspectRatio="xMidYMid meet"
    >
      <Path d={glyph.pathData} fill={colors.text.secondary} />
    </Svg>
  );
}

export function PeerBigThreeGlyphs({ bigThree }: { bigThree?: PeerBigThree | null }) {
  const signs = [bigThree?.sun, bigThree?.moon, bigThree?.rising].filter(
    (sign): sign is string => typeof sign === 'string' && sign.trim().length > 0
  );
  if (signs.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
      {signs.map((sign) => (
        <InlineSignGlyph key={sign} signName={sign} />
      ))}
    </View>
  );
}
