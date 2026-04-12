/**
 * Phase 5A — finite enumerated expression rules (voice only).
 * Wave 1 (Phase 5C): sandbox lab lines, tier scaffold (profile/sandbox/compat/campaign),
 * feed scope allowlist, one profile glue prefix pair. Max 25 rows across 5A+allowlist+5B (see tests).
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

const FEED_SCOPE_SENTENCE = 'This card stays narrow by design.';

/** Lexicographically sorted by rule_id at runtime; keep source sorted for diffs. */
export const PHASE5A_RULES: readonly Phase5ARule[] = [
  {
    rule_id: 'P5A-W1-001-glue-profile-baseline-prefix',
    surfaces: ['profile'],
    provenances: ['assembler_glue'],
    match: {
      kind: 'prefix',
      before_prefix: 'In this chart, you see a baseline ',
      after_prefix: 'In this chart, you see a steadier ',
    },
    replacement: '',
  },
  {
    rule_id: 'P5A-W1-002-tier-campaign-expanded',
    surfaces: ['campaign'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Expanded campaign pass adds pressure-response detail beyond baseline response guidance.',
    },
    replacement:
      'Expanded campaign pass adds pressure-response detail beyond baseline guidance, with clearer pacing.',
  },
  {
    rule_id: 'P5A-W1-003-tier-campaign-extended',
    surfaces: ['campaign'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended campaign pass adds secondary pressure moderators for turn-level adaptation.',
    },
    replacement:
      'Extended campaign pass adds secondary pressure moderators so turn-level choices stay legible.',
  },
  {
    rule_id: 'P5A-W1-004-tier-compat-expanded',
    surfaces: ['compat_pair'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Expanded pair pass adds interaction-mode detail beyond the baseline compatibility frame.',
    },
    replacement:
      'Expanded pair pass adds interaction-mode detail beyond the baseline frame, with steadier wording.',
  },
  {
    rule_id: 'P5A-W1-005-tier-compat-extended',
    surfaces: ['compat_pair'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Extended pair pass adds secondary pair moderators and contrast handling.',
    },
    replacement:
      'Extended pair pass adds secondary pair moderators and contrast handling, read as situational.',
  },
  {
    rule_id: 'P5A-W1-006-tier-profile-expanded',
    surfaces: ['profile'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Expanded pass adds mid-rank threads that explain how the same pattern shifts across context.',
    },
    replacement:
      'Expanded pass adds mid-rank threads so the same pattern reads across contexts with cleaner edges.',
  },
  {
    rule_id: 'P5A-W1-007-tier-profile-extended',
    surfaces: ['profile'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended pass folds in lower-ranked moderator threads to map nuance, not just the dominant headline.',
    },
    replacement:
      'Extended pass folds in lower-ranked moderator threads to map nuance beyond the dominant headline.',
  },
  {
    rule_id: 'P5A-W1-008-tier-sandbox-expanded',
    surfaces: ['sandbox'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded sandbox pass adds threads that shift when you change lab controls.',
    },
    replacement:
      'Expanded sandbox pass adds threads that track when you change lab controls, read as provisional.',
  },
  {
    rule_id: 'P5A-W1-009-tier-sandbox-extended',
    surfaces: ['sandbox'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Expanded sandbox pass adds second-order effects for edge-condition sensitivity.',
    },
    replacement:
      'Expanded sandbox pass adds second-order effects for edge-condition sensitivity in the lab.',
  },
  {
    rule_id: 'P5A-W1-010-sandbox-lab-a',
    surfaces: ['sandbox'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before: 'Sandbox framing: this picture reflects lab conditions you changed on purpose.',
    },
    replacement:
      'Lab framing: this chart reflects inputs you set on purpose for this sandbox pass.',
  },
  {
    rule_id: 'P5A-W1-011-sandbox-lab-b',
    surfaces: ['sandbox'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Sandbox framing: this lab pass emphasizes sensitivity to those changes, not fixed life conclusions.',
    },
    replacement:
      'Lab framing: this pass emphasizes sensitivity to your tweaks, not fixed life conclusions.',
  },
];

/** Lexicographically sorted by exception_id at runtime. */
export const PHASE5A_TEMPLATE_ALLOWLIST: readonly Phase5ATemplateAllowlistEntry[] = [
  {
    exception_id: 'P5A-W1-FEED-001-scope',
    surface: 'feed',
    match: { kind: 'whole_sentence', value: FEED_SCOPE_SENTENCE },
    /** Non-expanding vs original `FEED_SCOPE_SENTENCE` (41 chars). */
    replacement: 'This card stays tight by design.',
    section_ids: ['feed_context'],
  },
];
