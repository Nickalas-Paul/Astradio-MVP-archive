/**
 * Temporal state buckets from SemanticCore.temporal (read-only; no authority changes).
 */
import type { SemanticCore } from '../../semantic/semantic-core';

export type TemporalVoiceBucket = 'static' | 'activated' | 'mixed';

export function classifyTemporalVoice(core: SemanticCore): TemporalVoiceBucket {
  const t = core.temporal;
  if (!t) return 'static';
  const w = t.transit_vs_natal_weight;
  if (w >= 0.5) return 'activated';
  if (w <= 0.15) return 'static';
  return 'mixed';
}
