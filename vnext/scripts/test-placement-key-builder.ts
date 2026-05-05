/**
 * Test placement key builder validation
 */

import { buildPlacementKeys } from '../projection/placement-keys';
import type { EphemerisSnapshot } from '../contracts';

const testSnapshot: EphemerisSnapshot = {
  ts: new Date().toISOString(),
  tz: 'America/Chicago',
  lat: 41.8781,
  lon: -87.6298,
  houseSystem: 'P',
  planets: [
    { name: 'Sun', lon: 15.0 },
    { name: 'Moon', lon: 125.5 },
    { name: 'Mercury', lon: 350.2 },
  ],
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  aspects: [],
  moonPhase: 0.25,
  dominantElements: { fire: 0, earth: 0, air: 0, water: 0 },
};

console.log('Testing placement key builder...\n');

const keys = buildPlacementKeys(testSnapshot);

console.log('Generated placement keys:');
keys.forEach((k) => {
  console.log(`${k.planet}:`);
  console.log(`  Sign: ${k.sign} (${k.degInSign.toFixed(1)}°)`);
  console.log(`  House: ${k.house}`);
  console.log(`  Sign Key: ${k.signKey}`);
  console.log(`  House Key: ${k.houseKey}`);
  console.log('');
});

const expectedKeys = [
  'PLCMT_SUN_ARIES',
  'PLCMT_SUN_HOUSE1',
  'PLCMT_MOON_LEO',
  'PLCMT_MOON_HOUSE5',
  'PLCMT_MERCURY_PISCES',
  'PLCMT_MERCURY_HOUSE12',
];

const actualKeys = keys.flatMap((k) => [k.signKey, k.houseKey]);
const missing = expectedKeys.filter((ek) => !actualKeys.includes(ek));
const extra = actualKeys.filter((ak) => !expectedKeys.includes(ak));

if (missing.length === 0 && extra.length === 0) {
  console.log('✓ All expected keys generated correctly');
} else {
  console.error('✗ Key mismatch:');
  if (missing.length > 0) console.error('  Missing:', missing);
  if (extra.length > 0) console.error('  Extra:', extra);
  process.exit(1);
}
