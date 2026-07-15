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
import { useAudioPlayerStore } from '../../store/audio-player';
import type { AuraRawSnapshot } from './aura-raw-snapshot';
import { getPlanetGlyphSvg } from './wheel-glyphs';
import { ASPECT_LINE_COLOR } from './wheel-constants';

const ECLIPTIC_RADIUS = 2.5;
const RING_ROTATION_PERIOD = 75;
const TOOLTIP_DISMISS_MS = 4000;
const AUDIO_LERP = 0.02;
const RESTING_AUTO_ROTATE_SPEED = 0.3;
const RESTING_PLANET_EMISSIVE = 0.4;
const RESTING_RING_EMISSIVE = 0.1;
const RESTING_GLOW_OPACITY = 0.25;
const OUTER_RING_RADIUS = 2.55;

const radialGlowTextureCache = new Map<string, THREE.CanvasTexture>();

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

export type TooltipState =
  | {
      type: 'planet';
      planetKey: string;
      name: string;
      sign: string;
      degree: string;
      elementColor: string;
      screenX: number;
      screenY: number;
    }
  | {
      type: 'aspect';
      aspectKey: string;
      aspectType: string;
      aspectColor: string;
      planetA: string;
      planetB: string;
      orbLabel: string;
      strengthLabel?: string;
      screenX: number;
      screenY: number;
    }
  | null;

/** @deprecated Use TooltipState */
export type PlanetTooltipState = TooltipState;

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
  dashed: boolean;
};

type InteractionContextValue = {
  selectPlanet: (planet: { key: string; name: string; lon: number }) => void;
  selectAspect: (aspect: {
    key: string;
    type: string;
    bodies: [string, string];
    orb: number;
    strength?: number;
    midpoint: THREE.Vector3;
  }) => void;
  clearTooltip: () => void;
  registerPlanetObject: (key: string, object: THREE.Object3D | null) => void;
  registerAspectObject: (key: string, object: THREE.Object3D | null) => void;
};

const InteractionContext = createContext<InteractionContextValue | null>(null);
const ContainerRefContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
const PlanetObjectsRefContext = createContext<RefObject<Map<string, THREE.Object3D>> | null>(null);
const AspectObjectsRefContext = createContext<RefObject<Map<string, THREE.Object3D>> | null>(null);
const AudioIntensityRefContext = createContext<MutableRefObject<number> | null>(null);

function useAudioIntensityRef(): MutableRefObject<number> {
  const ref = useContext(AudioIntensityRefContext);
  if (!ref) throw new Error('AudioIntensityRefContext missing');
  return ref;
}

function isInnerPlanet(name: string): boolean {
  const n = normalizePlanetName(name);
  return n === 'sun' || n === 'moon' || n === 'mercury' || n === 'venus' || n === 'mars';
}

function AudioReactiveDriver({
  controlsRef,
}: {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}) {
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const currentTime = useAudioPlayerStore((s) => s.currentTime);
  const duration = useAudioPlayerStore((s) => s.duration);
  const intensityRef = useAudioIntensityRef();
  const rotateSpeedRef = useRef(RESTING_AUTO_ROTATE_SPEED);

  useFrame(() => {
    const progress = duration > 0 ? currentTime / duration : 0;
    const playbackIntensity = isPlaying ? 0.3 + 0.7 * Math.sin(progress * Math.PI) : 0;
    intensityRef.current += (playbackIntensity - intensityRef.current) * AUDIO_LERP;

    const targetRotate = RESTING_AUTO_ROTATE_SPEED + intensityRef.current * 0.7;
    rotateSpeedRef.current += (targetRotate - rotateSpeedRef.current) * AUDIO_LERP;
    if (controlsRef.current) {
      controlsRef.current.autoRotateSpeed = rotateSpeedRef.current;
    }
  });

  return null;
}

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

function getRadialGlowTexture(color: string): THREE.CanvasTexture {
  const cached = radialGlowTextureCache.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    radialGlowTextureCache.set(color, fallback);
    return fallback;
  }

  const normalized = color.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.55)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  radialGlowTextureCache.set(color, texture);
  return texture;
}

function dominantElementAccentColor(dominantElements: AuraRawSnapshot['dominantElements']): THREE.Color {
  const blended = new THREE.Color(0, 0, 0);
  let total = 0;
  for (const element of SIGN_ELEMENT) {
    const weight = dominantElements[element] ?? 0;
    if (weight <= 0) continue;
    const c = new THREE.Color(SIGN_ELEMENT_COLORS[element]);
    blended.r += c.r * weight;
    blended.g += c.g * weight;
    blended.b += c.b * weight;
    total += weight;
  }
  if (total > 0) {
    blended.multiplyScalar(1 / total);
  } else {
    blended.set(SIGN_ELEMENT_COLORS.earth);
  }
  return blended;
}

function normalizeAspectStrength(strength?: number): number {
  if (typeof strength !== 'number' || !Number.isFinite(strength)) return 1;
  return strength <= 1 ? strength : strength / 100;
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
function aspectTypeColor(type: string): string {
  const t = type.toLowerCase();
  return ASPECT_LINE_COLOR[t] ?? '#666666';
}

function capitalizeAspectType(type: string): string {
  const t = type.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatOrbLabel(orb: number): string {
  const degrees = Math.floor(orb);
  const minutes = Math.floor((orb - degrees) * 60);
  return `${degrees}°${String(minutes).padStart(2, '0')}'`;
}

function formatStrengthLabel(strength: number): string {
  const pct = strength <= 1 ? Math.round(strength * 100) : Math.round(strength);
  return `${pct}%`;
}

/** Aspect line colors from the shared wheel style guide (`ASPECT_LINE_COLOR`). */
function aspectLineStyle(type: string): AspectLineStyle | null {
  const t = type.toLowerCase();
  if (t === 'conjunction') return null;
  if (t === 'trine') {
    return { color: ASPECT_LINE_COLOR.trine, lineWidth: 1.5, baseOpacity: 0.6, pulsePeriod: 4, dashed: false };
  }
  if (t === 'sextile') {
    return { color: ASPECT_LINE_COLOR.sextile, lineWidth: 1, baseOpacity: 0.45, pulsePeriod: 4, dashed: true };
  }
  if (t === 'square') {
    return { color: ASPECT_LINE_COLOR.square, lineWidth: 1.5, baseOpacity: 0.6, pulsePeriod: 2, dashed: false };
  }
  if (t === 'opposition') {
    return { color: ASPECT_LINE_COLOR.opposition, lineWidth: 1.5, baseOpacity: 0.6, pulsePeriod: 3, dashed: false };
  }
  return { color: '#666666', lineWidth: 0.5, baseOpacity: 0.3, pulsePeriod: 4, dashed: true };
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

function TooltipOverlay({
  tooltip,
  containerRef,
}: {
  tooltip: NonNullable<TooltipState>;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const rect = containerRef.current?.getBoundingClientRect();
  const width = rect?.width ?? 0;
  const height = rect?.height ?? 0;
  const placement = computeTooltipPlacement(tooltip.screenX, tooltip.screenY, width, height);

  const borderColor =
    tooltip.type === 'planet'
      ? colorWithAlpha(tooltip.elementColor, 0.3)
      : colorWithAlpha(tooltip.aspectColor, 0.3);

  const tooltipKey = tooltip.type === 'planet' ? tooltip.planetKey : tooltip.aspectKey;

  return (
    <motion.div
      key={tooltipKey}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none absolute z-20 rounded-lg bg-black/85 px-3 py-2 text-sm text-white backdrop-blur-sm"
      style={{
        left: placement.left,
        top: placement.top,
        transform: placement.transform,
        border: `1px solid ${borderColor}`,
      }}
      role="status"
      aria-live="polite"
    >
      {tooltip.type === 'planet' ? (
        <span className="inline-flex items-center gap-2">
          <PlanetGlyphIcon planetKey={tooltip.planetKey} color={tooltip.elementColor} />
          <span>
            <span style={{ color: tooltip.elementColor }}>{tooltip.name}</span>
            <span className="text-white/80"> in {tooltip.sign} {tooltip.degree}</span>
          </span>
        </span>
      ) : (
        <div className="space-y-0.5">
          <p className="font-medium" style={{ color: tooltip.aspectColor }}>
            {tooltip.aspectType}
          </p>
          <p className="text-white/90">
            {tooltip.planetA} — {tooltip.planetB}
          </p>
          <p className="text-white/70 text-xs">
            Orb: {tooltip.orbLabel}
            {tooltip.strengthLabel ? ` · Strength: ${tooltip.strengthLabel}` : ''}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function ActiveTooltipTracker({
  activeTarget,
  onScreenPosition,
}: {
  activeTarget: { type: 'planet' | 'aspect'; key: string } | null;
  onScreenPosition: (position: { x: number; y: number } | null) => void;
}) {
  const { camera } = useThree();
  const containerRef = useContext(ContainerRefContext);
  const planetObjectsRef = useContext(PlanetObjectsRefContext);
  const aspectObjectsRef = useContext(AspectObjectsRefContext);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!activeTarget || !containerRef?.current) {
      onScreenPosition(null);
      return;
    }

    const objectMap =
      activeTarget.type === 'planet' ? planetObjectsRef?.current : aspectObjectsRef?.current;
    const object = objectMap?.get(activeTarget.key);
    if (!object) return;

    object.getWorldPosition(worldPosition);
    const projected = projectWorldToContainer(worldPosition, camera, containerRef.current);
    onScreenPosition(projected);
  });

  return null;
}

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec2 vUv;
  uniform vec3 uColor;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float alpha = smoothstep(0.5, 0.0, d) * 0.08;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function BackgroundAtmosphere({ dominantElements }: { dominantElements: AuraRawSnapshot['dominantElements'] }) {
  const accentColor = useMemo(() => dominantElementAccentColor(dominantElements), [dominantElements]);
  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: accentColor.clone() },
        },
        vertexShader: ATMOSPHERE_VERTEX_SHADER,
        fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [accentColor],
  );

  useEffect(() => {
    shaderMaterial.uniforms.uColor.value.copy(accentColor);
  }, [accentColor, shaderMaterial]);

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial]);

  return (
    <mesh>
      <sphereGeometry args={[12, 32, 32]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}

function EclipticRing() {
  const spinRef = useRef<THREE.Group>(null);
  const innerMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const outerMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const emissiveRef = useRef(RESTING_RING_EMISSIVE);
  const intensityRef = useAudioIntensityRef();

  useFrame((_, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += ((Math.PI * 2) / RING_ROTATION_PERIOD) * delta;
    }

    const target = RESTING_RING_EMISSIVE + intensityRef.current * 0.2;
    emissiveRef.current += (target - emissiveRef.current) * AUDIO_LERP;

    for (const mat of [innerMaterialRef.current, outerMaterialRef.current]) {
      if (mat) mat.emissiveIntensity = emissiveRef.current;
    }
  });

  const ringMaterialProps = {
    color: '#1e4a5a',
    emissive: '#1e4a5a',
    emissiveIntensity: RESTING_RING_EMISSIVE,
    roughness: 0.5,
    metalness: 0.3,
    transparent: true as const,
  };

  return (
    <group ref={spinRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ECLIPTIC_RADIUS, 0.025, 16, 128]} />
        <meshPhysicalMaterial ref={innerMaterialRef} {...ringMaterialProps} opacity={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[OUTER_RING_RADIUS, 0.008, 16, 128]} />
        <meshPhysicalMaterial ref={outerMaterialRef} {...ringMaterialProps} opacity={0.25} />
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
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const spriteMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const emissiveRef = useRef(RESTING_PLANET_EMISSIVE);
  const glowOpacityRef = useRef(RESTING_GLOW_OPACITY);
  const intensityRef = useAudioIntensityRef();
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const viewDirection = useMemo(() => new THREE.Vector3(), []);
  const planetDirection = useMemo(() => new THREE.Vector3(), []);
  const radius = planetRadius(name);
  const hitRadius = radius * 1.5;
  const glowSize = radius * 3;
  const color = signElementColor(lon);
  const glowTexture = useMemo(() => getRadialGlowTexture(color), [color]);
  const planetKey = normalizePlanetName(name);
  const position = useMemo(() => longitudePosition(lon), [lon]);
  const phase = useMemo(() => hashPhase(name), [name]);
  const breathePeriod = useMemo(() => 3 + (hashPhase(`${name}-period`) / (Math.PI * 2)) * 1, [name]);

  useEffect(() => {
    if (groupRef.current) registerPlanetObject(planetKey, groupRef.current);
    return () => registerPlanetObject(planetKey, null);
  }, [planetKey, registerPlanetObject]);

  useFrame((state) => {
    if (visibleRef.current) {
      const breathe = 0.95 + 0.05 * Math.sin((state.clock.elapsedTime / breathePeriod) * Math.PI * 2 + phase);
      visibleRef.current.scale.setScalar(breathe);
    }

    visibleRef.current?.getWorldPosition(worldPosition);
    viewDirection.copy(state.camera.position).sub(worldPosition).normalize();
    planetDirection.copy(worldPosition).normalize();
    const grazing = 1 - Math.abs(viewDirection.dot(planetDirection));
    const rimBoost = 0.12 * grazing;

    const mat = materialRef.current;
    if (mat) {
      const innerMult = isInnerPlanet(name) ? 1.3 : 1;
      const audioTarget = RESTING_PLANET_EMISSIVE + intensityRef.current * 0.6 * innerMult;
      const target = audioTarget + rimBoost;
      emissiveRef.current += (target - emissiveRef.current) * AUDIO_LERP;
      mat.emissiveIntensity = emissiveRef.current;
    }

    const spriteMat = spriteMaterialRef.current;
    if (spriteMat) {
      const targetGlow = RESTING_GLOW_OPACITY + intensityRef.current * 0.2;
      glowOpacityRef.current += (targetGlow - glowOpacityRef.current) * AUDIO_LERP;
      spriteMat.opacity = glowOpacityRef.current;
    }
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
      <pointLight color={color} intensity={0.3} distance={1.5} decay={2} />
      <sprite scale={[glowSize, glowSize, 1]} renderOrder={-1}>
        <spriteMaterial
          ref={spriteMaterialRef}
          map={glowTexture}
          color={color}
          transparent
          opacity={RESTING_GLOW_OPACITY}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh ref={visibleRef}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshPhysicalMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={RESTING_PLANET_EMISSIVE}
          roughness={0.3}
          metalness={0.1}
          clearcoat={0.4}
          clearcoatRoughness={0.2}
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
  aspectKey,
  aspect,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  style: AspectLineStyle;
  phaseOffset: number;
  aspectKey: string;
  aspect: AuraRawSnapshot['aspects'][number];
}) {
  const { selectAspect, registerAspectObject } = useInteraction();
  const lineRef = useRef<Line2>(null);
  const midpointRef = useRef<THREE.Group>(null);
  const intensityRef = useAudioIntensityRef();
  const aspectType = aspect.type.toLowerCase();
  const strengthNorm = normalizeAspectStrength(aspect.strength);
  const lineWidth = style.lineWidth * (0.5 + 0.5 * strengthNorm);
  const midpoint = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [start, end]);
  const tubeGeometry = useMemo(() => {
    const curve = new THREE.LineCurve3(start.clone(), end.clone());
    return new THREE.TubeGeometry(curve, 2, 0.08, 8, false);
  }, [start, end]);

  useEffect(() => {
    if (midpointRef.current) registerAspectObject(aspectKey, midpointRef.current);
    return () => registerAspectObject(aspectKey, null);
  }, [aspectKey, registerAspectObject]);

  useEffect(() => () => tubeGeometry.dispose(), [tubeGeometry]);

  useEffect(() => {
    const mat = lineRef.current?.material as LineMaterial | undefined;
    if (!mat) return;
    if (style.dashed) {
      mat.dashed = true;
      mat.dashSize = 0.15;
      mat.gapSize = 0.1;
    } else {
      mat.dashed = false;
    }
    mat.needsUpdate = true;
  }, [style.dashed]);

  useFrame((state) => {
    const mat = lineRef.current?.material as LineMaterial | undefined;
    if (!mat) return;

    const playback = intensityRef.current;
    const opacityBoost = playback * 0.3;
    const boostedBase = Math.min(1, style.baseOpacity + opacityBoost);

    let pulsePeriod = style.pulsePeriod;
    let pulseMin = 0.7;
    let pulseAmp = 0.3;

    if (aspectType === 'square' || aspectType === 'opposition') {
      pulsePeriod /= 1 + playback * 0.5;
    } else if (aspectType === 'trine' || aspectType === 'sextile') {
      pulsePeriod *= 1 + playback * 0.25;
      pulseMin = 0.7 - playback * 0.15;
      pulseAmp = 0.3 + playback * 0.1;
    }

    const pulse = pulseMin + pulseAmp * Math.sin((state.clock.elapsedTime / pulsePeriod) * Math.PI * 2 + phaseOffset);
    mat.opacity = Math.min(1, boostedBase * pulse);
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectAspect({
      key: aspectKey,
      type: aspect.type,
      bodies: aspect.bodies,
      orb: aspect.orb,
      strength: aspect.strength,
      midpoint,
    });
  };

  const handlePointerEnter = () => {
    document.body.style.cursor = 'pointer';
  };

  const handlePointerLeave = () => {
    document.body.style.cursor = 'default';
  };

  return (
    <group>
      <Line
        ref={lineRef}
        points={[start, end]}
        color={style.color}
        lineWidth={lineWidth}
        transparent
        opacity={style.baseOpacity}
        depthWrite={false}
        dashed={style.dashed}
        dashSize={0.15}
        gapSize={0.1}
      />
      <group ref={midpointRef} position={midpoint} />
      <mesh
        geometry={tubeGeometry}
        onClick={handleSelect}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
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
      aspect: AuraRawSnapshot['aspects'][number];
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
        aspect,
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
          aspectKey={line.key}
          aspect={line.aspect}
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
  activeTarget,
  onScreenPosition,
}: {
  snapshot: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  activeTarget: { type: 'planet' | 'aspect'; key: string } | null;
  onScreenPosition: (position: { x: number; y: number } | null) => void;
}) {
  const planetPositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    for (const planet of snapshot.planets) {
      map.set(normalizePlanetName(planet.name), longitudePosition(planet.lon));
    }
    return map;
  }, [snapshot.planets]);

  const playbackIntensityRef = useRef(0);

  return (
    <AudioIntensityRefContext.Provider value={playbackIntensityRef}>
      <color attach="background" args={['#080d18']} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <pointLight position={[-3, -3, -3]} intensity={0.15} />
      <hemisphereLight args={['#1a2a3a', '#0a0a0a', 0.1]} />

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
        autoRotateSpeed={RESTING_AUTO_ROTATE_SPEED}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
      />

      <AudioReactiveDriver controlsRef={controlsRef} />
      <ActiveTooltipTracker activeTarget={activeTarget} onScreenPosition={onScreenPosition} />
    </AudioIntensityRefContext.Provider>
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
  const aspectObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  const [tooltip, setTooltip] = useState<TooltipState>(null);
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

  const scheduleDismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      clearTooltip();
    }, TOOLTIP_DISMISS_MS);
  }, [clearTooltip]);

  const projectWorldPoint = useCallback((worldPosition: THREE.Vector3): { x: number; y: number } | null => {
    const container = containerRef.current;
    if (!container) return null;

    const camera = controlsRef.current?.object;
    if (!camera) return null;

    return projectWorldToContainer(worldPosition, camera, container);
  }, []);

  const projectPlanet = useCallback(
    (planetKey: string): { x: number; y: number } | null => {
      const object = planetObjectsRef.current.get(planetKey);
      if (!object) return null;
      const worldPosition = new THREE.Vector3();
      object.getWorldPosition(worldPosition);
      return projectWorldPoint(worldPosition);
    },
    [projectWorldPoint],
  );

  const projectAspect = useCallback(
    (aspectKey: string): { x: number; y: number } | null => {
      const object = aspectObjectsRef.current.get(aspectKey);
      if (!object) return null;
      const worldPosition = new THREE.Vector3();
      object.getWorldPosition(worldPosition);
      return projectWorldPoint(worldPosition);
    },
    [projectWorldPoint],
  );

  const buildPlanetTooltip = useCallback(
    (planet: { key: string; name: string; lon: number }, screenX: number, screenY: number): TooltipState => {
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

  const buildAspectTooltip = useCallback(
    (
      aspect: {
        key: string;
        type: string;
        bodies: [string, string];
        orb: number;
        strength?: number;
      },
      screenX: number,
      screenY: number,
    ): TooltipState => {
      const aspectColor = aspectTypeColor(aspect.type);
      const strengthLabel =
        typeof aspect.strength === 'number' && Number.isFinite(aspect.strength)
          ? formatStrengthLabel(aspect.strength)
          : undefined;

      return {
        type: 'aspect',
        aspectKey: aspect.key,
        aspectType: capitalizeAspectType(aspect.type),
        aspectColor,
        planetA: planetDisplayName(aspect.bodies[0]),
        planetB: planetDisplayName(aspect.bodies[1]),
        orbLabel: formatOrbLabel(aspect.orb),
        strengthLabel,
        screenX,
        screenY,
      };
    },
    [],
  );

  const selectPlanet = useCallback(
    (planet: { key: string; name: string; lon: number }) => {
      const projected = projectPlanet(planet.key);
      const fallbackW = containerRef.current?.clientWidth ?? 0;
      const fallbackH = containerRef.current?.clientHeight ?? 0;
      const screenX = projected?.x ?? fallbackW / 2;
      const screenY = projected?.y ?? fallbackH / 2;

      setTooltip(buildPlanetTooltip(planet, screenX, screenY));
      if (controlsRef.current) controlsRef.current.autoRotate = false;
      scheduleDismiss();
    },
    [buildPlanetTooltip, projectPlanet, scheduleDismiss],
  );

  const selectAspect = useCallback(
    (aspect: {
      key: string;
      type: string;
      bodies: [string, string];
      orb: number;
      strength?: number;
      midpoint: THREE.Vector3;
    }) => {
      const projected = projectAspect(aspect.key) ?? projectWorldPoint(aspect.midpoint);
      const fallbackW = containerRef.current?.clientWidth ?? 0;
      const fallbackH = containerRef.current?.clientHeight ?? 0;
      const screenX = projected?.x ?? fallbackW / 2;
      const screenY = projected?.y ?? fallbackH / 2;

      setTooltip(
        buildAspectTooltip(
          {
            key: aspect.key,
            type: aspect.type,
            bodies: aspect.bodies,
            orb: aspect.orb,
            strength: aspect.strength,
          },
          screenX,
          screenY,
        ),
      );
      if (controlsRef.current) controlsRef.current.autoRotate = false;
      scheduleDismiss();
    },
    [buildAspectTooltip, projectAspect, projectWorldPoint, scheduleDismiss],
  );

  const registerPlanetObject = useCallback((key: string, object: THREE.Object3D | null) => {
    if (object) planetObjectsRef.current.set(key, object);
    else planetObjectsRef.current.delete(key);
  }, []);

  const registerAspectObject = useCallback((key: string, object: THREE.Object3D | null) => {
    if (object) aspectObjectsRef.current.set(key, object);
    else aspectObjectsRef.current.delete(key);
  }, []);

  const activeTarget = useMemo(() => {
    if (!tooltip) return null;
    if (tooltip.type === 'planet') return { type: 'planet' as const, key: tooltip.planetKey };
    return { type: 'aspect' as const, key: tooltip.aspectKey };
  }, [tooltip]);

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
    () => ({
      selectPlanet,
      selectAspect,
      clearTooltip,
      registerPlanetObject,
      registerAspectObject,
    }),
    [selectPlanet, selectAspect, clearTooltip, registerPlanetObject, registerAspectObject],
  );

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      <InteractionContext.Provider value={interactionValue}>
        <PlanetObjectsRefContext.Provider value={planetObjectsRef}>
          <AspectObjectsRefContext.Provider value={aspectObjectsRef}>
            <ContainerRefContext.Provider value={containerRef}>
              <WebGLErrorBoundary onError={onWebGLError}>
                <Canvas
                  frameloop={frameloop}
                  camera={{ position: [0, 3.5, 5.5], fov: 40, near: 0.1, far: 100 }}
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
                      activeTarget={activeTarget}
                      onScreenPosition={handleScreenPosition}
                    />
                  </Suspense>
                </Canvas>
              </WebGLErrorBoundary>
            </ContainerRefContext.Provider>
          </AspectObjectsRefContext.Provider>
        </PlanetObjectsRefContext.Provider>
      </InteractionContext.Provider>

      <AnimatePresence>
        {tooltip ? <TooltipOverlay tooltip={tooltip} containerRef={containerRef} /> : null}
      </AnimatePresence>
    </div>
  );
}
