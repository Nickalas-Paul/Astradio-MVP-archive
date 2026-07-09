/**
 * Standalone video encode job. Runs as a Render one-off job,
 * isolated from the main server process.
 *
 * Usage: node dist/vnext/vnext/scripts/encode-video-job.js <videoExportKey> <snapshotB64>
 */

import path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import { DEFAULT_DURATION_S } from '../constants';
import { encodeVideo } from '../render/video-encoder';
import { exportFormatOptions } from '../render/export-formats';
import { generateSilentWav } from '../render/silent-wav';
import { createHash } from 'crypto';

type ExportStore = {
  put?: (
    key: string,
    buffer: Buffer,
    meta: Record<string, unknown>,
    options?: { extension?: string; contentType?: string },
  ) => Promise<void>;
};

function loadEnv(): void {
  try {
    require('dotenv').config();
  } catch {
    /* optional in production */
  }
  try {
    require(path.join(process.cwd(), 'lib', 'gcp-credentials')).loadGcpCredentials();
  } catch {
    /* optional */
  }
}

function initExportStore(): ExportStore {
  const { createExportStore } = require(path.join(process.cwd(), 'lib', 'export-store.js')) as {
    createExportStore: () => ExportStore;
  };
  const store = createExportStore();
  (process as { __astradio_export_store?: ExportStore }).__astradio_export_store = store;
  return store;
}

function parseSnapshot(snapshotB64: string): EphemerisSnapshot {
  const json = Buffer.from(snapshotB64, 'base64').toString('utf8');
  const snapshot = JSON.parse(json) as EphemerisSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.planets)) {
    throw new Error('Invalid snapshot JSON');
  }
  return snapshot;
}

async function main(): Promise<void> {
  loadEnv();

  const videoExportKey = process.argv[2]?.trim();
  const snapshotB64 = process.argv[3]?.trim();

  if (!videoExportKey || !/^[a-f0-9]{64}$/.test(videoExportKey)) {
    throw new Error('Usage: encode-video-job.js <64-hex-videoExportKey> <snapshotBase64>');
  }
  if (!snapshotB64) {
    throw new Error('Missing snapshotBase64 argument');
  }

  const snapshot = parseSnapshot(snapshotB64);
  const exportStore = initExportStore();
  const videoFormat = exportFormatOptions('video');

  const durationSeconds =
    Number(process.env.VIDEO_ENCODE_DURATION_S) > 0
      ? Number(process.env.VIDEO_ENCODE_DURATION_S)
      : DEFAULT_DURATION_S;

  const started = Date.now();
  console.log(`[ENCODE_VIDEO_JOB] Starting: ${videoExportKey}`);

  const wavBuffer = generateSilentWav(durationSeconds);
  const videoResult = await encodeVideo(snapshot, wavBuffer, { durationSeconds });

  const sha256 = createHash('sha256').update(videoResult.mp4Buffer).digest('hex');
  const integrity = {
    sha256,
    size_bytes: videoResult.fileSizeBytes,
    createdAt: new Date().toISOString(),
    media_type: 'video',
    duration_s: videoResult.durationSeconds,
  };

  if (!exportStore.put) {
    throw new Error('Export store unavailable');
  }

  await exportStore.put(videoExportKey, videoResult.mp4Buffer, integrity, videoFormat);

  const elapsedMs = Date.now() - started;
  console.log(
    `[ENCODE_VIDEO_JOB] OK: ${videoExportKey} (${(videoResult.fileSizeBytes / 1024 / 1024).toFixed(1)} MB) in ${elapsedMs}ms`,
  );
}

main().catch((err) => {
  console.error('[ENCODE_VIDEO_JOB] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
