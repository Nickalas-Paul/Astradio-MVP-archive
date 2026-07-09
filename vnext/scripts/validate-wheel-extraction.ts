/**
 * Validate shared wheel extraction modules (Pass 1).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/validate-wheel-extraction.js
 */

import type { EphemerisSnapshot } from '../contracts';
import { normalizeSnapshotForWheel } from '../render/chart-for-wheel';
import { pol } from '../render/wheel-geometry';
import { PLANET_COLORS } from '../render/planet-identity';
import { BRAND } from '../render/design-tokens';

function main(): void {
  const mockSnapshot: EphemerisSnapshot = {
    ts: '2026-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 0,
    lon: 0,
    houseSystem: 'placidus',
    planets: [{ name: 'sun', lon: 90 }],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };

  const chart = normalizeSnapshotForWheel(mockSnapshot);
  if (!chart) {
    throw new Error('normalizeSnapshotForWheel returned null');
  }

  const pt = pol(100, 90, 0);
  const sunColor = PLANET_COLORS.sun;

  console.log('[validate-wheel-extraction] pol(100, 90, 0) =', pt);
  console.log('[validate-wheel-extraction] chart.positions.sun =', chart.positions.sun);
  console.log('[validate-wheel-extraction] chart.cusps[0] (ASC) =', chart.cusps[0]);
  console.log('[validate-wheel-extraction] southNode derived =', chart.positions.southNode);
  console.log('[validate-wheel-extraction] PLANET_COLORS.sun =', sunColor);
  console.log('[validate-wheel-extraction] BRAND.colors.accent =', BRAND.colors.accent);

  if (Math.abs(pt.x - 0) > 0.001 || Math.abs(pt.y - 100) > 0.001) {
    throw new Error(`Unexpected pol result: x=${pt.x} y=${pt.y}, expected ~{x:0,y:100}`);
  }
  if (chart.positions.sun !== 90) {
    throw new Error(`Expected sun at 90°, got ${chart.positions.sun}`);
  }
  if (chart.cusps[0] !== 0) {
    throw new Error(`Expected ASC at 0°, got ${chart.cusps[0]}`);
  }

  console.log('[validate-wheel-extraction] OK');
}

main();
