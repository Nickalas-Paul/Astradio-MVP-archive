'use client';

/// <reference types="@react-three/fiber" />
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VizPayload } from './types';
import { createSeededRNG } from './seeded-rng';

/** Longitude to position on wheel: 0° at 9 o'clock (left), CCW. Three.js y-up. */
function lonToXY(lon: number, r: number): [number, number] {
  const rad = (Math.PI / 180) * (90 - lon);
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

function LineFromPoints({ points, color }: { points: [number, number, number][]; color: string }) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    );
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  }, [points, color]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Prim = 'primitive' as any;
  return <Prim object={line} />;
}

function WheelRing() {
  const points = useMemo(() => {
    const segs: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const [x, y] = lonToXY((i / 64) * 360, 1);
      segs.push([x, y, 0]);
    }
    return segs;
  }, []);
  return <LineFromPoints points={points} color="#555" />;
}

function HouseCusps({ houses }: { houses: number[] }) {
  return (
    <>
      {Array.from({ length: Math.min(12, houses.length) }).map((_, i) => {
        const lon = houses[i] ?? i * 30;
        const [x, y] = lonToXY(lon, 1);
        return (
          <LineFromPoints key={i} points={[[0, 0, 0], [x, y, 0]]} color="#666" />
        );
      })}
    </>
  );
}

function PlanetPoints({ planetLongitudes }: { planetLongitudes: Record<string, number> }) {
  const entries = Object.entries(planetLongitudes);
  return (
    <>
      {entries.map(([name, lon]) => {
        const [x, y] = lonToXY(lon, 0.85);
        return (
          <mesh key={name} position={[x, y, 0]}>
            <circleGeometry args={[0.03, 16]} />
            <meshBasicMaterial color="#ffaa44" />
          </mesh>
        );
      })}
    </>
  );
}

function AspectLines({
  aspects,
  planetLongitudes,
}: {
  aspects: Array<{ p1: string; p2: string; orb: number }>;
  planetLongitudes: Record<string, number>;
}) {
  const lines: React.ReactNode[] = [];
  for (const a of aspects) {
    const l1 = planetLongitudes[a.p1];
    const l2 = planetLongitudes[a.p2];
    if (l1 == null || l2 == null) continue;
    const [x1, y1] = lonToXY(l1, 0.85);
    const [x2, y2] = lonToXY(l2, 0.85);
    lines.push(
      <LineFromPoints key={`${a.p1}-${a.p2}`} points={[[x1, y1, 0], [x2, y2, 0]]} color="#888" />
    );
  }
  return <>{lines}</>;
}

function EnergyParticles({
  seed,
  density,
  tempo,
  t,
}: {
  seed: string;
  density: number;
  tempo: number;
  t: number;
}) {
  const rand = createSeededRNG(seed);
  const n = Math.max(8, Math.floor(20 + density * 40));
  const particles: { x: number; y: number; phase: number }[] = [];
  for (let i = 0; i < n; i++) {
    particles.push({
      x: (rand() - 0.5) * 1.8,
      y: (rand() - 0.5) * 1.8,
      phase: rand() * Math.PI * 2,
    });
  }
  const speed = 0.3 + tempo * 0.5;
  return (
    <group>
      {particles.map((p, i) => {
        const orbit = 0.4 + rand() * 0.6;
        const angle = p.phase + t * speed;
        const x = p.x * 0.3 + Math.cos(angle) * orbit;
        const y = p.y * 0.3 + Math.sin(angle) * orbit;
        return (
          <mesh key={i} position={[x, y, -0.1]}>
            <circleGeometry args={[0.01, 8]} />
            <meshBasicMaterial color="#4488ff" transparent opacity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function TensionRings({ seed, tension, t }: { seed: string; tension: number; t: number }) {
  const rand = createSeededRNG(seed);
  const rings = 3;
  const intensity = 0.3 + tension * 0.5;
  return (
    <>
      {Array.from({ length: rings }).map((_, i) => {
        const r = 0.5 + rand() * 0.4 + i * 0.15;
        const pulse = 0.8 + 0.2 * Math.sin(t * 2 + i);
        const pts = Array.from({ length: 33 }, (_, j) => {
          const [x, y] = lonToXY((j / 32) * 360, r);
          return [x, y, 0] as [number, number, number];
        });
        return (
          <LineFromPoints
            key={i}
            points={pts}
            color="#6688cc"
          />
        );
      })}
    </>
  );
}

function SceneContent({ payload, t }: { payload: VizPayload; t: number }) {
  const { chart, plan, seed } = payload;
  return (
    <>
      <WheelRing />
      <HouseCusps houses={chart.houses} />
      <PlanetPoints planetLongitudes={chart.planetLongitudes} />
      <AspectLines aspects={chart.aspects} planetLongitudes={chart.planetLongitudes} />
      <EnergyParticles
        seed={seed}
        density={plan.density ?? 0.5}
        tempo={plan.tempo ?? 0.5}
        t={t}
      />
      <TensionRings seed={seed} tension={plan.tension ?? 0.5} t={t} />
    </>
  );
}

function AnimatedScene({ payload }: { payload: VizPayload }) {
  const [t, setT] = useState(0);
  useFrame((_, delta) => {
    setT((prev) => prev + delta);
  });
  return <SceneContent payload={payload} t={t} />;
}

export function VizScene({ payload }: { payload: VizPayload }) {
  return (
    <div className="w-full h-96 bg-zinc-900 rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <AnimatedScene payload={payload} />
      </Canvas>
    </div>
  );
}
