'use client';

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HarmonicOverlay } from './harmonic/HarmonicOverlay';
import { HarmonicScene } from './harmonic/HarmonicScene';
import {
  mapAspectArcs,
  mapPlanetSources,
  terrainPalette,
} from './harmonic/harmonic-mapping';
import type { HarmonicLandscapeProps, HarmonicQuality } from './harmonic/types';

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
    return this.state.hasError ? null : this.props.children;
  }
}

function WebGLContextLossListener({ onError }: { onError?: () => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onError?.();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost);
  }, [gl, onError]);

  return null;
}

function getQuality(): HarmonicQuality {
  if (typeof window === 'undefined') return 'high';
  if (window.innerWidth < 768) return 'low';
  if ((navigator.hardwareConcurrency || 8) <= 4) return 'medium';
  return 'high';
}

function getReducedMotion(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Frame the terrain disk at ~70–75% of canvas width (thin starfield margin). */
export function getCameraDistance(aspect: number): [number, number, number] {
  if (aspect < 0.8) return [0, 9, 11]; // portrait mobile
  if (aspect < 1.2) return [0, 8, 10.5]; // tablet
  return [0, 7.5, 10]; // desktop
}

function cameraFitKey(aspect: number): string {
  if (aspect < 0.8) return 'portrait';
  if (aspect < 1.2) return 'square';
  return 'landscape';
}

/** Bias look target downward so the disk sits above the HUD pill bar. */
function getCameraLookTarget(aspect: number): [number, number, number] {
  if (aspect < 0.8) return [0, -1.2, 0];
  if (aspect < 1.2) return [0, -0.7, 0];
  return [0, -0.35, 0];
}

function ResponsiveCameraFit({
  onFitKeyChange,
}: {
  onFitKeyChange: (key: string) => void;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const [x, y, z] = getCameraDistance(aspect);
    const lookTarget = getCameraLookTarget(aspect);
    camera.fov = 46;
    camera.aspect = aspect;
    camera.position.set(x, y, z);
    camera.lookAt(lookTarget[0], lookTarget[1], lookTarget[2]);
    camera.updateProjectionMatrix();
    onFitKeyChange(cameraFitKey(aspect));
  }, [camera, onFitKeyChange, size.height, size.width]);

  return null;
}

export function HarmonicLandscape({
  snapshot,
  composeControls = null,
  linkedExportId = null,
  active = true,
  onWebGLError,
  onReady,
  onSelectionChange,
  clearSelectionSignal = 0,
}: HarmonicLandscapeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyCalledRef = useRef(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedAspectKey, setSelectedAspectKey] = useState<string | null>(null);
  const [frameloop, setFrameloop] = useState<'always' | 'never'>(
    active ? 'always' : 'never',
  );
  const [quality, setQuality] = useState<HarmonicQuality>('high');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cameraFitBucket, setCameraFitBucket] = useState('landscape');
  const controlsTarget = useMemo((): [number, number, number] => {
    if (cameraFitBucket === 'portrait') return [0, -1.2, 0];
    if (cameraFitBucket === 'square') return [0, -0.7, 0];
    return [0, -0.35, 0];
  }, [cameraFitBucket]);
  // Mild scale only — camera distance owns framing (~70–75% disk fill).
  const sceneScale =
    cameraFitBucket === 'portrait' ? 0.95 : cameraFitBucket === 'square' ? 0.98 : 1;
  const sources = useMemo(() => mapPlanetSources(snapshot.planets), [snapshot.planets]);
  const arcs = useMemo(
    () => mapAspectArcs(snapshot.aspects, sources),
    [snapshot.aspects, sources],
  );
  const palette = useMemo(
    () => terrainPalette(snapshot.dominantElements),
    [snapshot.dominantElements],
  );
  const bpm = 60 + Math.max(0, Math.min(1, composeControls?.tempoNorm ?? 0.5)) * 80;

  const selectPlanet = useCallback((index: number) => {
    setSelectedAspectKey(null);
    setSelectedIndex((current) => (current === index ? null : index));
  }, []);

  const selectAspect = useCallback((key: string) => {
    setSelectedAspectKey((current) => (current === key ? null : key));
    setSelectedIndex(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIndex(null);
    setSelectedAspectKey(null);
  }, []);

  const highlightedPlanetIndices = useMemo(() => {
    if (!selectedAspectKey) return [] as number[];
    const arc = arcs.find((item) => item.key === selectedAspectKey);
    return arc ? [arc.fromIdx, arc.toIdx] : [];
  }, [arcs, selectedAspectKey]);

  useEffect(() => {
    onSelectionChange?.(selectedIndex !== null || selectedAspectKey !== null);
  }, [onSelectionChange, selectedAspectKey, selectedIndex]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, clearSelectionSignal]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedIndex === null && selectedAspectKey === null) return;
      event.preventDefault();
      clearSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, clearSelection, selectedAspectKey, selectedIndex]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setQuality(getQuality());
      setReducedMotion(getReducedMotion());
    };
    sync();
    window.addEventListener('resize', sync);
    media.addEventListener('change', sync);
    return () => {
      window.removeEventListener('resize', sync);
      media.removeEventListener('change', sync);
    };
  }, []);

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
      setFrameloop(inView && document.visibilityState === 'visible' ? 'always' : 'never');
    };
    const observer = new IntersectionObserver(syncFrameloop, { threshold: 0.1 });
    observer.observe(node);
    document.addEventListener('visibilitychange', syncFrameloop);
    syncFrameloop();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncFrameloop);
    };
  }, [active]);

  useEffect(() => {
    return () => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      try {
        renderer.dispose();
        renderer.forceContextLoss();
      } catch {
        // Ignore teardown races with R3F's own cleanup.
      }
      rendererRef.current = null;
    };
  }, []);

  const handleCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      rendererRef.current = gl;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.3;
      gl.setClearColor('#0d0618', 1);
      if (!readyCalledRef.current) {
        readyCalledRef.current = true;
        onReady?.();
      }
    },
    [onReady],
  );

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden">
      <WebGLErrorBoundary onError={onWebGLError}>
        <Canvas
          frameloop={frameloop}
          camera={{ position: [0, 7.5, 10], fov: 46, near: 0.1, far: 100 }}
          dpr={quality === 'low' ? [1, 1.25] : [1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 2)]}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={handleCreated}
          onPointerMissed={clearSelection}
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        >
          <Suspense fallback={null}>
            <WebGLContextLossListener onError={onWebGLError} />
            <ResponsiveCameraFit onFitKeyChange={setCameraFitBucket} />
            <HarmonicScene
              key={cameraFitBucket}
              sources={sources}
              arcs={arcs}
              palette={palette}
              quality={quality}
              bpm={bpm}
              selectedIndex={selectedIndex}
              selectedAspectKey={selectedAspectKey}
              highlightedPlanetIndices={highlightedPlanetIndices}
              reducedMotion={reducedMotion}
              onSelect={selectPlanet}
              onSelectAspect={selectAspect}
              controlsTarget={controlsTarget}
              sceneScale={sceneScale}
              linkedExportId={linkedExportId}
            />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>

      <HarmonicOverlay
        sources={sources}
        arcs={arcs}
        selectedIndex={selectedIndex}
        selectedAspectKey={selectedAspectKey}
        onSelect={selectPlanet}
        onSelectAspect={selectAspect}
        linkedExportId={linkedExportId}
      />
    </div>
  );
}
