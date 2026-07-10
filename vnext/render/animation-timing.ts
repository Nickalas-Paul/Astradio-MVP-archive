export const ZODIAC_START = 30;
export const ZODIAC_FRAMES_PER_SEGMENT = 5;
export const PLANET_START = 90;
export const PLANET_FRAMES_EACH = 8;
export const ASPECT_START = 210;
export const ASPECT_FRAMES_EACH = 6;
export const CUSP_START = 330;
export const CUSP_FRAMES_EACH = 10;
export const HOLD_START = 450;
export const ROTATION_DEG_PER_SEC = 0.5;
export const MAX_ASPECTS = 10;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
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

export interface AnimationState {
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

export function computeAnimationState(frameIndex: number, fps: number): AnimationState {
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
