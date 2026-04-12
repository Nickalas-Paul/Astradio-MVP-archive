/**
 * Phase 5A — finite enumerated expression rules (voice only).
 * Wave 1 (Phase 5C): sandbox lab lines, tier scaffold (profile/sandbox/compat/campaign),
 * feed scope allowlist, one profile glue prefix pair.
 * Wave 2 (Phase 5C): shared preface lines, tier scaffold (daily/overlay/group/feed),
 * glue (compat/campaign/daily/overlay), campaign-only synthesis wrappers. See tests for caps.
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
  {
    rule_id: 'P5A-W2-001-glue-campaign-scenario-stable-prefix',
    surfaces: ['campaign'],
    provenances: ['assembler_glue'],
    match: {
      kind: 'prefix',
      before_prefix: 'In this scenario, you see a stable ',
      after_prefix: 'In this scenario, you see a calmer ',
    },
    replacement: '',
  },
  {
    rule_id: 'P5A-W2-002-glue-compat-baseline-prefix',
    surfaces: ['compat_pair'],
    provenances: ['assembler_glue'],
    match: {
      kind: 'prefix',
      before_prefix: 'For this connection, you see a baseline ',
      after_prefix: 'For this connection, you see a steadier ',
    },
    replacement: '',
  },
  {
    rule_id: 'P5A-W2-003-glue-daily-baseline-prefix',
    surfaces: ['daily'],
    provenances: ['assembler_glue'],
    match: {
      kind: 'prefix',
      before_prefix: 'In this chart, you see a baseline ',
      after_prefix: 'In this chart, you see a steadier ',
    },
    replacement: '',
  },
  {
    rule_id: 'P5A-W2-004-preface-descriptive-shared',
    surfaces: ['compat_pair', 'group'],
    provenances: ['preface'],
    match: {
      kind: 'whole_sentence',
      before: 'The sections stay descriptive.',
    },
    replacement: 'The sections stay descriptive and keep claims bounded to what shows.',
  },
  {
    rule_id: 'P5A-W2-005-preface-observational-shared',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['friends', 'lovers', 'rivals', 'neutral'],
    match: {
      kind: 'whole_sentence',
      before: 'The sections stay observational.',
    },
    replacement: 'The sections stay observational, with steady, plain language.',
  },
  {
    rule_id: 'P5A-W2-006-preface-situational-shared',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['collaborator', 'lovers'],
    match: {
      kind: 'whole_sentence',
      before: 'Language stays situational.',
    },
    replacement: 'Language stays situational, tied to what is happening in the moment.',
  },
  {
    rule_id: 'P5A-W2-007-synthesis-campaign-cross-threads',
    surfaces: ['campaign'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Cross-section synthesis ties together mid-rank threads that moderate the dominant pattern.',
    },
    replacement:
      'Cross-section synthesis ties together mid-rank threads that moderate the headline without overwriting it.',
  },
  {
    rule_id: 'P5A-W2-008-synthesis-campaign-secondary-refine',
    surfaces: ['campaign'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Synthesis adds secondary threads that refine where intensity softens or concentrates.',
    },
    replacement:
      'Synthesis adds secondary threads that refine where intensity softens or concentrates, read as situational.',
  },
  {
    rule_id: 'P5A-W2-009-tier-daily-expanded',
    surfaces: ['daily'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded daily pass adds near-term timing nuance around the same active sky signal.',
    },
    replacement:
      'Expanded daily pass adds near-term timing nuance around the same active sky signal, read as situational.',
  },
  {
    rule_id: 'P5A-W2-010-tier-daily-extended',
    surfaces: ['daily'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded daily pass adds secondary timing modifiers and contrast handling.',
    },
    replacement:
      'Expanded daily pass adds secondary timing modifiers and contrast handling, with steadier pacing.',
  },
  {
    rule_id: 'P5A-W2-011-tier-feed-expanded',
    surfaces: ['feed'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded feed pass adds one context layer while staying concise.',
    },
    replacement: 'Expanded feed pass adds one context layer while staying compact.',
  },
  {
    rule_id: 'P5A-W2-012-tier-feed-extended',
    surfaces: ['feed'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended feed pass adds one deeper synthesis hint without turning into a full report.',
    },
    replacement: 'Extended feed pass adds a second read without becoming a full report.',
  },
  {
    rule_id: 'P5A-W2-013-tier-group-expanded',
    surfaces: ['group'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Expanded group pass: this picture adds how emphasis spreads across people in the room.',
    },
    replacement:
      'Expanded group pass: this picture adds how emphasis spreads across people in the room, read as situational.',
  },
  {
    rule_id: 'P5A-W2-014-tier-group-extended',
    surfaces: ['group'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before:
        'Expanded group pass: this picture adds smaller clusters inside the wider group story.',
    },
    replacement:
      'Expanded group pass: this picture adds smaller clusters inside the wider group story, with steadier pacing.',
  },
  {
    rule_id: 'P5A-W2-015-tier-overlay-expanded',
    surfaces: ['overlay_pair'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded overlay pass adds explicit natal-versus-sky layering detail.',
    },
    replacement:
      'Expanded overlay pass adds explicit natal-versus-sky layering detail, read as situational.',
  },
  {
    rule_id: 'P5A-W2-016-tier-overlay-extended',
    surfaces: ['overlay_pair'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded overlay pass adds moderator threads across both time layers.',
    },
    replacement:
      'Expanded overlay pass adds moderator threads across both time layers, with steadier pacing.',
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
