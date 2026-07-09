import crypto from 'crypto';
import type { EphemerisSnapshot } from '../contracts';

/**
 * Generates a deterministic 64-char hex key for a video export.
 * Separate from audio export keys to avoid collisions.
 */
export function computeVideoExportKey(
  snapshot: EphemerisSnapshot,
  request: { videoTier?: string; mode?: string },
): string {
  const input = [
    'video',
    request.videoTier || 'standard',
    request.mode || 'unknown',
    snapshot.ts,
    snapshot.lat.toFixed(1),
    snapshot.lon.toFixed(1),
    snapshot.planets.map((p) => `${p.name}:${p.lon.toFixed(2)}`).join(','),
  ].join('\n');

  return crypto.createHash('sha256').update(input).digest('hex');
}
