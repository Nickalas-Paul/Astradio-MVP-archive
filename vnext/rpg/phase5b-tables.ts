/**
 * **Proj:** Phase 5B — finite enumerated RPG line filters (campaign copy only; legacy module name).
 * Wave 1: continuity line emission only (`rpg_continuity_lines_v1`).
 * Wave 2: additional continuity tones + history-direction lines on the same emission (per-line match).
 * Wave 3: remaining HISTORY_DIRECTION_TEXT literals (four lines).
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
  {
    rule_id: 'P5B-W2-001-continuity-ambiguity',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward holding space without forcing quick resolution.',
    },
    replacement:
      'Recent turns have leaned toward holding space without forcing a premature resolution.',
  },
  {
    rule_id: 'P5B-W2-002-continuity-cohesion',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward connection, trust, and relational steadiness.',
    },
    replacement:
      'Recent turns have leaned toward connection, trust, and steadier relational pacing.',
  },
  {
    rule_id: 'P5B-W2-003-continuity-containment',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward protecting capacity and reducing unnecessary exposure.',
    },
    replacement:
      'Recent turns have leaned toward protecting capacity and trimming unnecessary exposure.',
  },
  {
    rule_id: 'P5B-W2-004-continuity-integration',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward making a more coherent story out of mixed signals.',
    },
    replacement:
      'Recent turns have leaned toward making a clearer story out of mixed signals.',
  },
  {
    rule_id: 'P5B-W2-005-continuity-repair',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward repair, reciprocity, and small acts that restore trust.',
    },
    replacement:
      'Recent turns have leaned toward repair, reciprocity, and small acts that rebuild trust.',
  },
  {
    rule_id: 'P5B-W2-006-continuity-stability',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'Recent turns have leaned toward limits, steadier pacing, and preserving structure.',
    },
    replacement:
      'Recent turns have leaned toward limits, steadier pacing, and preserving workable structure.',
  },
  {
    rule_id: 'P5B-W2-007-history-assert-define',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also echoes a recent pattern of defining the situation rather than leaving it implied.',
    },
    replacement:
      'It also echoes a recent pattern of defining the situation rather than leaving it unstated.',
  },
  {
    rule_id: 'P5B-W2-008-history-engage-advance',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also continues a recent pattern of moving things forward through action.',
    },
    replacement:
      'It also continues a recent pattern of moving things forward through concrete action.',
  },
  {
    rule_id: 'P5B-W2-009-history-observe-hold',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also echoes a recent pattern of leaving room before forcing an answer.',
    },
    replacement:
      'It also echoes a recent pattern of leaving room before forcing a final answer.',
  },
  {
    rule_id: 'P5B-W2-010-history-withdraw-protect',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also continues a recent pattern of protecting capacity by reducing exposure.',
    },
    replacement:
      'It also continues a recent pattern of protecting capacity by trimming exposure.',
  },
  {
    rule_id: 'P5B-W3-001-history-contain-limit',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also continues a recent pattern of narrowing scope to stabilize what matters most.',
    },
    replacement:
      'It also continues a recent pattern of narrowing scope to keep what matters most legible.',
  },
  {
    rule_id: 'P5B-W3-002-history-offer-restore',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also continues a recent pattern of repair through something concrete.',
    },
    replacement:
      'It also continues a recent pattern of repair through a concrete gesture.',
  },
  {
    rule_id: 'P5B-W3-003-history-reframe-integrate',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also echoes a recent pattern of changing interpretation before changing the outer move.',
    },
    replacement:
      'It also echoes a recent pattern of changing interpretation before changing the visible move.',
  },
  {
    rule_id: 'P5B-W3-004-history-support-connect',
    emission_id: 'rpg_continuity_lines_v1',
    match: {
      kind: 'whole_text',
      before:
        'It also echoes a recent pattern of bringing in connection or perspective.',
    },
    replacement:
      'It also echoes a recent pattern of bringing in connection or outside perspective.',
  },
];
