/**
 * Validate SVG frame generator (Pass 3).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/validate-frame-generator.js
 */

import fs from 'fs';
import path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import { generateFrame } from '../render/standard/frame-generator';

const OUTPUT_DIR = path.join(__dirname, '..', 'test-frames');

/** Founder chart reference: Sun ~55° Taurus, Moon ~53° Taurus, ASC ~141° Leo. */
function founderMockSnapshot(): EphemerisSnapshot {
  const asc = 141;
  const houses: EphemerisSnapshot['houses'] = [
    asc,
    asc + 30,
    asc + 60,
    asc + 90,
    asc + 120,
    asc + 150,
    asc + 180,
    asc + 210,
    asc + 240,
    asc + 270,
    asc + 300,
    asc + 330,
  ].map((d) => ((d % 360) + 360) % 360) as EphemerisSnapshot['houses'];

  return {
    ts: '1990-05-15T14:30:00Z',
    tz: 'America/New_York',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'sun', lon: 55 },
      { name: 'moon', lon: 53 },
      { name: 'mercury', lon: 72 },
      { name: 'venus', lon: 48 },
      { name: 'mars', lon: 118 },
      { name: 'jupiter', lon: 198 },
      { name: 'saturn', lon: 288 },
      { name: 'uranus', lon: 18 },
      { name: 'neptune', lon: 332 },
      { name: 'pluto', lon: 268 },
      { name: 'northNode', lon: 95 },
      { name: 'chiron', lon: 152 },
    ],
    houses,
    aspects: [
      { bodyA: 'sun', bodyB: 'moon', type: 'conjunction', orb: 2.1 },
      { bodyA: 'sun', bodyB: 'mars', type: 'trine', orb: 3.2 },
      { bodyA: 'moon', bodyB: 'saturn', type: 'square', orb: 4.5 },
      { bodyA: 'venus', bodyB: 'jupiter', type: 'opposition', orb: 5.0 },
      { bodyA: 'mars', bodyB: 'chiron', type: 'sextile', orb: 1.8 },
      { bodyA: 'sun', bodyB: 'northNode', type: 'square', orb: 6.2 },
      { bodyA: 'mercury', bodyB: 'neptune', type: 'sextile', orb: 2.9 },
    ],
    moonPhase: 0.12,
    dominantElements: { fire: 0.2, earth: 0.45, air: 0.15, water: 0.2 },
  };
}

const KEY_FRAMES = [0, 60, 150, 270, 400, 600] as const;

function main(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const snapshot = founderMockSnapshot();
  const written: string[] = [];

  for (const frameIndex of KEY_FRAMES) {
    const result = generateFrame(snapshot, frameIndex);
    const filename = `frame_${String(frameIndex).padStart(4, '0')}.svg`;
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, result.svg, 'utf8');
    written.push(filePath);

    const wMatch = result.svg.match(/width="(\d+)"/);
    const hMatch = result.svg.match(/height="(\d+)"/);
    const w = wMatch?.[1] ?? '?';
    const h = hMatch?.[1] ?? '?';

    console.log(
      `[validate-frame-generator] frame ${frameIndex}/${result.totalFrames - 1} → ${filePath} (${w}×${h})`,
    );
  }

  console.log(`[validate-frame-generator] wrote ${written.length} SVG files to ${OUTPUT_DIR}`);
  console.log('[validate-frame-generator] OK');
}

try {
  main();
} catch (err) {
  console.error('[validate-frame-generator] FAILED:', err);
  process.exit(1);
}
