'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { EphemerisSnapshot, SandboxOverrides, PlanetKey } from '../../types/sandbox';
import { normalizeChartForWheel, type ChartForWheel } from '../../core/chart-adapter';
import { extractAspects } from './wheel-aspects';
import { angleToLonDeg } from './wheel-geometry';
import {
  clampToHouse,
  getPlanetAtPoint,
  houseIndexForLongitude,
  PLANET_ORDER,
} from './wheel-builder-math';
import { WheelSvgCore } from './WheelSvgCore';

export interface WheelBuilderProps {
  snapshot: EphemerisSnapshot | null;
  overrides: SandboxOverrides;
  onOverrideChange: (planet: PlanetKey, lonDeg: number) => void;
  isUpdating?: boolean;
  constrainToHouse?: boolean;
  freeBuild?: boolean;
  selectedPlanetForPlacement?: PlanetKey | null;
  showAspectLines?: boolean;
}

const EQUAL_HOUSE_BLANK: ChartForWheel = {
  positions: {},
  cusps: Array.from({ length: 12 }, (_, i) => i * 30),
};

export function WheelBuilder({
  snapshot,
  overrides,
  onOverrideChange,
  isUpdating = false,
  constrainToHouse = true,
  freeBuild = false,
  selectedPlanetForPlacement = null,
  showAspectLines = true,
}: WheelBuilderProps) {
  const effectiveFreeBuild = freeBuild || snapshot == null;
  const svgRef = useRef<SVGSVGElement | null>(null);
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

  const freeBuildChart: ChartForWheel | null = effectiveFreeBuild
    ? (() => {
        const positions: Record<string, number> = {};
        for (const [planet, override] of Object.entries(overrides.planets)) {
          if (override && Number.isFinite(override.lonDeg)) positions[planet] = override.lonDeg;
        }
        const cusps = Array.from({ length: 12 }, (_, i) => i * 30);
        return { positions, cusps };
      })()
    : null;

  const normalized =
    (snapshot != null ? normalizeChartForWheel(snapshot) : null) ??
    freeBuildChart ??
    EQUAL_HOUSE_BLANK;

  const positions: Record<string, number> = { ...normalized.positions };
  for (const [planet, override] of Object.entries(overrides.planets)) {
    if (override) {
      positions[planet] = override.lonDeg;
    }
  }

  const aspects = snapshot ? extractAspects(snapshot) : undefined;

  const R_OUT = wheelSize / 2 - 4;
  const R_IN = R_OUT * 0.6;
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;

  const pointerToViewBox = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const scaleX = wheelSize / (rect.width || 1);
      const scaleY = wheelSize / (rect.height || 1);
      return { x: px * scaleX, y: py * scaleY };
    },
    [wheelSize]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const { x, y } = pointerToViewBox(e);
      const planet = getPlanetAtPoint(x, y, cx, cy, R_OUT, positions);
      if (planet) {
        setDraggingPlanet(planet);
        const useConstrain = effectiveFreeBuild ? false : constrainToHouse;
        if (useConstrain && normalized.cusps.length >= 12) {
          const houseIdx = houseIndexForLongitude(positions[planet] ?? 0, normalized.cusps);
          setDragStartHouse(houseIdx);
        } else {
          setDragStartHouse(null);
        }
        svgRef.current.setPointerCapture(e.pointerId);
        e.preventDefault();
      } else if (effectiveFreeBuild || selectedPlanetForPlacement != null) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= R_IN - 10 && dist <= R_OUT + 20) {
          const angle = Math.atan2(dy, dx);
          const lonDeg = angleToLonDeg(angle);
          const toPlace =
            selectedPlanetForPlacement ??
            PLANET_ORDER.find((p) => positions[p] === undefined) ??
            'sun';
          onOverrideChange(toPlace, lonDeg);
        }
      }
    },
    [
      pointerToViewBox,
      cx,
      cy,
      R_OUT,
      R_IN,
      positions,
      constrainToHouse,
      effectiveFreeBuild,
      selectedPlanetForPlacement,
      normalized.cusps,
      onOverrideChange,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingPlanet || !svgRef.current) return;
      const { x, y } = pointerToViewBox(e);
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      let lonDeg = angleToLonDeg(angle);
      const useConstrain = effectiveFreeBuild ? false : constrainToHouse;
      if (useConstrain && dragStartHouse !== null && normalized.cusps.length >= 12) {
        lonDeg = clampToHouse(lonDeg, dragStartHouse, normalized.cusps);
      }
      onOverrideChange(draggingPlanet, lonDeg);
    },
    [
      draggingPlanet,
      pointerToViewBox,
      cx,
      cy,
      onOverrideChange,
      constrainToHouse,
      effectiveFreeBuild,
      dragStartHouse,
      normalized.cusps,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (draggingPlanet && svgRef.current) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
      setDraggingPlanet(null);
      setDragStartHouse(null);
    },
    [draggingPlanet]
  );

  return (
    <div className="relative w-full">
      <WheelSvgCore
        chart={normalized}
        size={wheelSize}
        positions={positions}
        aspects={aspects}
        showAspectLines={showAspectLines}
        planetHighlight={draggingPlanet}
        svgRef={svgRef}
        interactive
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {isUpdating && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-bgElev/90 border border-border rounded text-xs text-subtext">
          Updating...
        </div>
      )}
      {effectiveFreeBuild && (
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
