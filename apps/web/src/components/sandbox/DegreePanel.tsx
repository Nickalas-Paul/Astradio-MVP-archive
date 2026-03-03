'use client';

import { useState } from 'react';
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

function lonToSignDeg(lonDeg: number): { sign: string; deg: number; min: number } {
  const signIdx = Math.floor(lonDeg / 30);
  const degInSign = lonDeg % 30;
  const deg = Math.floor(degInSign);
  const min = Math.round((degInSign - deg) * 60);
  return {
    sign: SIGN_NAMES[signIdx % 12],
    deg,
    min,
  };
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

export function DegreePanel({ overrides, basePositions, cusps, onOverrideChange, onResetPlanet }: DegreePanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text mb-3">Planet Degrees</h3>
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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="360"
                  step="0.1"
                  value={currentLon.toFixed(1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val) && val >= 0 && val < 360) {
                      onOverrideChange(planet, roundDegree(val));
                    }
                  }}
                  className="w-20 px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                />
                <span className="text-xs text-subtext">°</span>
                <span className="text-xs text-subtext flex-1">
                  {sign} {deg}° {min}′
                  {houseNum != null && <span className="ml-1 text-subtext/80"> · House {houseNum}</span>}
                </span>
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
