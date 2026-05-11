import type { SemanticCore } from './semantic-core';
import { CORE_SCHEMA_VERSION } from './ontology-codes';

export class SemanticCoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticCoreValidationError';
  }
}

export function validateSemanticCore(core: SemanticCore): void {
  if (core.provenance.core_schema_version !== CORE_SCHEMA_VERSION) {
    throw new SemanticCoreValidationError('core_schema_version mismatch');
  }
  if (!core.provenance.source_object_hash || core.provenance.source_object_hash.length !== 64) {
    throw new SemanticCoreValidationError('invalid source_object_hash');
  }
  const n = core.claims.length;
  for (let i = 0; i < n; i++) {
    const c = core.claims[i];
    if (c.priority_rank !== i) {
      throw new SemanticCoreValidationError(`claims must be sorted with consecutive ranks; expected ${i}, got ${c.priority_rank}`);
    }
    if (c.strength < 0 || c.strength > 1) {
      throw new SemanticCoreValidationError('claim strength out of range');
    }
  }
  const ids = new Set(core.claims.map((c) => c.claim_id));
  for (const e of core.tension_harmony?.claim_edges ?? []) {
    if (!ids.has(e.from_claim_id) || !ids.has(e.to_claim_id)) {
      throw new SemanticCoreValidationError('claim_edges reference unknown claim_id');
    }
  }
  // Phase 4A: emphasis_order is deprecated with template infrastructure removal.
  // It should remain empty, but validation no longer treats it as an assembly contract.
}
