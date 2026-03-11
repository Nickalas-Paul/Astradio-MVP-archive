'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { EphemerisSnapshot, SandboxOverrides, PlanetKey } from '../../types/sandbox';
import { normalizeChartForWheel, type ChartForWheel } from '../../core/chart-adapter';
import { BODY_DISPLAY_ORDER } from '../../../../../vnext/canonical-bodies';

const PLANET_GLYPH: Record<string, string> = {
  sun: '\u2609',
  moon: '\u263D',
  mercury: '\u263F',
  venus: '\u2640',
  mars: '\u2642',
  jupiter: '\u2643',
  saturn: '\u2644',
  uranus: '\u2645',
  neptune: '\u2646',
  pluto: '\u2647',
  chiron: '\u26B7',
  ceres: '\u26B3',
  pallas: '\u26B4',
  juno: '\u26B5',
  vesta: '\u26B6',
};

const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];

const WHEEL_COLORS = {
  outerRingStroke: '#4a5a7a',
  houseFill: '#1a2435',
  houseStroke: '#3d4f6e',
  houseNumberFill: '#b8c5d6',
  planetGlyphFill: '#e8ecf1',
  planetGlyphFillDragging: '#ffd700',
  markerFill: '#e8ecf1',
} as const;

/** Deterministic aspect line colors by type (conventional mapping). */
const ASPECT_LINE_COLOR: Record<string, string> = {
  conjunction: '#b8a070',
  sextile: '#6b9bb8',
  square: '#c66b6b',
  trine: '#4a9b7a',
  opposition: '#9470b8',
};

function pol(r: number, eclDeg: number) {
  const a = ((-eclDeg + 180) * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

/**
 * Canonical degree rounding: 0.1° precision for determinism
 */
function roundDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

function angleToLonDeg(angleRad: number): number {
  // Convert from screen angle (0 = right, CCW positive) to ecliptic longitude (0 = Aries, CCW)
  let lonDeg = (-angleRad * 180) / Math.PI + 180;
  while (lonDeg < 0) lonDeg += 360;
  while (lonDeg >= 360) lonDeg -= 360;
  return roundDegree(lonDeg);
}

function lonDegToAngle(lonDeg: number): number {
  // Convert ecliptic longitude to screen angle
  return ((-lonDeg + 180) * Math.PI) / 180;
}

function arcPath(r1: number, r2: number, a0: number, a1: number): string {
  const span = ((a1 - a0 + 360) % 360) || 360;
  const p0 = pol(r1, a0);
  const p1 = pol(r1, a1);
  const p2 = pol(r2, a1);
  const p3 = pol(r2, a0);
  const large = span > 180 ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

function getPlanetAtPoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number,
  positions: Record<string, number>,
  hitRadius: number = 15
): PlanetKey | null {
  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Check if click is near a planet
  if (dist > radius - hitRadius && dist < radius + hitRadius) {
    const angle = Math.atan2(dy, dx);
    const clickLon = angleToLonDeg(angle);
    
    // Find closest planet
    let closest: PlanetKey | null = null;
    let minDist = Infinity;
    
    for (const planet of PLANET_ORDER) {
      const planetLon = positions[planet];
      if (planetLon === undefined) continue;
      
      let dist = Math.abs(clickLon - planetLon);
      if (dist > 180) dist = 360 - dist;
      
      if (dist < minDist && dist < 10) {
        minDist = dist;
        closest = planet;
      }
    }
    
    return closest;
  }
  
  return null;
}

/** Which house index (0-11) contains this longitude given cusps. */
function houseIndexForLongitude(lonDeg: number, cusps: number[]): number {
  if (cusps.length < 12) return 0;
  const lon = ((lonDeg % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const inRange = end > start ? (lon >= start && lon < end) : (lon >= start || lon < end);
    if (inRange) return i;
  }
  return 0;
}

/** Clamp longitude to the arc of the given house index (0-11). Cusps in 0-360. */
function clampToHouse(lonDeg: number, houseIndex: number, cusps: number[]): number {
  if (cusps.length < 12) return roundDegree(lonDeg);
  const start = cusps[houseIndex];
  const end = cusps[(houseIndex + 1) % 12];
  let lon = ((lonDeg % 360) + 360) % 360;
  const inRange = end > start
    ? (lon >= start && lon < end)
    : (lon >= start || lon < end);
  if (inRange) return roundDegree(lonDeg);
  const distToStart = start <= lon ? lon - start : lon + (360 - start);
  const distToEnd = end >= lon ? end - lon : (360 - lon) + end;
  const clamped = distToStart <= distToEnd ? start : end;
  return roundDegree(clamped === 360 ? 0 : clamped);
}

type SnapshotAspectLike = { bodyA?: string; bodyB?: string; a?: string; b?: string; type: string; orb?: number };

export interface WheelCanvasBuilderProps {
  snapshot: EphemerisSnapshot | null;
  overrides: SandboxOverrides;
  onOverrideChange: (planet: PlanetKey, lonDeg: number) => void;
  isUpdating?: boolean;
  /** When true (default), drag is clamped to the house the planet started in */
  constrainToHouse?: boolean;
  /** Free-build mode: no birth snapshot; wheel from overrides only with equal-house reference */
  freeBuild?: boolean;
  /** When set, click-on-wheel places this planet (wheel-first placement). Used only in free-build. */
  selectedPlanetForPlacement?: PlanetKey | null;
  /** When true (default), aspect lines are drawn. Set false to hide. */
  showAspectLines?: boolean;
}

export function WheelCanvasBuilder({
  snapshot,
  overrides,
  onOverrideChange,
  isUpdating = false,
  constrainToHouse = true,
  freeBuild = false,
  selectedPlanetForPlacement = null,
  showAspectLines = true,
}: WheelCanvasBuilderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPlanet, setDraggingPlanet] = useState<PlanetKey | null>(null);
  const [dragStartHouse, setDragStartHouse] = useState<number | null>(null);
  const [wheelSize, setWheelSize] = useState(400);

  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current?.parentElement) {
        const w = svgRef.current.parentElement.offsetWidth;
        setWheelSize(Math.min(w, 600));
      }
    };
    updateSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  // Free-build: build display from overrides only; equal-house as reference (labeled)
  const freeBuildChart: ChartForWheel | null = freeBuild
    ? (() => {
        const positions: Record<string, number> = {};
        for (const [planet, override] of Object.entries(overrides.planets)) {
          if (override && Number.isFinite(override.lonDeg)) positions[planet] = override.lonDeg;
        }
        const cusps = Array.from({ length: 12 }, (_, i) => i * 30);
        return { positions, cusps };
      })()
    : null;

  const normalized = snapshot ? normalizeChartForWheel(snapshot) : freeBuildChart;
  if (!normalized) {
    return (
      <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl flex items-center justify-center">
        <p className="text-subtext text-sm">Load birth data to see the wheel</p>
      </div>
    );
  }

  // Merge base positions with overrides (for birth-first, overrides override snapshot)
  const positions: Record<string, number> = { ...normalized.positions };
  for (const [planet, override] of Object.entries(overrides.planets)) {
    if (override) {
      positions[planet] = override.lonDeg;
    }
  }

  const R_OUT = wheelSize / 2 - 4;
  const R_IN = R_OUT * 0.6;
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;

  /** Convert pointer from element (pixel) space to viewBox space so hit-test and angle use same units. */
  const pointerToViewBox = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const scaleX = wheelSize / (rect.width || 1);
    const scaleY = wheelSize / (rect.height || 1);
    return { x: px * scaleX, y: py * scaleY };
  }, [wheelSize]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const { x, y } = pointerToViewBox(e);
    const planet = getPlanetAtPoint(x, y, cx, cy, R_OUT, positions);
    if (planet) {
      setDraggingPlanet(planet);
      const useConstrain = freeBuild ? false : constrainToHouse;
      if (useConstrain && normalized.cusps.length >= 12) {
        const houseIdx = houseIndexForLongitude(positions[planet] ?? 0, normalized.cusps);
        setDragStartHouse(houseIdx);
      } else {
        setDragStartHouse(null);
      }
      svgRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (freeBuild) {
      // Click on wheel: place selected planet (or next unplaced) at click position — wheel is authoritative
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= R_IN - 10 && dist <= R_OUT + 20) {
        const angle = Math.atan2(dy, dx);
        const lonDeg = angleToLonDeg(angle);
        const toPlace = selectedPlanetForPlacement ?? PLANET_ORDER.find((p) => positions[p] === undefined) ?? 'sun';
        onOverrideChange(toPlace, lonDeg);
      }
    }
  }, [pointerToViewBox, cx, cy, R_OUT, R_IN, positions, constrainToHouse, freeBuild, selectedPlanetForPlacement, normalized?.cusps, onOverrideChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingPlanet || !svgRef.current) return;
    const { x, y } = pointerToViewBox(e);
    const dx = x - cx;
    const dy = y - cy;
    const angle = Math.atan2(dy, dx);
    let lonDeg = angleToLonDeg(angle);
    const useConstrain = freeBuild ? false : constrainToHouse;
    if (useConstrain && dragStartHouse !== null && normalized.cusps.length >= 12) {
      lonDeg = clampToHouse(lonDeg, dragStartHouse, normalized.cusps);
    }
    onOverrideChange(draggingPlanet, lonDeg);
  }, [draggingPlanet, pointerToViewBox, cx, cy, onOverrideChange, constrainToHouse, freeBuild, dragStartHouse, normalized?.cusps]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPlanet && svgRef.current) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    setDraggingPlanet(null);
    setDragStartHouse(null);
  }, [draggingPlanet]);

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        width={wheelSize}
        height={wheelSize}
        viewBox={`0 0 ${wheelSize} ${wheelSize}`}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g transform={`translate(${cx}, ${cy})`}>
          {/* Outer ring */}
          <circle r={R_OUT} fill="none" stroke={WHEEL_COLORS.outerRingStroke} strokeWidth={1} />
          
          {/* Houses */}
          {normalized.cusps.slice(0, 12).map((a0, i) => {
            const a1 = normalized.cusps[(i + 1) % 12];
            const span = a1 > a0 ? a1 - a0 : a1 + 360 - a0;
            return (
              <g key={i}>
                <path
                  d={arcPath(R_OUT, R_IN, a0, a0 + span)}
                  fill={WHEEL_COLORS.houseFill}
                  stroke={WHEEL_COLORS.houseStroke}
                  strokeWidth={1}
                  opacity={1}
                />
                <text
                  x={pol((R_OUT + R_IN) / 2, (a0 + span / 2) % 360).x}
                  y={pol((R_OUT + R_IN) / 2, (a0 + span / 2) % 360).y + 3}
                  textAnchor="middle"
                  fill={WHEEL_COLORS.houseNumberFill}
                  fontSize={10}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
          
          {/* Aspect lines (from snapshot state; same geometry as planets) */}
          {showAspectLines && snapshot?.aspects?.length
            ? snapshot.aspects.map((asp: SnapshotAspectLike, idx: number) => {
                const bodyA = asp.bodyA ?? asp.a ?? '';
                const bodyB = asp.bodyB ?? asp.b ?? '';
                const lonA = positions[bodyA];
                const lonB = positions[bodyB];
                if (lonA == null || lonB == null || !Number.isFinite(lonA) || !Number.isFinite(lonB)) return null;
                const p1 = pol(R_OUT - 10, lonA);
                const p2 = pol(R_OUT - 10, lonB);
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

          {/* Planets */}
          {Object.entries(positions).map(([name, deg]) => {
            if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
            const p = pol(R_OUT - 10, deg);
            const isDragging = draggingPlanet === name;
            return (
              <text
                key={name}
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fill={isDragging ? WHEEL_COLORS.planetGlyphFillDragging : WHEEL_COLORS.planetGlyphFill}
                fontSize={isDragging ? 18 : 14}
                fontWeight={isDragging ? 'bold' : 'normal'}
                style={{ cursor: 'grab', userSelect: 'none' }}
              >
                {PLANET_GLYPH[name] || '•'}
              </text>
            );
          })}
        </g>
      </svg>
      
      {isUpdating && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-bgElev/90 border border-border rounded text-xs text-subtext">
          Updating...
        </div>
      )}
      {freeBuild && (
        <p className="mt-2 text-xs text-subtext/80 text-center">
          {selectedPlanetForPlacement
            ? 'Click the wheel to place it. Or drag a planet to move it.'
            : Object.keys(positions).length === 0
            ? 'Select a planet above, then click the wheel to place it.'
            : 'Equal house (reference). Add birth data for actual house positions.'}
        </p>
      )}
    </div>
  );
}
