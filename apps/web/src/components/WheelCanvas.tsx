'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { WheelCanvasProps } from '../types';
import { stableStringify, sha256Hex } from '../core/hash';

function WheelCanvas({ 
  chartData, 
  isLoading = false, 
  onPlanetClick,
  className = '' 
}: WheelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(400);
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const size = Math.min(containerWidth, 600);
        setWheelSize(size);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize wheel when data is available
  useEffect(() => {
    if (chartData && !isLoading && !isInitialized) {
      // Initialize the wheel with chart data
      initializeWheel();
      setIsInitialized(true);
      
      // Add hover/auto-hide behavior for overlay controls
      const root = document.querySelector("section.relative.group");
      const controls = root?.querySelector(".controls") as HTMLElement;
      
      if (root && controls) {
        let hideTimer: number | null = null;
        
        function show() {
          controls.classList.add("!opacity-100");
          if (hideTimer) window.clearTimeout(hideTimer);
          hideTimer = window.setTimeout(() => controls.classList.remove("!opacity-100"), 2000);
        }
        
        root.addEventListener("mousemove", show);
        
        ["play","pause","stop"].forEach(id => {
          const el = root.querySelector<HTMLButtonElement>("#"+id);
          if (el) {
            el.addEventListener("focus", () => controls.classList.add("!opacity-100"));
            el.addEventListener("blur", () => controls.classList.remove("!opacity-100"));
          }
        });
      }
    }
  }, [chartData, isLoading, isInitialized]);

  const initializeWheel = async () => {
    if (!chartData || !containerRef.current) return;

    const hasValidData = (
      chartData.positions && Object.keys(chartData.positions).length > 0 &&
      chartData.cusps && Array.isArray(chartData.cusps) && chartData.cusps.length === 12
    );

    if (!hasValidData) {
      console.warn('WheelCanvas: Invalid chart data structure', chartData);
      return;
    }

    const planets = Object.entries(chartData.positions).map(([id, longitude]) => ({
      id,
      longitude: typeof longitude === 'number' ? longitude : parseFloat(longitude as string) || 0,
    }));

    const wheelSnapshot = {
      planets,
      houses: chartData.cusps,
      asc: (chartData as { asc?: number }).asc ?? chartData.cusps[0] ?? 0,
    };

    // Compute renderer hash deterministically from snapshot
    const rendererHash = await sha256Hex(stableStringify(wheelSnapshot));

    // Store globally for wheel.js to access
    (window as any).__wheelSnapshot = wheelSnapshot;
    (window as any).__rendererHash = rendererHash;

    // Trigger wheel render with compatibility for public/wheel.js
    const g = window as any;
    // Provide a compatibility shim if only Wheel.renderSnapshot is available
    if (typeof g.__wheelRedraw !== 'function' && g.Wheel && typeof g.Wheel.renderSnapshot === 'function') {
      g.__wheelRedraw = g.Wheel.renderSnapshot.bind(g.Wheel);
    }
    if (typeof g.__wheelRedraw === 'function') {
      g.__wheelRedraw(wheelSnapshot);
    } else if (g.Wheel && typeof g.Wheel.renderSnapshot === 'function') {
      g.Wheel.renderSnapshot(wheelSnapshot);
    }
  };

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
        {/* Wheel SVG Container */}
        <div 
          id="wheel" 
          className="w-full h-full"
          style={{ 
            width: wheelSize, 
            height: wheelSize,
            margin: '0 auto'
          }}
        />
        
        {/* Overlay for interactions */}
        <div className="wheel-overlay" />
        
        {/* Loading state overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-bgElev/80 flex items-center justify-center">
            <div className="text-center">
              <div className="loading-spinner mx-auto mb-4" />
              <p className="text-subtext text-sm">Rendering wheel...</p>
            </div>
          </div>
        )}
        
        {/* Empty state */}
        {(!chartData || !chartData.positions || !chartData.cusps?.length) && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-subtext text-sm">Waiting for chart data…</p>
              <p className="text-xs text-subtext mt-1">Generate a chart to see the wheel</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default WheelCanvas;
