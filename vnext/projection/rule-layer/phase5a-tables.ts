/**
 * Phase 5A — finite enumerated expression rules (voice only).
 * Production tables ship empty; add rows only with tests for Phase 2 / density / invariants.
 */
import type { ConnectionMode, ProjectionSurface, ProvenanceType } from '../projection-types';

export type Phase5ARuleMatch =
  | { kind: 'whole_sentence'; before: string }
  | { kind: 'prefix'; before_prefix: string; after_prefix: string };

export type Phase5ARule = {
  rule_id: string;
  surfaces: readonly (ProjectionSurface | '*')[];
  provenances: readonly ProvenanceType[];
  /** When set, rule applies only if `connectionMode` is listed (excludes undefined). */
  connection_modes?: readonly ConnectionMode[];
  match: Phase5ARuleMatch;
  /** Used for `whole_sentence` only; ignored for `prefix` (uses `after_prefix`). */
  replacement: string;
};

export type Phase5ATemplateMatch =
  | { kind: 'whole_sentence'; value: string }
  | { kind: 'exact_substring'; value: string };

export type Phase5ATemplateAllowlistEntry = {
  exception_id: string;
  surface: ProjectionSurface | '*';
  match: Phase5ATemplateMatch;
  replacement: string;
  section_ids?: readonly string[];
};

/** Lexicographically sorted by rule_id at runtime; keep source sorted for diffs. */
export const PHASE5A_RULES: readonly Phase5ARule[] = [];

/** Lexicographically sorted by exception_id at runtime. */
export const PHASE5A_TEMPLATE_ALLOWLIST: readonly Phase5ATemplateAllowlistEntry[] = [];
