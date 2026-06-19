import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { normalizePlanetName, planetColor, PLANET_COLORS } from '../../constants/planet-colors';
import { BODY_DISPLAY_ORDER, PLANET_GLYPH, SIGN_GLYPH, WHEEL_COLORS } from '../../constants/wheel-constants';
import { angularSeparationDeg, pol, wheelRadii, zodiacSegmentPath } from '../../lib/chart-geometry';
import type { WheelAspect, WheelPlacement } from '../../types/my-sky';

type NatalWheelProps = {
  size: number;
  placements: WheelPlacement[];
  aspects: WheelAspect[];
  cusps: number[];
  ascendantLongitude: number;
};

const CLUSTER_THRESHOLD_DEG = 8;

function bodyKey(body: string): string {
  return body.toLowerCase().replace(/\s+/g, '');
}

function resolveBodyLongitude(
  body: string,
  placements: WheelPlacement[],
  lookup: Map<string, number>
): number | undefined {
  const key = bodyKey(body);
  if (lookup.has(key)) return lookup.get(key);
  const placement = placements.find((item) => bodyKey(item.body) === key);
  return placement?.longitude;
}

function clusterPlanetRadii(
  planets: Array<{ key: string; lon: number }>,
  baseRadius: number,
  size: number
): Map<string, number> {
  const sorted = [...planets].sort((a, b) => a.lon - b.lon);
  const radii = new Map<string, number>();
  const offset = size * 0.025;
  let clusterIndex = 0;
  let prevLon: number | null = null;

  for (const planet of sorted) {
    if (prevLon == null || angularSeparationDeg(planet.lon, prevLon) >= CLUSTER_THRESHOLD_DEG) {
      clusterIndex = 0;
    } else {
      clusterIndex += 1;
    }

    const radialShift = clusterIndex === 0 ? 0 : clusterIndex % 2 === 1 ? -offset : offset;
    radii.set(planet.key, baseRadius + radialShift);
    prevLon = planet.lon;
  }

  return radii;
}

export function NatalWheel({
  size,
  placements,
  aspects,
  cusps,
  ascendantLongitude,
}: NatalWheelProps) {
  const geometry = useMemo(() => {
    const cx = size / 2;
    const { R_ZODIAC, R_OUT, R_IN, planetRadius } = wheelRadii(size);
    return {
      cx,
      outerRadius: R_ZODIAC,
      zodiacInnerRadius: R_OUT,
      planetRadius,
      innerRadius: R_IN,
    };
  }, [size]);

  const longitudeLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const placement of placements) {
      lookup.set(bodyKey(placement.body), placement.longitude);
    }
    return lookup;
  }, [placements]);

  const visiblePlanets = useMemo(() => {
    const planets: Array<{ key: string; lon: number; glyph: string }> = [];
    for (const body of BODY_DISPLAY_ORDER) {
      const lon = longitudeLookup.get(body);
      if (lon == null) continue;
      planets.push({ key: body, lon, glyph: PLANET_GLYPH[body] ?? '•' });
    }
    return planets;
  }, [longitudeLookup]);

  const planetRadii = useMemo(
    () => clusterPlanetRadii(visiblePlanets, geometry.planetRadius, size),
    [visiblePlanets, geometry.planetRadius, size]
  );

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G x={geometry.cx} y={geometry.cx}>
          <Circle
            r={geometry.innerRadius}
            stroke={colors.border}
            strokeWidth={1}
            fill="transparent"
          />

          {Array.from({ length: 12 }, (_, signIndex) => {
            const fill = signIndex % 2 === 0 ? '#151B24' : '#1A222E';
            return (
              <Path
                key={`zodiac-${signIndex}`}
                d={zodiacSegmentPath(
                  geometry.outerRadius,
                  geometry.zodiacInnerRadius,
                  signIndex,
                  ascendantLongitude
                )}
                fill={fill}
                stroke="#333333"
                strokeWidth={1}
              />
            );
          })}

          {Array.from({ length: 12 }, (_, signIndex) => {
            const midLon = signIndex * 30 + 15;
            const glyphRadius = (geometry.outerRadius + geometry.zodiacInnerRadius) / 2;
            const point = pol(glyphRadius, midLon, ascendantLongitude);
            return (
              <SvgText
                key={`sign-${signIndex}`}
                x={point.x}
                y={point.y + 4}
                fill={colors.text.primary}
                fontSize={10}
                textAnchor="middle"
              >
                {SIGN_GLYPH[signIndex]}
              </SvgText>
            );
          })}

          {cusps.slice(0, 12).map((cuspLon, index) => {
            const houseOuter = pol(geometry.zodiacInnerRadius, cuspLon, ascendantLongitude);
            const inner = pol(geometry.innerRadius, cuspLon, ascendantLongitude);
            const isAsc = index === 0;
            return (
              <Line
                key={`cusp-${index}`}
                x1={inner.x}
                y1={inner.y}
                x2={houseOuter.x}
                y2={houseOuter.y}
                stroke={isAsc ? colors.accent.DEFAULT : colors.border}
                strokeWidth={isAsc ? 1.5 : 1}
              />
            );
          })}

          {cusps.slice(0, 12).map((a0, index) => {
            const a1 = cusps[(index + 1) % 12]!;
            const span = a1 > a0 ? a1 - a0 : a1 + 360 - a0;
            const midLon = (a0 + span / 2) % 360;
            const houseLabelRadius = (geometry.innerRadius + geometry.zodiacInnerRadius) / 2;
            const point = pol(houseLabelRadius, midLon, ascendantLongitude);
            return (
              <SvgText
                key={`house-num-${index}`}
                x={point.x}
                y={point.y + 3}
                fill={WHEEL_COLORS.houseNumberFill}
                fontSize={10}
                opacity={0.75}
                textAnchor="middle"
              >
                {index + 1}
              </SvgText>
            );
          })}

          {aspects.map((aspect, index) => {
            const lonA = resolveBodyLongitude(aspect.body1, placements, longitudeLookup);
            const lonB = resolveBodyLongitude(aspect.body2, placements, longitudeLookup);
            if (lonA == null || lonB == null) return null;

            const pointA = pol(geometry.innerRadius, lonA, ascendantLongitude);
            const pointB = pol(geometry.innerRadius, lonB, ascendantLongitude);
            const color =
              planetColor(aspect.body1) ??
              PLANET_COLORS[normalizePlanetName(aspect.body1)] ??
              colors.text.secondary;

            return (
              <Line
                key={`aspect-${index}`}
                x1={pointA.x}
                y1={pointA.y}
                x2={pointB.x}
                y2={pointB.y}
                stroke={color}
                strokeOpacity={0.3}
                strokeWidth={1}
              />
            );
          })}

          {visiblePlanets.map((planet) => {
            const radius = planetRadii.get(planet.key) ?? geometry.planetRadius;
            const point = pol(radius, planet.lon, ascendantLongitude);
            const color = PLANET_COLORS[normalizePlanetName(planet.key)] ?? colors.text.primary;
            return (
              <SvgText
                key={`planet-${planet.key}`}
                x={point.x}
                y={point.y + 4}
                fill={color}
                fontSize={11}
                fontWeight="600"
                textAnchor="middle"
              >
                {planet.glyph}
              </SvgText>
            );
          })}

          <Circle
            r={geometry.outerRadius}
            stroke="#333333"
            strokeWidth={1}
            fill="transparent"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
});
