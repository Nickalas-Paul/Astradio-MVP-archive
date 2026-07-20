'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HarmonicPalette, HarmonicPlanetSource, HarmonicQuality } from './types';
import {
  TERRAIN_COLOR_RAMP,
  terrainFragmentShader,
  terrainVertexShader,
} from './terrainShader';
import {
  TERRAIN_DISPLACEMENT_SCALE,
  TERRAIN_GLOBAL_DAMPING,
} from './terrain-height';
import { useHarmonicAudioLevelSampler } from './useHarmonicAudioLevel';

type TerrainMeshProps = {
  sources: HarmonicPlanetSource[];
  palette: HarmonicPalette;
  quality: HarmonicQuality;
  bpm: number;
  highlightIndex: number;
  reducedMotion: boolean;
  linkedExportId?: string | null;
};

export function TerrainMesh({
  sources,
  palette,
  quality,
  bpm,
  highlightIndex,
  reducedMotion,
  linkedExportId = null,
}: TerrainMeshProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const sampleAudioLevel = useHarmonicAudioLevelSampler(linkedExportId);
  const segmentCount = quality === 'high' ? 140 : 80;
  const positions = useMemo(
    () => Array.from({ length: 10 }, () => new THREE.Vector2()),
    [],
  );
  const frequencies = useMemo(() => new Float32Array(10), []);
  const amplitudes = useMemo(() => new Float32Array(10), []);
  const planetColors = useMemo(
    () => Array.from({ length: 10 }, () => new THREE.Color('#000000')),
    [],
  );
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioLevel: { value: 0.5 },
      uBpm: { value: bpm },
      uHighlightIdx: { value: -1 },
      uPlanetCount: { value: 0 },
      uPositions: { value: positions },
      uFrequencies: { value: frequencies },
      uAmplitudes: { value: amplitudes },
      uPlanetColors: { value: planetColors },
      uColorInfluence: { value: 0.35 },
      uGlobalDamping: { value: TERRAIN_GLOBAL_DAMPING },
      uDisplacementScale: { value: TERRAIN_DISPLACEMENT_SCALE },
      uWarmth: { value: palette.warmth },
      uColLow: { value: new THREE.Color(TERRAIN_COLOR_RAMP.low) },
      uColMid: { value: new THREE.Color(TERRAIN_COLOR_RAMP.mid) },
      uColHigh: { value: new THREE.Color(TERRAIN_COLOR_RAMP.high) },
      uColPeak: { value: new THREE.Color(TERRAIN_COLOR_RAMP.peak) },
    }),
    [amplitudes, bpm, frequencies, palette.warmth, planetColors, positions],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uPlanetCount.value = Math.min(sources.length, 10);
    sources.slice(0, 10).forEach((source, index) => {
      positions[index]?.set(source.position[0], source.position[1]);
      frequencies[index] = source.frequency;
      amplitudes[index] = source.amplitude;
      planetColors[index]?.set(source.color);
    });
    material.uniforms.uBpm.value = bpm;
    material.uniforms.uHighlightIdx.value = highlightIndex;
    material.uniforms.uWarmth.value = palette.warmth;
  }, [
    amplitudes,
    bpm,
    frequencies,
    highlightIndex,
    palette.warmth,
    planetColors,
    positions,
    sources,
  ]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const elapsed = clock.getElapsedTime();
    const bpmMultiplier = bpm / 120;
    if (!reducedMotion) {
      material.uniforms.uTime.value = elapsed * bpmMultiplier;
    }
    material.uniforms.uAudioLevel.value = sampleAudioLevel(elapsed, reducedMotion);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10, segmentCount, segmentCount]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={terrainVertexShader}
        fragmentShader={terrainFragmentShader}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped
      />
    </mesh>
  );
}
