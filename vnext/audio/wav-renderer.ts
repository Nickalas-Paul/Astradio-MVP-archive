/**
 * WAV renderer stub for staging / clean clone.
 * Satisfies tsc module resolution; throws if called.
 * Set ENABLE_WAV_EXPORT=1 and provide the real implementation to generate audio.
 */

export interface RenderOptions {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface RenderResult {
  buffer: Buffer;
  sha256: string;
  duration_ms: number;
  size_bytes: number;
}

export function renderWav60s(
  _plan: unknown,
  _payload: unknown,
  _hash: string,
  _options?: RenderOptions
): RenderResult {
  throw new Error(
    'WAV renderer is a stub. Set ENABLE_WAV_EXPORT=1 and provide the real wav-renderer implementation to generate audio.'
  );
}
