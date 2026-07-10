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
import { Billboard, Html, OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ChartForWheel } from '../../core/chart-adapter';
import { normalizePlanetName, PLANET_COLORS } from '../../core/planet-identity';
import { BODY_DISPLAY_ORDER, BODY_LABELS, type BodyKey } from '../../../../../vnext/canonical-bodies';
import { useAudioPlayerStore } from '../../store/audio-player';
import { ASPECT_LINE_COLOR, SIGN_GLYPH, WHEEL_COLORS, type WheelAspect } from './wheel-constants';
import { pol, resolveAscendantLongitude } from './wheel-geometry';

const R_RING_OUTER = 1.65;
const R_RING_INNER = 1.2;
const R_PLANET = 1.42;
const R_SIGN_GLYPH = 1.82;

export interface CinematicWheelProps {
  chart: ChartForWheel;
  aspects?: WheelAspect[];
  size: number;
  onWebGLError?: () => void;
  onReady?: () => void;
}

function eclipticToScene(lon: number, radius: number, asc: number): [number, number, number] {
  const { x, y } = pol(radius, lon, asc);
  return [x, 0.06, -y];
}

function positionLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const deg = positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

function planetLabel(name: string): string {
  const canonical = normalizePlanetName(name);
  return BODY_LABELS[canonical as BodyKey] ?? canonical.slice(0, 3);
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

function ZodiacRing({ asc }: { asc: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[(R_RING_OUTER + R_RING_INNER) / 2, (R_RING_OUTER - R_RING_INNER) / 2, 16, 72]} />
        <meshStandardMaterial
          color="#1a2435"
          metalness={0.35}
          roughness={0.55}
          emissive="#0e9696"
          emissiveIntensity={0.12}
        />
      </mesh>
      {Array.from({ length: 12 }, (_, signIndex) => {
        const midLon = signIndex * 30 + 15;
        const [gx, gy, gz] = eclipticToScene(midLon, R_SIGN_GLYPH, asc);
        return (
          <Billboard key={signIndex} position={[gx, gy + 0.04, gz]}>
            <Text fontSize={0.16} color={WHEEL_COLORS.zodiacGlyphFill} anchorX="center" anchorY="middle">
              {SIGN_GLYPH[signIndex]}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}

function CuspLine({ cuspLon, asc, index }: { cuspLon: number; asc: number; index: number }) {
  const [x, , z] = eclipticToScene(cuspLon, R_RING_OUTER, asc);
  const positions = useMemo(
    () => new Float32Array([0, 0.02, 0, x, 0.02, z]),
    [x, z],
  );
  return (
    <line key={`cusp-${index}`}>
      <bufferGeometry attach="geometry">
        <bufferAttribute attach="attributes-position" count={2} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#3d4f6e" transparent opacity={0.45} />
    </line>
  );
}

function HouseCusps({ cusps, asc }: { cusps: number[]; asc: number }) {
  return (
    <group>
      {cusps.slice(0, 12).map((cuspLon, i) => (
        <CuspLine key={i} cuspLon={cuspLon} asc={asc} index={i} />
      ))}
    </group>
  );
}

function AspectLines({
  aspects,
  positions,
  asc,
}: {
  aspects: WheelAspect[];
  positions: Record<string, number>;
  asc: number;
}) {
  const lines = useMemo(() => {
    const out: { key: string; p1: [number, number, number]; p2: [number, number, number]; color: string }[] = [];
    for (const asp of aspects) {
      const bodyA = asp.bodyA ?? asp.a ?? '';
      const bodyB = asp.bodyB ?? asp.b ?? '';
      const lonA = positions[bodyA];
      const lonB = positions[bodyB];
      if (lonA == null || lonB == null) continue;
      out.push({
        key: `${bodyA}-${bodyB}-${asp.type}`,
        p1: eclipticToScene(lonA, R_PLANET, asc),
        p2: eclipticToScene(lonB, R_PLANET, asc),
        color: ASPECT_LINE_COLOR[asp.type] ?? '#6a7a8a',
      });
    }
    return out;
  }, [aspects, positions, asc]);

  return (
    <group>
      {lines.map((line) => (
        <line key={line.key}>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={
                new Float32Array([
                  line.p1[0], line.p1[1], line.p1[2],
                  line.p2[0], line.p2[1], line.p2[2],
                ])
              }
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={line.color} transparent opacity={0.55} linewidth={1} />
        </line>
      ))}
    </group>
  );
}

function PlanetMarker({
  name,
  lon,
  asc,
}: {
  name: string;
  lon: number;
  asc: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const canonical = normalizePlanetName(name);
  const color = PLANET_COLORS[canonical] ?? WHEEL_COLORS.planetGlyphFill;
  const [x, y, z] = eclipticToScene(lon, R_PLANET, asc);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const pulse = isPlaying ? Math.sin(state.clock.elapsedTime * 2.2) * 0.5 + 0.5 : 0;
    mat.emissiveIntensity = 0.25 + pulse * 0.2;
  });

  return (
    <group position={[x, y, z]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      <pointLight
        color={color}
        intensity={isPlaying ? 0.22 : 0.15}
        distance={0.5}
      />
      <Html center distanceFactor={6} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span className="text-[9px] text-text-secondary/90 whitespace-nowrap">{planetLabel(name)}</span>
      </Html>
    </group>
  );
}

function Planets({
  positions,
  asc,
}: {
  positions: Record<string, number>;
  asc: number;
}) {
  const planetNames = BODY_DISPLAY_ORDER.filter((name) => positionLongitude(positions, name) != null);
  return (
    <group>
      {planetNames.map((name) => {
        const lon = positionLongitude(positions, name);
        if (lon == null) return null;
        return <PlanetMarker key={name} name={name} lon={lon} asc={asc} />;
      })}
    </group>
  );
}

function ChartScene({
  chart,
  aspects,
}: {
  chart: ChartForWheel;
  aspects?: WheelAspect[];
}) {
  const asc = resolveAscendantLongitude(chart);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);

  return (
    <>
      <color attach="background" args={['#0a0f18']} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 4, 2]} intensity={0.6} color="#a8d8e8" />
      <pointLight position={[-2, -1, -2]} intensity={0.25} color="#6b4a9b" />
      <Stars radius={80} depth={40} count={1200} factor={2} saturation={0.2} fade speed={0.15} />
      <ZodiacRing asc={asc} />
      <HouseCusps cusps={chart.cusps} asc={asc} />
      {aspects?.length ? (
        <AspectLines aspects={aspects} positions={chart.positions} asc={asc} />
      ) : null}
      <Planets positions={chart.positions} asc={asc} />
      <OrbitControls
        enablePan={false}
        minDistance={2.2}
        maxDistance={6}
        autoRotate
        autoRotateSpeed={isPlaying ? 0.65 : 0.25}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export function CinematicWheel({
  chart,
  aspects,
  size,
  onWebGLError,
  onReady,
}: CinematicWheelProps) {
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
          camera={{ position: [0, 2.8, 2.8], fov: 42, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={handleCreated}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <ChartScene chart={chart} aspects={aspects} />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
