import type {
  CanonicalRelationalFieldObject,
  CompatibilityClassification,
  PersistedCompatibilityRecord,
  RelationalFieldScoreContract,
} from './contracts';
import type { RelationalWeatherStateV1 } from '../relational/weather/types';
import { buildCanonicalRelationalField, buildCompatibilityRecord } from './build-relational-field';
import { classifyCompatibilityScore, scoreCompatibilityField } from './scoring';

export interface CompatibilityComputationResult {
  field: CanonicalRelationalFieldObject;
  scoring: RelationalFieldScoreContract;
  classification: CompatibilityClassification;
  record: PersistedCompatibilityRecord;
  /** Ephemeral sky/activation snapshot for feed UI; not persisted on the canonical field record. */
  transit_weather: RelationalWeatherStateV1 | null;
}

export async function computeCompatibilitySystem(params: {
  chartIds: string[];
  relationshipBindingId?: string | null;
  transitInput?: { date: string; time: string; lat: number; lon: number; timezone?: string };
  computedAt?: string;
}): Promise<CompatibilityComputationResult> {
  const { field, record, transit_weather } = await buildCompatibilityRecord({
    chartIds: params.chartIds,
    relationshipBindingId: params.relationshipBindingId ?? null,
    transitInput: params.transitInput,
    computedAt: params.computedAt,
  });
  const scoring = scoreCompatibilityField(field);
  const classification = classifyCompatibilityScore(scoring);
  return {
    field,
    scoring,
    classification,
    transit_weather,
    record: {
      ...record,
      classification_id: classification.classification_id,
      classification_version: classification.classification_version,
    },
  };
}

export async function computeCompatibilityFieldOnly(params: {
  chartIds: string[];
  relationshipBindingId?: string | null;
  transitInput?: { date: string; time: string; lat: number; lon: number; timezone?: string };
}): Promise<CanonicalRelationalFieldObject> {
  const { field } = await buildCanonicalRelationalField({
    chartIds: params.chartIds,
    bindingKey: params.relationshipBindingId ?? undefined,
    transitInput: params.transitInput,
  });
  return field;
}
