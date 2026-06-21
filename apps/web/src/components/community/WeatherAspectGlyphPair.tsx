'use client';

import { PLANET_COLORS } from '@/core/planet-identity';
import { getPlanetGlyphSvg } from '@/components/wheel/wheel-glyphs';
import { parseWeatherAspectPlanets, planetDisplayNameToKey } from '@/lib/weather-aspect-glyphs';

function InlinePlanetGlyph({
  planetKey,
  size = 17,
}: {
  planetKey: string;
  size?: number;
}) {
  const glyph = getPlanetGlyphSvg(planetKey);
  if (!glyph) return null;
  const fill = PLANET_COLORS[planetKey] ?? '#94A3B8';

  return (
    <svg width={size} height={size} viewBox={glyph.viewBox} className="inline-block shrink-0" aria-hidden>
      <path d={glyph.pathData} fill={fill} />
    </svg>
  );
}

export function WeatherAspectGlyphPair({ prefix }: { prefix: string }) {
  const parsed = parseWeatherAspectPlanets(prefix);
  if (!parsed) return null;

  const transitKey = planetDisplayNameToKey(parsed.transit);
  const natalKey = planetDisplayNameToKey(parsed.natal);
  const transitGlyph = getPlanetGlyphSvg(transitKey);
  const natalGlyph = getPlanetGlyphSvg(natalKey);
  if (!transitGlyph || !natalGlyph) return null;

  return (
    <span className="inline-flex items-center gap-1 align-middle" aria-hidden>
      <InlinePlanetGlyph planetKey={transitKey} />
      <span className="text-[10px] text-text-muted leading-none">→</span>
      <InlinePlanetGlyph planetKey={natalKey} />
    </span>
  );
}
