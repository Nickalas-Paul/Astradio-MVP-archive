'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HarmonicAspectArc, HarmonicPlanetSource } from './types';

const ARC_BASE_Y = 0.5;
const ARC_MID_Y = 2.6;
const CURVE_SEGMENTS = 24;

type AspectArcsProps = {
  arcs: HarmonicAspectArc[];
  sources: HarmonicPlanetSource[];
  selectedIndex: number | null;
  reducedMotion: boolean;
};

function AspectArcLine({
  arc,
  sources,
  dimmed,
  index,
  reducedMotion,
}: {
  arc: HarmonicAspectArc;
  sources: HarmonicPlanetSource[];
  dimmed: boolean;
  index: number;
  reducedMotion: boolean;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const from = sources[arc.fromIdx];
  const to = sources[arc.toIdx];

  const line = useMemo(() => {
    if (!from || !to) return null;
    const start = new THREE.Vector3(from.position[0], ARC_BASE_Y, from.position[1]);
    const end = new THREE.Vector3(to.position[0], ARC_BASE_Y, to.position[1]);
    const mid = new THREE.Vector3(
      (from.position[0] + to.position[0]) * 0.5,
      ARC_MID_Y,
      (from.position[1] + to.position[1]) * 0.5,
    );
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(CURVE_SEGMENTS),
    );
    const material = new THREE.LineBasicMaterial({
      color: arc.color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Line(geometry, material);
  }, [arc.color, from, to]);

  useEffect(
    () => () => {
      if (!line) return;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(({ clock }) => {
    if (!line) return;
    const material = line.material as THREE.LineBasicMaterial;
    if (dimmed) {
      material.opacity = 0.05;
      return;
    }
    const t = clock.getElapsedTime();
    const audioLevel = reducedMotion ? 0.5 : 0.5 + Math.sin(t * 0.5) * 0.2;
    material.opacity = reducedMotion
      ? 0.18
      : 0.12 + Math.sin(t * 1.0 + index * 1.2) * 0.08 * audioLevel;
  });

  if (!line) return null;
  return <primitive ref={lineRef} object={line} />;
}

export function AspectArcs({
  arcs,
  sources,
  selectedIndex,
  reducedMotion,
}: AspectArcsProps) {
  return (
    <group>
      {arcs.map((arc, index) => {
        const incident =
          selectedIndex === null ||
          arc.fromIdx === selectedIndex ||
          arc.toIdx === selectedIndex;
        return (
          <AspectArcLine
            key={arc.key}
            arc={arc}
            sources={sources}
            dimmed={!incident}
            index={index}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </group>
  );
}
