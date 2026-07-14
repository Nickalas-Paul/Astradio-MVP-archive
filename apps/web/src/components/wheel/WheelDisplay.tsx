'use client';

// Wheel render modes:
// - 'classic': Traditional 2D SVG chart via WheelSvgCore
// - 'cinematic': ArtisticViz synesthetic WebGL scene (lazy-loaded)
// Default: 'cinematic' with automatic fallback to 'classic' if WebGL unavailable
// Sandbox (WheelBuilder) bypasses this — always uses WheelSvgCore directly

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ComposeVisualControls } from '../../core/compose-visual-controls';
import { usePlacementHighlight } from '../../core/PlacementHighlightContext';
import { normalizeChartForWheel, type ChartForWheel } from '../../core/chart-adapter';
import { normalizePlanetName } from '../../core/planet-identity';
import { lonToSignDegMin, SIGN_NAMES } from '../../lib/zodiac-degrees';
import { BODY_LABELS, type BodyKey } from '../../../../../vnext/canonical-bodies';
import { extractAspects } from './wheel-aspects';
import { resolveAscendantLongitude } from './wheel-geometry';
import { useWheelDisplayMode } from '../../hooks/useWheelDisplayMode';
import { useWheelRenderMode } from '../../hooks/useWheelRenderMode';
import { AuraModal } from './AuraModal';
import { WheelModeToggle } from './WheelModeToggle';
import { WheelSvgCore } from './WheelSvgCore';

function planetDisplayName(bodyKey: string): string {
  const canonical = normalizePlanetName(bodyKey);
  return BODY_LABELS[canonical as BodyKey] ?? canonical.charAt(0).toUpperCase() + canonical.slice(1);
}

function formatPlanetHoverLabel(bodyKey: string, lon: number): string {
  const { signIndex, degree, minutes } = lonToSignDegMin(lon);
  const signName = SIGN_NAMES[signIndex] ?? '';
  const minStr = String(minutes).padStart(2, '0');
  return `${planetDisplayName(bodyKey)} · ${signName} ${degree}°${minStr}'`;
}

function lookupLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const canonical = normalizePlanetName(bodyKey);
  if (canonical === 'southNode') {
    const nn = positions.northNode ?? positions.northnode ?? positions.NorthNode;
    if (typeof nn === 'number' && Number.isFinite(nn)) return (nn + 180) % 360;
  }
  const deg = positions[canonical] ?? positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

export interface WheelDisplayProps {
  chartData?: unknown;
  isLoading?: boolean;
  showAspectLines?: boolean;
  className?: string;
  /** Max pixel size for the wheel SVG (default 600). */
  maxSize?: number;
  /** Explicit highlight overrides context (e.g. Sandbox drag). */
  planetHighlight?: string | string[] | Set<string> | null;
  /** Shown when chartData is absent (e.g. privacy-restricted preview). */
  emptyMessage?: string;
  /** Musical compose parameters for ArtisticViz (Today sky summary). */
  composeControls?: ComposeVisualControls | null;
}

export function WheelDisplay({
  chartData,
  isLoading = false,
  showAspectLines = false,
  className = '',
  maxSize = 600,
  planetHighlight: planetHighlightProp,
  emptyMessage,
  composeControls = null,
}: WheelDisplayProps) {
  const { mode: displayMode } = useWheelDisplayMode();
  const { mode: renderMode } = useWheelRenderMode();
  const { highlightedPlanets, setHighlight, clearHighlight } = usePlacementHighlight();
  const containerRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(400);
  const [normalized, setNormalized] = useState<ChartForWheel | null>(null);
  const [aspects, setAspects] = useState<ReturnType<typeof extractAspects>>(undefined);
  const [aspectLinesVisible, setAspectLinesVisible] = useState(showAspectLines);
  const [auraModalOpen, setAuraModalOpen] = useState(false);
  const prevRenderModeRef = useRef(renderMode);

  const effectiveHighlight =
    planetHighlightProp ??
    (highlightedPlanets.size > 0 ? highlightedPlanets : undefined);

  const enableBidirectional = planetHighlightProp == null;

  const hoverLabel = useMemo(() => {
    if (highlightedPlanets.size !== 1 || !normalized) return null;
    const bodyKey = [...highlightedPlanets][0]!;
    const lon = lookupLongitude(normalized.positions, bodyKey);
    if (lon == null) return null;
    return formatPlanetHoverLabel(bodyKey, lon);
  }, [highlightedPlanets, normalized]);

  useEffect(() => {
    if (renderMode === 'cinematic' && prevRenderModeRef.current !== 'cinematic') {
      setAuraModalOpen(true);
    }
    prevRenderModeRef.current = renderMode;
  }, [renderMode]);

  const handlePlanetHover = useCallback(
    (planet: string | null) => {
      if (planet) {
        setHighlight([planet]);
      } else {
        clearHighlight();
      }
    },
    [setHighlight, clearHighlight]
  );

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
      <div ref={containerRef} className={`wheel-container w-full ${className}`}>
        <div
          className="mx-auto flex items-center justify-center bg-bgElev border border-border rounded-2xl"
          style={{ width: wheelSize, height: wheelSize }}
        >
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4" />
            <p className="text-text-secondary text-sm">Loading astrological chart...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`wheel-container w-full ${className}`}>
      <motion.div
        id="wheel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto flex items-center justify-center bg-bgElev border border-border rounded-2xl overflow-hidden relative"
        style={{ width: wheelSize, height: wheelSize }}
      >
        {normalized ? (
          <>
            {wheelSize >= 200 ? (
              <div className="absolute top-2 right-2 z-20 pointer-events-auto">
                <WheelModeToggle />
              </div>
            ) : null}
            {(() => {
            const wheelProps = {
              chart: normalized,
              size: wheelSize,
              ascendantLongitude: resolveAscendantLongitude(normalized),
              aspects,
              showAspectLines: aspectLinesVisible,
              planetHighlight: effectiveHighlight,
              displayMode,
              onPlanetHover: enableBidirectional ? handlePlanetHover : undefined,
            };

            return <WheelSvgCore {...wheelProps} />;
          })()}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-text-secondary"
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
              <p className="text-text-secondary text-sm">
                {emptyMessage ?? 'Waiting for chart data…'}
              </p>
              {!emptyMessage ? (
                <p className="text-xs text-text-secondary mt-1">Compose a chart to see the wheel</p>
              ) : null}
            </div>
          </div>
        )}
        {hoverLabel ? (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 max-w-[92%] px-2.5 py-1 rounded-md bg-bg/95 border border-border text-caption text-text-primary text-center pointer-events-none z-10 whitespace-nowrap"
            aria-live="polite"
          >
            {hoverLabel}
          </div>
        ) : null}
        <div className="wheel-overlay pointer-events-none" />
      </motion.div>
      <AuraModal isOpen={auraModalOpen} onClose={() => setAuraModalOpen(false)} />
    </div>
  );
}

export default WheelDisplay;
