/**
 * Render provider contract: prompt + seed + duration → WAV.
 * Determinism is enforced by cache key (hash), not by provider bit-identity.
 */

export interface RenderInput {
  prompt: string;
  seed: string;
  duration_s: number;
  /** For local_wav fallback only */
  plan?: unknown;
  payload?: unknown;
}

export interface RenderResult {
  wavBuffer: Buffer;
  sha256: string;
  size_bytes: number;
  format: string;
  provider_meta: Record<string, unknown>;
}

export interface RenderProvider {
  readonly name: string;
  render(input: RenderInput): Promise<RenderResult>;
}
