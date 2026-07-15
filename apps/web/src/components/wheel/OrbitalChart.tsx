'use client';

import {
  Component,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Line2 } from 'three-stdlib';
import type { LineMaterial } from 'three-stdlib';
import { BODY_LABELS, type BodyKey } from '../../../../../vnext/canonical-bodies';
import type { ComposeVisualControls } from '../../core/compose-visual-controls';
import { normalizePlanetName } from '../../core/planet-identity';
import { lonToSignDegMin, SIGN_NAMES } from '../../lib/zodiac-degrees';
import type { AuraRawSnapshot } from './aura-raw-snapshot';
import { getPlanetGlyphSvg } from './wheel-glyphs';
import { ASPECT_LINE_COLOR } from './wheel-constants';

const ECLIPTIC_RADIUS = 2.5;
const RING_ROTATION_PERIOD = 75;
const TOOLTIP_DISMISS_MS = 4000;

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

export type PlanetTooltipState = {
  type: 'planet';
  planetKey: string;
  name: string;
  sign: string;
  degree: string;
  elementColor: string;
  screenX: number;
  screenY: number;
} | null;

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

type InteractionContextValue = {
  selectPlanet: (planet: { key: string; name: string; lon: number }) => void;
  clearTooltip: () => void;
  registerPlanetObject: (key: string, object: THREE.Object3D | null) => void;
};

const InteractionContext = createContext<InteractionContextValue | null>(null);
const ContainerRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
const PlanetObjectsRefContext = createContext<RefObject<Map<string, THREE.Object3D>> | null>(null);

function hashPhase(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000) * Math.PI * 2;
}

function planetRadius(name: string): number {
  const n = normalizePlanetName(name);
  if (n === 'sun' || n === 'moon') return 0.12;
  if (n === 'mercury' || n === 'venus' || n === 'mars') return 0.08;
  if (n === 'jupiter' || n === 'saturn') return 0.09;
  if (n === 'uranus' || n === 'neptune' || n === 'pluto') return 0.06;
  return 0.04;
}

function planetDisplayName(bodyKey: string): string {
  const canonical = normalizePlanetName(bodyKey);
  return BODY_LABELS[canonical as BodyKey] ?? canonical.charAt(0).toUpperCase() + canonical.slice(1);
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

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function projectWorldToContainer(
  worldPosition: THREE.Vector3,
  camera: THREE.Camera,
  container: HTMLElement,
): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  const projected = worldPosition.clone().project(camera);
  return {
    x: ((projected.x + 1) / 2) * rect.width,
    y: ((-projected.y + 1) / 2) * rect.height,
  };
}

function computeTooltipPlacement(
  screenX: number,
  screenY: number,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number; transform: string } {
  const anchorRight = screenX > containerWidth / 2;
  const anchorBottom = screenY > containerHeight / 2;
  const offset = 10;

  return {
    left: anchorRight ? screenX - offset : screenX + offset,
    top: anchorBottom ? screenY - offset : screenY + offset,
    transform: `${anchorRight ? 'translateX(-100%)' : 'translateX(0)'} ${anchorBottom ? 'translateY(-100%)' : 'translateY(0)'}`,
  };
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

function useInteraction(): InteractionContextValue {
  const ctx = useContext(InteractionContext);
  if (!ctx) throw new Error('OrbitalChart interaction context missing');
  return ctx;
}

function PlanetGlyphIcon({ planetKey, color }: { planetKey: string; color: string }) {
  const glyph = getPlanetGlyphSvg(planetKey);
  if (!glyph) return null;

  return (
    <svg width={16} height={16} viewBox={glyph.viewBox} className="inline-block shrink-0" aria-hidden>
      <path d={glyph.pathData} fill={color} />
    </svg>
  );
}

function PlanetTooltipOverlay({
  tooltip,
  containerRef,
}: {
  tooltip: NonNullable<PlanetTooltipState>;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const rect = containerRef.current?.getBoundingClientRect();
  const width = rect?.width ?? 0;
  const height = rect?.height ?? 0;
  const placement = computeTooltipPlacement(tooltip.screenX, tooltip.screenY, width, height);

  return (
    <motion.div
      key={tooltip.planetKey}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none absolute z-20 rounded-lg bg-black/85 px-3 py-2 text-sm text-white backdrop-blur-sm"
      style={{
        left: placement.left,
        top: placement.top,
        transform: placement.transform,
        border: `1px solid ${colorWithAlpha(tooltip.elementColor, 0.3)}`,
      }}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2">
        <PlanetGlyphIcon planetKey={tooltip.planetKey} color={tooltip.elementColor} />
        <span>
          <span style={{ color: tooltip.elementColor }}>{tooltip.name}</span>
          <span className="text-white/80"> in {tooltip.sign} {tooltip.degree}</span>
        </span>
      </span>
    </motion.div>
  );
}

function ActiveTooltipTracker({
  activePlanetKey,
  onScreenPosition,
}: {
  activePlanetKey: string | null;
  onScreenPosition: (position: { x: number; y: number } | null) => void;
}) {
  const { camera } = useThree();
  const containerRef = useContext(ContainerRefContext);
  const planetObjectsRef = useContext(PlanetObjectsRefContext);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!activePlanetKey || !containerRef?.current || !planetObjectsRef?.current) {
      onScreenPosition(null);
      return;
    }

    const object = planetObjectsRef.current.get(activePlanetKey);
    if (!object) return;

    object.getWorldPosition(worldPosition);
    const projected = projectWorldToContainer(worldPosition, camera, containerRef.current);
    onScreenPosition(projected);
  });

  return null;
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
  const { selectPlanet, registerPlanetObject } = useInteraction();
  const groupRef = useRef<THREE.Group>(null);
  const visibleRef = useRef<THREE.Mesh>(null);
  const radius = planetRadius(name);
  const hitRadius = radius * 1.5;
  const color = signElementColor(lon);
  const planetKey = normalizePlanetName(name);
  const position = useMemo(() => longitudePosition(lon), [lon]);
  const phase = useMemo(() => hashPhase(name), [name]);
  const breathePeriod = useMemo(() => 3 + (hashPhase(`${name}-period`) / (Math.PI * 2)) * 1, [name]);

  useEffect(() => {
    if (groupRef.current) registerPlanetObject(planetKey, groupRef.current);
    return () => registerPlanetObject(planetKey, null);
  }, [planetKey, registerPlanetObject]);

  useFrame((state) => {
    if (!visibleRef.current) return;
    const breathe = 0.95 + 0.05 * Math.sin((state.clock.elapsedTime / breathePeriod) * Math.PI * 2 + phase);
    visibleRef.current.scale.setScalar(breathe);
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectPlanet({ key: planetKey, name, lon });
  };

  const handlePointerEnter = () => {
    document.body.style.cursor = 'pointer';
  };

  const handlePointerLeave = () => {
    document.body.style.cursor = 'default';
  };

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={visibleRef}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.15}
          roughness={0.45}
        />
      </mesh>
      <mesh
        onClick={handleSelect}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
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
  controlsRef,
  activePlanetKey,
  onScreenPosition,
}: {
  snapshot: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  activePlanetKey: string | null;
  onScreenPosition: (position: { x: number; y: number } | null) => void;
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
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
      />

      <ActiveTooltipTracker activePlanetKey={activePlanetKey} onScreenPosition={onScreenPosition} />
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
  const controlsRef = useRef<OrbitControlsImpl | null>(null) as React.MutableRefObject<OrbitControlsImpl | null>;
  const planetObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const [tooltip, setTooltip] = useState<PlanetTooltipState>(null);
  const readyCalledRef = useRef(false);

  const clearTooltip = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setTooltip(null);
    if (controlsRef.current) controlsRef.current.autoRotate = true;
    document.body.style.cursor = 'default';
  }, []);

  const buildTooltip = useCallback(
    (planet: { key: string; name: string; lon: number }, screenX: number, screenY: number): PlanetTooltipState => {
      const { signIndex, degree, minutes } = lonToSignDegMin(planet.lon);
      const sign = SIGN_NAMES[signIndex] ?? '';
      const degreeLabel = `${degree}°${String(minutes).padStart(2, '0')}'`;
      return {
        type: 'planet',
        planetKey: planet.key,
        name: planetDisplayName(planet.name),
        sign,
        degree: degreeLabel,
        elementColor: signElementColor(planet.lon),
        screenX,
        screenY,
      };
    },
    [],
  );

  const projectPlanet = useCallback((planetKey: string): { x: number; y: number } | null => {
    const container = containerRef.current;
    const object = planetObjectsRef.current.get(planetKey);
    if (!container || !object) return null;

    const canvas = container.querySelector('canvas');
    if (!canvas) return null;

    const worldPosition = new THREE.Vector3();
    object.getWorldPosition(worldPosition);

    const camera = controlsRef.current?.object;
    if (!camera) return null;

    return projectWorldToContainer(worldPosition, camera, container);
  }, []);

  const selectPlanet = useCallback(
    (planet: { key: string; name: string; lon: number }) => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      const projected = projectPlanet(planet.key);
      const fallbackW = containerRef.current?.clientWidth ?? 0;
      const fallbackH = containerRef.current?.clientHeight ?? 0;
      const screenX = projected?.x ?? fallbackW / 2;
      const screenY = projected?.y ?? fallbackH / 2;

      setTooltip(buildTooltip(planet, screenX, screenY));
      if (controlsRef.current) controlsRef.current.autoRotate = false;

      dismissTimerRef.current = setTimeout(() => {
        clearTooltip();
      }, TOOLTIP_DISMISS_MS);
    },
    [buildTooltip, clearTooltip, projectPlanet],
  );

  const registerPlanetObject = useCallback((key: string, object: THREE.Object3D | null) => {
    if (object) planetObjectsRef.current.set(key, object);
    else planetObjectsRef.current.delete(key);
  }, []);

  const handleScreenPosition = useCallback((position: { x: number; y: number } | null) => {
    if (!position) return;
    setTooltip((current) => {
      if (!current) return current;
      if (Math.abs(current.screenX - position.x) < 0.5 && Math.abs(current.screenY - position.y) < 0.5) {
        return current;
      }
      return { ...current, screenX: position.x, screenY: position.y };
    });
  }, []);

  useEffect(() => {
    if (!active) {
      clearTooltip();
    }
  }, [active, clearTooltip]);

  useEffect(
    () => () => {
      clearTooltip();
      document.body.style.cursor = 'default';
    },
    [clearTooltip],
  );

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

    const observer = new IntersectionObserver(() => syncFrameloop(), { threshold: 0.1 });
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

  const interactionValue = useMemo(
    () => ({ selectPlanet, clearTooltip, registerPlanetObject }),
    [selectPlanet, clearTooltip, registerPlanetObject],
  );

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      <InteractionContext.Provider value={interactionValue}>
        <PlanetObjectsRefContext.Provider value={planetObjectsRef}>
          <ContainerRefContext.Provider value={containerRef}>
            <WebGLErrorBoundary onError={onWebGLError}>
              <Canvas
                frameloop={frameloop}
                camera={{ position: [0, 3, 5], fov: 45, near: 0.1, far: 100 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                onCreated={handleCreated}
                onPointerMissed={clearTooltip}
                style={{ width: '100%', height: '100%', background: 'transparent' }}
              >
                <Suspense fallback={null}>
                  <OrbitalScene
                    snapshot={snapshot}
                    composeControls={composeControls}
                    controlsRef={controlsRef}
                    activePlanetKey={tooltip?.planetKey ?? null}
                    onScreenPosition={handleScreenPosition}
                  />
                </Suspense>
              </Canvas>
            </WebGLErrorBoundary>
          </ContainerRefContext.Provider>
        </PlanetObjectsRefContext.Provider>
      </InteractionContext.Provider>

      <AnimatePresence>
        {tooltip ? <PlanetTooltipOverlay tooltip={tooltip} containerRef={containerRef} /> : null}
      </AnimatePresence>
    </div>
  );
}
