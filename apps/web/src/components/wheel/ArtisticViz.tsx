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
import type { WheelAspect } from './wheel-constants';

const ATMOSPHERE_SIZE = 16;

const ELEMENT_COLORS = {
  fire: { a: '#3b0a0a', b: '#5c1a0a', c: '#8b4513' },
  water: { a: '#0a1628', b: '#0c2d48', c: '#134e6f' },
  earth: { a: '#1a1408', b: '#2d2010', c: '#4a3728' },
  air: { a: '#101820', b: '#1a2530', c: '#2d3748' },
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

const ELEMENT_ZONE_ANGLE: Record<keyof typeof ELEMENT_COLORS, number> = {
  fire: -Math.PI / 2,
  water: Math.PI,
  earth: Math.PI / 2,
  air: 0,
};

const LUMINARIES = new Set(['sun', 'moon']);

const ATMOSPHERE_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uTension;
  uniform float uSaturation;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float complexity = 2.5 + uTension * 2.0;
    float noise1 = sin(uv.x * complexity + uTime * 0.15) * cos(uv.y * (complexity - 0.5) + uTime * 0.12);
    float noise2 = sin(uv.x * (complexity - 1.2) - uTime * 0.1 + 1.5) * cos(uv.y * (complexity + 0.7) + uTime * 0.08);
    float combined = (noise1 + noise2) * 0.5 + 0.5;

    float dist = length(uv - 0.5) * 2.0;
    float radial = 1.0 - smoothstep(0.0, 1.2, dist);

    vec3 color = mix(uColorA, uColorB, combined);
    color = mix(color, uColorC, combined * radial * 0.4);
    color *= 0.35 + radial * 0.15;
    color *= uSaturation;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface ArtisticVizProps {
  chart: ChartForWheel;
  aspects?: WheelAspect[];
  size: number;
  composeControls?: ComposeVisualControls | null;
  onWebGLError?: () => void;
  onReady?: () => void;
}

function positionLongitude(positions: Record<string, number>, bodyKey: string): number | undefined {
  const deg = positions[bodyKey] ?? positions[bodyKey.toLowerCase()];
  return typeof deg === 'number' && Number.isFinite(deg) ? deg : undefined;
}

function elementWeightsFromChart(positions: Record<string, number>): Record<keyof typeof ELEMENT_COLORS, number> {
  const counts = { fire: 0, water: 0, earth: 0, air: 0 };
  for (const name of BODY_DISPLAY_ORDER) {
    const lon = positionLongitude(positions, name);
    if (lon == null) continue;
    const signIndex = Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
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

function planetElement(lon: number): keyof typeof ELEMENT_COLORS {
  const signIndex = Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
  return SIGN_ELEMENT[signIndex] ?? 'earth';
}

function blendElementPalettes(weights: Record<keyof typeof ELEMENT_COLORS, number>) {
  const a = new THREE.Color(0, 0, 0);
  const b = new THREE.Color(0, 0, 0);
  const c = new THREE.Color(0, 0, 0);
  let total = 0;

  for (const element of Object.keys(ELEMENT_COLORS) as (keyof typeof ELEMENT_COLORS)[]) {
    const weight = weights[element] ?? 0;
    if (weight <= 0.001) continue;
    const palette = ELEMENT_COLORS[element];
    const ca = new THREE.Color(palette.a);
    const cb = new THREE.Color(palette.b);
    const cc = new THREE.Color(palette.c);
    a.r += ca.r * weight;
    a.g += ca.g * weight;
    a.b += ca.b * weight;
    b.r += cb.r * weight;
    b.g += cb.g * weight;
    b.b += cb.b * weight;
    c.r += cc.r * weight;
    c.g += cc.g * weight;
    c.b += cc.b * weight;
    total += weight;
  }

  if (total > 0) {
    a.multiplyScalar(1 / total);
    b.multiplyScalar(1 / total);
    c.multiplyScalar(1 / total);
  } else {
    a.set(ELEMENT_COLORS.earth.a);
    b.set(ELEMENT_COLORS.earth.b);
    c.set(ELEMENT_COLORS.earth.c);
  }

  return { a, b, c };
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function aspectMidpointDegrees(lonA: number, lonB: number): number {
  let diff = lonB - lonA;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (((lonA + diff / 2) % 360) + 360) % 360;
}

function buildPolygonPoints(vertexCount: number, rotationDeg: number, radius: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < vertexCount; i += 1) {
    const angle = ((rotationDeg + (360 / vertexCount) * i) * Math.PI) / 180;
    points.push(radius * Math.cos(angle), radius * Math.sin(angle));
  }
  return points;
}

function buildLineGeometry(points: number[], z = 0): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    positions.push(points[i], points[i + 1], z);
  }
  if (points.length >= 2) {
    positions.push(points[0], points[1], z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function buildDiameterPoints(angleDeg: number, radius: number): number[] {
  const angle = (angleDeg * Math.PI) / 180;
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  return [-x, -y, x, y];
}

function aspectStrength(orb?: number): number {
  const o = typeof orb === 'number' ? orb : 5;
  return Math.max(0.25, 1 - o / 10);
}

function aspectBodies(asp: WheelAspect): { bodyA: string; bodyB: string } {
  return {
    bodyA: asp.bodyA ?? asp.a ?? '',
    bodyB: asp.bodyB ?? asp.b ?? '',
  };
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

function AtmosphericBackground({
  positions,
  composeControls,
  audioIntensity,
}: {
  positions: Record<string, number>;
  composeControls?: ComposeVisualControls | null;
  audioIntensity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const weights = useMemo(() => elementWeightsFromChart(positions), [positions]);
  const palette = useMemo(() => blendElementPalettes(weights), [weights]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: palette.a.clone() },
          uColorB: { value: palette.b.clone() },
          uColorC: { value: palette.c.clone() },
          uTension: { value: composeControls?.aspectTension ?? 0.5 },
          uSaturation: { value: 1 },
        },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        depthWrite: false,
      }),
    [palette, composeControls?.aspectTension],
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uColorA.value.copy(palette.a);
    mat.uniforms.uColorB.value.copy(palette.b);
    mat.uniforms.uColorC.value.copy(palette.c);
    mat.uniforms.uTension.value = composeControls?.aspectTension ?? 0.5;
    mat.uniforms.uSaturation.value = 1 + audioIntensity * 0.15;
  });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh ref={meshRef} position={[0, 0, -2]} material={material}>
      <planeGeometry args={[ATMOSPHERE_SIZE, ATMOSPHERE_SIZE]} />
    </mesh>
  );
}

function PulsingLineShape({
  geometry,
  color,
  baseOpacity,
  pulseRate,
  phaseOffset,
  intensityMult,
  scale = 1,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  baseOpacity: number;
  pulseRate: number;
  phaseOffset: number;
  intensityMult: number;
  scale?: number;
}) {
  const lineObject = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [geometry, color, baseOpacity]);

  useFrame((state) => {
    const mat = lineObject.material as THREE.LineBasicMaterial;
    const pulse = 0.7 + 0.3 * Math.sin(state.clock.elapsedTime * pulseRate + phaseOffset);
    mat.opacity = Math.min(1, baseOpacity * pulse * intensityMult);
  });

  useEffect(
    () => () => {
      lineObject.geometry.dispose();
      (lineObject.material as THREE.Material).dispose();
    },
    [lineObject],
  );

  return (
    <group scale={scale}>
      <primitive object={lineObject} />
    </group>
  );
}

function SacredGeometry({
  aspects,
  positions,
  intensityMult,
  pulseRateMult,
}: {
  aspects: WheelAspect[];
  positions: Record<string, number>;
  intensityMult: number;
  pulseRateMult: number;
}) {
  const shapes = useMemo(() => {
    type ShapeDef = {
      key: string;
      kind: 'triangle' | 'square' | 'opposition' | 'sextile';
      rotationDeg: number;
      baseOpacity: number;
      pulseRate: number;
      phaseOffset: number;
      color: string;
      radius: number;
    };

    const out: ShapeDef[] = [];
    let conjunctionStrength = 0;

    for (const asp of aspects) {
      const type = (asp.type ?? '').toLowerCase();
      const { bodyA, bodyB } = aspectBodies(asp);
      const lonA = positionLongitude(positions, bodyA);
      const lonB = positionLongitude(positions, bodyB);
      if (lonA == null || lonB == null) continue;

      const strength = aspectStrength(asp.orb);
      const midDeg = aspectMidpointDegrees(lonA, lonB);
      const phase = midDeg * 0.017;

      if (type === 'conjunction') {
        conjunctionStrength += strength;
        continue;
      }

      if (type === 'trine') {
        out.push({
          key: `${bodyA}-${bodyB}-trine`,
          kind: 'triangle',
          rotationDeg: midDeg,
          baseOpacity: 0.15 + strength * 0.15,
          pulseRate: 0.4,
          phaseOffset: phase,
          color: '#fcd34d',
          radius: 1.2,
        });
      } else if (type === 'square') {
        out.push({
          key: `${bodyA}-${bodyB}-square`,
          kind: 'square',
          rotationDeg: midDeg,
          baseOpacity: 0.12 + strength * 0.12,
          pulseRate: 1.2,
          phaseOffset: phase,
          color: '#ef4444',
          radius: 1.0,
        });
      } else if (type === 'opposition') {
        out.push({
          key: `${bodyA}-${bodyB}-opposition`,
          kind: 'opposition',
          rotationDeg: midDeg,
          baseOpacity: 0.18 + strength * 0.12,
          pulseRate: 0.6,
          phaseOffset: phase,
          color: '#a78bfa',
          radius: 1.4,
        });
      } else if (type === 'sextile') {
        out.push({
          key: `${bodyA}-${bodyB}-sextile`,
          kind: 'sextile',
          rotationDeg: midDeg,
          baseOpacity: 0.08 + strength * 0.04,
          pulseRate: 0.2,
          phaseOffset: phase,
          color: '#5eead4',
          radius: 0.85,
        });
      }
    }

    return { shapes: out, conjunctionStrength };
  }, [aspects, positions]);

  const conjunctionRadius = Math.min(0.3, 0.15 + shapes.conjunctionStrength * 0.05);
  const conjunctionOpacity = Math.min(0.75, 0.25 + shapes.conjunctionStrength * 0.15) * intensityMult;
  const conjunctionRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!conjunctionRef.current || shapes.conjunctionStrength <= 0) return;
    const mat = conjunctionRef.current.material as THREE.MeshBasicMaterial;
    const pulse = 0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 0.5);
    mat.opacity = conjunctionOpacity * pulse;
  });

  return (
    <group>
      {shapes.conjunctionStrength > 0 ? (
        <mesh ref={conjunctionRef} position={[0, 0, 0.05]}>
          <sphereGeometry args={[conjunctionRadius, 24, 24]} />
          <meshBasicMaterial color="#fef3c7" transparent opacity={conjunctionOpacity} depthWrite={false} />
        </mesh>
      ) : null}

      {shapes.shapes.map((shape) => {
        let points: number[];
        if (shape.kind === 'triangle') {
          points = buildPolygonPoints(3, shape.rotationDeg, shape.radius);
        } else if (shape.kind === 'square') {
          points = buildPolygonPoints(4, shape.rotationDeg + 45, shape.radius);
        } else if (shape.kind === 'sextile') {
          points = buildPolygonPoints(6, shape.rotationDeg, shape.radius);
        } else {
          points = buildDiameterPoints(shape.rotationDeg, shape.radius);
        }

        const geometry = shape.kind === 'opposition'
          ? (() => {
              const g = new THREE.BufferGeometry();
              g.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(
                  [points[0], points[1], 0, points[2], points[3], 0],
                  3,
                ),
              );
              return g;
            })()
          : buildLineGeometry(points, 0);

        const glowGeometry = geometry.clone();

        return (
          <group key={shape.key}>
            <PulsingLineShape
              geometry={geometry}
              color={shape.color}
              baseOpacity={shape.baseOpacity}
              pulseRate={shape.pulseRate * pulseRateMult}
              phaseOffset={shape.phaseOffset}
              intensityMult={intensityMult}
            />
            <PulsingLineShape
              geometry={glowGeometry}
              color={shape.color}
              baseOpacity={shape.baseOpacity * 0.3}
              pulseRate={shape.pulseRate * pulseRateMult}
              phaseOffset={shape.phaseOffset + 0.5}
              intensityMult={intensityMult}
              scale={1.05}
            />
          </group>
        );
      })}
    </group>
  );
}

function PlanetParticle({
  x,
  y,
  color,
  coreRadius,
  glowRadius,
  coreOpacity,
  glowOpacity,
  seed,
  audioIntensity,
}: {
  x: number;
  y: number;
  color: string;
  coreRadius: number;
  glowRadius: number;
  coreOpacity: number;
  glowOpacity: number;
  seed: number;
  audioIntensity: number;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const breathe = 0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 0.3 + seed);
    const audioBoost = 1 + audioIntensity * 0.3;
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(
        0.35,
        glowOpacity * breathe * audioBoost,
      );
    }
    if (coreRef.current) {
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(
        0.95,
        coreOpacity * (0.9 + breathe * 0.1),
      );
    }
  });

  return (
    <group position={[x, y, 0.1]}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[glowRadius, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={glowOpacity} depthWrite={false} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[coreRadius, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={coreOpacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PlanetEnergyField({
  positions,
  aspects,
  audioIntensity,
}: {
  positions: Record<string, number>;
  aspects?: WheelAspect[];
  audioIntensity: number;
}) {
  const particles = useMemo(() => {
    const conjunctGroups = new Map<string, string[]>();
    const parent = new Map<string, string>();

    function find(name: string): string {
      const p = parent.get(name);
      if (!p || p === name) return name;
      const root = find(p);
      parent.set(name, root);
      return root;
    }

    function union(a: string, b: string) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    }

    for (const name of BODY_DISPLAY_ORDER) {
      const canonical = normalizePlanetName(name);
      parent.set(canonical, canonical);
    }

    for (const asp of aspects ?? []) {
      if ((asp.type ?? '').toLowerCase() !== 'conjunction') continue;
      const { bodyA, bodyB } = aspectBodies(asp);
      const lonA = positionLongitude(positions, bodyA);
      const lonB = positionLongitude(positions, bodyB);
      if (lonA == null || lonB == null) continue;
      const delta = Math.abs(lonA - lonB);
      if (Math.min(delta, 360 - delta) <= 8) {
        union(normalizePlanetName(bodyA), normalizePlanetName(bodyB));
      }
    }

    for (const name of BODY_DISPLAY_ORDER) {
      const canonical = normalizePlanetName(name);
      const root = find(canonical);
      if (!conjunctGroups.has(root)) conjunctGroups.set(root, []);
      conjunctGroups.get(root)!.push(name);
    }

    type Particle = {
      key: string;
      x: number;
      y: number;
      color: string;
      coreRadius: number;
      glowRadius: number;
      coreOpacity: number;
      glowOpacity: number;
      seed: number;
    };

    const out: Particle[] = [];

    for (const [, group] of conjunctGroups) {
      const groupLons = group
        .map((name) => positionLongitude(positions, name))
        .filter((lon): lon is number => lon != null);
      if (groupLons.length === 0) continue;

      const avgLon = groupLons.reduce((a, b) => a + b, 0) / groupLons.length;
      const element = planetElement(avgLon);
      const zoneAngle = ELEMENT_ZONE_ANGLE[element];
      const baseX = Math.cos(zoneAngle) * 0.8;
      const baseY = Math.sin(zoneAngle) * 0.8;
      const isConjunctionCluster = group.length > 1;
      const scatterScale = isConjunctionCluster ? 0.25 : 0.6;

      for (const name of group) {
        const lon = positionLongitude(positions, name);
        if (lon == null) continue;
        const canonical = normalizePlanetName(name);
        const color = PLANET_COLORS[canonical] ?? '#e8ecf1';
        const seed = hashSeed(`${name}-${lon.toFixed(2)}`);
        const isLuminary = LUMINARIES.has(canonical);
        const particleCount = isLuminary ? 7 : 4;
        const coreBase = isLuminary ? 0.05 : 0.03;
        const glowBase = isLuminary ? 0.11 : 0.09;
        const coreOpacityBase = isLuminary ? 0.85 : 0.55;
        const glowOpacityBase = isLuminary ? 0.14 : 0.1;

        for (let j = 0; j < particleCount; j += 1) {
          const px = baseX + (seededRandom(seed, j * 2) - 0.5) * scatterScale;
          const py = baseY + (seededRandom(seed, j * 2 + 1) - 0.5) * scatterScale;
          const sizeVar = 0.85 + seededRandom(seed, j + 10) * 0.3;

          out.push({
            key: `${name}-${j}`,
            x: px,
            y: py,
            color,
            coreRadius: coreBase * sizeVar,
            glowRadius: glowBase * sizeVar,
            coreOpacity: coreOpacityBase,
            glowOpacity: glowOpacityBase,
            seed: seed + j * 1.7,
          });
        }
      }
    }

    return out;
  }, [positions, aspects]);

  return (
    <group>
      {particles.map((p) => (
        <PlanetParticle
          key={p.key}
          x={p.x}
          y={p.y}
          color={p.color}
          coreRadius={p.coreRadius}
          glowRadius={p.glowRadius}
          coreOpacity={p.coreOpacity}
          glowOpacity={p.glowOpacity}
          seed={p.seed}
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
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const currentTime = useAudioPlayerStore((s) => s.currentTime);
  const duration = useAudioPlayerStore((s) => s.duration);
  const progress = duration > 0 ? currentTime / duration : 0;
  const arcIntensity = isPlaying ? 0.5 + 0.5 * Math.sin(progress * Math.PI) : 0;
  const intensityMult = 0.7 + arcIntensity * 0.5;
  const pulseRateMult = 1 + arcIntensity * 0.5;

  return (
    <>
      <AtmosphericBackground
        positions={chart.positions}
        composeControls={composeControls}
        audioIntensity={arcIntensity}
      />
      {aspects?.length ? (
        <SacredGeometry
          aspects={aspects}
          positions={chart.positions}
          intensityMult={intensityMult}
          pulseRateMult={pulseRateMult}
        />
      ) : null}
      <PlanetEnergyField
        positions={chart.positions}
        aspects={aspects}
        audioIntensity={arcIntensity}
      />
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
          camera={{ position: [0, 0, 4.5], fov: 50, near: 0.1, far: 100 }}
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
