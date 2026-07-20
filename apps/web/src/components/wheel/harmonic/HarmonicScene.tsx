'use client';

import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { AspectArcs } from './AspectArcs';
import { Particles } from './Particles';
import { PlanetMarkers } from './PlanetMarkers';
import { TerrainMesh } from './TerrainMesh';
import type {
  HarmonicAspectArc,
  HarmonicPalette,
  HarmonicPlanetSource,
  HarmonicQuality,
} from './types';

type HarmonicSceneProps = {
  sources: HarmonicPlanetSource[];
  arcs: HarmonicAspectArc[];
  palette: HarmonicPalette;
  quality: HarmonicQuality;
  bpm: number;
  selectedIndex: number | null;
  selectedAspectKey: string | null;
  highlightedPlanetIndices: number[];
  reducedMotion: boolean;
  onSelect: (index: number) => void;
  onSelectAspect: (key: string) => void;
  controlsTarget?: [number, number, number];
  sceneScale?: number;
  linkedExportId?: string | null;
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function BackgroundStars() {
  const positions = useMemo(() => {
    const random = seededRandom(0xa57ad10);
    const values = new Float32Array(300 * 3);
    for (let index = 0; index < 300; index += 1) {
      const radius = 25 + random() * 15;
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      values[index * 3] = radius * sinPhi * Math.cos(theta);
      values[index * 3 + 1] = radius * cosPhi;
      values[index * 3 + 2] = radius * sinPhi * Math.sin(theta);
    }
    return values;
  }, []);

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffd4a0"
        size={0.08}
        opacity={0.4}
        transparent
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

export function HarmonicScene({
  sources,
  arcs,
  palette,
  quality,
  bpm,
  selectedIndex,
  selectedAspectKey,
  highlightedPlanetIndices,
  reducedMotion,
  onSelect,
  onSelectAspect,
  controlsTarget = [0, -0.35, 0],
  sceneScale = 1,
  linkedExportId = null,
}: HarmonicSceneProps) {
  const enableBloom = quality !== 'low' && !reducedMotion;
  const enableParticles = !reducedMotion;

  return (
    <>
      <color attach="background" args={['#0d0618']} />
      <fogExp2 attach="fog" args={['#0d0618', 0.022]} />

      <ambientLight color="#2a1a3d" intensity={0.5} />
      <directionalLight color="#ffd4a0" intensity={0.9} position={[5, 8, 3]} />
      <pointLight color="#c4841d" intensity={0.5} distance={20} position={[-4, 5, -3]} />
      <pointLight color="#e8a0b0" intensity={0.25} distance={15} position={[2, 3, -6]} />

      <group scale={sceneScale}>
        <BackgroundStars />
        {enableParticles ? <Particles quality={quality} reducedMotion={reducedMotion} /> : null}

        <TerrainMesh
          sources={sources}
          palette={palette}
          quality={quality}
          bpm={bpm}
          highlightIndex={selectedIndex ?? -1}
          reducedMotion={reducedMotion}
          linkedExportId={linkedExportId}
        />
        <AspectArcs
          arcs={arcs}
          sources={sources}
          selectedIndex={selectedIndex}
          selectedAspectKey={selectedAspectKey}
          reducedMotion={reducedMotion}
          onSelectAspect={onSelectAspect}
        />
        <PlanetMarkers
          sources={sources}
          selectedIndex={selectedIndex}
          highlightedPlanetIndices={highlightedPlanetIndices}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          linkedExportId={linkedExportId}
          bpm={bpm}
        />
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.3 * Math.max(0.75, Math.min(1.4, bpm / 100))}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.42}
        minDistance={5}
        maxDistance={20}
        enablePan={false}
        target={controlsTarget}
      />

      {enableBloom ? (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
          <Bloom
            intensity={0.4}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.35}
            mipmapBlur
            radius={0.28}
          />
        </EffectComposer>
      ) : null}
    </>
  );
}
