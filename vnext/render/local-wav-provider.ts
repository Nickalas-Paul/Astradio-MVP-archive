/**
 * Local WAV renderer as fallback when Lyria is unavailable or RENDER_PROVIDER=local_wav.
 * Uses existing plan + payload → 30s PCM WAV. Do not invest in improving this path.
 */

import type { RenderProvider, RenderInput, RenderResult } from './types';
import { renderWav60s } from '../audio/wav-renderer';

const DURATION_SEC = 30;

export const localWavProvider: RenderProvider = {
  name: 'local_wav',
  async render(input: RenderInput): Promise<RenderResult> {
    const plan = input.plan;
    const payload = input.payload as { hash?: string } | undefined;
    const hash = input.seed || payload?.hash || 'local_fallback';
    if (!plan || !payload) {
      throw new Error('local_wav provider requires plan and payload');
    }
    const result = renderWav60s(plan, payload, hash, {
      sampleRate: 22050,
      channels: 1,
      bitDepth: 16,
    });
    return {
      wavBuffer: result.buffer,
      sha256: result.sha256,
      size_bytes: result.size_bytes,
      format: 'wav',
      provider_meta: {
        provider: 'local_wav',
        modelVersion: 'local-v1',
        duration_s: DURATION_SEC,
      },
    };
  },
};
