import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { normalizePlanetName, planetColor, PLANET_COLORS } from '../../constants/planet-colors';
import { BODY_DISPLAY_ORDER, PLANET_GLYPH, SIGN_GLYPH, WHEEL_COLORS } from '../../constants/wheel-constants';
import { getPlanetGlyphPath, getSignGlyphPath, type GlyphData } from '../../constants/wheel-glyphs';
import { clusterPlanetRadii, degreeTickStyle, pol, wheelRadii, zodiacSegmentPath } from '../../lib/chart-geometry';
import type { WheelAspect, WheelPlacement } from '../../types/my-sky';

type NatalWheelProps = {
  size: number;
  placements: WheelPlacement[];
  aspects: WheelAspect[];
  cusps: number[];
  ascendantLongitude: number;
  /** Optional inner-ring transit glyphs (composite transit chart). */
  transitPlacements?: WheelPlacement[];
};

const NATAL_PLANET_GLYPH_SIZE = 14;
const TRANSIT_PLANET_GLYPH_SIZE = 12;
const SIGN_GLYPH_SIZE = 14;

const ANGLE_GLYPH_BY_HOUSE_INDEX: Record<number, 'ascendant' | 'midheaven'> = {
  0: 'ascendant',
  9: 'midheaven',
};

const ANGLE_GLYPH_COLOR: Record<'ascendant' | 'midheaven', string> = {
  ascendant: PLANET_COLORS.ascendant,
  midheaven: PLANET_COLORS.mc,
};

function renderWheelGlyph(
  glyph: GlyphData,
  x: number,
  y: number,
  size: number,
  fill: string,
  opacity = 1
) {
  return (
    <G x={x} y={y} opacity={opacity}>
      <Svg
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        viewBox={glyph.viewBox}
      >
        <Path d={glyph.pathData} fill={fill} />
      </Svg>
    </G>
  );
}

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

export function NatalWheel({
  size,
  placements,
  aspects,
  cusps,
  ascendantLongitude,
  transitPlacements,
}: NatalWheelProps) {
  const angleGlyphSize = size >= 400 ? 24 : 18;

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
    () =>
      clusterPlanetRadii(
        visiblePlanets,
        geometry.planetRadius,
        size,
        geometry.innerRadius + 5,
        geometry.zodiacInnerRadius - 5
      ),
    [visiblePlanets, geometry.planetRadius, geometry.innerRadius, geometry.zodiacInnerRadius, size]
  );

  const transitLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    for (const placement of transitPlacements ?? []) {
      lookup.set(bodyKey(placement.body), placement.longitude);
    }
    return lookup;
  }, [transitPlacements]);

  const visibleTransitPlanets = useMemo(() => {
    if (!transitPlacements?.length) return [];
    const planets: Array<{ key: string; lon: number; glyph: string }> = [];
    for (const body of BODY_DISPLAY_ORDER) {
      const lon = transitLookup.get(body);
      if (lon == null) continue;
      planets.push({ key: body, lon, glyph: PLANET_GLYPH[body] ?? '•' });
    }
    return planets;
  }, [transitPlacements, transitLookup]);

  const transitPlanetRadius = useMemo(
    () => (geometry.innerRadius + geometry.planetRadius) / 2,
    [geometry.innerRadius, geometry.planetRadius]
  );

  const transitPlanetRadii = useMemo(
    () =>
      clusterPlanetRadii(
        visibleTransitPlanets,
        transitPlanetRadius,
        size,
        geometry.innerRadius + 5,
        geometry.zodiacInnerRadius - 5
      ),
    [visibleTransitPlanets, transitPlanetRadius, geometry.innerRadius, geometry.zodiacInnerRadius, size]
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
            const fill = signIndex % 2 === 0 ? WHEEL_COLORS.zodiacFillA : WHEEL_COLORS.zodiacFillB;
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
                stroke={WHEEL_COLORS.ringStroke}
                strokeWidth={1}
              />
            );
          })}

          {Array.from({ length: 360 }, (_, i) => {
            const deg = i;
            const { len, strokeWidth } = degreeTickStyle(deg, size);
            const outer = pol(geometry.outerRadius, deg, ascendantLongitude);
            const inner = pol(geometry.outerRadius - len, deg, ascendantLongitude);
            return (
              <Line
                key={`tick-${deg}`}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke={WHEEL_COLORS.outerRingStroke}
                strokeWidth={strokeWidth}
              />
            );
          })}

          {Array.from({ length: 12 }, (_, signIndex) => {
            const midLon = signIndex * 30 + 15;
            const glyphRadius = (geometry.outerRadius + geometry.zodiacInnerRadius) / 2;
            const point = pol(glyphRadius, midLon, ascendantLongitude);
            const signGlyph = getSignGlyphPath(signIndex);
            if (signGlyph) {
              return (
                <G key={`sign-${signIndex}`}>
                  {renderWheelGlyph(
                    signGlyph,
                    point.x,
                    point.y,
                    SIGN_GLYPH_SIZE,
                    WHEEL_COLORS.zodiacGlyphFill
                  )}
                </G>
              );
            }
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
            const planetGlyph = getPlanetGlyphPath(planet.key);
            if (planetGlyph) {
              return (
                <G key={`planet-${planet.key}`}>
                  {renderWheelGlyph(planetGlyph, point.x, point.y, NATAL_PLANET_GLYPH_SIZE, color)}
                </G>
              );
            }
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

          {visibleTransitPlanets.map((planet) => {
            const radius = transitPlanetRadii.get(planet.key) ?? transitPlanetRadius;
            const point = pol(radius, planet.lon, ascendantLongitude);
            const transitGlyph = getPlanetGlyphPath(planet.key);
            if (transitGlyph) {
              return (
                <G key={`transit-${planet.key}`}>
                  {renderWheelGlyph(
                    transitGlyph,
                    point.x,
                    point.y,
                    TRANSIT_PLANET_GLYPH_SIZE,
                    WHEEL_COLORS.transitGlyphFill
                  )}
                </G>
              );
            }
            return (
              <SvgText
                key={`transit-${planet.key}`}
                x={point.x}
                y={point.y + 4}
                fill={WHEEL_COLORS.transitGlyphFill}
                fontSize={11}
                fontWeight="600"
                textAnchor="middle"
              >
                {planet.glyph}
              </SvgText>
            );
          })}

          {cusps.slice(0, 12).map((a0, index) => {
            const angleGlyphKey = ANGLE_GLYPH_BY_HOUSE_INDEX[index];
            if (angleGlyphKey == null) return null;
            const angleGlyph = getPlanetGlyphPath(angleGlyphKey);
            if (!angleGlyph) return null;
            const anglePoint = pol(geometry.zodiacInnerRadius - 8, a0, ascendantLongitude);
            return (
              <G key={`angle-${angleGlyphKey}`}>
                {renderWheelGlyph(
                  angleGlyph,
                  anglePoint.x,
                  anglePoint.y,
                  angleGlyphSize,
                  ANGLE_GLYPH_COLOR[angleGlyphKey]
                )}
              </G>
            );
          })}

          <Circle
            r={geometry.outerRadius}
            stroke={WHEEL_COLORS.ringStroke}
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
