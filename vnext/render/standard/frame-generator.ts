import type { EphemerisSnapshot } from '../../contracts';
import { normalizeSnapshotForWheel, resolveAscendantLongitude } from '../chart-for-wheel';
import {
  createWheelLayout,
  groupAtWheelCenter,
  positionsFromChart,
  renderAspectLines,
  renderBackground,
  renderHouseCusps,
  renderPlanets,
  renderZodiacRing,
  strongestAspects,
  WHEEL_CX,
  WHEEL_CY,
} from './svg-wheel-renderer';

export interface FrameGeneratorOptions {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
}

export interface FrameResult {
  svg: string;
  frameIndex: number;
  totalFrames: number;
}

export const DEFAULT_FRAME_OPTIONS: Required<FrameGeneratorOptions> = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 30,
};

const ZODIAC_START = 30;
const ZODIAC_FRAMES_PER_SEGMENT = 5;
const PLANET_START = 90;
const PLANET_FRAMES_EACH = 8;
const ASPECT_START = 210;
const ASPECT_FRAMES_EACH = 6;
const CUSP_START = 330;
const CUSP_FRAMES_EACH = 10;
const HOLD_START = 450;
const ROTATION_DEG_PER_SEC = 0.5;
const MAX_ASPECTS = 10;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function resolveOptions(options?: Partial<FrameGeneratorOptions>): Required<FrameGeneratorOptions> {
  return { ...DEFAULT_FRAME_OPTIONS, ...options };
}

export function getTotalFrames(options?: Partial<FrameGeneratorOptions>): number {
  const opts = resolveOptions(options);
  return opts.fps * opts.durationSeconds;
}

interface AnimationState {
  bgFade: number;
  zodiacSegments: number;
  zodiacPartial: number;
  zodiacOpacity: number;
  planetsVisible: number;
  planetPartial: number;
  planetOpacity: number;
  aspectsVisible: number;
  aspectProgress: number;
  cuspsVisible: number;
  cuspPartial: number;
  cuspOpacity: number;
  rotationDeg: number;
}

function staggeredCount(
  frame: number,
  start: number,
  framesEach: number,
  maxCount: number,
): { full: number; partial: number } {
  if (frame < start) return { full: 0, partial: 0 };
  const elapsed = frame - start;
  const full = Math.min(maxCount, Math.floor(elapsed / framesEach));
  const remainder = elapsed - full * framesEach;
  const partial = full < maxCount ? clamp01(remainder / framesEach) : 0;
  return { full, partial };
}

function computeAnimationState(frameIndex: number, fps: number): AnimationState {
  const bgFade = frameIndex <= 29 ? lerp(0, 1, frameIndex / 29) : 1;

  const zodiac = staggeredCount(frameIndex, ZODIAC_START, ZODIAC_FRAMES_PER_SEGMENT, 12);
  const zodiacOpacity = frameIndex >= ZODIAC_START ? 1 : 0;

  const planetCount = 13;
  const planets = staggeredCount(frameIndex, PLANET_START, PLANET_FRAMES_EACH, planetCount);
  const planetOpacity = frameIndex >= PLANET_START ? 1 : 0;

  const aspects = staggeredCount(frameIndex, ASPECT_START, ASPECT_FRAMES_EACH, MAX_ASPECTS);

  const cusps = staggeredCount(frameIndex, CUSP_START, CUSP_FRAMES_EACH, 12);
  const cuspOpacity = frameIndex >= CUSP_START ? 1 : 0;

  const rotationDeg =
    frameIndex >= HOLD_START ? ((frameIndex - HOLD_START) / fps) * ROTATION_DEG_PER_SEC : 0;

  return {
    bgFade,
    zodiacSegments: zodiac.full,
    zodiacPartial: zodiac.partial,
    zodiacOpacity,
    planetsVisible: planets.full,
    planetPartial: planets.partial,
    planetOpacity,
    aspectsVisible: aspects.full,
    aspectProgress: aspects.partial,
    cuspsVisible: cusps.full,
    cuspPartial: cusps.partial,
    cuspOpacity,
    rotationDeg,
  };
}

function buildSvg(
  width: number,
  height: number,
  background: string,
  wheelGroup: string,
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    background,
    wheelGroup,
    '</svg>',
  ].join('');
}

export function generateFrame(
  snapshot: EphemerisSnapshot,
  frameIndex: number,
  options?: Partial<FrameGeneratorOptions>,
): FrameResult {
  const opts = resolveOptions(options);
  const totalFrames = getTotalFrames(opts);
  const clampedFrame = Math.max(0, Math.min(totalFrames - 1, frameIndex));

  const chart = normalizeSnapshotForWheel(snapshot);
  if (!chart) {
    throw new Error('generateFrame: snapshot could not be normalized for wheel rendering');
  }

  const asc = resolveAscendantLongitude(chart);
  const positions = positionsFromChart(chart);
  const aspects = strongestAspects(
    snapshot.aspects.map((a) => ({
      bodyA: a.bodyA,
      bodyB: a.bodyB,
      type: a.type,
      orb: a.orb ?? 99,
    })),
    positions,
    MAX_ASPECTS,
  );

  const anim = computeAnimationState(clampedFrame, opts.fps);
  const background = renderBackground(opts.width, opts.height, anim.bgFade);

  const layers: string[] = [];

  if (anim.zodiacOpacity > 0) {
    layers.push(
      renderZodiacRing(asc, anim.zodiacSegments, anim.zodiacOpacity, anim.zodiacPartial),
    );
  }

  if (anim.planetOpacity > 0 && positions.length > 0) {
    layers.push(
      renderPlanets(
        positions,
        asc,
        anim.planetsVisible,
        anim.planetOpacity,
        anim.planetPartial,
      ),
    );
  }

  if (anim.aspectsVisible > 0 || anim.aspectProgress > 0) {
    layers.push(
      renderAspectLines(
        aspects,
        positions,
        asc,
        anim.aspectsVisible,
        anim.aspectProgress,
      ),
    );
  }

  if (anim.cuspOpacity > 0) {
    layers.push(
      renderHouseCusps(chart.cusps, asc, anim.cuspsVisible, anim.cuspOpacity, anim.cuspPartial),
    );
  }

  const wheelGroup =
    layers.length > 0 ? groupAtWheelCenter(layers.join(''), anim.rotationDeg) : '';

  const svg = buildSvg(opts.width, opts.height, background, wheelGroup);

  return {
    svg,
    frameIndex: clampedFrame,
    totalFrames,
  };
}

/** Expose wheel anchor for layout tests. */
export const WHEEL_LAYOUT_ANCHOR = { cx: WHEEL_CX, cy: WHEEL_CY };

/** Re-export for tests that need layout from snapshot. */
export { createWheelLayout };
