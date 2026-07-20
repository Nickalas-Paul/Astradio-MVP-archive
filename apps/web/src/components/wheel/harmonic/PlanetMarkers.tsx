'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Sphere } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { HarmonicPlanetSource } from './types';
import {
  PLANET_SURFACE_OFFSET,
  sampleTerrainHeight,
  type TerrainWaveSource,
} from './terrain-height';
import { useHarmonicAudioLevelSampler } from './useHarmonicAudioLevel';

type PlanetMarkersProps = {
  sources: HarmonicPlanetSource[];
  selectedIndex: number | null;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
  linkedExportId?: string | null;
  bpm: number;
};

function toWaveSources(sources: HarmonicPlanetSource[]): TerrainWaveSource[] {
  return sources.map((source) => ({
    x: source.position[0],
    z: source.position[1],
    frequency: source.frequency,
    amplitude: source.amplitude,
  }));
}

function EnergyThread({
  source,
  lineRef,
}: {
  source: HarmonicPlanetSource;
  lineRef: MutableRefObject<THREE.Line | null>;
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      source.position[0],
      PLANET_SURFACE_OFFSET,
      source.position[1],
      source.position[0],
      0,
      source.position[1],
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: source.color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [source.color, source.position]);

  useEffect(() => {
    lineRef.current = line;
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      if (lineRef.current === line) lineRef.current = null;
    };
  }, [line, lineRef]);

  return <primitive object={line} />;
}

function PlanetMarker({
  source,
  selected,
  dimmed,
  reducedMotion,
  onSelect,
  audioLevelRef,
  waveSources,
  highlightIndex,
  bpm,
  threadRef,
}: {
  source: HarmonicPlanetSource;
  selected: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
  audioLevelRef: MutableRefObject<number>;
  waveSources: TerrainWaveSource[];
  highlightIndex: number;
  bpm: number;
  threadRef: MutableRefObject<THREE.Line | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const audioLevel = audioLevelRef.current;
    const elapsed = clock.getElapsedTime();
    const time = reducedMotion ? 0 : elapsed * (bpm / 120);
    const px = source.position[0];
    const pz = source.position[1];
    const surfaceY = sampleTerrainHeight(
      px,
      pz,
      time,
      audioLevel,
      highlightIndex,
      waveSources,
      bpm,
    );
    const topY = surfaceY + PLANET_SURFACE_OFFSET;

    if (groupRef.current) {
      groupRef.current.position.y = topY;
    }
    if (glowRef.current) {
      const base = dimmed ? 0.12 : 0.3;
      glowRef.current.intensity = base + audioLevel * 0.3;
    }

    const thread = threadRef.current;
    if (thread) {
      const positions = thread.geometry.attributes.position as THREE.BufferAttribute;
      positions.setXYZ(0, px, topY, pz);
      positions.setXYZ(1, px, surfaceY, pz);
      positions.needsUpdate = true;
      const material = thread.material as THREE.LineBasicMaterial;
      let opacity = 0.2;
      if (highlightIndex >= 0) {
        opacity = selected ? 0.6 : 0.03;
      }
      opacity *= 0.8 + audioLevel * 0.4;
      material.opacity = opacity;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  const emissiveIntensity = dimmed ? 0.45 : selected ? 1.8 : 1.4;

  return (
    <group
      ref={groupRef}
      position={[source.position[0], PLANET_SURFACE_OFFSET, source.position[1]]}
      scale={selected ? 1.22 : 1}
    >
      <pointLight
        ref={glowRef}
        color={source.color}
        intensity={0.4}
        distance={2.5}
        decay={2}
      />
      <Sphere
        args={[source.markerSize, 24, 24]}
        onClick={handleClick}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
        userData={{ planetKey: source.key }}
      >
        <meshStandardMaterial
          color="#ffffff"
          emissive={source.color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.1}
          roughness={0.3}
          transparent={dimmed}
          opacity={dimmed ? 0.35 : 1}
          toneMapped={false}
        />
      </Sphere>
    </group>
  );
}

export function PlanetMarkers({
  sources,
  selectedIndex,
  reducedMotion,
  onSelect,
  linkedExportId = null,
  bpm,
}: PlanetMarkersProps) {
  const sampleAudioLevel = useHarmonicAudioLevelSampler(linkedExportId);
  const audioLevelRef = useRef(0.5);
  const waveSources = useMemo(() => toWaveSources(sources), [sources]);
  const highlightIndex = selectedIndex ?? -1;
  const threadRefs = useRef<Array<MutableRefObject<THREE.Line | null>>>([]);

  if (threadRefs.current.length !== sources.length) {
    threadRefs.current = sources.map(
      (_, index) => threadRefs.current[index] ?? { current: null },
    );
  }

  useFrame(({ clock }) => {
    audioLevelRef.current = sampleAudioLevel(clock.getElapsedTime(), reducedMotion);
  });

  return (
    <group>
      {sources.map((source, index) => (
        <group key={source.key}>
          <EnergyThread source={source} lineRef={threadRefs.current[index]!} />
          <PlanetMarker
            source={source}
            selected={selectedIndex === source.index}
            dimmed={selectedIndex !== null && selectedIndex !== source.index}
            reducedMotion={reducedMotion}
            onSelect={() => onSelect(source.index)}
            audioLevelRef={audioLevelRef}
            waveSources={waveSources}
            highlightIndex={highlightIndex}
            bpm={bpm}
            threadRef={threadRefs.current[index]!}
          />
        </group>
      ))}
    </group>
  );
}
