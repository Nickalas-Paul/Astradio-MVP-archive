/**
 * Render provider selection: Lyria (primary) or local_wav (fallback).
 * RENDER_PROVIDER=lyria|local_wav (default lyria in production).
 * If Lyria fails or keys missing, fail closed unless ALLOW_RENDER_FALLBACK=1.
 */

import type { RenderProvider, RenderInput, RenderResult } from './types';
import { lyriaProvider } from './lyria-provider';
import { localWavProvider } from './local-wav-provider';

const RAW_PROVIDER = (process.env.RENDER_PROVIDER || 'lyria').toLowerCase();
const hasLyriaCreds = !!process.env.GOOGLE_CLOUD_PROJECT;
const effectiveRaw = RAW_PROVIDER === 'lyria' && !hasLyriaCreds ? 'local_wav' : RAW_PROVIDER;
const PROVIDER: 'lyria' | 'local_wav' | null =
  effectiveRaw === 'lyria' || effectiveRaw === 'local_wav' ? effectiveRaw : null;
const ALLOW_FALLBACK = process.env.ALLOW_RENDER_FALLBACK === '1';

function assertValidProvider(provider: string | null): asserts provider is 'lyria' | 'local_wav' {
  if (provider !== 'lyria' && provider !== 'local_wav') {
    const allowed = ['lyria', 'local_wav'];
    throw new Error(
      `Invalid RENDER_PROVIDER "${RAW_PROVIDER}". Expected one of: ${allowed.join(', ')}.`
    );
  }
}

function getProvider(): RenderProvider {
  assertValidProvider(PROVIDER);
  if (PROVIDER === 'local_wav') return localWavProvider;
  return lyriaProvider;
}

/**
 * Render audio: cache layer should call this. Provider is selected exactly once
 * from RENDER_PROVIDER. On Lyria failure, fall back to local_wav only if
 * ALLOW_RENDER_FALLBACK=1.
 */
export async function renderWithProvider(input: RenderInput): Promise<RenderResult> {
  const provider = getProvider();
  if (provider.name === 'lyria') {
    try {
      return await provider.render(input);
    } catch (err) {
      if (!ALLOW_FALLBACK) throw err;
      if (!input.plan || !input.payload) {
        throw new Error('Lyria failed and fallback requires plan and payload');
      }
      return localWavProvider.render(input);
    }
  }
  return provider.render(input);
}

export { buildLyriaPrompt } from './prompt-from-controls';
export type { RenderProvider, RenderInput, RenderResult } from './types';
export { lyriaProvider, localWavProvider };
export { getProvider };
