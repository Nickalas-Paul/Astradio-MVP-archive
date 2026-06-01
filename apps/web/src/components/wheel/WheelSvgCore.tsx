'use client';

import type { Ref, PointerEvent } from 'react';
import type { ChartForWheel } from '../../core/chart-adapter';
import { BODY_DISPLAY_ORDER } from '../../../../../vnext/canonical-bodies';
import { ASPECT_LINE_COLOR, PLANET_GLYPH, WHEEL_COLORS, type WheelAspect } from './wheel-constants';
import { arcPath, pol, resolveAscendantLongitude } from './wheel-geometry';

const BODY_ORDER: readonly string[] = BODY_DISPLAY_ORDER;

/** House index → angle label (professional chart wheel). */
const ANGLE_LABEL_BY_HOUSE_INDEX: Record<number, string> = {
  0: 'ASC',
  3: 'IC',
  6: 'DSC',
  9: 'MC',
};

/** Accent on dark house fill — brighter than brand #00674f for legibility on #1a2435. */
const ANGLE_LABEL_FILL = '#5ec9a8';
const ANGLE_LABEL_STROKE = 'rgba(232, 236, 241, 0.45)';
const SOUTH_NODE_OPACITY = 0.45;

export interface WheelSvgCoreProps {
  chart: ChartForWheel;
  size: number;
  /** H1 ecliptic longitude; defaults to chart.asc or cusps[0]. */
  ascendantLongitude?: number;
  positions?: Record<string, number>;
  aspects?: WheelAspect[];
  showAspectLines?: boolean;
  planetHighlight?: string | null;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  interactive?: boolean;
  onPointerDown?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: PointerEvent<SVGSVGElement>) => void;
}

export function WheelSvgCore({
  chart,
  size,
  ascendantLongitude,
  positions: positionsOverride,
  aspects,
  showAspectLines = false,
  planetHighlight = null,
  className = '',
  svgRef,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: WheelSvgCoreProps) {
  const positions = positionsOverride ?? chart.positions;
  const asc = resolveAscendantLongitude(chart, ascendantLongitude);
  const R_OUT = size / 2 - 4;
  const R_IN = R_OUT * 0.6;
  const cx = size / 2;
  const cy = size / 2;

  const planetNames = [
    ...BODY_ORDER.filter((name) => Object.prototype.hasOwnProperty.call(positions, name)),
    ...Object.keys(positions).filter((name) => !BODY_ORDER.includes(name)),
  ];

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
        <circle r={R_OUT} fill="none" stroke={WHEEL_COLORS.outerRingStroke} strokeWidth={1} />

        {chart.cusps.slice(0, 12).map((a0, i) => {
          const a1 = chart.cusps[(i + 1) % 12]!;
          const span = a1 > a0 ? a1 - a0 : a1 + 360 - a0;
          return (
            <g key={i}>
              <path
                d={arcPath(R_OUT, R_IN, a0, a1, asc)}
                fill={WHEEL_COLORS.houseFill}
                stroke={WHEEL_COLORS.houseStroke}
                strokeWidth={1}
                opacity={1}
              />
              {(() => {
                const midLon = (a0 + span / 2) % 360;
                const midPt = pol((R_OUT + R_IN) / 2, midLon, asc);
                const angleLabel = ANGLE_LABEL_BY_HOUSE_INDEX[i];
                const cuspPt = angleLabel != null ? pol(R_OUT - 8, a0, asc) : null;
                return (
                  <>
                    <text
                      x={midPt.x}
                      y={midPt.y + 3}
                      textAnchor="middle"
                      fill={WHEEL_COLORS.houseNumberFill}
                      fontSize={10}
                    >
                      {i + 1}
                    </text>
                    {angleLabel != null && cuspPt != null ? (
                      <text
                        x={cuspPt.x}
                        y={cuspPt.y + 4}
                        textAnchor="middle"
                        fill={ANGLE_LABEL_FILL}
                        stroke={ANGLE_LABEL_STROKE}
                        strokeWidth={0.6}
                        paintOrder="stroke fill"
                        fontSize={10}
                        fontWeight={600}
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
              const p1 = pol(R_OUT - 10, lonA, asc);
              const p2 = pol(R_OUT - 10, lonB, asc);
              const color = ASPECT_LINE_COLOR[asp.type] ?? '#6a7a8a';
              return (
                <line
                  key={`aspect-${idx}-${bodyA}-${bodyB}-${asp.type}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth={1}
                  strokeOpacity={0.7}
                />
              );
            })
          : null}

        {planetNames.map((name) => {
          const deg = positions[name];
          if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
          const p = pol(R_OUT - 10, deg, asc);
          const isHighlighted = planetHighlight === name;
          return (
            <text
              key={name}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fill={
                isHighlighted
                  ? WHEEL_COLORS.planetGlyphFillDragging
                  : WHEEL_COLORS.planetGlyphFill
              }
              fontSize={isHighlighted ? 18 : 14}
              fontWeight={isHighlighted ? 'bold' : 'normal'}
              style={interactive ? { cursor: 'grab', userSelect: 'none' } : undefined}
            >
              {PLANET_GLYPH[name.toLowerCase()] ?? PLANET_GLYPH[name] ?? '•'}
            </text>
          );
        })}

        {(() => {
          const nnLon = positions.northNode ?? positions.northnode;
          if (typeof nnLon !== 'number' || !Number.isFinite(nnLon)) return null;
          const southLon = (nnLon + 180) % 360;
          const p = pol(R_OUT - 10, southLon, asc);
          return (
            <text
              key="southNode-derived"
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fill={WHEEL_COLORS.planetGlyphFill}
              fontSize={11}
              opacity={SOUTH_NODE_OPACITY}
              pointerEvents="none"
            >
              {PLANET_GLYPH.southNode}
            </text>
          );
        })()}
      </g>
    </svg>
  );
}
