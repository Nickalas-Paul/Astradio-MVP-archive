import type { CanonicalReportObject } from './canonical-report-object';

export class CanonicalReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalReportValidationError';
  }
}

export function validateCanonicalReportObject(o: CanonicalReportObject): void {
  if (o.schema_version !== 'canonical_report_v1') {
    throw new CanonicalReportValidationError('invalid schema_version');
  }
  if (!o.object_identity_hash || o.object_identity_hash.length !== 64) {
    throw new CanonicalReportValidationError('invalid object_identity_hash');
  }
  if (!o.participants.length) {
    throw new CanonicalReportValidationError('participants required');
  }

  switch (o.surface_kind) {
    case 'profile_natal':
      if (o.participants.length !== 1) {
        throw new CanonicalReportValidationError('profile_natal requires exactly one participant');
      }
      break;
    case 'home_daily':
      if (o.participants.length !== 1) {
        throw new CanonicalReportValidationError('home_daily requires exactly one participant');
      }
      if (!o.transit_lock || !o.transit_snapshot_hash) {
        throw new CanonicalReportValidationError('home_daily requires transit_lock and transit_snapshot_hash');
      }
      break;
    case 'comparison_pair':
      if (o.participants.length !== 2) {
        throw new CanonicalReportValidationError('comparison_pair requires two participants');
      }
      break;
    case 'overlay_aggregate':
      if (o.participants.length < 1) {
        throw new CanonicalReportValidationError('overlay_aggregate requires at least one participant');
      }
      if (o.composite_feature_vector == null || !o.composite_algorithm_id) {
        throw new CanonicalReportValidationError('overlay_aggregate requires composite vector and algorithm id');
      }
      if (o.anchor_slot_index == null || o.anchor_slot_index < 0 || o.anchor_slot_index >= o.participants.length) {
        throw new CanonicalReportValidationError('overlay_aggregate requires valid anchor_slot_index');
      }
      break;
    default:
      throw new CanonicalReportValidationError('unknown surface_kind');
  }
}
