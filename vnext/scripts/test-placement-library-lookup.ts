/**
 * Test that placement keys exist in ASPECT_INSIGHTS
 */

import { getAspectInsight } from '../projection/insight-library/insight-library-index';

const testKeys = [
  'PLCMT_SUN_ARIES',
  'PLCMT_SUN_HOUSE1',
  'PLCMT_MOON_CANCER',
  'PLCMT_MOON_HOUSE4',
  'PLCMT_MERCURY_GEMINI',
  'PLCMT_MERCURY_HOUSE3',
  'PLCMT_VENUS_TAURUS',
  'PLCMT_VENUS_HOUSE2',
  'PLCMT_MARS_ARIES',
  'PLCMT_MARS_HOUSE1',
  'PLCMT_JUPITER_SAGITTARIUS',
  'PLCMT_JUPITER_HOUSE9',
  'PLCMT_SATURN_CAPRICORN',
  'PLCMT_SATURN_HOUSE10',
  'PLCMT_URANUS_AQUARIUS',
  'PLCMT_URANUS_HOUSE11',
  'PLCMT_NEPTUNE_PISCES',
  'PLCMT_NEPTUNE_HOUSE12',
  'PLCMT_PLUTO_SCORPIO',
  'PLCMT_PLUTO_HOUSE8',
];

console.log('Testing placement library lookup...\n');

let missingCount = 0;
let foundCount = 0;

testKeys.forEach((key) => {
  const insight = getAspectInsight(key);
  if (!insight) {
    console.error(`✗ MISSING KEY: ${key}`);
    missingCount++;
  } else {
    console.log(`✓ ${key}: ${insight.core?.substring(0, 60)}...`);
    foundCount++;
  }
});

console.log(`\nResults: ${foundCount} found, ${missingCount} missing`);

if (missingCount > 0) {
  console.error('✗ Some placement keys are missing from library');
  process.exit(1);
} else {
  console.log('✓ All test placement keys exist in library');
}
