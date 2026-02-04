'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { WheelCanvasProps } from '../types';
import { normalizeChartForWheel, type ChartForWheel } from '../core/chart-adapter';

/** Visibility sanity: palette must read clearly on dark navy (bg ~#0C1320). Glyphs and house numbers need explicit light fill. */
const WHEEL_COLORS = {
  outerRingStroke: '#4a5a7a',
  houseFill: '#1a2435',
  houseStroke: '#3d4f6e',
  houseNumberFill: '#b8c5d6',
  planetGlyphFill: '#e8ecf1',
  markerFill: '#e8ecf1',
} as const;

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

function pol(r: number, eclDeg: number) {
  const a = ((-eclDeg + 180) * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
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

function WheelSvg({ chart, size }: { chart: ChartForWheel; size: number }) {
  const R_OUT = size / 2 - 4;
  const R_IN = R_OUT * 0.6;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      <g transform={`translate(${cx}, ${cy})`}>
        <circle r={R_OUT} fill="none" stroke={WHEEL_COLORS.outerRingStroke} strokeWidth={1} />
        {chart.cusps.slice(0, 12).map((a0, i) => {
          const a1 = chart.cusps[(i + 1) % 12];
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
        {Object.entries(chart.positions).map(([name, deg]) => {
          if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
          const p = pol(R_OUT - 10, deg);
          return (
            <text
              key={name}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fill={WHEEL_COLORS.planetGlyphFill}
              fontSize={14}
            >
              {PLANET_GLYPH[name] || '•'}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

function WheelCanvas({
  chartData,
  isLoading = false,
  onPlanetClick,
  className = '',
}: WheelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(400);
  const [normalized, setNormalized] = useState<ChartForWheel | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setWheelSize(Math.min(w, 600));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!chartData || isLoading) {
      setNormalized(null);
      return;
    }
    const next = normalizeChartForWheel(chartData);
    setNormalized(next);
  }, [chartData, isLoading]);

  if (isLoading) {
    return (
      <div className={`wheel-container ${className}`}>
        <div
          ref={containerRef}
          className="w-full aspect-square bg-bgElev border border-border rounded-2xl flex items-center justify-center"
        >
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4" />
            <p className="text-subtext text-sm">Loading astrological chart...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`wheel-container ${className}`}>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full aspect-square bg-bgElev border border-border rounded-2xl overflow-hidden relative"
        style={{ minHeight: wheelSize }}
      >
        <div
          id="wheel"
          className="w-full h-full flex items-center justify-center"
          style={{ width: wheelSize, height: wheelSize, margin: '0 auto' }}
        >
          {normalized ? (
            <WheelSvg chart={normalized} size={wheelSize} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-subtext"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <p className="text-subtext text-sm">Waiting for chart data…</p>
                <p className="text-xs text-subtext mt-1">Generate a chart to see the wheel</p>
              </div>
            </div>
          )}
        </div>
        <div className="wheel-overlay" />
      </motion.div>
    </div>
  );
}

export default WheelCanvas;
