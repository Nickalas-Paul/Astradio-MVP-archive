/**
 * Lyria (Vertex AI) render provider. Primary renderer for 30s instrumental WAV.
 * Calls Vertex AI lyria-002 predict endpoint; seed for reproducibility.
 */

import type { RenderProvider, RenderInput, RenderResult } from './types';
import { callLyriaPredict } from './lyria-client';

export const lyriaProvider: RenderProvider = {
  name: 'lyria',
  async render(input: RenderInput): Promise<RenderResult> {
    const seedInt = hashToInteger(input.seed);
    const { wavBuffer, sha256, size_bytes, model, requestId } = await callLyriaPredict({
      prompt: input.prompt,
      seed: seedInt,
    });
    return {
      wavBuffer,
      sha256,
      size_bytes,
      format: 'wav',
      provider_meta: {
        provider: 'lyria',
        modelVersion: model || 'lyria-002',
        requestId,
        duration_s: input.duration_s,
      },
    };
  },
};

function hashToInteger(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h = h & h;
  }
  return (h >>> 0) % 0x7fffffff;
}
