/**
 * Validate compose + video integration (Pass 5).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/validate-compose-video.js
 *
 * Uses sandbox + overriddenSnapshot (lat 0, lon 0, UTC) so validation does not require
 * a running chart-snapshot HTTP service. The video hook runs on the same compose path as sky mode.
 */

process.env.ENABLE_VIDEO_EXPORT = '1';
process.env.VIDEO_ENCODE_DURATION_S = '5';

import path from 'path';
import { composeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import type { EphemerisSnapshot } from '../contracts';

type ExportStore = {
  exists?: (key: string, extension?: string) => Promise<boolean>;
};

const CANONICAL_SNAPSHOT: EphemerisSnapshot = {
  ts: '2026-01-01T12:00:00Z',
  tz: 'UTC',
  lat: 0,
  lon: 0,
  houseSystem: 'placidus',
  planets: [
    { name: 'sun', lon: 280 },
    { name: 'moon', lon: 45 },
    { name: 'mercury', lon: 265 },
    { name: 'venus', lon: 310 },
    { name: 'mars', lon: 120 },
    { name: 'jupiter', lon: 75 },
    { name: 'saturn', lon: 345 },
    { name: 'uranus', lon: 55 },
    { name: 'neptune', lon: 358 },
    { name: 'pluto', lon: 302 },
    { name: 'northNode', lon: 150 },
    { name: 'chiron', lon: 22 },
  ],
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  aspects: [
    { bodyA: 'sun', bodyB: 'saturn', type: 'sextile', orb: 2.5 },
    { bodyA: 'moon', bodyB: 'mars', type: 'trine', orb: 3.1 },
    { bodyA: 'venus', bodyB: 'jupiter', type: 'square', orb: 4.0 },
  ],
  moonPhase: 0.25,
  dominantElements: { fire: 0.2, earth: 0.3, air: 0.25, water: 0.25 },
};

function initExportStore(): void {
  if ((process as { __astradio_export_store?: ExportStore }).__astradio_export_store) return;
  const { createExportStore } = require(path.join(process.cwd(), 'lib', 'export-store.js')) as {
    createExportStore: () => ExportStore;
  };
  (process as { __astradio_export_store?: ExportStore }).__astradio_export_store =
    createExportStore();
}

async function main(): Promise<void> {
  initExportStore();

  (composeAPI as unknown as { compositionCache?: { clear?: () => void } }).compositionCache?.clear?.();

  const request: ComposeRequest & { overriddenSnapshot?: EphemerisSnapshot } = {
    mode: 'sandbox',
    controls: {},
    generateAudio: false,
    generateVideo: true,
    videoTier: 'standard',
    overriddenSnapshot: JSON.parse(JSON.stringify(CANONICAL_SNAPSHOT)),
  };

  console.log('[validate-compose-video] calling composeAPI.compose (generateVideo=true)...');
  const started = Date.now();
  const response = (await composeAPI.compose(request)) as {
    text?: { short?: string };
    export_id?: string;
    video_export_id?: string;
    video_export_available?: boolean;
    video?: {
      format?: string;
      size_bytes?: number;
      encode_time_ms?: number;
      export_error?: string;
    };
  };
  const elapsedMs = Date.now() - started;

  const store = (process as { __astradio_export_store?: ExportStore }).__astradio_export_store;
  const hasText = Boolean(response.text?.short);
  const hasAudioExport = Boolean(response.export_id);
  const hasVideoExportId = Boolean(response.video_export_id);
  const videoFormatOk = response.video?.format === 'mp4';
  const storeOk =
    hasVideoExportId && store?.exists
      ? await store.exists(response.video_export_id!, '.mp4')
      : false;

  console.log('[validate-compose-video] elapsed_ms:', elapsedMs);
  console.log('[validate-compose-video] text present:', hasText);
  console.log('[validate-compose-video] audio export_id present:', hasAudioExport);
  console.log('[validate-compose-video] video_export_id:', response.video_export_id ?? '—');
  console.log('[validate-compose-video] video_export_available:', response.video_export_available);
  console.log('[validate-compose-video] video.format:', response.video?.format ?? '—');
  console.log('[validate-compose-video] video.size_bytes:', response.video?.size_bytes ?? '—');
  console.log('[validate-compose-video] video.encode_time_ms:', response.video?.encode_time_ms ?? '—');
  console.log('[validate-compose-video] export store .mp4 exists:', storeOk);

  if (response.video?.export_error) {
    console.error('[validate-compose-video] video.export_error:', response.video.export_error);
  }

  const ok =
    hasText &&
    hasVideoExportId &&
    response.video_export_available === true &&
    videoFormatOk &&
    storeOk &&
    typeof response.video?.size_bytes === 'number' &&
    response.video.size_bytes > 0;

  if (!ok) {
    throw new Error('Compose video validation failed — see log above');
  }

  console.log('[validate-compose-video] OK');
}

main().catch((err) => {
  console.error('[validate-compose-video] FAILED:', err);
  process.exit(1);
});
