/**
 * Render provider selection: Lyria (primary) or local_wav (explicit only).
 * RENDER_PROVIDER=lyria|local_wav (default lyria in production).
 * Fail-closed: Lyria requested but credentials missing or Lyria failure → error, no silent fallback.
 */

import type { RenderProvider, RenderInput, RenderResult } from './types';
import { lyriaProvider } from './lyria-provider';
import { localWavProvider } from './local-wav-provider';

const RAW_PROVIDER = (process.env.RENDER_PROVIDER || 'lyria').toLowerCase();
const PROVIDER: 'lyria' | 'local_wav' | null =
  RAW_PROVIDER === 'lyria' || RAW_PROVIDER === 'local_wav' ? RAW_PROVIDER : null;

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
 * Render audio: cache layer should call this. Provider is selected from RENDER_PROVIDER.
 * No fallback: if Lyria is requested but unavailable (missing creds or API failure), throws.
 */
export async function renderWithProvider(input: RenderInput): Promise<RenderResult> {
  const provider = getProvider();
  return provider.render(input);
}

export { buildLyriaPrompt } from './prompt-from-controls';
export type { RenderProvider, RenderInput, RenderResult } from './types';
export { lyriaProvider, localWavProvider };
export { getProvider };
