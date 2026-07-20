'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HarmonicQuality } from './types';

const PARTICLE_COLORS = ['#FFD700', '#c4841d', '#e8c547', '#e8a0b0'] as const;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

type ParticlesProps = {
  quality: HarmonicQuality;
  reducedMotion: boolean;
};

export function Particles({ quality, reducedMotion }: ParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const count = quality === 'high' ? 150 : quality === 'medium' ? 80 : 40;

  const { positions, colors } = useMemo(() => {
    const random = seededRandom(0xc1a55c);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scratch = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const radius = Math.sqrt(random()) * 4.2;
      const theta = random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = 0.2 + random() * 2.5;
      positions[i * 3 + 2] = Math.sin(theta) * radius;

      scratch.set(PARTICLE_COLORS[i % PARTICLE_COLORS.length]!);
      colors[i * 3] = scratch.r;
      colors[i * 3 + 1] = scratch.g;
      colors[i * 3 + 2] = scratch.b;
    }

    return { positions, colors };
  }, [count]);

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.015;
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.055}
          vertexColors
          transparent
          opacity={0.65}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
    </group>
  );
}
