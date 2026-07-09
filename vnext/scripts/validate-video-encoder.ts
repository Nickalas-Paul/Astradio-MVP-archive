/**
 * Validate video encoder (Pass 4).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/validate-video-encoder.js
 */

import fs from 'fs';
import path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import { encodeVideo } from '../render/video-encoder';

const OUTPUT_DIR = path.join(__dirname, '..', 'test-output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'test-video.mp4');
const TEST_DURATION_SECONDS = 5;

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

/** 16-bit PCM silent WAV at 44100 Hz stereo. */
function createSilentWav(durationSeconds: number): Buffer {
  const sampleRate = 44100;
  const channels = 2;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function hasMp4FtypMagic(buffer: Buffer): boolean {
  const header = buffer.subarray(0, 12).toString('ascii');
  const ftypIndex = header.indexOf('ftyp');
  return ftypIndex >= 0 && ftypIndex < 8;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const snapshot = founderMockSnapshot();
  const wavBuffer = createSilentWav(TEST_DURATION_SECONDS);

  const started = Date.now();
  const result = await encodeVideo(snapshot, wavBuffer, {
    durationSeconds: TEST_DURATION_SECONDS,
  });
  const totalMs = Date.now() - started;

  await fs.promises.writeFile(OUTPUT_FILE, result.mp4Buffer);

  const magicOk = hasMp4FtypMagic(result.mp4Buffer);

  console.log(`[validate-video-encoder] wrote ${OUTPUT_FILE}`);
  console.log(`[validate-video-encoder] duration: ${result.durationSeconds}s`);
  console.log(`[validate-video-encoder] total frames: ${result.totalFrames}`);
  console.log(
    `[validate-video-encoder] file size: ${(result.fileSizeBytes / 1024).toFixed(1)} KB`,
  );
  console.log(`[validate-video-encoder] total encode time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`[validate-video-encoder] MP4 ftyp magic: ${magicOk ? 'PASS' : 'FAIL'}`);

  if (!magicOk) {
    throw new Error('MP4 magic bytes check failed');
  }

  console.log('[validate-video-encoder] OK');
}

main().catch((err) => {
  console.error('[validate-video-encoder] FAILED:', err);
  process.exit(1);
});
