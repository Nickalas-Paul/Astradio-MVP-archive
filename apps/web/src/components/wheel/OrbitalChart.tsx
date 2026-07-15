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
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import type { LineMaterial } from 'three-stdlib';
import type { ComposeVisualControls } from '../../core/compose-visual-controls';
import { normalizePlanetName } from '../../core/planet-identity';
import type { AuraRawSnapshot } from './aura-raw-snapshot';
import { ASPECT_LINE_COLOR } from './wheel-constants';

const ECLIPTIC_RADIUS = 2.5;
const RING_ROTATION_PERIOD = 75;

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

const SIGN_ELEMENT_COLORS: Record<(typeof SIGN_ELEMENT)[number], string> = {
  fire: '#e8913a',
  earth: '#4a9e6a',
  air: '#c0c8d8',
  water: '#3a8a9e',
};

const ELEMENT_BG_COLORS: Record<(typeof SIGN_ELEMENT)[number], string> = {
  fire: '#120a06',
  earth: '#08100a',
  air: '#0a0e14',
  water: '#060c14',
};

export interface OrbitalChartProps {
  snapshot: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
  active?: boolean;
  onWebGLError?: () => void;
  onReady?: () => void;
}

type AspectLineStyle = {
  color: string;
  lineWidth: number;
  baseOpacity: number;
  pulsePeriod: number;
};

function hashPhase(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000 * Math.PI * 2;
}

function planetRadius(name: string): number {
  const n = normalizePlanetName(name);
  if (n === 'sun' || n === 'moon') return 0.12;
  if (n === 'mercury' || n === 'venus' || n === 'mars') return 0.08;
  if (n === 'jupiter' || n === 'saturn') return 0.09;
  if (n === 'uranus' || n === 'neptune' || n === 'pluto') return 0.06;
  return 0.04;
}

function signElementColor(lon: number): string {
  const signIndex = Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
  const element = SIGN_ELEMENT[signIndex] ?? 'earth';
  return SIGN_ELEMENT_COLORS[element];
}

function longitudePosition(lon: number, radius = ECLIPTIC_RADIUS): THREE.Vector3 {
  const lonRad = (lon * Math.PI) / 180;
  return new THREE.Vector3(radius * Math.cos(lonRad), 0, radius * Math.sin(lonRad));
}

/** Aspect line colors from the shared wheel style guide (`ASPECT_LINE_COLOR`). */
function aspectLineStyle(type: string): AspectLineStyle | null {
  const t = type.toLowerCase();
  if (t === 'conjunction') return null;
  if (t === 'trine') {
    return { color: ASPECT_LINE_COLOR.trine, lineWidth: 1.5, baseOpacity: 0.5, pulsePeriod: 4 };
  }
  if (t === 'sextile') {
    return { color: ASPECT_LINE_COLOR.sextile, lineWidth: 1, baseOpacity: 0.35, pulsePeriod: 4 };
  }
  if (t === 'square') {
    return { color: ASPECT_LINE_COLOR.square, lineWidth: 1.5, baseOpacity: 0.5, pulsePeriod: 2 };
  }
  if (t === 'opposition') {
    return { color: ASPECT_LINE_COLOR.opposition, lineWidth: 1.5, baseOpacity: 0.5, pulsePeriod: 3 };
  }
  return { color: '#666666', lineWidth: 0.5, baseOpacity: 0.2, pulsePeriod: 4 };
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

function BackgroundAtmosphere({ dominantElements }: { dominantElements: AuraRawSnapshot['dominantElements'] }) {
  const color = useMemo(() => {
    const blended = new THREE.Color(0, 0, 0);
    let total = 0;
    for (const element of SIGN_ELEMENT) {
      const weight = dominantElements[element] ?? 0;
      if (weight <= 0) continue;
      const c = new THREE.Color(ELEMENT_BG_COLORS[element]);
      blended.r += c.r * weight;
      blended.g += c.g * weight;
      blended.b += c.b * weight;
      total += weight;
    }
    if (total > 0) {
      blended.multiplyScalar(1 / total);
    } else {
      blended.set('#080d18');
    }
    return blended;
  }, [dominantElements]);

  return (
    <mesh>
      <sphereGeometry args={[15, 32, 32]} />
      <meshBasicMaterial color={color} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function EclipticRing() {
  const spinRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!spinRef.current) return;
    spinRef.current.rotation.y += ((Math.PI * 2) / RING_ROTATION_PERIOD) * delta;
  });

  return (
    <group ref={spinRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ECLIPTIC_RADIUS, 0.015, 16, 128]} />
        <meshStandardMaterial
          color="#1a3a4a"
          emissive="#1a3a4a"
          emissiveIntensity={0.25}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

function PlanetSphere({
  name,
  lon,
}: {
  name: string;
  lon: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = planetRadius(name);
  const color = signElementColor(lon);
  const position = useMemo(() => longitudePosition(lon), [lon]);
  const phase = useMemo(() => hashPhase(name), [name]);
  const breathePeriod = useMemo(() => 3 + (hashPhase(`${name}-period`) / (Math.PI * 2)) * 1, [name]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const breathe = 0.95 + 0.05 * Math.sin((state.clock.elapsedTime / breathePeriod) * Math.PI * 2 + phase);
    meshRef.current.scale.setScalar(breathe);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        metalness={0.15}
        roughness={0.45}
      />
    </mesh>
  );
}

function PulsingAspectLine({
  start,
  end,
  style,
  phaseOffset,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  style: AspectLineStyle;
  phaseOffset: number;
}) {
  const lineRef = useRef<Line2>(null);

  useFrame((state) => {
    const mat = lineRef.current?.material as LineMaterial | undefined;
    if (!mat) return;
    const pulse =
      0.7 + 0.3 * Math.sin((state.clock.elapsedTime / style.pulsePeriod) * Math.PI * 2 + phaseOffset);
    mat.opacity = style.baseOpacity * pulse;
  });

  return (
    <Line
      ref={lineRef}
      points={[start, end]}
      color={style.color}
      lineWidth={style.lineWidth}
      transparent
      opacity={style.baseOpacity}
      depthWrite={false}
    />
  );
}

function AspectConnections({
  snapshot,
  positions,
}: {
  snapshot: AuraRawSnapshot;
  positions: Map<string, THREE.Vector3>;
}) {
  const lines = useMemo(() => {
    const out: {
      key: string;
      start: THREE.Vector3;
      end: THREE.Vector3;
      style: AspectLineStyle;
      phaseOffset: number;
    }[] = [];

    for (const aspect of snapshot.aspects) {
      const type = aspect.type.toLowerCase();
      if (type === 'conjunction' && aspect.orb < 8) continue;

      const style = aspectLineStyle(type);
      if (!style) continue;

      const bodyA = normalizePlanetName(aspect.bodies[0]);
      const bodyB = normalizePlanetName(aspect.bodies[1]);
      const start = positions.get(bodyA);
      const end = positions.get(bodyB);
      if (!start || !end) continue;

      out.push({
        key: `${bodyA}-${bodyB}-${type}-${aspect.orb}`,
        start,
        end,
        style,
        phaseOffset: hashPhase(`${bodyA}-${bodyB}-${type}`),
      });
    }

    return out;
  }, [snapshot.aspects, positions]);

  return (
    <group>
      {lines.map((line) => (
        <PulsingAspectLine
          key={line.key}
          start={line.start}
          end={line.end}
          style={line.style}
          phaseOffset={line.phaseOffset}
        />
      ))}
    </group>
  );
}

function OrbitalScene({
  snapshot,
}: {
  snapshot: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
}) {
  const planetPositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    for (const planet of snapshot.planets) {
      map.set(normalizePlanetName(planet.name), longitudePosition(planet.lon));
    }
    return map;
  }, [snapshot.planets]);

  return (
    <>
      <color attach="background" args={['#080d18']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-3, -3, -3]} intensity={0.3} />

      <BackgroundAtmosphere dominantElements={snapshot.dominantElements} />
      <EclipticRing />

      {snapshot.planets.map((planet) => (
        <PlanetSphere key={normalizePlanetName(planet.name)} name={planet.name} lon={planet.lon} />
      ))}

      <AspectConnections snapshot={snapshot} positions={planetPositions} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
      />
    </>
  );
}

export function OrbitalChart({
  snapshot,
  composeControls = null,
  active = true,
  onWebGLError,
  onReady,
}: OrbitalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const readyCalledRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setFrameloop('never');
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const syncFrameloop = () => {
      const rect = node.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      const tabVisible = document.visibilityState === 'visible';
      setFrameloop(inView && tabVisible ? 'always' : 'never');
    };

    const observer = new IntersectionObserver(
      () => syncFrameloop(),
      { threshold: 0.1 },
    );
    observer.observe(node);
    syncFrameloop();

    const onVisibility = () => syncFrameloop();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);

  const handleCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
    if (!readyCalledRef.current) {
      readyCalledRef.current = true;
      onReady?.();
    }
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      onWebGLError?.();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      <WebGLErrorBoundary onError={onWebGLError}>
        <Canvas
          frameloop={frameloop}
          camera={{ position: [0, 3, 5], fov: 45, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={handleCreated}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <OrbitalScene snapshot={snapshot} composeControls={composeControls} />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
