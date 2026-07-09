import { createHash } from 'crypto';
import path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import type { ComposeRequest } from '../explainer/contracts';
import { DEFAULT_DURATION_S } from '../constants';
import { encodeVideo } from '../render/video-encoder';
import { exportFormatOptions } from '../render/export-formats';
import { generateSilentWav } from '../render/silent-wav';
import { computeVideoExportKey } from '../render/video-export-key';
import type { LyriaExportBundle } from './run-lyria-export-block';

export type ComposeVideoMeta = {
  format: 'mp4';
  export_id?: string;
  export_error?: string;
  duration_s?: number;
  size_bytes?: number;
  encode_time_ms?: number;
};

export type ComposeVideoBlockResult = {
  video_export_id?: string;
  video_export_available?: boolean;
  video?: ComposeVideoMeta;
};

type ExportStore = {
  get?: (key: string, extension?: string) => Promise<Buffer | null>;
  put?: (
    key: string,
    buffer: Buffer,
    meta: Record<string, unknown>,
    options?: { extension?: string; contentType?: string },
  ) => Promise<void>;
  exists?: (key: string, extension?: string) => Promise<boolean>;
  storageKey?: (key: string, extension?: string) => string;
};

function getExportStore(): ExportStore | undefined {
  return (process as { __astradio_export_store?: ExportStore }).__astradio_export_store;
}

async function resolveWavForVideo(wavBundle: LyriaExportBundle): Promise<Buffer> {
  const b64 = wavBundle.audio?.base64;
  if (typeof b64 === 'string' && b64.length > 0) {
    const decoded = Buffer.from(b64, 'base64');
    if (decoded.length > 44) return decoded;
  }

  const exportId = wavBundle.export_id;
  const store = getExportStore();
  if (exportId && store?.get) {
    const fromStore = await store.get(exportId, '.wav');
    if (fromStore && fromStore.length > 0) return fromStore;
  }

  const durationSeconds =
    Number(process.env.VIDEO_ENCODE_DURATION_S) > 0
      ? Number(process.env.VIDEO_ENCODE_DURATION_S)
      : DEFAULT_DURATION_S;
  return generateSilentWav(durationSeconds);
}

async function tryCreateExportJob(input: Record<string, unknown>): Promise<void> {
  if (!process.env.POSTGRES_URL) return;
  try {
    const pgStore = require(path.join(process.cwd(), 'lib', 'pg-store.js')) as {
      createExportJob?: (job: Record<string, unknown>) => Promise<unknown>;
    };
    if (pgStore?.createExportJob) {
      await pgStore.createExportJob(input);
    }
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== '23505') {
      console.warn(
        '[COMPOSE_VIDEO] DB record skipped:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

/**
 * Optional MP4 export after audio compose. Skipped unless generateVideo + ENABLE_VIDEO_EXPORT.
 * Failures are non-fatal for the overall compose response.
 */
export async function runComposeVideoBlock(params: {
  request: ComposeRequest;
  snapshot: EphemerisSnapshot;
  wavBundle: LyriaExportBundle;
  dailyExportSource: string | null;
  sessionUserId: string;
  payloadHash: string;
}): Promise<ComposeVideoBlockResult> {
  const { request, snapshot, wavBundle, dailyExportSource, sessionUserId, payloadHash } = params;

  if (request.generateVideo !== true || process.env.ENABLE_VIDEO_EXPORT !== '1') {
    return {};
  }

  const videoFormat = exportFormatOptions('video');
  const exportStore = getExportStore();
  const videoExportKey = computeVideoExportKey(snapshot, request);
  const durationSeconds =
    Number(process.env.VIDEO_ENCODE_DURATION_S) > 0
      ? Number(process.env.VIDEO_ENCODE_DURATION_S)
      : DEFAULT_DURATION_S;

  try {
    if (exportStore?.exists && (await exportStore.exists(videoExportKey, videoFormat.extension))) {
      console.log(`[COMPOSE_VIDEO] Reusing existing export: ${videoExportKey}`);
      let sizeBytes = 0;
      if (exportStore.get) {
        const existing = await exportStore.get(videoExportKey, videoFormat.extension);
        sizeBytes = existing?.length ?? 0;
      }
      return {
        video_export_id: videoExportKey,
        video_export_available: true,
        video: {
          format: 'mp4',
          export_id: videoExportKey,
          duration_s: durationSeconds,
          size_bytes: sizeBytes,
        },
      };
    }

    const videoStartTime = Date.now();
    const wavForVideo = await resolveWavForVideo(wavBundle);
    const videoResult = await encodeVideo(snapshot, wavForVideo, { durationSeconds });

    const sha256 = createHash('sha256').update(videoResult.mp4Buffer).digest('hex');
    const integrity = {
      sha256,
      size_bytes: videoResult.fileSizeBytes,
      createdAt: new Date().toISOString(),
      payload_hash: payloadHash,
      media_type: 'video',
      video_tier: request.videoTier || 'standard',
      duration_s: videoResult.durationSeconds,
    };

    if (exportStore?.put) {
      await exportStore.put(videoExportKey, videoResult.mp4Buffer, integrity, videoFormat);
    }

    const storageKey = exportStore?.storageKey
      ? exportStore.storageKey(videoExportKey, videoFormat.extension)
      : undefined;

    await tryCreateExportJob({
      id: videoExportKey,
      requestId: videoExportKey,
      userId: sessionUserId || null,
      planHash: null,
      chartHash: payloadHash,
      filePath: storageKey || `video/${videoExportKey}.mp4`,
      contentType: videoFormat.contentType,
      sizeBytes: videoResult.fileSizeBytes,
      storageKey: storageKey || undefined,
      exportMeta: {
        media_type: 'video',
        video_tier: request.videoTier || 'standard',
        source: dailyExportSource || 'video',
        duration_s: videoResult.durationSeconds,
        encode_time_ms: Date.now() - videoStartTime,
        sha256,
      },
    });

    const encodeTimeMs = Date.now() - videoStartTime;
    console.log(
      `[COMPOSE_VIDEO] OK: ${videoExportKey} (${(videoResult.fileSizeBytes / 1024 / 1024).toFixed(1)} MB) in ${encodeTimeMs}ms`,
    );

    return {
      video_export_id: videoExportKey,
      video_export_available: true,
      video: {
        format: 'mp4',
        export_id: videoExportKey,
        duration_s: videoResult.durationSeconds,
        size_bytes: videoResult.fileSizeBytes,
        encode_time_ms: encodeTimeMs,
      },
    };
  } catch (err) {
    console.error('[COMPOSE_VIDEO] Failed:', err instanceof Error ? err.message : err);
    return {
      video_export_available: false,
      video: {
        format: 'mp4',
        export_error: err instanceof Error ? err.message : 'Unknown video error',
      },
    };
  }
}
