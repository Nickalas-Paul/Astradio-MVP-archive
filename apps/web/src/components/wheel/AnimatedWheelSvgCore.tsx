'use client';

import { useEffect, useRef, useState } from 'react';
import { useAudioPlayerStore } from '../../store/audio-player';
import { ROTATION_DEG_PER_SEC } from '../../../../../vnext/render/animation-timing';
import { WheelSvgCore, type WheelSvgCoreProps } from './WheelSvgCore';

const DRAW_IN_COMPLETE_SEC = 3.0;
const HOLD_ROTATION_RAMP_START_SEC = 2.4;
const HOLD_ROTATION_RAMP_END_SEC = 3.0;
const HOLD_ROTATION_RAMP_DURATION_SEC = HOLD_ROTATION_RAMP_END_SEC - HOLD_ROTATION_RAMP_START_SEC;

export type AnimatedWheelSvgCoreProps = Omit<
  WheelSvgCoreProps,
  | 'zodiacOpacity'
  | 'houseOpacity'
  | 'aspectOpacity'
  | 'planetOpacity'
  | 'angleOpacity'
  | 'planetCount'
  | 'rotationDeg'
>;

type LayerAnimationProps = Pick<
  WheelSvgCoreProps,
  | 'zodiacOpacity'
  | 'houseOpacity'
  | 'aspectOpacity'
  | 'planetOpacity'
  | 'angleOpacity'
  | 'planetCount'
  | 'rotationDeg'
>;

const INITIAL_LAYERS: LayerAnimationProps = {
  zodiacOpacity: 0,
  houseOpacity: 0,
  aspectOpacity: 0,
  planetOpacity: 0,
  angleOpacity: 0,
  planetCount: undefined,
  rotationDeg: 0,
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
}

function phaseProgress(elapsedSec: number, startSec: number, endSec: number): number {
  if (elapsedSec <= startSec) return 0;
  if (elapsedSec >= endSec) return 1;
  return easeOutCubic((elapsedSec - startSec) / (endSec - startSec));
}

/** Integral of easeOutCubic from 0 to t (t in 0..1). */
function integralEaseOutCubic01(t: number): number {
  const u = Math.min(Math.max(t, 0), 1);
  return (3 * u * u) / 2 - u * u * u + (u * u * u * u) / 4;
}

function slowRotationDeg(elapsedSec: number): number {
  if (elapsedSec <= HOLD_ROTATION_RAMP_START_SEC) return 0;

  if (elapsedSec < HOLD_ROTATION_RAMP_END_SEC) {
    const rampElapsed = elapsedSec - HOLD_ROTATION_RAMP_START_SEC;
    const u = rampElapsed / HOLD_ROTATION_RAMP_DURATION_SEC;
    return (
      HOLD_ROTATION_RAMP_DURATION_SEC * integralEaseOutCubic01(u) * ROTATION_DEG_PER_SEC
    );
  }

  const rampRotation =
    HOLD_ROTATION_RAMP_DURATION_SEC *
    integralEaseOutCubic01(1) *
    ROTATION_DEG_PER_SEC;
  return rampRotation + (elapsedSec - HOLD_ROTATION_RAMP_END_SEC) * ROTATION_DEG_PER_SEC;
}

function resolveHoldRotation(elapsedSec: number): number {
  if (elapsedSec < DRAW_IN_COMPLETE_SEC) {
    return slowRotationDeg(elapsedSec);
  }
  const { isPlaying, currentTime, duration } = useAudioPlayerStore.getState();
  if (isPlaying && duration > 0) {
    return (currentTime / duration) * 360;
  }
  return slowRotationDeg(elapsedSec);
}

function computeWidgetLayers(elapsedSec: number): LayerAnimationProps {
  if (elapsedSec >= DRAW_IN_COMPLETE_SEC) {
    return {
      zodiacOpacity: 1,
      houseOpacity: 1,
      aspectOpacity: 1,
      planetOpacity: 1,
      angleOpacity: 1,
      planetCount: undefined,
      rotationDeg: resolveHoldRotation(elapsedSec),
    };
  }

  return {
    zodiacOpacity: phaseProgress(elapsedSec, 0.0, 0.8),
    planetOpacity: phaseProgress(elapsedSec, 0.4, 1.4),
    aspectOpacity: phaseProgress(elapsedSec, 1.0, 2.0),
    houseOpacity: phaseProgress(elapsedSec, 1.4, 2.4),
    angleOpacity: phaseProgress(elapsedSec, 1.4, 2.4),
    planetCount: undefined,
    rotationDeg: slowRotationDeg(elapsedSec),
  };
}

export function AnimatedWheelSvgCore({ aspects, ...wheelProps }: AnimatedWheelSvgCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);

  const [layers, setLayers] = useState<LayerAnimationProps>(INITIAL_LAYERS);

  useEffect(() => {
    mountTimeRef.current = performance.now();

    const tick = () => {
      if (!visibleRef.current || mountTimeRef.current == null) {
        rafRef.current = 0;
        return;
      }

      const elapsedSec = (performance.now() - mountTimeRef.current) / 1000;
      setLayers(computeWidgetLayers(elapsedSec));

      rafRef.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isVisible = entry?.isIntersecting ?? true;
        visibleRef.current = isVisible;
        if (isVisible && rafRef.current === 0) {
          rafRef.current = requestAnimationFrame(tick);
        }
        if (!isVisible && rafRef.current !== 0) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      },
      { threshold: 0.1 },
    );

    const node = containerRef.current;
    if (node) observer.observe(node);

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [aspects]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <WheelSvgCore
        {...wheelProps}
        aspects={aspects}
        zodiacOpacity={layers.zodiacOpacity}
        houseOpacity={layers.houseOpacity}
        aspectOpacity={layers.aspectOpacity}
        planetOpacity={layers.planetOpacity}
        angleOpacity={layers.angleOpacity}
        planetCount={layers.planetCount}
        rotationDeg={layers.rotationDeg}
      />
    </div>
  );
}
