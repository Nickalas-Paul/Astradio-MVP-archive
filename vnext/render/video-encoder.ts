import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import { generateFrame, getTotalFrames } from './standard/frame-generator';
import { svgToPng } from './standard/svg-to-png';

const ffmpegPath = require('ffmpeg-static') as string | null;

export interface VideoEncodeOptions {
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  crf?: number;
}

export interface VideoEncodeResult {
  mp4Buffer: Buffer;
  durationSeconds: number;
  totalFrames: number;
  fileSizeBytes: number;
}

const DEFAULT_OPTIONS: Required<VideoEncodeOptions> = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 30,
  crf: 23,
};

const FRAME_BATCH_SIZE = 50;

function resolveOptions(options?: Partial<VideoEncodeOptions>): Required<VideoEncodeOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegPath) {
    return Promise.reject(new Error('ffmpeg-static binary path is not available'));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

/**
 * Generates a complete MP4 video from a chart snapshot and audio.
 *
 * Pipeline:
 *   1. Generate SVG frames via frame-generator
 *   2. Convert each SVG to PNG via sharp
 *   3. Write PNGs to temp directory
 *   4. Write WAV to temp file
 *   5. Run ffmpeg-static to composite PNG sequence + WAV → MP4
 *   6. Read MP4 into buffer, clean up temp files, return
 */
export async function encodeVideo(
  snapshot: EphemerisSnapshot,
  wavBuffer: Buffer,
  options?: Partial<VideoEncodeOptions>,
): Promise<VideoEncodeResult> {
  const opts = resolveOptions(options);
  const frameOpts = {
    width: opts.width,
    height: opts.height,
    fps: opts.fps,
    durationSeconds: opts.durationSeconds,
  };
  const totalFrames = getTotalFrames(frameOpts);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astradio-video-'));
  const encodeStart = Date.now();

  console.log(
    `[VIDEO_ENCODE] Starting: ${totalFrames} frames at ${opts.width}x${opts.height}, ${opts.fps}fps`,
  );

  try {
    const svgPhaseStart = Date.now();
    for (let batchStart = 0; batchStart < totalFrames; batchStart += FRAME_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + FRAME_BATCH_SIZE, totalFrames);
      await Promise.all(
        Array.from({ length: batchEnd - batchStart }, (_, offset) => {
          const i = batchStart + offset;
          return (async () => {
            const { svg } = generateFrame(snapshot, i, frameOpts);
            const filename = `frame_${String(i + 1).padStart(4, '0')}.svg`;
            await fs.promises.writeFile(path.join(tempDir, filename), svg, 'utf8');
          })();
        }),
      );

      if (batchEnd % 100 === 0 || batchEnd === totalFrames) {
        console.log(`[VIDEO_ENCODE] Frame generation: ${batchEnd}/${totalFrames}...`);
      }
    }
    const svgPhaseMs = Date.now() - svgPhaseStart;
    console.log(
      `[VIDEO_ENCODE] Frame generation complete: ${totalFrames} frames in ${(svgPhaseMs / 1000).toFixed(1)}s`,
    );

    const pngPhaseStart = Date.now();
    for (let batchStart = 0; batchStart < totalFrames; batchStart += FRAME_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + FRAME_BATCH_SIZE, totalFrames);
      await Promise.all(
        Array.from({ length: batchEnd - batchStart }, (_, offset) => {
          const i = batchStart + offset;
          return (async () => {
            const stem = `frame_${String(i + 1).padStart(4, '0')}`;
            const svg = await fs.promises.readFile(path.join(tempDir, `${stem}.svg`), 'utf8');
            const png = await svgToPng(svg, opts.width, opts.height);
            await fs.promises.writeFile(path.join(tempDir, `${stem}.png`), png);
            await fs.promises.unlink(path.join(tempDir, `${stem}.svg`));
          })();
        }),
      );
    }
    const pngPhaseMs = Date.now() - pngPhaseStart;
    console.log(`[VIDEO_ENCODE] SVG→PNG conversion complete in ${(pngPhaseMs / 1000).toFixed(1)}s`);

    const wavPath = path.join(tempDir, 'audio.wav');
    await fs.promises.writeFile(wavPath, wavBuffer);

    const outputPath = path.join(tempDir, 'output.mp4');
    const ffmpegArgs = [
      '-y',
      '-framerate',
      String(opts.fps),
      '-i',
      path.join(tempDir, 'frame_%04d.png'),
      '-i',
      wavPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      String(opts.crf),
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    ];

    console.log('[VIDEO_ENCODE] FFmpeg encoding started...');
    const ffmpegStart = Date.now();
    await runFfmpeg(ffmpegArgs);
    const ffmpegMs = Date.now() - ffmpegStart;

    const mp4Buffer = await fs.promises.readFile(outputPath);
    const fileSizeBytes = mp4Buffer.length;
    const fileSizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);

    console.log(
      `[VIDEO_ENCODE] FFmpeg complete: output.mp4 (${fileSizeMb} MB) in ${(ffmpegMs / 1000).toFixed(1)}s`,
    );
    console.log(
      `[VIDEO_ENCODE] Total encode time: ${((Date.now() - encodeStart) / 1000).toFixed(1)}s`,
    );

    return {
      mp4Buffer,
      durationSeconds: opts.durationSeconds,
      totalFrames,
      fileSizeBytes,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
