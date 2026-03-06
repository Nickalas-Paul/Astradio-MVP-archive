'use client';

import type { SandboxOverrides, PlanetKey } from '../../types/sandbox';

const PLANET_ORDER: PlanetKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

const PLANET_LABELS: Record<PlanetKey, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

/** Internal storage is 0–360° (canonical longitude). User-facing is sign + 0–29° (and minutes). */
function lonToSignDeg(lonDeg: number): { signIdx: number; sign: string; deg: number; min: number } {
  const n = ((lonDeg % 360) + 360) % 360;
  const signIdx = Math.floor(n / 30) % 12;
  const degInSign = n % 30;
  const deg = Math.floor(degInSign);
  const min = Math.round((degInSign - deg) * 60);
  return {
    signIdx,
    sign: SIGN_NAMES[signIdx],
    deg,
    min,
  };
}

/** Convert astrology-native (sign + degree within sign + minutes) to canonical 0–360 longitude. */
function signDegToLon(signIdx: number, deg: number, min: number): number {
  const d = Math.max(0, Math.min(29, deg)) + Math.max(0, Math.min(59, min)) / 60;
  return (signIdx % 12) * 30 + d;
}

function houseIndexForLongitude(lonDeg: number, cusps: number[]): number {
  if (cusps.length < 12) return 0;
  const lon = ((lonDeg % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const inRange = end > start ? (lon >= start && lon < end) : (lon >= start || lon < end);
    if (inRange) return i;
  }
  return 0;
}

export interface DegreePanelProps {
  overrides: SandboxOverrides;
  basePositions?: Record<string, number>;
  /** Cusps (12 numbers) for house number display */
  cusps?: number[];
  onOverrideChange: (planet: PlanetKey, lonDeg: number | null) => void;
  onResetPlanet?: (planet: PlanetKey) => void;
}

/**
 * Canonical degree rounding: 0.1° precision for determinism
 */
function roundDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

/**
 * Planet degree editor. Internal state: canonical longitude 0–360°.
 * User-facing: sign + 0–29° within sign + minutes. Conversion at boundary only.
 */
export function DegreePanel({ overrides, basePositions, cusps, onOverrideChange, onResetPlanet }: DegreePanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text mb-3">Planet Degrees</h3>
      <p className="text-xs text-subtext mb-2">Sign, degree in sign (0–29°), and minutes. Values stored as longitude 0–360°.</p>
      {PLANET_ORDER.map((planet) => {
        const override = overrides.planets[planet];
        const baseLon = basePositions?.[planet];
        const currentLon = override?.lonDeg ?? baseLon ?? 0;
        const { sign, deg, min } = lonToSignDeg(currentLon);
        const hasOverride = override !== undefined;
        const houseNum = cusps && cusps.length === 12 ? houseIndexForLongitude(currentLon, cusps) + 1 : null;

        return (
          <div key={planet} className="flex items-center gap-3 p-2 bg-bgElev rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text w-20">{PLANET_LABELS[planet]}</span>
                {hasOverride && (
                  <span className="text-xs text-yellow-400">(overridden)</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`${PLANET_LABELS[planet]} sign`}
                  value={lonToSignDeg(currentLon).signIdx}
                  onChange={(e) => {
                    const signIdx = parseInt(e.target.value, 10);
                    if (!Number.isFinite(signIdx) || signIdx < 0 || signIdx > 11) return;
                    const { deg, min } = lonToSignDeg(currentLon);
                    onOverrideChange(planet, roundDegree(signDegToLon(signIdx, deg, min)));
                  }}
                  className="px-2 py-1 bg-bg border border-border rounded text-text text-sm min-w-[7rem]"
                >
                  {SIGN_NAMES.map((name, i) => (
                    <option key={name} value={i}>{name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={29}
                  step={1}
                  aria-label={`${PLANET_LABELS[planet]} degree in sign`}
                  value={lonToSignDeg(currentLon).deg}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isFinite(val) || val < 0 || val > 29) return;
                    const { signIdx, min } = lonToSignDeg(currentLon);
                    onOverrideChange(planet, roundDegree(signDegToLon(signIdx, val, min)));
                  }}
                  className="w-12 px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                />
                <span className="text-xs text-subtext">°</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  aria-label={`${PLANET_LABELS[planet]} minutes`}
                  value={lonToSignDeg(currentLon).min}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isFinite(val) || val < 0 || val > 59) return;
                    const { signIdx, deg } = lonToSignDeg(currentLon);
                    onOverrideChange(planet, roundDegree(signDegToLon(signIdx, deg, val)));
                  }}
                  className="w-12 px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                />
                <span className="text-xs text-subtext">′</span>
                {houseNum != null && (
                  <span className="text-xs text-subtext/80">· House {houseNum}</span>
                )}
              </div>
            </div>
            {hasOverride && (
              <button
                onClick={() => {
                  if (onResetPlanet) {
                    onResetPlanet(planet);
                  } else {
                    onOverrideChange(planet, null);
                  }
                }}
                className="px-2 py-1 text-xs text-subtext hover:text-text border border-border rounded"
                title="Reset to base position"
              >
                Reset
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
