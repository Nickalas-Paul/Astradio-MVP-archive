/**
 * Shared projection context shape.
 *
 * Phase 4A removed the raw template line renderer from this module. The context
 * type remains because phase2-sentence-load still uses it for section framing.
 */
import type { TopologyClass } from './topology-classify';
import type { TemporalVoiceBucket } from './temporal-classify';
import type { ProjectionSurface } from '../projection-types';

export type TemplateContext = {
  readonly suppressAstrologyTitles: boolean;
  readonly topologyClass: TopologyClass;
  readonly temporalBucket: TemporalVoiceBucket;
  readonly surface?: ProjectionSurface;
};
