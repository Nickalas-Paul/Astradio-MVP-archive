/**
 * Deterministic surface expression rules: enumerated replacements on tagged provenance rows.
 * Shipped rule_id strings prefixed `P5A-` / `P6B-` are frozen identifiers for regression filters.
 */
import type { ConnectionMode, ProjectionSurface, ProvenanceType } from '../projection-types';

export type SurfaceExpressionRuleMatch =
  | { kind: 'whole_sentence'; before: string }
  | { kind: 'prefix'; before_prefix: string; after_prefix: string };

export type SurfaceExpressionRule = {
  rule_id: string;
  surfaces: readonly (ProjectionSurface | '*')[];
  provenances: readonly ProvenanceType[];
  /** When set, rule applies only if `connectionMode` is listed (excludes undefined). */
  connection_modes?: readonly ConnectionMode[];
  match: SurfaceExpressionRuleMatch;
  /** Used for `whole_sentence` only; ignored for `prefix` (uses `after_prefix`). */
  replacement: string;
};

export type SurfaceExpressionTemplateMatch =
  | { kind: 'whole_sentence'; value: string }
  | { kind: 'exact_substring'; value: string };

export type SurfaceExpressionTemplateAllowlistEntry = {
  exception_id: string;
  surface: ProjectionSurface | '*';
  match: SurfaceExpressionTemplateMatch;
  replacement: string;
  section_ids?: readonly string[];
};

const FEED_SCOPE_SENTENCE = 'This card stays narrow by design.';

/** Lexicographically sorted by rule_id at runtime; keep source sorted for diffs. */
export const SHIPPED_SURFACE_EXPRESSION_RULES: readonly SurfaceExpressionRule[] = [
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
      'Expanded campaign pass adds pressure-response detail beyond baseline guidance, with tighter pacing.',
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
    surfaces: ['compat_pair', 'group'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Expanded pass adds mid-level threads beyond the baseline framing.',
    },
    replacement:
      'Expanded pass adds mid-level threads beyond the baseline framing, with steadier wording.',
  },
  {
    rule_id: 'P5A-W1-005-tier-compat-extended',
    surfaces: ['compat_pair', 'group'],
    provenances: ['tier_scaffold'],
    match: {
      kind: 'whole_sentence',
      before: 'Extended pass adds secondary moderators and contrast handling.',
    },
    replacement: 'Extended pass adds secondary moderators and contrast handling, read as situational.',
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
      'Lab framing: this pass tracks how small input shifts change the read, not fixed life conclusions.',
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
      'Cross-section synthesis threads mid-rank moderators with the headline so situational nuance stays legible without overwriting the main read.',
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
      'Synthesis adds secondary threads that show where intensity softens or tightens on the same situational beat.',
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
  {
    rule_id: 'P5A-W3-001-glue-overlay-baseline-prefix',
    surfaces: ['overlay_pair'],
    provenances: ['assembler_glue'],
    match: {
      kind: 'prefix',
      before_prefix: 'In this chart, you see a baseline ',
      after_prefix: 'In this chart, you see a steadier ',
    },
    replacement: '',
  },
  {
    rule_id: 'P5A-W3-002-preface-collaborator-opener',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['collaborator'],
    match: {
      kind: 'whole_sentence',
      before: 'This connection starts from task coordination.',
    },
    replacement:
      'This connection starts from task coordination, read as practical and bounded to the work at hand.',
  },
  {
    rule_id: 'P5A-W3-003-preface-friends-opener',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['friends'],
    match: {
      kind: 'whole_sentence',
      before: 'This connection emphasizes cooperative timing and repair when friction shows.',
    },
    replacement:
      'This connection emphasizes cooperative timing and repair when friction shows, keeping the frame practical.',
  },
  {
    rule_id: 'P5A-W3-004-preface-group-ensemble-voices',
    surfaces: ['group'],
    provenances: ['preface'],
    match: {
      kind: 'whole_sentence',
      before: 'This group holds multiple voices; emphasis may spread unevenly.',
    },
    replacement:
      'This group holds multiple voices; emphasis may spread unevenly, read as situational room-wide.',
  },
  {
    rule_id: 'P5A-W3-005-preface-lovers-opener',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['lovers'],
    match: {
      kind: 'whole_sentence',
      before: 'This connection emphasizes reciprocity and intimacy cadence.',
    },
    replacement:
      'This connection emphasizes reciprocity and intimacy cadence, read with steadier, plain language.',
  },
  {
    rule_id: 'P5A-W3-006-preface-mentor-opener',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['mentor'],
    match: {
      kind: 'whole_sentence',
      before: 'This connection names asymmetric support timing.',
    },
    replacement:
      'This connection names asymmetric support timing, honoring both sides without fixing real-world hierarchy.',
  },
  {
    rule_id: 'P5A-W3-007-preface-neutral-opener',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['neutral'],
    match: {
      kind: 'whole_sentence',
      before: 'This connection keeps assumptions low.',
    },
    replacement: 'This connection keeps assumptions low, with steady, plain language.',
  },
  {
    rule_id: 'P5A-W3-008-preface-rivals-opener',
    surfaces: ['compat_pair'],
    provenances: ['preface'],
    connection_modes: ['rivals'],
    match: {
      kind: 'whole_sentence',
      before: 'This connection names competitive charge and boundary pressure.',
    },
    replacement:
      'This connection names competitive charge and boundary pressure, read as situational intensity.',
  },
  {
    rule_id: 'P5A-W3-009-synthesis-campaign-contrast-handling',
    surfaces: ['campaign'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Contrast handling keeps constructive and challenging threads visible without forcing a single winner; the view stays multi-valued on purpose.',
    },
    replacement:
      'Contrast handling keeps constructive and challenging threads visible without forcing a single winner; the view stays multi-valued by design.',
  },
  {
    rule_id: 'P5A-W3-010-synthesis-campaign-extended-pass',
    surfaces: ['campaign'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern.',
    },
    replacement:
      'Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern with pacing you can steer.',
  },
  {
    rule_id: 'P5A-W3-011-synthesis-campaign-second-pass',
    surfaces: ['campaign'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal.',
    },
    replacement:
      'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal, kept situational and bounded.',
  },
  {
    rule_id: 'P5A-W3-012-synthesis-campaign-tension-together',
    surfaces: ['campaign'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Taken together, supportive and challenging signals both appear in this picture; this configuration tends to benefit from naming friction without treating it as the whole story, while still honoring care where it shows up.',
    },
    replacement:
      'Taken together, supportive and challenging signals both appear in this picture; this configuration tends to benefit from naming friction without treating it as the whole story, while still honoring care where it lands most clearly.',
  },
  {
    rule_id: 'P5A-W3-013-synthesis-profile-trait-bridge-a',
    surfaces: ['profile'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Trait bridge: elemental and tonal signals often travel together; changing context can shift which side shows up first.',
    },
    replacement:
      'Trait bridge: elemental and tonal signals often travel together; changing context can shift which side reads first, without forcing one story.',
  },
  {
    rule_id: 'P5A-W3-014-synthesis-profile-trait-bridge-b',
    surfaces: ['profile'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Trait bridge: structure in skills under stress may show before self-description; both tracks can be valid.',
    },
    replacement:
      'Trait bridge: structure in skills under stress may show before self-description; both tracks can be valid, read as situational.',
  },
  {
    rule_id: 'P6B-001-glue-group-baseline-prefix',
    surfaces: ['group'],
    provenances: ['assembler_glue'],
    match: {
      kind: 'prefix',
      before_prefix: 'Here, you see a baseline ',
      after_prefix: 'Here, you see a steadier ',
    },
    replacement: '',
  },
  {
    rule_id: 'P6B-002-synthesis-group-field-distribution-a',
    surfaces: ['group'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Field distribution: emphasis often concentrates on a few people rather than spreading evenly.',
    },
    replacement:
      'Field distribution: emphasis often concentrates on a few people rather than spreading evenly, read as situational.',
  },
  {
    rule_id: 'P6B-003-synthesis-group-field-distribution-b',
    surfaces: ['group'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Field distribution: harmony and friction can read as uneven spread before local detail tightens.',
    },
    replacement:
      'Field distribution: harmony and friction can read as uneven spread before local detail tightens, with steadier pacing.',
  },
  {
    rule_id: 'surface-group-synthesis-wrap-cross-threads',
    surfaces: ['group'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Cross-section synthesis ties together mid-rank threads that moderate the dominant pattern.',
    },
    replacement:
      'Cross-section synthesis ties mid-rank threads to the headline while keeping many voices legible in the shared field.',
  },
  {
    rule_id: 'surface-group-synthesis-wrap-secondary-refine',
    surfaces: ['group'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before: 'Synthesis adds secondary threads that refine where intensity softens or concentrates.',
    },
    replacement:
      'Synthesis adds secondary threads that show where intensity softens or tightens before local detail tightens across the room.',
  },
  {
    rule_id: 'surface-group-synthesis-b-extended',
    surfaces: ['group'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern.',
    },
    replacement:
      'Extended synthesis brings lower-ranked moderator threads to map nuance around the headline pattern while keeping the field-wide frame explicit.',
  },
  {
    rule_id: 'surface-group-synthesis-b-second',
    surfaces: ['group'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal.',
    },
    replacement:
      'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal, read as room-scale and bounded.',
  },
  {
    rule_id: 'surface-profile-synthesis-wrap-cross-threads',
    surfaces: ['profile'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Cross-section synthesis ties together mid-rank threads that moderate the dominant pattern.',
    },
    replacement:
      'Cross-section synthesis ties mid-rank threads to your headline pattern so personal nuance stays legible without overwriting the main read.',
  },
  {
    rule_id: 'surface-profile-synthesis-wrap-secondary-refine',
    surfaces: ['profile'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before: 'Synthesis adds secondary threads that refine where intensity softens or concentrates.',
    },
    replacement:
      'Synthesis adds secondary threads that show where intensity softens or tightens in the same personal picture.',
  },
  {
    rule_id: 'surface-profile-synthesis-b-extended',
    surfaces: ['profile'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern.',
    },
    replacement:
      'Extended synthesis brings lower-ranked moderator threads to map nuance around the headline pattern with steadier personal pacing.',
  },
  {
    rule_id: 'surface-profile-synthesis-b-second',
    surfaces: ['profile'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal.',
    },
    replacement:
      'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal, kept personal and bounded.',
  },
  {
    rule_id: 'surface-sandbox-synthesis-wrap-cross-threads',
    surfaces: ['sandbox'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Cross-section synthesis ties together mid-rank threads that moderate the dominant pattern.',
    },
    replacement:
      'Cross-section synthesis ties mid-rank threads to the lab snapshot so controlled shifts stay easy to compare run to run.',
  },
  {
    rule_id: 'surface-sandbox-synthesis-wrap-secondary-refine',
    surfaces: ['sandbox'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before: 'Synthesis adds secondary threads that refine where intensity softens or concentrates.',
    },
    replacement:
      'Synthesis adds secondary threads that show where intensity softens or tightens under the inputs you set for this pass.',
  },
  {
    rule_id: 'surface-sandbox-synthesis-b-extended',
    surfaces: ['sandbox'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern.',
    },
    replacement:
      'Extended synthesis brings lower-ranked moderator threads to map nuance around the headline pattern while keeping conclusions provisional.',
  },
  {
    rule_id: 'surface-sandbox-synthesis-b-second',
    surfaces: ['sandbox'],
    provenances: ['synthesis_wrapper'],
    match: {
      kind: 'whole_sentence',
      before:
        'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal.',
    },
    replacement:
      'Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal, read as lab-bounded and reversible.',
  },
];

/** Lexicographically sorted by exception_id at runtime. */
export const SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST: readonly SurfaceExpressionTemplateAllowlistEntry[] = [
  {
    exception_id: 'P5A-W1-FEED-001-scope',
    surface: 'feed',
    match: { kind: 'whole_sentence', value: FEED_SCOPE_SENTENCE },
    /** Non-expanding vs original `FEED_SCOPE_SENTENCE` (41 chars). */
    replacement: 'This card stays tight by design.',
    section_ids: ['feed_context'],
  },
];
