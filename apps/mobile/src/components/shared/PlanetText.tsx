import { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { normalizePlanetName, planetColor, PLANET_NAME_PATTERN } from '../../constants/planet-colors';

type PlanetTextProps = {
  children: string;
  tone?: 'primary' | 'secondary';
  defaultColor?: string;
  style?: StyleProp<TextStyle>;
};

type TextPart = {
  text: string;
  planetName?: string;
};

function splitByPlanets(input: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = new RegExp(PLANET_NAME_PATTERN.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: input.slice(lastIndex, match.index) });
    }
    parts.push({ text: match[0], planetName: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    parts.push({ text: input.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ text: input }];
}

export function PlanetText({
  children,
  tone = 'secondary',
  defaultColor,
  style,
}: PlanetTextProps) {
  const parts = useMemo(() => splitByPlanets(children), [children]);
  const baseColor =
    defaultColor ?? (tone === 'primary' ? colors.text.primary : colors.text.secondary);

  return (
    <Text style={[tone === 'primary' ? styles.primary : styles.secondary, { color: baseColor }, style]}>
      {parts.map((part, index) => {
        if (part.planetName) {
          const color = planetColor(part.planetName) ?? baseColor;
          return (
            <Text
              key={`planet-${index}`}
              style={[styles.planet, { color, borderBottomColor: `${color}66` }]}
            >
              {part.text}
            </Text>
          );
        }
        return <Text key={`plain-${index}`}>{part.text}</Text>;
      })}
    </Text>
  );
}

/** Extract transiting planet from activation line prefix/text (API does not expose transitBody directly). */
export function extractTransitPlanetFromLine(prefixOrText: string): string | null {
  const src = prefixOrText.trim();
  if (!src) return null;

  const patterns = [
    /(?:Your|Their)\s+transiting\s+([A-Za-z]+)/i,
    /Transiting\s+([A-Za-z]+)/i,
  ];

  for (const pattern of patterns) {
    const match = src.match(pattern);
    if (match?.[1]) {
      return normalizePlanetName(match[1]);
    }
  }

  return null;
}

const styles = StyleSheet.create({
  primary: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Manrope-Regular',
  },
  secondary: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Manrope-Regular',
  },
  planet: {
    fontFamily: 'Manrope-SemiBold',
    borderBottomWidth: 1.5,
  },
});
