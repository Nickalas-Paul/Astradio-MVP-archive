'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { normalizeChartForWheel, type ChartForWheel } from '../../core/chart-adapter';
import { extractAspects } from './wheel-aspects';
import { WheelSvgCore } from './WheelSvgCore';

export interface WheelDisplayProps {
  chartData?: unknown;
  isLoading?: boolean;
  showAspectLines?: boolean;
  className?: string;
  /** Max pixel size for the wheel SVG (default 600). */
  maxSize?: number;
}

export function WheelDisplay({
  chartData,
  isLoading = false,
  showAspectLines = false,
  className = '',
  maxSize = 600,
}: WheelDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(400);
  const [normalized, setNormalized] = useState<ChartForWheel | null>(null);
  const [aspects, setAspects] = useState<ReturnType<typeof extractAspects>>(undefined);
  const [aspectLinesVisible, setAspectLinesVisible] = useState(showAspectLines);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setWheelSize(Math.min(w, maxSize));
      }
    };
    updateSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, [maxSize]);

  useEffect(() => {
    if (!showAspectLines) {
      setAspectLinesVisible(false);
      return;
    }
    if (typeof window === 'undefined') {
      setAspectLinesVisible(true);
      return;
    }
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setAspectLinesVisible(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [showAspectLines]);

  useEffect(() => {
    if (!chartData || isLoading) {
      setNormalized(null);
      setAspects(undefined);
      return;
    }
    setNormalized(normalizeChartForWheel(chartData));
    setAspects(extractAspects(chartData));
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
            <WheelSvgCore
              chart={normalized}
              size={wheelSize}
              aspects={aspects}
              showAspectLines={aspectLinesVisible}
            />
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

export default WheelDisplay;
