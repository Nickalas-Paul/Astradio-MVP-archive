/**
 * Phase 5B — finite enumerated RPG line filters (campaign copy only).
 * Wave 1: continuity line emission only (`rpg_continuity_lines_v1`).
 */
export type Phase5BMatch = { kind: 'whole_text'; before: string };

export type Phase5BRule = {
  rule_id: string;
  emission_id: string;
  match: Phase5BMatch;
  replacement: string;
};

export const PHASE5B_RULES: readonly Phase5BRule[] = [
  {
    rule_id: 'P5B-W1-001-continuity-clarity',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward naming things plainly and defining the line more clearly.',
    },
    replacement:
      'Recent turns have favored plain naming and sharper lines without adding extra drama.',
  },
  {
    rule_id: 'P5B-W1-002-continuity-momentum',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward movement, follow-through, and keeping things in motion.',
    },
    replacement:
      'Recent turns have leaned toward movement, follow-through, and keeping momentum readable.',
  },
  {
    rule_id: 'P5B-W1-003-continuity-strain',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have carried extra strain, so narrower moves may read more clearly than sweeping ones.',
    },
    replacement:
      'Recent turns have carried extra strain, so smaller moves may read more clearly than sweeping ones.',
  },
];
