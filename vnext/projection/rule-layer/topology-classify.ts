/**
 * Topology classification for projection voice (presentation only).
 */
import type { ProjectionOptions } from '../projection-types';

export type TopologyClass = 'identity' | 'dyad' | 'field';

export function classifyTopology(options: ProjectionOptions): TopologyClass {
  const surface = options.surface;
  if (surface === 'compat_pair' || surface === 'overlay_pair') return 'dyad';
  if (surface === 'group') return 'field';
  const n = options.participantCount ?? 0;
  if (n > 2) return 'field';
  if (n === 2 && (surface === 'sandbox' || surface === 'profile' || surface === 'daily')) {
    return 'dyad';
  }
  return 'identity';
}
