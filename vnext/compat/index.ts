/**
 * Community Compatibility V1 — public API.
 */

export { createCompatRouter } from './routes';
export { mergeFeatureVectors } from './fusion';
export type { MergeFeatureVectorsOptions } from './fusion';
export type { User, Chart, Comparison, ChartBInline, RelationshipMode, FusionParams, CompatibilityTextStructured } from './types';
export {
  RELATIONSHIP_MODES,
  DEPRECATED_RELATIONSHIP_MODE_ALIASES,
  parseRelationshipModeInput,
  coerceRelationshipModeFromStorage,
} from './types';
export { createComparison, composeComparisonAggregateReading } from './comparison-service';
export type {
  CreateComparisonInput,
  CreateComparisonResult,
  ComposeComparisonAggregateReadingParams,
  ComposeComparisonAggregateReadingResult,
} from './comparison-service';
export * as compatStorage from './storage';
