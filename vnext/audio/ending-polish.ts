/**
 * Deterministic post-render ending polish for Lyria WAV output.
 * Shapes the final 2–3 seconds so the clip lands cleanly without a hard cutoff.
 * Same input buffer + options → same output. No randomness.
 */

import type { EndingStyle } from './composition-narrative';

const WAV_HEADER_LEN = 44;
const DEFAULT_TAIL_WINDOW_S = 2.5;

export interface EndingPolishOptions {
  /** Length of the ending section to shape (seconds). */
  tailWindowSeconds?: number;
  /** Optional ending style from narrative; influences curve shape. */
  endingStyle?: EndingStyle;
  /** Sample rate (Hz). Read from WAV header if not provided; used only for validation when provided. */
  sampleRate?: number;
}

export interface EndingPolishResult {
  /** Polished WAV buffer (new Buffer). */
  buffer: Buffer;
  /** Whether polish was applied (false if skipped e.g. buffer too short). */
  applied: boolean;
  /** Tail window seconds used. */
  tailWindowSeconds: number;
  /** endingStyle used if available. */
  endingStyleUsed?: EndingStyle;
}

/**
 * Apply a deterministic gain envelope to the final tail of PCM audio.
 * Ensures clean decay to near-silence to avoid clicks and hard cutoffs.
 */
export function applyEndingPolish(
  wavBuffer: Buffer,
  options: EndingPolishOptions = {}
): EndingPolishResult {
  const tailWindowSeconds = options.tailWindowSeconds ?? DEFAULT_TAIL_WINDOW_S;
  const endingStyle = options.endingStyle;

  if (wavBuffer.length < WAV_HEADER_LEN + 4) {
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  // Standard PCM WAV: RIFF/WAVE, fmt at 12, data at 44
  if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF' || wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  const numChannels = wavBuffer.readUInt16LE(22);
  const sampleRate = wavBuffer.readUInt32LE(24);
  const bitsPerSample = wavBuffer.readUInt16LE(34);
  const dataChunkSize = wavBuffer.readUInt32LE(40);
  const dataOffset = 44;

  const bufferLength = wavBuffer.length;
  if (dataOffset >= bufferLength) {
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  if (bitsPerSample !== 16 || numChannels < 1 || sampleRate < 8000) {
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  const bytesPerFrame = 2 * numChannels;
  const actualPcmBytes = bufferLength - dataOffset;
  const framesFromHeader = bytesPerFrame > 0 ? Math.floor(dataChunkSize / bytesPerFrame) : 0;
  const framesFromBuffer = bytesPerFrame > 0 ? Math.floor(actualPcmBytes / bytesPerFrame) : 0;
  let totalFrames = Math.min(framesFromHeader, framesFromBuffer);
  if (bytesPerFrame <= 0 || totalFrames <= 0 || !Number.isFinite(totalFrames)) {
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  const headerExceedsActual = dataChunkSize > actualPcmBytes;
  if (headerExceedsActual) {
    try {
      console.log('[ENDING_POLISH]', JSON.stringify({
        dataOffset,
        dataChunkSize,
        bufferLength,
        actualPcmBytes,
        bytesPerFrame,
        totalFrames,
        headerExceedsActual,
        _mismatch: 'buffer shorter than header',
      }));
    } catch {
      // logging must not affect behavior
    }
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  const tailFrames = Math.min(
    Math.floor(tailWindowSeconds * sampleRate),
    totalFrames
  );

  if (tailFrames <= 0) {
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  const fadeStartFrame = totalFrames - tailFrames;
  const out = Buffer.alloc(wavBuffer.length);
  wavBuffer.copy(out, 0, 0, dataOffset);

  try {
    for (let f = 0; f < totalFrames; f++) {
      const gain = f < fadeStartFrame ? 1 : envelopeGain((f - fadeStartFrame) / tailFrames, endingStyle);
      for (let c = 0; c < numChannels; c++) {
        const offset = dataOffset + (f * numChannels + c) * 2;
        const sample = wavBuffer.readInt16LE(offset);
        const scaled = Math.round(sample * gain);
        const clamped = Math.max(-32768, Math.min(32767, scaled));
        out.writeInt16LE(clamped, offset);
      }
    }
  } catch (e) {
    try {
      console.log('[ENDING_POLISH_ERROR]', JSON.stringify({ message: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200) }));
    } catch {
      // logging must not affect behavior
    }
    return {
      buffer: wavBuffer,
      applied: false,
      tailWindowSeconds,
      endingStyleUsed: endingStyle,
    };
  }

  return {
    buffer: out,
    applied: true,
    tailWindowSeconds,
    endingStyleUsed: endingStyle,
  };
}

/**
 * Deterministic gain curve for t in [0, 1]: 1 at t=0, 0 at t=1.
 * Smooth cosine ramp to avoid clicks. endingStyle slightly shapes the curve.
 */
function envelopeGain(t: number, endingStyle?: EndingStyle): number {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  // Cosine squared: smooth fall, no discontinuity at end
  const smooth = 0.5 + 0.5 * Math.cos(Math.PI * t);
  const base = smooth * smooth;
  // resolved/triumphant: preserve more energy in first half, then drop (slightly later start of drop)
  if (endingStyle === 'resolved' || endingStyle === 'triumphant') {
    const late = t < 0.5 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (t - 0.5) * 2);
    return late * late;
  }
  // dissipating / suspended / open: use smooth cosine² throughout
  return base;
}
