'use client';

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ChartForWheel } from '../../core/chart-adapter';
import type { ComposeVisualControls } from '../../core/compose-visual-controls';
import { normalizePlanetName, PLANET_COLORS } from '../../core/planet-identity';
import { BODY_DISPLAY_ORDER } from '../../../../../vnext/canonical-bodies';
import { useAudioPlayerStore } from '../../store/audio-player';
import { resolveAscendantLongitude } from './wheel-geometry';
import type { WheelAspect } from './wheel-constants';

const SCENE_RADIUS = 1.8;
const ATMOSPHERE_SIZE = 14;

const ELEMENT_PALETTE = {
  fire: { a: new THREE.Color('#991b1b'), b: new THREE.Color('#b45309') },
  water: { a: new THREE.Color('#1e3a5f'), b: new THREE.Color('#0e7490') },
  earth: { a: new THREE.Color('#78350f'), b: new THREE.Color('#065f46') },
  air: { a: new THREE.Color('#64748b'), b: new THREE.Color('#bae6fd') },
} as const;

const SIGN_ELEMENT = [
  'fire',
  'earth',
  'air',
  'water',
  'fire',
  'earth',
  'air',
  'water',
  'fire',
  'earth',
  'air',
  'water',
] as const;

const ASPECT_VISUAL: Record<
  string,
  { color: string; pulseSpeed: number; baseOpacity: number; line: boolean }
> = {
  conjunction: { color: '#fbbf24', pulseSpeed: 0, baseOpacity: 0.85, line: false },
  sextile: { color: '#5eead4', pulseSpeed: 0.3, baseOpacity: 0.45, line: true },
  square: { color: '#f87171', pulseSpeed: 1.5, baseOpacity: 0.55, line: true },
  trine: { color: '#fcd34d', pulseSpeed: 0.5, baseOpacity: 0.5, line: true },
  opposition: { color: '#a78bfa', pulseSpeed: 0.8, baseOpacity: 0.55, line: true },
};

const PLANET_SIZE: Record<string, number> = {
  sun: 0.12,
  moon: 0.1,
  mercury: 0.07,
  venus: 0.07,
  mars: 0.07,
  jupiter: 0.08,
  saturn: 0.08,
  uranus: 0.05,
  neptune: 0.05,
  pluto: 0.05,
  northNode: 0.04,
  southNode: 0.04,
  chiron: 0.04,
};

export interface ArtisticVizProps {
  chart: ChartForWheel;
  aspects?: WheelAspect[];
  size: number;
  composeControls?: ComposeVisualControls | null;
  onWebGLError?: () => void;
  onReady?: () => void;
}

function lonToScenePos(lon: number, asc: number, radius: number): [number, number, number] {
  const angle = ((lon - asc + 180) * Math.PI) / 180;
  return [radius * Math.cos(angle), radius * Math.sin(angle), 0];
}

function positionLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const deg = positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

function elementWeightsFromChart(positions: Record<string, number>): Record<string, number> {
  const counts = { fire: 0, water: 0, earth: 0, air: 0 };
  for (const name of BODY_DISPLAY_ORDER) {
    const lon = positionLongitude(positions, name);
    if (lon == null) continue;
    const signIndex = Math.floor(((lon % 360) + 360) % 360 / 30) % 12;
    const element = SIGN_ELEMENT[signIndex] ?? 'earth';
    counts[element] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return {
    fire: counts.fire / total,
    water: counts.water / total,
    earth: counts.earth / total,
    air: counts.air / total,
  };
}

function createLineSegmentGeometry(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([x1, y1, z1, x2, y2, z2], 3));
  return geometry;
}

class WebGLErrorBoundary extends Component<
  { onError?: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function ElementalAtmosphere({
  composeControls,
  positions,
  audioIntensity,
}: {
  composeControls?: ComposeVisualControls | null;
  positions: Record<string, number>;
  audioIntensity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const weights = useMemo(() => elementWeightsFromChart(positions), [positions]);

  const dominant =
    composeControls?.elementDominance?.toLowerCase() ??
    (Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'earth');

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const t = state.clock.elapsedTime;
    const wobble = 0.5 + 0.5 * Math.sin(t * 0.3);

    const palette = ELEMENT_PALETTE[dominant as keyof typeof ELEMENT_PALETTE] ?? ELEMENT_PALETTE.earth;
    const blended = new THREE.Color();
    blended.copy(palette.a).lerp(palette.b, wobble * 0.35 + weights[dominant as keyof typeof weights] * 0.25);

    for (const [key, weight] of Object.entries(weights)) {
      if (key === dominant || weight < 0.05) continue;
      const p = ELEMENT_PALETTE[key as keyof typeof ELEMENT_PALETTE];
      if (!p) continue;
      const tint = new THREE.Color().copy(p.a).lerp(p.b, 0.5);
      blended.lerp(tint, weight * 0.35);
    }

    const satBoost = 1 + audioIntensity * 0.12;
    mat.color.copy(blended).multiplyScalar(0.22 * satBoost);
    mat.opacity = 0.92;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -2]}>
      <planeGeometry args={[ATMOSPHERE_SIZE, ATMOSPHERE_SIZE]} />
      <meshBasicMaterial transparent opacity={0.92} depthWrite={false} />
    </mesh>
  );
}

function AspectLineSegment({
  p1,
  p2,
  color,
  baseOpacity,
  pulseSpeed,
  intensityMult,
  clockRef,
}: {
  p1: [number, number, number];
  p2: [number, number, number];
  color: string;
  baseOpacity: number;
  pulseSpeed: number;
  intensityMult: number;
  clockRef: React.MutableRefObject<number>;
}) {
  const geometry = useMemo(
    () => createLineSegmentGeometry(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]),
    [p1, p2],
  );

  const lineObject = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
    });
    return new THREE.Line(geometry, material);
  }, [geometry, color, baseOpacity]);

  useFrame((state) => {
    clockRef.current = state.clock.elapsedTime;
    const mat = lineObject.material as THREE.LineBasicMaterial;
    const t = state.clock.elapsedTime;
    const pulse =
      pulseSpeed > 0
        ? 0.85 + 0.15 * Math.sin(t * pulseSpeed * Math.PI * 2 + p1[0] * 2)
        : 1;
    mat.opacity = Math.min(1, baseOpacity * pulse * intensityMult);
  });

  useEffect(() => {
    return () => {
      lineObject.geometry.dispose();
      (lineObject.material as THREE.Material).dispose();
    };
  }, [lineObject]);

  return <primitive object={lineObject} />;
}

function SacredGeometry({
  aspects,
  positions,
  asc,
  intensityMult,
}: {
  aspects: WheelAspect[];
  positions: Record<string, number>;
  asc: number;
  intensityMult: number;
}) {
  const clockRef = useRef(0);

  const lines = useMemo(() => {
    const out: {
      key: string;
      p1: [number, number, number];
      p2: [number, number, number];
      color: string;
      baseOpacity: number;
      pulseSpeed: number;
    }[] = [];

    for (const asp of aspects) {
      const type = (asp.type ?? '').toLowerCase();
      const visual = ASPECT_VISUAL[type];
      if (!visual?.line) continue;

      const bodyA = asp.bodyA ?? asp.a ?? '';
      const bodyB = asp.bodyB ?? asp.b ?? '';
      const lonA = positionLongitude(positions, bodyA);
      const lonB = positionLongitude(positions, bodyB);
      if (lonA == null || lonB == null) continue;

      const orb = typeof asp.orb === 'number' ? asp.orb : 5;
      const tightness = Math.max(0.25, 1 - orb / 10);

      out.push({
        key: `${bodyA}-${bodyB}-${type}`,
        p1: lonToScenePos(lonA, asc, SCENE_RADIUS),
        p2: lonToScenePos(lonB, asc, SCENE_RADIUS),
        color: visual.color,
        baseOpacity: visual.baseOpacity * tightness,
        pulseSpeed: visual.pulseSpeed,
      });
    }
    return out;
  }, [aspects, positions, asc]);

  return (
    <group>
      {lines.map((line) => (
        <AspectLineSegment
          key={line.key}
          p1={line.p1}
          p2={line.p2}
          color={line.color}
          baseOpacity={line.baseOpacity}
          pulseSpeed={line.pulseSpeed}
          intensityMult={intensityMult}
          clockRef={clockRef}
        />
      ))}
    </group>
  );
}

function PlanetNode({
  name,
  lon,
  asc,
  index,
  conjunctionBoost,
  audioIntensity,
}: {
  name: string;
  lon: number;
  asc: number;
  index: number;
  conjunctionBoost: number;
  audioIntensity: number;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const canonical = normalizePlanetName(name);
  const color = PLANET_COLORS[canonical] ?? '#e8ecf1';
  const coreSize = PLANET_SIZE[canonical] ?? 0.06;
  const [x, y, z] = lonToScenePos(lon, asc, SCENE_RADIUS);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const playBoost = audioIntensity > 0 ? 1.15 : 1;
    const phase = index * 0.7;
    const glowBase = 0.18 + conjunctionBoost * 0.25;
    const glowOpacity = (glowBase + 0.07 * Math.sin(t * 0.4 * playBoost + phase)) * (1 + audioIntensity * 0.2);

    if (haloRef.current) {
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(0.55, glowOpacity);
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.75 + conjunctionBoost * 0.15 + audioIntensity * 0.1;
    }
  });

  return (
    <group position={[x, y, z]}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[coreSize * 3, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[coreSize, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function PlanetNodes({
  positions,
  asc,
  aspects,
  audioIntensity,
}: {
  positions: Record<string, number>;
  asc: number;
  aspects?: WheelAspect[];
  audioIntensity: number;
}) {
  const conjunctionBoost = useMemo(() => {
    const boost = new Map<string, number>();
    for (const asp of aspects ?? []) {
      if ((asp.type ?? '').toLowerCase() !== 'conjunction') continue;
      const bodyA = asp.bodyA ?? asp.a ?? '';
      const bodyB = asp.bodyB ?? asp.b ?? '';
      boost.set(normalizePlanetName(bodyA), (boost.get(normalizePlanetName(bodyA)) ?? 0) + 0.5);
      boost.set(normalizePlanetName(bodyB), (boost.get(normalizePlanetName(bodyB)) ?? 0) + 0.5);
    }
    return boost;
  }, [aspects]);

  const planets = useMemo(
    () =>
      BODY_DISPLAY_ORDER.flatMap((name, index) => {
        const lon = positionLongitude(positions, name);
        return lon == null ? [] : [{ name, lon, index }];
      }),
    [positions],
  );

  return (
    <group>
      {planets.map((planet) => (
        <PlanetNode
          key={planet.name}
          name={planet.name}
          lon={planet.lon}
          asc={asc}
          index={planet.index}
          conjunctionBoost={conjunctionBoost.get(normalizePlanetName(planet.name)) ?? 0}
          audioIntensity={audioIntensity}
        />
      ))}
    </group>
  );
}

function VizScene({
  chart,
  aspects,
  composeControls,
}: {
  chart: ChartForWheel;
  aspects?: WheelAspect[];
  composeControls?: ComposeVisualControls | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const asc = resolveAscendantLongitude(chart);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const currentTime = useAudioPlayerStore((s) => s.currentTime);
  const duration = useAudioPlayerStore((s) => s.duration);
  const progress = duration > 0 ? currentTime / duration : 0;

  const arcShape = composeControls?.arcShape ?? 0.5;
  const audioIntensity = isPlaying
    ? 0.6 + 0.4 * Math.sin(progress * Math.PI * (0.5 + arcShape))
    : 0;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const driftSpeed = (isPlaying ? 0.65 : 0.5) * (Math.PI / 180);
    groupRef.current.rotation.z += driftSpeed * delta;
  });

  return (
    <>
      <ElementalAtmosphere
        composeControls={composeControls}
        positions={chart.positions}
        audioIntensity={audioIntensity}
      />
      <group ref={groupRef}>
        {aspects?.length ? (
          <SacredGeometry
            aspects={aspects}
            positions={chart.positions}
            asc={asc}
            intensityMult={0.7 + audioIntensity * 0.5}
          />
        ) : null}
        <PlanetNodes
          positions={chart.positions}
          asc={asc}
          aspects={aspects}
          audioIntensity={audioIntensity}
        />
      </group>
    </>
  );
}

export function ArtisticViz({
  chart,
  aspects,
  size,
  composeControls,
  onWebGLError,
  onReady,
}: ArtisticVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const readyCalledRef = useRef(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        const tabVisible = document.visibilityState === 'visible';
        setFrameloop(visible && tabVisible ? 'always' : 'never');
      },
      { threshold: 0.1 },
    );
    observer.observe(node);

    const onVisibility = () => {
      const rect = node.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      setFrameloop(document.visibilityState === 'visible' && inView ? 'always' : 'never');
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    if (!readyCalledRef.current) {
      readyCalledRef.current = true;
      onReady?.();
    }
    const canvas = gl.domElement;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      onWebGLError?.();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ width: size, height: size }}
    >
      <WebGLErrorBoundary onError={onWebGLError}>
        <Canvas
          frameloop={frameloop}
          camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={handleCreated}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <VizScene chart={chart} aspects={aspects} composeControls={composeControls} />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
