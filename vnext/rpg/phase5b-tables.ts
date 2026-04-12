/**
 * Phase 5B — finite enumerated RPG line filters (separate from Phase 5A projection).
 */
export type Phase5BMatch = { kind: 'whole_text'; before: string };

export type Phase5BRule = {
  rule_id: string;
  emission_id: string;
  match: Phase5BMatch;
  replacement: string;
};

export const PHASE5B_RULES: readonly Phase5BRule[] = [];
