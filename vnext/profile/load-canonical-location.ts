/**
 * Load repo-root lib/canonical-location.js (CJS). process.cwd() must be repository root when the engine runs.
 */
import path from 'path';

export type CanonicalLocationModule = {
  validateCanonicalLocation: (body: unknown) =>
    | { ok: true; location: Record<string, unknown> }
    | { ok: false; error: string; code?: string };
  transitContextFingerprint: (location: Record<string, unknown>, date: string, time: string) => string;
  canonicalJson: (value: unknown) => string;
  sha256: (str: string) => string;
};

let cached: CanonicalLocationModule | null = null;

export function getCanonicalLocationModule(): CanonicalLocationModule {
  if (cached) return cached;
  const root = process.cwd();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cached = require(path.join(root, 'lib', 'canonical-location.js')) as CanonicalLocationModule;
  return cached;
}
