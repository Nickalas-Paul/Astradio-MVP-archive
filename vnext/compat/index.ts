/**
 * Community Compatibility V1 — public API.
 */

export { createCompatRouter } from './routes';
export { mergeFeatureVectors } from './fusion';
export type { MergeFeatureVectorsOptions } from './fusion';
export type { User, Chart, Comparison, ChartBInline, RelationshipMode, FusionParams, CompatibilityTextStructured } from './types';
export { createComparison } from './comparison-service';
export type { CreateComparisonInput, CreateComparisonResult } from './comparison-service';
export * as compatStorage from './storage';
