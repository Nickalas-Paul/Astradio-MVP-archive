console.log('video-muxer loaded');

import { spawn } from 'child_process';

const ffmpegPath = require('ffmpeg-static') as string | null;

export function runFfmpeg(args: string[]): Promise<void> {
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
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Mode 1: still image + audio → MP4 (existing sky post path). */
export async function muxImageAndAudio(options: {
  imagePath: string;
  audioPath: string;
  outputPath: string;
}): Promise<void> {
  const { imagePath, audioPath, outputPath } = options;
  await runFfmpeg([
    '-y',
    '-loop',
    '1',
    '-i',
    imagePath,
    '-i',
    audioPath,
    '-c:v',
    'libx264',
    '-tune',
    'stillimage',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-pix_fmt',
    'yuv420p',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

/**
 * Mode 2: looping Aura video + branded overlay PNG + audio → MP4.
 * Overlay should be full-frame (typically transparent where the loop shows through).
 */
export async function muxLoopWithOverlayAndAudio(options: {
  loopVideoPath: string;
  overlayImagePath: string;
  audioPath: string;
  outputPath: string;
  durationSeconds?: number;
}): Promise<void> {
  const { loopVideoPath, overlayImagePath, audioPath, outputPath } = options;
  const durationSeconds =
    typeof options.durationSeconds === 'number' && options.durationSeconds > 0
      ? options.durationSeconds
      : 30;

  await runFfmpeg([
    '-y',
    '-stream_loop',
    '-1',
    '-i',
    loopVideoPath,
    '-i',
    overlayImagePath,
    '-i',
    audioPath,
    '-filter_complex',
    '[0:v][1:v]overlay=0:0:format=auto[v]',
    '-map',
    '[v]',
    '-map',
    '2:a',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-pix_fmt',
    'yuv420p',
    '-t',
    String(durationSeconds),
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}
