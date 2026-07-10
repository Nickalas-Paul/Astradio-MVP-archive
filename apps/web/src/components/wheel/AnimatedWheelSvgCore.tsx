'use client';

import { useEffect, useRef, useState } from 'react';
import { useAudioPlayerStore } from '../../store/audio-player';
import {
  computeAnimationState,
  HOLD_START,
  MAX_ASPECTS,
  ROTATION_DEG_PER_SEC,
  type AnimationState,
} from '../../../../../vnext/render/animation-timing';
import { WheelSvgCore, type WheelSvgCoreProps } from './WheelSvgCore';

const ANIMATION_FPS = 24;
const MS_PER_FRAME = 1000 / ANIMATION_FPS;

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
  planetCount: 0,
  rotationDeg: 0,
};

const HOLD_LAYERS: LayerAnimationProps = {
  zodiacOpacity: 1,
  houseOpacity: 1,
  aspectOpacity: 1,
  planetOpacity: 1,
  angleOpacity: 1,
  planetCount: undefined,
  rotationDeg: 0,
};

function mapAnimationStateToLayers(anim: AnimationState): LayerAnimationProps {
  const maxPlanets = 13;
  const revealingPlanet = anim.planetPartial > 0 && anim.planetsVisible < maxPlanets;
  const planetCount = anim.planetsVisible + (revealingPlanet ? 1 : 0);
  const planetOpacity =
    anim.planetOpacity *
    (revealingPlanet
      ? Math.max(0.2, anim.planetPartial)
      : planetCount > 0
        ? 1
        : 0);

  const revealingAspect = anim.aspectProgress > 0 && anim.aspectsVisible < MAX_ASPECTS;
  const aspectOpacity =
    anim.aspectsVisible > 0 || revealingAspect
      ? revealingAspect
        ? Math.max(0.2, anim.aspectProgress)
        : 1
      : 0;

  const revealingCusp = anim.cuspPartial > 0 && anim.cuspsVisible < 12;
  const houseOpacity =
    anim.cuspOpacity *
    (anim.cuspsVisible >= 12
      ? 1
      : revealingCusp
        ? Math.max(0.2, anim.cuspPartial)
        : anim.cuspsVisible > 0
          ? 1
          : 0);

  return {
    zodiacOpacity: anim.zodiacOpacity,
    planetCount: planetCount > 0 ? planetCount : 0,
    planetOpacity,
    aspectOpacity,
    houseOpacity,
    angleOpacity: anim.cuspsVisible >= 12 ? anim.cuspOpacity : houseOpacity,
    rotationDeg: anim.rotationDeg,
  };
}

function sliceVisibleAspects(
  aspects: WheelSvgCoreProps['aspects'],
  anim: AnimationState,
): WheelSvgCoreProps['aspects'] {
  if (!aspects?.length) return aspects;
  const limit =
    anim.aspectsVisible + (anim.aspectProgress > 0 && anim.aspectsVisible < MAX_ASPECTS ? 1 : 0);
  if (limit <= 0) return [];
  return aspects.slice(0, limit);
}

function holdRotationDeg(frameIndex: number): number {
  if (frameIndex < HOLD_START) return 0;
  return ((frameIndex - HOLD_START) / ANIMATION_FPS) * ROTATION_DEG_PER_SEC;
}

export function AnimatedWheelSvgCore({ aspects, ...wheelProps }: AnimatedWheelSvgCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const drawInCompleteRef = useRef(false);

  const [layers, setLayers] = useState<LayerAnimationProps>(INITIAL_LAYERS);
  const [visibleAspects, setVisibleAspects] = useState<WheelSvgCoreProps['aspects']>([]);

  useEffect(() => {
    mountTimeRef.current = performance.now();
    drawInCompleteRef.current = false;

    const tick = () => {
      if (!visibleRef.current || mountTimeRef.current == null) {
        rafRef.current = 0;
        return;
      }

      const elapsedMs = performance.now() - mountTimeRef.current;
      const frameIndex = Math.floor(elapsedMs / MS_PER_FRAME);

      if (!drawInCompleteRef.current && frameIndex >= HOLD_START) {
        drawInCompleteRef.current = true;
      }

      if (drawInCompleteRef.current) {
        setLayers({
          ...HOLD_LAYERS,
          rotationDeg: holdRotationDeg(frameIndex),
        });
        setVisibleAspects(aspects);
      } else {
        const anim = computeAnimationState(frameIndex, ANIMATION_FPS);
        setLayers(mapAnimationStateToLayers(anim));
        setVisibleAspects(sliceVisibleAspects(aspects, anim));
      }

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
        aspects={visibleAspects}
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
