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
import { Billboard, OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import type { ChartForWheel } from '../../core/chart-adapter';
import { normalizePlanetName, PLANET_COLORS } from '../../core/planet-identity';
import { BODY_DISPLAY_ORDER } from '../../../../../vnext/canonical-bodies';
import { useAudioPlayerStore } from '../../store/audio-player';
import { ASPECT_LINE_COLOR, WHEEL_COLORS, type WheelAspect } from './wheel-constants';
import { getPlanetGlyphSvg, getSignGlyphSvg } from './wheel-glyphs';
import { pol, resolveAscendantLongitude, wheelEclipticDeg } from './wheel-geometry';

const R_RING_OUTER = 1.45;
const R_RING_INNER = 1.05;
const R_PLANET = 1.28;
const R_LABEL_BASE = 1.52;
const R_LABEL_STEP = 0.11;
const R_SIGN_LABEL = 1.68;
const R_HOUSE_NUMBER = 0.9;
const R_ANGLE_MARKER = 1.57;
const MIN_LABEL_ANGLE_DEG = 8;
const SIGN_GLYPH_COLOR = '#94a3b8';
const HOUSE_LABEL_COLOR = '#64748b';
const ANGLE_MARKER_COLOR = '#5eead4';
const PLANET_GLYPH_SIZE = 0.12;
const SIGN_GLYPH_SIZE = 0.14;
const ANGLE_MARKER_SIZE = 0.15;
const INNER_RING_SEGMENTS = 64;

const glyphGeometryCache = new Map<string, THREE.ShapeGeometry>();

function createGlyphGeometry(pathData: string, viewBox: string, targetSize: number): THREE.ShapeGeometry | null {
  const cacheKey = `${pathData}|${viewBox}|${targetSize}`;
  const cached = glyphGeometryCache.get(cacheKey);
  if (cached) return cached;

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path d="${pathData}"/></svg>`;
  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);

  const shapes: THREE.Shape[] = [];
  for (const path of svgData.paths) {
    shapes.push(...SVGLoader.createShapes(path));
  }
  if (shapes.length === 0) return null;

  const geometry = new THREE.ShapeGeometry(shapes);
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return null;

  const gWidth = bbox.max.x - bbox.min.x;
  const gHeight = bbox.max.y - bbox.min.y;
  const scale = targetSize / Math.max(gWidth, gHeight, 1e-6);
  geometry.scale(scale, -scale, 1);

  geometry.computeBoundingBox();
  const newBbox = geometry.boundingBox;
  if (!newBbox) return null;

  const centerX = (newBbox.max.x + newBbox.min.x) / 2;
  const centerY = (newBbox.max.y + newBbox.min.y) / 2;
  geometry.translate(-centerX, -centerY, 0);

  glyphGeometryCache.set(cacheKey, geometry);
  return geometry;
}

interface GlyphIconProps {
  pathData: string;
  viewBox: string;
  size: number;
  color: string;
  position: [number, number, number];
  opacity?: number;
}

function GlyphIcon({ pathData, viewBox, size, color, position, opacity = 1 }: GlyphIconProps) {
  const geometry = useMemo(
    () => createGlyphGeometry(pathData, viewBox, size),
    [pathData, viewBox, size],
  );

  useEffect(() => {
    return () => {
      if (geometry && !glyphGeometryCache.has(`${pathData}|${viewBox}|${size}`)) {
        geometry.dispose();
      }
    };
  }, [geometry, pathData, viewBox, size]);

  if (!geometry) return null;

  return (
    <Billboard position={position}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </Billboard>
  );
}

export interface CinematicWheelProps {
  chart: ChartForWheel;
  aspects?: WheelAspect[];
  size: number;
  onWebGLError?: () => void;
  onReady?: () => void;
}

function eclipticToScene(lon: number, radius: number, asc: number): [number, number, number] {
  const { x, y } = pol(radius, lon, asc);
  return [x, 0.05, -y];
}

function positionLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const deg = positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

function angularDeltaDeg(a: number, b: number): number {
  return Math.abs(((a - b + 180) % 360) - 180);
}

type PlanetLayout = { name: string; lon: number; labelRadius: number };

function layoutPlanets(positions: Record<string, number>, asc: number): PlanetLayout[] {
  const entries = BODY_DISPLAY_ORDER.flatMap((name) => {
    const lon = positionLongitude(positions, name);
    if (lon == null) return [];
    return [{ name, lon, angle: wheelEclipticDeg(lon, asc) }];
  });

  entries.sort((a, b) => a.angle - b.angle);

  const placed: { angle: number; radius: number }[] = [];
  const layouts: PlanetLayout[] = [];

  for (const entry of entries) {
    let labelRadius = R_LABEL_BASE;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const overlaps = placed.some(
        (p) =>
          angularDeltaDeg(entry.angle, p.angle) < MIN_LABEL_ANGLE_DEG &&
          Math.abs(labelRadius - p.radius) < R_LABEL_STEP * 0.75,
      );
      if (!overlaps) break;
      labelRadius += R_LABEL_STEP;
    }
    placed.push({ angle: entry.angle, radius: labelRadius });
    layouts.push({ name: entry.name, lon: entry.lon, labelRadius });
  }

  return layouts;
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
        <torusGeometry args={[(R_RING_OUTER + R_RING_INNER) / 2, (R_RING_OUTER - R_RING_INNER) / 2, 20, 80]} />
        <meshStandardMaterial
          color="#1a2435"
          metalness={0.55}
          roughness={0.35}
          emissive="#0e9696"
          emissiveIntensity={0.1}
        />
      </mesh>
      {Array.from({ length: 12 }, (_, signIndex) => {
        const boundaryLon = signIndex * 30;
        const [tx, , tz] = eclipticToScene(boundaryLon, R_RING_OUTER + 0.02, asc);
        const [bx, , bz] = eclipticToScene(boundaryLon, R_RING_INNER - 0.02, asc);
        const midLon = signIndex * 30 + 15;
        const [lx, ly, lz] = eclipticToScene(midLon, R_SIGN_LABEL, asc);
        const signGlyph = getSignGlyphSvg(signIndex);
        return (
          <group key={signIndex}>
            <line>
              <bufferGeometry attach="geometry">
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([tx, 0.04, tz, bx, 0.04, bz])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#4a5a7a" transparent opacity={0.35} />
            </line>
            {signGlyph ? (
              <GlyphIcon
                pathData={signGlyph.pathData}
                viewBox={signGlyph.viewBox}
                size={SIGN_GLYPH_SIZE}
                color={SIGN_GLYPH_COLOR}
                position={[lx, ly + 0.03, lz]}
                opacity={0.72}
              />
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function CuspLine({ cuspLon, asc }: { cuspLon: number; asc: number }) {
  const [x1, , z1] = eclipticToScene(cuspLon, R_RING_INNER, asc);
  const [x2, , z2] = eclipticToScene(cuspLon, R_RING_OUTER, asc);
  const positions = useMemo(
    () => new Float32Array([x1, 0.02, z1, x2, 0.02, z2]),
    [x1, z1, x2, z2],
  );
  return (
    <line>
      <bufferGeometry attach="geometry">
        <bufferAttribute attach="attributes-position" count={2} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={HOUSE_LABEL_COLOR} transparent opacity={0.5} />
    </line>
  );
}

function InnerHouseRing() {
  const positions = useMemo(() => {
    const pts = new Float32Array((INNER_RING_SEGMENTS + 1) * 3);
    for (let i = 0; i <= INNER_RING_SEGMENTS; i += 1) {
      const angle = (i / INNER_RING_SEGMENTS) * Math.PI * 2;
      pts[i * 3] = R_RING_INNER * Math.cos(angle);
      pts[i * 3 + 1] = 0.02;
      pts[i * 3 + 2] = R_RING_INNER * Math.sin(angle);
    }
    return pts;
  }, []);

  return (
    <line>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          count={INNER_RING_SEGMENTS + 1}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={HOUSE_LABEL_COLOR} transparent opacity={0.3} />
    </line>
  );
}

function HouseCusps({ cusps, asc }: { cusps: number[]; asc: number }) {
  return (
    <group>
      <InnerHouseRing />
      {cusps.slice(0, 12).map((cuspLon, i) => (
        <CuspLine key={i} cuspLon={cuspLon} asc={asc} />
      ))}
    </group>
  );
}

function houseMidLongitude(cusps: number[], houseIndex: number): number {
  const a0 = cusps[houseIndex]!;
  const a1 = cusps[(houseIndex + 1) % 12]!;
  const span = a1 > a0 ? a1 - a0 : a1 + 360 - a0;
  return (a0 + span / 2) % 360;
}

function HouseNumbers({ cusps, asc }: { cusps: number[]; asc: number }) {
  return (
    <group>
      {cusps.slice(0, 12).map((_, i) => {
        const midLon = houseMidLongitude(cusps, i);
        const [x, y, z] = eclipticToScene(midLon, R_HOUSE_NUMBER, asc);
        return (
          <Billboard key={`house-${i + 1}`} position={[x, y, z]}>
            <Text fontSize={0.09} color={HOUSE_LABEL_COLOR} anchorX="center" anchorY="middle">
              {String(i + 1)}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}

function AngleMarkers({ cusps, asc }: { cusps: number[]; asc: number }) {
  const ascGlyph = getPlanetGlyphSvg('ascendant');
  const mcGlyph = getPlanetGlyphSvg('midheaven');
  const ascLon = cusps[0];
  const mcLon = cusps[9];

  if (ascLon == null && mcLon == null) return null;

  return (
    <group>
      {ascGlyph && ascLon != null ? (
        <GlyphIcon
          pathData={ascGlyph.pathData}
          viewBox={ascGlyph.viewBox}
          size={ANGLE_MARKER_SIZE}
          color={ANGLE_MARKER_COLOR}
          position={eclipticToScene(ascLon, R_ANGLE_MARKER, asc)}
          opacity={0.9}
        />
      ) : null}
      {mcGlyph && mcLon != null ? (
        <GlyphIcon
          pathData={mcGlyph.pathData}
          viewBox={mcGlyph.viewBox}
          size={ANGLE_MARKER_SIZE}
          color={ANGLE_MARKER_COLOR}
          position={eclipticToScene(mcLon, R_ANGLE_MARKER, asc)}
          opacity={0.9}
        />
      ) : null}
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
          <lineBasicMaterial color={line.color} transparent opacity={0.38} />
        </line>
      ))}
    </group>
  );
}

function PlanetMarker({
  name,
  lon,
  labelRadius,
  asc,
}: {
  name: string;
  lon: number;
  labelRadius: number;
  asc: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const canonical = normalizePlanetName(name);
  const color = PLANET_COLORS[canonical] ?? WHEEL_COLORS.planetGlyphFill;
  const planetGlyph = getPlanetGlyphSvg(name);
  const [x, y, z] = eclipticToScene(lon, R_PLANET, asc);
  const [lx, ly, lz] = eclipticToScene(lon, labelRadius, asc);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const pulse = isPlaying ? Math.sin(state.clock.elapsedTime * 2.2) * 0.5 + 0.5 : 0;
    mat.emissiveIntensity = 0.3 + pulse * 0.15;
  });

  return (
    <group>
      <group position={[x, y, z]}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.048, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>
        <pointLight color={color} intensity={isPlaying ? 0.18 : 0.12} distance={0.45} />
      </group>
      {planetGlyph ? (
        <GlyphIcon
          pathData={planetGlyph.pathData}
          viewBox={planetGlyph.viewBox}
          size={PLANET_GLYPH_SIZE}
          color={color}
          position={[lx, ly + 0.02, lz]}
          opacity={0.9}
        />
      ) : null}
    </group>
  );
}

function Planets({ positions, asc }: { positions: Record<string, number>; asc: number }) {
  const layouts = useMemo(() => layoutPlanets(positions, asc), [positions, asc]);
  return (
    <group>
      {layouts.map((layout) => (
        <PlanetMarker
          key={layout.name}
          name={layout.name}
          lon={layout.lon}
          labelRadius={layout.labelRadius}
          asc={asc}
        />
      ))}
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
      <ambientLight intensity={0.32} />
      <pointLight position={[0, 3.5, 2]} intensity={0.5} color="#a8d8e8" />
      <pointLight position={[-1.5, -0.5, -1.5]} intensity={0.2} color="#6b4a9b" />
      <Stars radius={70} depth={35} count={900} factor={1.6} saturation={0.15} fade speed={0.1} />
      <ZodiacRing asc={asc} />
      <HouseCusps cusps={chart.cusps} asc={asc} />
      <HouseNumbers cusps={chart.cusps} asc={asc} />
      <AngleMarkers cusps={chart.cusps} asc={asc} />
      {aspects?.length ? (
        <AspectLines aspects={aspects} positions={chart.positions} asc={asc} />
      ) : null}
      <Planets positions={chart.positions} asc={asc} />
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={5.2}
        autoRotate
        autoRotateSpeed={isPlaying ? 0.35 : 0.12}
        enableDamping
        dampingFactor={0.1}
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
          camera={{ position: [0, 3.4, 3.4], fov: 34, near: 0.1, far: 100 }}
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
