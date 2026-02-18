'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { EphemerisSnapshot, SandboxOverrides, PlanetKey } from '../../types/sandbox';
import { normalizeChartForWheel, type ChartForWheel } from '../../core/chart-adapter';

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
};

const PLANET_ORDER: PlanetKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

const WHEEL_COLORS = {
  outerRingStroke: '#4a5a7a',
  houseFill: '#1a2435',
  houseStroke: '#3d4f6e',
  houseNumberFill: '#b8c5d6',
  planetGlyphFill: '#e8ecf1',
  planetGlyphFillDragging: '#ffd700',
  markerFill: '#e8ecf1',
} as const;

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

export interface WheelCanvasBuilderProps {
  snapshot: EphemerisSnapshot | null;
  overrides: SandboxOverrides;
  onOverrideChange: (planet: PlanetKey, lonDeg: number) => void;
  isUpdating?: boolean;
}

export function WheelCanvasBuilder({
  snapshot,
  overrides,
  onOverrideChange,
  isUpdating = false,
}: WheelCanvasBuilderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPlanet, setDraggingPlanet] = useState<PlanetKey | null>(null);
  const [wheelSize, setWheelSize] = useState(400);

  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current?.parentElement) {
        const w = svgRef.current.parentElement.offsetWidth;
        setWheelSize(Math.min(w, 600));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const normalized = snapshot ? normalizeChartForWheel(snapshot) : null;
  if (!normalized) {
    return (
      <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl flex items-center justify-center">
        <p className="text-subtext text-sm">Load birth data to see the wheel</p>
      </div>
    );
  }

  // Merge base positions with overrides
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

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const planet = getPlanetAtPoint(x, y, cx, cy, R_OUT, positions);
    if (planet) {
      setDraggingPlanet(planet);
      svgRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [cx, cy, R_OUT, positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingPlanet || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dx = x - cx;
    const dy = y - cy;
    const angle = Math.atan2(dy, dx);
    const lonDeg = angleToLonDeg(angle);
    
    // Already rounded by angleToLonDeg
    onOverrideChange(draggingPlanet, lonDeg);
  }, [draggingPlanet, cx, cy, onOverrideChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPlanet && svgRef.current) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    setDraggingPlanet(null);
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
    </div>
  );
}
