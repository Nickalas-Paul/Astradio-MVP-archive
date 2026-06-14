/**
 * Run: npx tsx apps/web/src/lib/sandbox-chart-import.test.ts
 */
import assert from 'node:assert';
import {
  chartApiRecordHasEngineBirthFields,
  applySandboxOverridesToSnapshotLite,
  combinedChartIdOverridesSeed,
} from './sandbox-chart-import';
import type { EphemerisSnapshot } from '../types/sandbox';

assert.strictEqual(
  chartApiRecordHasEngineBirthFields({
    id: 'c1',
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7,
    lon: -74.0,
  }),
  true
);

assert.strictEqual(
  chartApiRecordHasEngineBirthFields({
    id: 'c1',
    date: '1990-01-15',
    label: 'Public',
  }),
  false
);

const baseSnap: EphemerisSnapshot = {
  ts: '1990-01-15T12:00:00Z',
  tz: 'UTC',
  lat: 40,
  lon: -74,
  houseSystem: 'placidus',
  planets: [{ name: 'sun', lon: 295 }],
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  aspects: [],
  moonPhase: 0.5,
  dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
};

const withOverride = applySandboxOverridesToSnapshotLite(baseSnap, {
  planets: { sun: { lonDeg: 10 } },
});
assert.strictEqual(withOverride.planets.find((p) => p.name === 'sun')?.lon, 10);

void combinedChartIdOverridesSeed('chart_abc', { planets: {} }).then((h) => {
  assert.match(h, /^[a-f0-9]{64}$/);
  console.log('OK: sandbox-chart-import tests passed');
});
