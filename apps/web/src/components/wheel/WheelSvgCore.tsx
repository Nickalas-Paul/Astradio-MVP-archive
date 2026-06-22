'use client';

import { useMemo, type Ref, PointerEvent, type SVGAttributes } from 'react';
import type { ChartForWheel } from '../../core/chart-adapter';
import { PLANET_COLORS, normalizePlanetName } from '../../core/planet-identity';
import { BODY_DISPLAY_ORDER } from '../../../../../vnext/canonical-bodies';
import {
  ASPECT_LINE_COLOR,
  PLANET_GLYPH,
  SIGN_GLYPH,
  WHEEL_COLORS,
  WHEEL_GLYPH_FONT,
  WHEEL_GLYPH_HALO,
  type WheelAspect,
  type WheelDisplayMode,
} from './wheel-constants';
import {
  arcPath,
  aspectLineStyle,
  clusterPlanetRadii,
  degreeTickStyle,
  pol,
  resolveAscendantLongitude,
  zodiacSegmentPath,
} from './wheel-geometry';
import { getPlanetGlyphSvg, getSignGlyphSvg, type GlyphData } from './wheel-glyphs';

const BODY_ORDER: readonly string[] = BODY_DISPLAY_ORDER;

/** House index → angle glyph key (ASC at H1, MC at H10). */
const ANGLE_GLYPH_BY_HOUSE_INDEX: Record<number, 'ascendant' | 'midheaven'> = {
  0: 'ascendant',
  9: 'midheaven',
};

const ANGLE_GLYPH_COLOR: Record<'ascendant' | 'midheaven', string> = {
  ascendant: PLANET_COLORS.ascendant,
  midheaven: PLANET_COLORS.mc,
};

const SOUTH_NODE_OPACITY = 0.45;
const PLANET_GLYPH_SIZE = 16;
const PLANET_GLYPH_SIZE_HIGHLIGHTED = 22;
const SOUTH_NODE_GLYPH_SIZE = 13;
const SOUTH_NODE_GLYPH_SIZE_HIGHLIGHTED = 18;

function renderInlineGlyph({
  glyph,
  x,
  y,
  size,
  fill,
  haloWidth = 2.5,
  opacity = 1,
  gProps = {},
  signGlyph = false,
}: {
  glyph: GlyphData;
  x: number;
  y: number;
  size: number;
  fill: string;
  haloWidth?: number;
  opacity?: number;
  gProps?: SVGAttributes<SVGGElement> & { 'data-planet'?: string };
  /** Zodiac band glyphs: center on point with no text-baseline offset. */
  signGlyph?: boolean;
}) {
  return (
    <g transform={`translate(${x}, ${y})`} opacity={opacity} pointerEvents="all" {...gProps}>
      <svg
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        viewBox={glyph.viewBox}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        {signGlyph ? (
          <path d={glyph.pathData} fill={fill} pointerEvents="visiblePainted" />
        ) : (
          <path
            d={glyph.pathData}
            fill={fill}
            stroke={WHEEL_COLORS.glyphHaloStroke}
            strokeWidth={haloWidth}
            strokeLinejoin="round"
            paintOrder="stroke fill"
            pointerEvents="visiblePainted"
          />
        )}
      </svg>
    </g>
  );
}

function positionLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const deg = positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

function glyphForBody(name: string): string | null {
  const canonical = normalizePlanetName(name);
  if (canonical === 'southNode') return null;
  return PLANET_GLYPH[canonical] ?? null;
}

export interface WheelSvgCoreProps {
  chart: ChartForWheel;
  size: number;
  ascendantLongitude?: number;
  positions?: Record<string, number>;
  aspects?: WheelAspect[];
  showAspectLines?: boolean;
  planetHighlight?: string | string[] | Set<string> | null;
  displayMode?: WheelDisplayMode;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  interactive?: boolean;
  onPointerDown?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: PointerEvent<SVGSVGElement>) => void;
  onPlanetHover?: (planet: string | null) => void;
  onPlanetClick?: (planet: string) => void;
}

export function WheelSvgCore({
  chart,
  size,
  ascendantLongitude,
  positions: positionsOverride,
  aspects,
  showAspectLines = false,
  planetHighlight = null,
  displayMode = 'technical',
  className = '',
  svgRef,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPlanetHover,
  onPlanetClick,
}: WheelSvgCoreProps) {
  const isTechnical = displayMode === 'technical';

  const highlightSet = useMemo(() => {
    if (!planetHighlight) return new Set<string>();
    if (planetHighlight instanceof Set) {
      return new Set([...planetHighlight].map((p) => normalizePlanetName(p)));
    }
    if (Array.isArray(planetHighlight)) {
      return new Set(planetHighlight.map((p) => normalizePlanetName(p)));
    }
    return new Set([normalizePlanetName(planetHighlight)]);
  }, [planetHighlight]);

  const positions = positionsOverride ?? chart.positions;
  const asc = resolveAscendantLongitude(chart, ascendantLongitude);

  const R_ZODIAC = size / 2 - 4;
  const R_OUT = isTechnical ? R_ZODIAC - size * 0.08 : size / 2 - 4;
  const R_IN = R_OUT * 0.6;
  const cx = size / 2;
  const cy = size / 2;

  const zodiacBand = R_ZODIAC - R_OUT;
  const zodiacGlyphSize = Math.max(8, zodiacBand * 0.55);
  const angleGlyphSize = size >= 400 ? 24 : 18;

  const showSignGlyphs = isTechnical && size >= 200;

  const planetNames = BODY_ORDER.filter((name) => positionLongitude(positions, name) != null);
  const planetRadius = R_OUT - 10;
  const houseSectorStroke = isTechnical ? 0.5 : 1;

  const planetClusterInput = useMemo(
    () =>
      planetNames
        .map((name) => {
          const lon = positionLongitude(positions, name);
          return lon == null ? null : { key: name, lon };
        })
        .filter((p): p is { key: string; lon: number } => p != null),
    [planetNames, positions]
  );

  const planetRadii = useMemo(
    () => clusterPlanetRadii(planetClusterInput, planetRadius, size, R_IN + 5, R_OUT - 5),
    [planetClusterInput, planetRadius, size, R_IN, R_OUT]
  );

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`w-full h-full ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <g transform={`translate(${cx}, ${cy})`}>
        {isTechnical ? (
          <>
            {Array.from({ length: 12 }, (_, signIndex) => (
              <path
                key={`zodiac-${signIndex}`}
                d={zodiacSegmentPath(R_ZODIAC, R_OUT, signIndex, asc)}
                fill={signIndex % 2 === 0 ? WHEEL_COLORS.zodiacFillA : WHEEL_COLORS.zodiacFillB}
                stroke="none"
              />
            ))}
            <circle
              r={R_OUT}
              fill="none"
              stroke={WHEEL_COLORS.outerRingStroke}
              strokeWidth={1}
            />
            <circle
              r={R_ZODIAC}
              fill="none"
              stroke={WHEEL_COLORS.outerRingStroke}
              strokeWidth={1.5}
            />
            {showSignGlyphs
              ? Array.from({ length: 12 }, (_, signIndex) => {
                  const midLon = signIndex * 30 + 15;
                  const pt = pol((R_ZODIAC + R_OUT) / 2, midLon, asc);
                  const signGlyph = getSignGlyphSvg(signIndex);
                  if (signGlyph) {
                    return (
                      <g key={`zodiac-glyph-${signIndex}`} pointerEvents="none">
                        {renderInlineGlyph({
                          glyph: signGlyph,
                          x: pt.x,
                          y: pt.y,
                          size: zodiacGlyphSize,
                          fill: WHEEL_COLORS.zodiacGlyphFill,
                          haloWidth: 1.5,
                          signGlyph: true,
                        })}
                      </g>
                    );
                  }
                  return (
                    <text
                      key={`zodiac-glyph-${signIndex}`}
                      x={pt.x}
                      y={pt.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={WHEEL_COLORS.zodiacGlyphFill}
                      fontSize={zodiacGlyphSize}
                      fontFamily={WHEEL_GLYPH_FONT}
                      pointerEvents="none"
                      {...WHEEL_GLYPH_HALO}
                      style={{ fontVariantEmoji: 'text' }}
                    >
                      {SIGN_GLYPH[signIndex]}
                    </text>
                  );
                })
              : null}
            {isTechnical
              ? Array.from({ length: 360 }, (_, i) => {
                  const deg = i;
                  const { len, strokeWidth } = degreeTickStyle(deg, size);
                  const p0 = pol(R_ZODIAC, deg, asc);
                  const p1 = pol(R_ZODIAC - len, deg, asc);
                  return (
                    <line
                      key={`tick-${deg}`}
                      x1={p0.x}
                      y1={p0.y}
                      x2={p1.x}
                      y2={p1.y}
                      stroke={WHEEL_COLORS.tickStroke}
                      strokeWidth={strokeWidth}
                    />
                  );
                })
              : null}
          </>
        ) : (
          <circle r={R_OUT} fill="none" stroke={WHEEL_COLORS.outerRingStroke} strokeWidth={1} />
        )}

        {chart.cusps.slice(0, 12).map((a0, i) => {
          const a1 = chart.cusps[(i + 1) % 12]!;
          const span = a1 > a0 ? a1 - a0 : a1 + 360 - a0;
          const midLon = (a0 + span / 2) % 360;
          const midPt = pol((R_OUT + R_IN) / 2, midLon, asc);
          return (
            <g key={i}>
              <path
                d={arcPath(R_OUT, R_IN, a0, a1, asc)}
                fill={WHEEL_COLORS.houseFill}
                stroke={WHEEL_COLORS.houseStroke}
                strokeWidth={houseSectorStroke}
                opacity={1}
              />
              <text
                x={midPt.x}
                y={midPt.y + 3}
                textAnchor="middle"
                fill={WHEEL_COLORS.houseNumberFill}
                fontSize={10}
                fontFamily={WHEEL_GLYPH_FONT}
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {showAspectLines && aspects?.length
          ? aspects.map((asp, idx) => {
              const bodyA = asp.bodyA ?? asp.a ?? '';
              const bodyB = asp.bodyB ?? asp.b ?? '';
              const lonA = positions[bodyA];
              const lonB = positions[bodyB];
              if (
                lonA == null ||
                lonB == null ||
                !Number.isFinite(lonA) ||
                !Number.isFinite(lonB)
              ) {
                return null;
              }
              const p1 = pol(planetRadius, lonA, asc);
              const p2 = pol(planetRadius, lonB, asc);
              const color = ASPECT_LINE_COLOR[asp.type] ?? '#6a7a8a';
              const lineStyle = isTechnical ? aspectLineStyle(asp.orb) : { strokeWidth: 1, strokeOpacity: 0.7 };
              return (
                <line
                  key={`aspect-${idx}-${bodyA}-${bodyB}-${asp.type}`}
                  data-planet-a={bodyA.toLowerCase()}
                  data-planet-b={bodyB.toLowerCase()}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth={lineStyle.strokeWidth}
                  strokeOpacity={lineStyle.strokeOpacity}
                />
              );
            })
          : null}

        {planetNames.map((name) => {
          const deg = positionLongitude(positions, name);
          if (deg == null) return null;
          const radius = planetRadii.get(name) ?? planetRadius;
          const p = pol(radius, deg, asc);
          const canonicalName = normalizePlanetName(name);
          const isHighlighted = highlightSet.has(canonicalName);
          const fill = PLANET_COLORS[canonicalName] ?? WHEEL_COLORS.planetGlyphFill;
          const planetInteractive = !interactive && (onPlanetHover != null || onPlanetClick != null);
          const glyphSize = isHighlighted ? PLANET_GLYPH_SIZE_HIGHLIGHTED : PLANET_GLYPH_SIZE;
          const planetGlyph = getPlanetGlyphSvg(name);
          const interactionProps: SVGAttributes<SVGGElement> & { 'data-planet'?: string } = {
            'data-planet': canonicalName,
            style: {
              transition: 'opacity 0.2s ease',
              cursor: planetInteractive ? 'pointer' : interactive ? 'grab' : undefined,
              userSelect: interactive ? ('none' as const) : undefined,
            },
            onMouseEnter: planetInteractive ? () => onPlanetHover?.(canonicalName) : undefined,
            onMouseLeave: planetInteractive ? () => onPlanetHover?.(null) : undefined,
            onClick: planetInteractive ? () => onPlanetClick?.(canonicalName) : undefined,
          };

          if (planetGlyph) {
            return (
              <g key={name}>
                {renderInlineGlyph({
                  glyph: planetGlyph,
                  x: p.x,
                  y: p.y,
                  size: glyphSize,
                  fill,
                  gProps: interactionProps,
                })}
              </g>
            );
          }

          const unicodeGlyph = glyphForBody(name);
          if (!unicodeGlyph) return null;
          return (
            <text
              key={name}
              data-planet={canonicalName}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fill={fill}
              fontSize={isHighlighted ? 18 : 14}
              fontWeight={isHighlighted ? 'bold' : 'normal'}
              fontFamily={WHEEL_GLYPH_FONT}
              {...WHEEL_GLYPH_HALO}
              style={{
                fontVariantEmoji: 'text',
                transition: 'fill 0.2s ease, font-size 0.2s ease',
                cursor: planetInteractive ? 'pointer' : interactive ? 'grab' : undefined,
                userSelect: interactive ? ('none' as const) : undefined,
              }}
              onMouseEnter={planetInteractive ? () => onPlanetHover?.(canonicalName) : undefined}
              onMouseLeave={planetInteractive ? () => onPlanetHover?.(null) : undefined}
              onClick={planetInteractive ? () => onPlanetClick?.(canonicalName) : undefined}
            >
              {unicodeGlyph}
            </text>
          );
        })}

        {(() => {
          const nnLon = positionLongitude(positions, 'northNode');
          if (typeof nnLon !== 'number' || !Number.isFinite(nnLon)) return null;
          const southLon = (nnLon + 180) % 360;
          const p = pol(planetRadius, southLon, asc);
          const southHighlighted = highlightSet.has(normalizePlanetName('southNode'));
          const southFill = PLANET_COLORS.southNode ?? WHEEL_COLORS.planetGlyphFill;
          const southGlyphSize = southHighlighted
            ? SOUTH_NODE_GLYPH_SIZE_HIGHLIGHTED
            : SOUTH_NODE_GLYPH_SIZE;
          const southGlyph = getPlanetGlyphSvg('southNode');

          if (southGlyph) {
            return (
              <g key="southNode-derived" pointerEvents="none">
                {renderInlineGlyph({
                  glyph: southGlyph,
                  x: p.x,
                  y: p.y,
                  size: southGlyphSize,
                  fill: southFill,
                  opacity: southHighlighted ? 1 : SOUTH_NODE_OPACITY,
                  gProps: { 'data-planet': 'southNode' },
                })}
              </g>
            );
          }

          return (
            <text
              key="southNode-derived"
              data-planet="southNode"
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fill={southFill}
              fontSize={southHighlighted ? 16 : 11}
              fontWeight={southHighlighted ? 'bold' : 'normal'}
              opacity={southHighlighted ? 1 : SOUTH_NODE_OPACITY}
              fontFamily={WHEEL_GLYPH_FONT}
              pointerEvents="none"
              {...WHEEL_GLYPH_HALO}
              style={{ fontVariantEmoji: 'text', transition: 'fill 0.2s ease, font-size 0.2s ease' }}
            >
              {PLANET_GLYPH.southNode}
            </text>
          );
        })()}

        {chart.cusps.slice(0, 12).map((a0, i) => {
          const angleGlyphKey = ANGLE_GLYPH_BY_HOUSE_INDEX[i];
          if (angleGlyphKey == null) return null;
          const angleGlyph = getPlanetGlyphSvg(angleGlyphKey);
          if (!angleGlyph) return null;
          const anglePt = pol(R_OUT - 8, a0, asc);
          return (
            <g key={`angle-${angleGlyphKey}`} pointerEvents="none">
              {renderInlineGlyph({
                glyph: angleGlyph,
                x: anglePt.x,
                y: anglePt.y,
                size: angleGlyphSize,
                fill: ANGLE_GLYPH_COLOR[angleGlyphKey],
                haloWidth: 1.5,
              })}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
