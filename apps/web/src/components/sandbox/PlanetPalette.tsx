'use client';

import type { PlanetKey, SandboxOverrides } from '../../types/sandbox';
import { BODY_DISPLAY_ORDER, BODY_LABELS } from '../../../../../vnext/canonical-bodies';

const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];

const PLANET_GLYPH: Record<string, string> = {
  sun: '\u2609',
  moon: '\u263D',
  mercury: '\u263F',
  venus: '\u2640',
  mars: '\u2642',
  jupiter: '\u2643',
  saturn: '\u2644',
  uranus: '\u2645',
  neptune: '\u2646',
  pluto: '\u2647',
  chiron: '\u26B7',
  ceres: '\u26B3',
  pallas: '\u26B4',
  juno: '\u26B5',
  vesta: '\u26B6',
};

const PLANET_LABELS: Record<PlanetKey, string> = { ...BODY_LABELS } as Record<PlanetKey, string>;

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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-subtext mr-1">Place:</span>
      {PLANET_ORDER.map((planet) => {
        const isPlaced = overrides.planets?.[planet] != null;
        const isSelected = selectedPlanet === planet;
        return (
          <button
            key={planet}
            type="button"
            onClick={() => onSelectPlanet(planet)}
            className={`px-2 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-primary text-white border-primary'
                : isPlaced
                ? 'bg-bgElev border-border text-text'
                : 'bg-bgElev/60 border-border text-subtext hover:border-border/80 hover:text-text'
            }`}
            title={isPlaced ? `${PLANET_LABELS[planet]} placed — click to place elsewhere` : `Click wheel to place ${PLANET_LABELS[planet]}`}
          >
            <span className="mr-1" aria-hidden>{PLANET_GLYPH[planet] ?? '•'}</span>
            {PLANET_LABELS[planet]}
          </button>
        );
      })}
    </div>
  );
}
