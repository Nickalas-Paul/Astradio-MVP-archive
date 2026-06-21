'use client';

import type { PlanetKey, SandboxOverrides } from '../../types/sandbox';
import { PLANET_COLORS } from '../../core/planet-identity';
import { BODY_DISPLAY_ORDER, BODY_LABELS } from '../../../../../vnext/canonical-bodies';
import { PLANET_GLYPH } from '../wheel/wheel-constants';
import { getPlanetGlyphSvg } from '../wheel/wheel-glyphs';

const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];

const PLANET_LABELS: Record<PlanetKey, string> = { ...BODY_LABELS } as Record<PlanetKey, string>;

const CHIP_GLYPH_SIZE = 14;

function PlanetChipGlyph({ planet }: { planet: PlanetKey }) {
  const glyph = getPlanetGlyphSvg(planet);
  const fill = PLANET_COLORS[planet] ?? '#e8ecf1';

  if (glyph) {
    return (
      <svg
        className="inline-block align-middle mr-1"
        width={CHIP_GLYPH_SIZE}
        height={CHIP_GLYPH_SIZE}
        viewBox={glyph.viewBox}
        overflow="visible"
        aria-hidden
      >
        <path d={glyph.pathData} fill={fill} />
      </svg>
    );
  }

  return (
    <span className="mr-1" aria-hidden>
      {PLANET_GLYPH[planet] ?? '•'}
    </span>
  );
}

export interface PlanetPaletteProps {
  overrides: SandboxOverrides;
  selectedPlanet: PlanetKey | null;
  onSelectPlanet: (planet: PlanetKey) => void;
}

/**
 * Wheel-adjacent planet selector for free-build. User picks a planet here, then clicks the wheel to place it.
 * Makes the wheel the primary placement surface; this is the "which planet" control only.
 */
export function PlanetPalette({ overrides, selectedPlanet, onSelectPlanet }: PlanetPaletteProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
      <span className="text-sm text-text-secondary mr-1">Place:</span>
      {PLANET_ORDER.map((planet) => {
        const isPlaced = overrides.planets?.[planet] != null;
        const isSelected = selectedPlanet === planet;
        return (
          <button
            key={planet}
            type="button"
            onClick={() => onSelectPlanet(planet)}
            className={`px-2 py-2 min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-primary text-white border-primary'
                : isPlaced
                ? 'bg-bgElev border-border text-text-primary'
                : 'bg-bgElev/60 border-border text-text-secondary hover:border-border/80 hover:text-text-primary'
            }`}
            title={isPlaced ? `${PLANET_LABELS[planet]} placed. Click to place elsewhere` : `Click wheel to place ${PLANET_LABELS[planet]}`}
          >
            <PlanetChipGlyph planet={planet} />
            {PLANET_LABELS[planet]}
          </button>
        );
      })}
    </div>
  );
}
