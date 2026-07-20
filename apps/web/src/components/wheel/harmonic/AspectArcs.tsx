'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { HarmonicAspectArc, HarmonicPlanetSource } from './types';

const ARC_BASE_Y = 0.5;
const ARC_MID_Y = 2.6;
const CURVE_SEGMENTS = 24;
const HIT_TUBE_RADIUS = 0.15;

type AspectArcsProps = {
  arcs: HarmonicAspectArc[];
  sources: HarmonicPlanetSource[];
  selectedIndex: number | null;
  selectedAspectKey: string | null;
  reducedMotion: boolean;
  onSelectAspect: (key: string) => void;
};

function AspectArcLine({
  arc,
  sources,
  active,
  highlighted,
  dimmed,
  index,
  reducedMotion,
  onSelectAspect,
}: {
  arc: HarmonicAspectArc;
  sources: HarmonicPlanetSource[];
  active: boolean;
  highlighted: boolean;
  dimmed: boolean;
  index: number;
  reducedMotion: boolean;
  onSelectAspect: (key: string) => void;
}) {
  const from = sources[arc.fromIdx];
  const to = sources[arc.toIdx];

  const { line, tubeGeometry } = useMemo(() => {
    if (!from || !to) return { line: null, tubeGeometry: null };
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
    const tube = new THREE.TubeGeometry(curve, CURVE_SEGMENTS, HIT_TUBE_RADIUS, 8, false);
    return {
      line: new THREE.Line(geometry, material),
      tubeGeometry: tube,
    };
  }, [arc.color, from, to]);

  useEffect(
    () => () => {
      if (line) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      tubeGeometry?.dispose();
    },
    [line, tubeGeometry],
  );

  useFrame(({ clock }) => {
    if (!line) return;
    const material = line.material as THREE.LineBasicMaterial;
    const t = clock.getElapsedTime();
    if (highlighted) {
      material.opacity = reducedMotion
        ? 0.9
        : 0.75 + Math.sin(t * 3.2 + index) * 0.15;
      return;
    }
    if (active) {
      // Incident on selected planet
      material.opacity = reducedMotion
        ? 0.7
        : 0.6 + Math.sin(t * 2.4 + index * 1.1) * 0.15;
      return;
    }
    if (dimmed) {
      material.opacity = 0.05;
      return;
    }
    // Idle (nothing selected)
    material.opacity = reducedMotion
      ? 0.2
      : 0.18 + Math.sin(t * 0.9 + index * 0.7) * 0.04;
  });

  if (!line || !tubeGeometry) return null;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelectAspect(arc.key);
  };

  return (
    <group>
      <primitive object={line} />
      <mesh geometry={tubeGeometry} onClick={handleClick} visible={false}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function AspectArcs({
  arcs,
  sources,
  selectedIndex,
  selectedAspectKey,
  reducedMotion,
  onSelectAspect,
}: AspectArcsProps) {
  return (
    <group>
      {arcs.map((arc, index) => {
        const highlighted = selectedAspectKey === arc.key;
        const incidentOnPlanet =
          selectedIndex !== null &&
          (arc.fromIdx === selectedIndex || arc.toIdx === selectedIndex);
        const selectionActive =
          selectedIndex !== null || selectedAspectKey !== null;
        const active = highlighted || incidentOnPlanet;
        const dimmed = selectionActive && !active;
        return (
          <AspectArcLine
            key={arc.key}
            arc={arc}
            sources={sources}
            active={active}
            highlighted={highlighted}
            dimmed={dimmed}
            index={index}
            reducedMotion={reducedMotion}
            onSelectAspect={onSelectAspect}
          />
        );
      })}
    </group>
  );
}
