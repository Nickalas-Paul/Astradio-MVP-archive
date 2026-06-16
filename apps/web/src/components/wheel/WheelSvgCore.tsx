'use client';

import { useMemo, type Ref, PointerEvent } from 'react';
import type { ChartForWheel } from '../../core/chart-adapter';
import { PLANET_COLORS, normalizePlanetName } from '../../core/planet-identity';
import { formatCuspDegreeLabel } from '../../lib/zodiac-degrees';
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
  angularSeparationDeg,
  arcPath,
  aspectLineStyle,
  pol,
  radialLabelRotationDeg,
  resolveAscendantLongitude,
  zodiacSegmentPath,
} from './wheel-geometry';

const BODY_ORDER: readonly string[] = BODY_DISPLAY_ORDER;

/** House index → angle label (professional chart wheel). */
const ANGLE_LABEL_BY_HOUSE_INDEX: Record<number, string> = {
  0: 'ASC',
  3: 'IC',
  6: 'DSC',
  9: 'MC',
};

const SOUTH_NODE_OPACITY = 0.45;

function positionLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const deg = positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

function glyphForBody(name: string): string | null {
  const canonical = normalizePlanetName(name);
  if (canonical === 'southNode') return null;
  return PLANET_GLYPH[canonical] ?? null;
}

function hiddenCuspLabelIndices(cusps: number[]): Set<number> {
  const hidden = new Set<number>();
  for (let i = 0; i < 12; i++) {
    const a0 = cusps[i];
    const prev = cusps[(i + 11) % 12];
    if (a0 == null || prev == null) continue;
    if (angularSeparationDeg(a0, prev) < 5) hidden.add(i);
  }
  return hidden;
}

function isEqualHouseCusps(cusps: number[]): boolean {
  if (cusps.length < 12) return false;
  const asc = cusps[0]!;
  return cusps.every((c, i) => {
    const expected = (asc + i * 30) % 360;
    return Math.abs(c - expected) < 0.01;
  });
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
  const cuspLabelFontSize = size * 0.022;

  const showSignGlyphs = isTechnical && size >= 200;
  const showDegreeTicks = isTechnical && size >= 300;
  const equalHouses = useMemo(() => isEqualHouseCusps(chart.cusps), [chart.cusps]);
  const showCuspLabels = isTechnical && size >= 400 && !equalHouses;

  const cuspLabelHidden = useMemo(
    () => (showCuspLabels ? hiddenCuspLabelIndices(chart.cusps) : new Set<number>()),
    [chart.cusps, showCuspLabels]
  );

  const planetNames = BODY_ORDER.filter((name) => positionLongitude(positions, name) != null);
  const planetRadius = R_OUT - 10;
  const houseSectorStroke = isTechnical ? 0.5 : 1;

  const shortTickLen = Math.max(3, size * 0.012);
  const longTickLen = Math.max(6, size * 0.025);

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
                  return (
                    <text
                      key={`zodiac-glyph-${signIndex}`}
                      x={pt.x}
                      y={pt.y + zodiacGlyphSize * 0.35}
                      textAnchor="middle"
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
            {showDegreeTicks
              ? Array.from({ length: 72 }, (_, i) => {
                  const deg = i * 5;
                  const isSignBoundary = deg % 30 === 0;
                  const len = isSignBoundary ? longTickLen : shortTickLen;
                  const p0 = pol(R_OUT, deg, asc);
                  const p1 = pol(R_OUT - len, deg, asc);
                  return (
                    <line
                      key={`tick-${deg}`}
                      x1={p0.x}
                      y1={p0.y}
                      x2={p1.x}
                      y2={p1.y}
                      stroke={WHEEL_COLORS.tickStroke}
                      strokeWidth={isSignBoundary ? 1 : 0.5}
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
          const angleLabel = ANGLE_LABEL_BY_HOUSE_INDEX[i];
          return (
            <g key={i}>
              <path
                d={arcPath(R_OUT, R_IN, a0, a1, asc)}
                fill={WHEEL_COLORS.houseFill}
                stroke={WHEEL_COLORS.houseStroke}
                strokeWidth={houseSectorStroke}
                opacity={1}
              />
              {(() => {
                const midLon = (a0 + span / 2) % 360;
                const midPt = pol((R_OUT + R_IN) / 2, midLon, asc);
                const cuspPt = angleLabel != null ? pol(R_OUT - 8, a0, asc) : null;
                return (
                  <>
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
                    {angleLabel != null && cuspPt != null ? (
                      <text
                        x={cuspPt.x}
                        y={cuspPt.y + 4}
                        textAnchor="middle"
                        fill={WHEEL_COLORS.angleLabelFill}
                        fontSize={10}
                        fontWeight={600}
                        letterSpacing="0.05em"
                        fontFamily="Georgia, 'Cormorant Garamond', serif"
                      >
                        {angleLabel}
                      </text>
                    ) : null}
                  </>
                );
              })()}
            </g>
          );
        })}

        {showCuspLabels
          ? chart.cusps.slice(0, 12).map((a0, i) => {
              if (cuspLabelHidden.has(i)) return null;
              const isAngle = ANGLE_LABEL_BY_HOUSE_INDEX[i] != null;
              const labelRadius = isAngle
                ? R_OUT + zodiacBand * 0.82
                : R_OUT + zodiacBand * 0.45;
              const pt = pol(labelRadius, a0, asc);
              const rotation = radialLabelRotationDeg(pt.x, pt.y);
              return (
                <text
                  key={`cusp-label-${i}`}
                  x={pt.x}
                  y={pt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={WHEEL_COLORS.cuspLabelFill}
                  fontSize={cuspLabelFontSize}
                  fontFamily={WHEEL_GLYPH_FONT}
                  transform={`rotate(${rotation}, ${pt.x}, ${pt.y})`}
                  pointerEvents="none"
                  {...WHEEL_GLYPH_HALO}
                  style={{ fontVariantEmoji: 'text' }}
                >
                  {formatCuspDegreeLabel(a0)}
                </text>
              );
            })
          : null}

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
          const glyph = glyphForBody(name);
          if (!glyph) return null;
          const p = pol(planetRadius, deg, asc);
          const canonicalName = normalizePlanetName(name);
          const isHighlighted = highlightSet.has(canonicalName);
          const fill = PLANET_COLORS[canonicalName] ?? WHEEL_COLORS.planetGlyphFill;
          const planetInteractive = !interactive && (onPlanetHover != null || onPlanetClick != null);
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
              {glyph}
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
      </g>
    </svg>
  );
}
