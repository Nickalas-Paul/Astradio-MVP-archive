/**
 * Render provider selection: Lyria (primary) or local_wav (fallback).
 * RENDER_PROVIDER=lyria|local_wav (default lyria in production).
 * If Lyria fails or keys missing, fail closed unless ALLOW_RENDER_FALLBACK=1.
 */

import type { RenderProvider, RenderInput, RenderResult } from './types';
import { lyriaProvider } from './lyria-provider';
import { localWavProvider } from './local-wav-provider';

const PROVIDER = (process.env.RENDER_PROVIDER || 'lyria').toLowerCase();
const ALLOW_FALLBACK = process.env.ALLOW_RENDER_FALLBACK === '1';

function getProvider(): RenderProvider {
  if (PROVIDER === 'local_wav') return localWavProvider;
  return lyriaProvider;
}

/**
 * Render audio: cache layer should call this. On Lyria failure, fall back to local_wav only if ALLOW_RENDER_FALLBACK=1.
 */
export async function renderWithProvider(input: RenderInput): Promise<RenderResult> {
  const provider = getProvider();
  if (provider.name === 'lyria') {
    try {
      return await lyriaProvider.render(input);
    } catch (err) {
      if (!ALLOW_FALLBACK) throw err;
      if (!input.plan || !input.payload) {
        throw new Error('Lyria failed and fallback requires plan and payload');
      }
      return localWavProvider.render(input);
    }
  }
  return localWavProvider.render(input);
}

export { buildLyriaPrompt } from './prompt-from-controls';
export type { RenderProvider, RenderInput, RenderResult } from './types';
export { lyriaProvider, localWavProvider };
export { getProvider };
