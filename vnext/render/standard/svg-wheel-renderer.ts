import { deriveSouthNodeLongitude, resolveAscendantLongitude, type ChartForWheel } from '../chart-for-wheel';
import { BRAND } from '../design-tokens';
import { normalizePlanetName, PLANET_COLORS } from '../planet-identity';
import {
  ASPECT_LINE_COLOR,
  computeWheelRadii,
  WHEEL_COLORS,
  type WheelRadii,
} from '../wheel-constants';
import { getPlanetGlyphSvg, getSignGlyphSvg, type GlyphData } from '../wheel-glyphs';
import {
  arcPath,
  aspectLineStyle,
  clusterPlanetRadii,
  pol,
  zodiacSegmentPath,
} from '../wheel-geometry';

export const WHEEL_CX = 540;
export const WHEEL_CY = 700;
export const WHEEL_SIZE = 900;

export const PLANET_ANIMATION_ORDER = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northNode',
  'chiron',
  'southNode',
] as const;

const ANGLE_GLYPH_BY_HOUSE_INDEX: Record<number, 'ascendant' | 'midheaven'> = {
  0: 'ascendant',
  9: 'midheaven',
};

const ANGLE_GLYPH_COLOR: Record<'ascendant' | 'midheaven', string> = {
  ascendant: PLANET_COLORS.ascendant ?? WHEEL_COLORS.angleLabelFill,
  midheaven: PLANET_COLORS.mc ?? WHEEL_COLORS.angleLabelFill,
};

const PLANET_GLYPH_SIZE = 22;
const SOUTH_NODE_GLYPH_SIZE = 18;
const ZODIAC_GLYPH_SIZE = 28;
const ANGLE_GLYPH_SIZE = 32;

export interface WheelLayout {
  cx: number;
  cy: number;
  wheelSize: number;
  radii: WheelRadii;
  asc: number;
}

export interface PlanetPosition {
  name: string;
  lon: number;
}

export interface AspectInput {
  bodyA: string;
  bodyB: string;
  type: string;
  orb: number;
}

export function createWheelLayout(chart: ChartForWheel, ascOverride?: number): WheelLayout {
  const asc = resolveAscendantLongitude(chart, ascOverride);
  return {
    cx: WHEEL_CX,
    cy: WHEEL_CY,
    wheelSize: WHEEL_SIZE,
    radii: computeWheelRadii(WHEEL_SIZE, true),
    asc,
  };
}

export function lonForBody(positions: Record<string, number>, name: string): number | null {
  const key = normalizePlanetName(name);
  if (key === 'southNode') {
    const nn = positions.northNode ?? positions.northnode;
    if (typeof nn === 'number' && Number.isFinite(nn)) return deriveSouthNodeLongitude(nn);
    const direct = positions.southNode ?? positions.southnode;
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
    return null;
  }
  const v = positions[key] ?? positions[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function positionsFromChart(chart: ChartForWheel): PlanetPosition[] {
  const out: PlanetPosition[] = [];
  for (const name of PLANET_ANIMATION_ORDER) {
    const lon = lonForBody(chart.positions, name);
    if (lon != null) out.push({ name, lon });
  }
  return out;
}

function glyphSvg(
  glyph: GlyphData,
  x: number,
  y: number,
  size: number,
  fill: string,
  opts?: { haloWidth?: number; opacity?: number; signGlyph?: boolean },
): string {
  const hw = opts?.haloWidth ?? 2.5;
  const op = opts?.opacity ?? 1;
  const sign = opts?.signGlyph ?? false;
  const pathAttrs = sign
    ? `d="${glyph.pathData}" fill="${fill}"`
    : `d="${glyph.pathData}" fill="${fill}" stroke="${WHEEL_COLORS.glyphHaloStroke}" stroke-width="${hw}" stroke-linejoin="round" paint-order="stroke fill"`;
  return `<g opacity="${op}"><svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="${glyph.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible"><path ${pathAttrs}/></svg></g>`;
}

function wheelRadii(): WheelRadii {
  return computeWheelRadii(WHEEL_SIZE, true);
}

/** Wrap wheel-layer SVG (origin at wheel center) with translate + optional rotation. */
export function groupAtWheelCenter(inner: string, rotationDeg = 0): string {
  const rot = rotationDeg !== 0 ? ` rotate(${rotationDeg})` : '';
  return `<g transform="translate(${WHEEL_CX}, ${WHEEL_CY})${rot}">${inner}</g>`;
}

/** Returns the 12 zodiac segments as SVG paths (segments 0..segmentsVisible-1 at full opacity; optional partial on current). */
export function renderZodiacRing(
  asc: number,
  segmentsVisible: number,
  opacity: number,
  partialSegmentOpacity = 1,
): string {
  const radii = wheelRadii();
  const parts: string[] = [];

  for (let signIndex = 0; signIndex < 12; signIndex++) {
    const segOpacity =
      signIndex < segmentsVisible
        ? opacity
        : signIndex === segmentsVisible && segmentsVisible < 12
          ? opacity * partialSegmentOpacity
          : 0;
    if (segOpacity <= 0) continue;

    const d = zodiacSegmentPath(radii.rZodiac, radii.rOut, signIndex, asc);
    const fill = signIndex % 2 === 0 ? WHEEL_COLORS.zodiacFillA : WHEEL_COLORS.zodiacFillB;
    parts.push(`<path d="${d}" fill="${fill}" stroke="none" opacity="${segOpacity}"/>`);

    const midLon = signIndex * 30 + 15;
    const pt = pol((radii.rZodiac + radii.rOut) / 2, midLon, asc);
    const signGlyph = getSignGlyphSvg(signIndex);
    if (signGlyph) {
      parts.push(
        glyphSvg(signGlyph, pt.x, pt.y, ZODIAC_GLYPH_SIZE, WHEEL_COLORS.zodiacGlyphFill, {
          signGlyph: true,
          opacity: segOpacity,
          haloWidth: 1.5,
        }),
      );
    }
  }

  if (segmentsVisible > 0 || partialSegmentOpacity > 0) {
    parts.push(
      `<circle r="${radii.rOut}" fill="none" stroke="${WHEEL_COLORS.outerRingStroke}" stroke-width="1" opacity="${opacity}"/>`,
    );
    parts.push(
      `<circle r="${radii.rZodiac}" fill="none" stroke="${WHEEL_COLORS.outerRingStroke}" stroke-width="1.5" opacity="${opacity}"/>`,
    );
  }

  return parts.join('');
}

export function renderPlanets(
  positions: PlanetPosition[],
  asc: number,
  planetsVisible: number,
  opacity: number,
  partialPlanetOpacity = 1,
): string {
  const radii = wheelRadii();

  const clusterInput = positions.map((p) => ({ key: p.name, lon: p.lon }));
  const planetRadii = clusterPlanetRadii(
    clusterInput,
    radii.rPlanet,
    WHEEL_SIZE,
    radii.clusterMin,
    radii.clusterMax,
  );

  const parts: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const { name, lon } = positions[i]!;
    const op =
      i < planetsVisible
        ? opacity
        : i === planetsVisible && planetsVisible < positions.length
          ? opacity * partialPlanetOpacity
          : 0;
    if (op <= 0) continue;

    const radius = planetRadii.get(name) ?? radii.rPlanet;
    const p = pol(radius, lon, asc);
    const canonical = normalizePlanetName(name);
    const fill = PLANET_COLORS[canonical] ?? WHEEL_COLORS.planetGlyphFill;
    const glyph = getPlanetGlyphSvg(name);
    const size = canonical === 'southNode' ? SOUTH_NODE_GLYPH_SIZE : PLANET_GLYPH_SIZE;

    if (glyph) {
      parts.push(glyphSvg(glyph, p.x, p.y, size, fill, { opacity: op }));
    }
  }

  return parts.join('');
}

export function renderAspectLines(
  aspects: AspectInput[],
  positions: PlanetPosition[],
  asc: number,
  aspectsVisible: number,
  lineProgress: number,
): string {
  const radii = wheelRadii();
  const posMap: Record<string, number> = {};
  for (const p of positions) posMap[normalizePlanetName(p.name)] = p.lon;

  const sorted = [...aspects]
    .filter((a) => {
      const aLon = lonForBody(posMap, a.bodyA);
      const bLon = lonForBody(posMap, a.bodyB);
      return aLon != null && bLon != null;
    })
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 10);

  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const asp = sorted[i]!;
    const lonA = lonForBody(posMap, asp.bodyA)!;
    const lonB = lonForBody(posMap, asp.bodyB)!;
    const p1 = pol(radii.rPlanet, lonA, asc);
    const p2 = pol(radii.rPlanet, lonB, asc);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    let t = 1;
    if (i < aspectsVisible) {
      t = 1;
    } else if (i === aspectsVisible) {
      t = Math.max(0, Math.min(1, lineProgress));
    } else {
      continue;
    }

    const x1 = mx + (p1.x - mx) * t;
    const y1 = my + (p1.y - my) * t;
    const x2 = mx + (p2.x - mx) * t;
    const y2 = my + (p2.y - my) * t;

    const typeKey = asp.type.toLowerCase();
    const color = ASPECT_LINE_COLOR[typeKey] ?? '#6a7a8a';
    const style = aspectLineStyle(asp.orb);
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${style.strokeWidth}" stroke-opacity="${style.strokeOpacity}"/>`,
    );
  }

  return parts.join('');
}

export function renderHouseCusps(
  cusps: number[],
  asc: number,
  cuspsVisible: number,
  opacity: number,
  partialCuspOpacity = 1,
): string {
  const radii = wheelRadii();
  const parts: string[] = [];

  for (let i = 0; i < 12; i++) {
    const op =
      i < cuspsVisible
        ? opacity
        : i === cuspsVisible && cuspsVisible < 12
          ? opacity * partialCuspOpacity
          : 0;
    if (op <= 0) continue;

    const a0 = cusps[i] ?? 0;
    const a1 = cusps[(i + 1) % 12] ?? 0;
    const sectorPath = arcPath(radii.rOut, radii.rIn, a0, a1, asc);
    parts.push(
      `<path d="${sectorPath}" fill="${WHEEL_COLORS.houseFill}" stroke="${WHEEL_COLORS.houseStroke}" stroke-width="0.5" opacity="${op * 0.85}"/>`,
    );

    const cuspPt = pol(radii.rZodiac, a0, asc);
    const innerPt = pol(radii.rIn, a0, asc);
    parts.push(
      `<line x1="${innerPt.x}" y1="${innerPt.y}" x2="${cuspPt.x}" y2="${cuspPt.y}" stroke="${BRAND.colors.textMuted}" stroke-width="1" opacity="${op}"/>`,
    );

    const span = a1 > a0 ? a1 - a0 : a1 + 360 - a0;
    const midLon = (a0 + span / 2) % 360;
    const midPt = pol((radii.rOut + radii.rIn) / 2, midLon, asc);
    parts.push(
      `<text x="${midPt.x}" y="${midPt.y + 4}" text-anchor="middle" fill="${WHEEL_COLORS.houseNumberFill}" font-size="14" opacity="${op}">${i + 1}</text>`,
    );

    const angleKey = ANGLE_GLYPH_BY_HOUSE_INDEX[i];
    if (angleKey != null) {
      const angleGlyph = getPlanetGlyphSvg(angleKey);
      if (angleGlyph) {
        const anglePt = pol(radii.rOut - 12, a0, asc);
        parts.push(
          glyphSvg(angleGlyph, anglePt.x, anglePt.y, ANGLE_GLYPH_SIZE, ANGLE_GLYPH_COLOR[angleKey], {
            haloWidth: 1.5,
            opacity: op,
          }),
        );
      }
    }
  }

  return parts.join('');
}

export function renderBackground(width: number, height: number, fadeProgress: number): string {
  const t = Math.max(0, Math.min(1, fadeProgress));
  const bg = BRAND.colors.background;
  return `<defs>
    <radialGradient id="bgFade" cx="50%" cy="36%" r="75%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${1 - t * 0.85}"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#000000"/>
  <rect width="${width}" height="${height}" fill="url(#bgFade)" opacity="${t}"/>`;
}

export function strongestAspects(
  aspects: AspectInput[],
  positions: PlanetPosition[],
  limit = 10,
): AspectInput[] {
  const posMap: Record<string, number> = {};
  for (const p of positions) posMap[normalizePlanetName(p.name)] = p.lon;
  return [...aspects]
    .filter((a) => lonForBody(posMap, a.bodyA) != null && lonForBody(posMap, a.bodyB) != null)
    .sort((a, b) => a.orb - b.orb)
    .slice(0, limit);
}
