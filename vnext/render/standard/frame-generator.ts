import type { EphemerisSnapshot } from '../../contracts';
import { computeAnimationState, MAX_ASPECTS } from '../animation-timing';
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

function resolveOptions(options?: Partial<FrameGeneratorOptions>): Required<FrameGeneratorOptions> {
  return { ...DEFAULT_FRAME_OPTIONS, ...options };
}

export function getTotalFrames(options?: Partial<FrameGeneratorOptions>): number {
  const opts = resolveOptions(options);
  return opts.fps * opts.durationSeconds;
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
