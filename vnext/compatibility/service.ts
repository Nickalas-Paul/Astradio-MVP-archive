import type {
  CanonicalRelationalFieldObject,
  CompatibilityClassification,
  PersistedCompatibilityRecord,
  RelationalFieldScoreContract,
} from './contracts';
import { buildCanonicalRelationalField, buildCompatibilityRecord } from './build-relational-field';
import { classifyCompatibilityScore, scoreCompatibilityField } from './scoring';

export interface CompatibilityComputationResult {
  field: CanonicalRelationalFieldObject;
  scoring: RelationalFieldScoreContract;
  classification: CompatibilityClassification;
  record: PersistedCompatibilityRecord;
}

export async function computeCompatibilitySystem(params: {
  chartIds: string[];
  relationshipBindingId?: string | null;
  transitInput?: { date: string; time: string; lat: number; lon: number; timezone?: string };
  computedAt?: string;
}): Promise<CompatibilityComputationResult> {
  const { field, record } = await buildCompatibilityRecord({
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
  return buildCanonicalRelationalField({
    chartIds: params.chartIds,
    bindingKey: params.relationshipBindingId ?? undefined,
    transitInput: params.transitInput,
  });
}
