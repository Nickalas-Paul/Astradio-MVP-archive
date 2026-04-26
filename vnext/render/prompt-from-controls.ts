import type { ControlSurfacePayload } from '../explainer/contracts';
import type { Plan } from '../contracts';
import type { CompositionNarrativePlan } from '../audio/composition-narrative';

/**
 * Lyria provider prompt (`lyria_spec_v1`): deterministic key=value lines only (no prose).
 * See buildLyriaPrompt; semantic inputs unchanged (payload, plan, CompositionNarrativePlan).
 */

const LYRIA_MAX_PROMPT_CHARS = 1800;

const CONSTRAINTS_FULL =
  'no_vocals|no_speech|no_lyrics|original_only|clear_landing|no_abrupt_cutoff';

/** Max tags per bucket; overflow dropped deterministically (facet bucket first). */
const MAX_CHART_IDENTITY_TAGS = 24;
const MAX_FACET_TAGS = 24;

/** When eliding, set these field keys to `none` in order (lines stay; values shrink). */
const ELIDE_VALUE_NONE_KEYS: string[] = [
  'facet_tags',
  'chart_identity_tags',
  'harmonic_secondary',
  'register_brightness',
  'register_texture',
  'rhythm_groove',
  'syncopation',
  'aspects_opposition_heavy',
  'aspects_square_heavy',
  'aspects_trine_heavy',
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Hyphenated internal tags → snake_case Lyria spec tokens. */
function tokenToSnake(token: string): string {
  return token.replace(/-/g, '_');
}

function deriveModalColor(
  narrative: CompositionNarrativePlan,
  plan?: Plan | { key?: string }
): { tag: string } {
  const key = (plan && (plan as any).key) as string | undefined;
  const lower = key ? key.toLowerCase() : '';
  const isMinor = lower.includes('minor');
  const isMajor = lower.includes('major');

  let mode: 'major' | 'minor' | 'ambiguous' = 'ambiguous';
  if (isMinor && !isMajor) mode = 'minor';
  else if (isMajor && !isMinor) mode = 'major';

  const polarity = narrative.tonalPolarity;

  if (mode === 'minor') {
    if (polarity === 'bright') return { tag: 'harmonic-minor-bright-modal' };
    if (polarity === 'dark') return { tag: 'harmonic-minor-shadowed' };
    return { tag: 'harmonic-minor-balanced' };
  }

  if (mode === 'major') {
    if (polarity === 'bright') return { tag: 'harmonic-major-open' };
    if (polarity === 'dark') return { tag: 'harmonic-major-with-suspensions' };
    return { tag: 'harmonic-major-balanced' };
  }

  if (polarity === 'bright') return { tag: 'harmonic-modal-bright' };
  if (polarity === 'dark') return { tag: 'harmonic-modal-shadowed' };
  return { tag: 'harmonic-modal-balanced' };
}

function deriveHarmonicBehavior(
  narrative: CompositionNarrativePlan,
  payload: ControlSurfacePayload,
  plan?: Plan | { key?: string }
): { tags: string[] } {
  const tensionSignal = clamp01(narrative.tensionIndex);
  const aspectTension =
    typeof payload.aspect_tension === 'number' ? clamp01(payload.aspect_tension) : tensionSignal;
  const harmonicTension = clamp01(0.6 * tensionSignal + 0.4 * aspectTension);
  const resolutionStrength = clamp01(narrative.resolutionIndex);

  let tensionTag: string;
  if (harmonicTension <= 0.33) {
    tensionTag = 'harmonic-low-tension';
  } else if (harmonicTension >= 0.67) {
    tensionTag = 'harmonic-high-tension';
  } else {
    tensionTag = 'harmonic-medium-tension';
  }

  let cadenceTag: string;
  if (resolutionStrength >= 0.67) {
    cadenceTag = 'cadence-strong-resolution';
  } else if (resolutionStrength <= 0.33) {
    cadenceTag = 'cadence-soft-or-open';
  } else {
    cadenceTag = 'cadence-moderate-resolution';
  }

  const modal = deriveModalColor(narrative, plan);

  const chordDensitySignal =
    narrative.densityProfile === 'sparse_to_full'
      ? 0.45
      : narrative.densityProfile === 'full_to_sparse'
        ? 0.7
        : 0.55;
  const densityControl = clamp01(
    0.5 * chordDensitySignal +
      0.5 *
        (typeof (payload as any).density_level === 'number'
          ? (payload as any).density_level
          : chordDensitySignal)
  );

  let chordDensityTag: string;
  if (densityControl <= 0.33) {
    chordDensityTag = 'chord-density-lean';
  } else if (densityControl >= 0.67) {
    chordDensityTag = 'chord-density-rich';
  } else {
    chordDensityTag = 'chord-density-medium';
  }

  return {
    tags: [modal.tag, tensionTag, cadenceTag, chordDensityTag],
  };
}

function deriveRhythmicCharacter(
  narrative: CompositionNarrativePlan,
  payload: ControlSurfacePayload
): { tags: string[] } {
  const drive = clamp01(narrative.rhythmicDrive);
  const { cardinal, fixed, mutable } = narrative.modalityBalance;
  const primaryModality =
    cardinal >= fixed && cardinal >= mutable ? 'cardinal' : fixed >= mutable ? 'fixed' : 'mutable';

  let intensityTag: string;
  if (drive >= 0.67) {
    intensityTag = 'rhythm-drive-strong';
  } else if (drive <= 0.33) {
    intensityTag = 'rhythm-drive-soft';
  } else {
    intensityTag = 'rhythm-drive-medium';
  }

  let modalityTag: string;
  if (primaryModality === 'cardinal') {
    modalityTag = 'rhythm-cardinal-pulse';
  } else if (primaryModality === 'fixed') {
    modalityTag = 'rhythm-fixed-groove';
  } else {
    modalityTag = 'rhythm-mutable-variation';
  }

  const syncBias =
    typeof (payload as any).syncopation_bias === 'number'
      ? clamp01((payload as any).syncopation_bias)
      : 0.5;
  let syncTag: string;
  if (syncBias >= 0.67) {
    syncTag = 'rhythm-syncopated-strong';
  } else if (syncBias <= 0.33) {
    syncTag = 'rhythm-syncopated-soft';
  } else {
    syncTag = 'rhythm-syncopated-medium';
  }

  return {
    tags: [intensityTag, modalityTag, syncTag],
  };
}

function deriveRegisterAndInstrumentation(
  narrative: CompositionNarrativePlan,
  _payload: ControlSurfacePayload
): { tags: string[] } {
  const primary = narrative.primaryElement;
  const brightness = clamp01(narrative.brightnessIndex);
  const isBright = brightness >= 0.65;
  const isDark = brightness <= 0.35;

  let harmonyRegister: 'low' | 'mid' | 'wide';
  if (primary === 'earth') {
    harmonyRegister = 'low';
  } else if (primary === 'water') {
    harmonyRegister = 'wide';
  } else {
    harmonyRegister = 'mid';
  }

  const brightnessTag =
    isBright && !isDark
      ? 'register-bright-high-center'
      : isDark && !isBright
        ? 'register-darker-low-center'
        : 'register-balanced-mid-center';
  const textureTag =
    primary === 'water'
      ? 'texture-wide-blended'
      : primary === 'earth'
        ? 'texture-dense-grounded'
        : primary === 'air'
          ? 'texture-light-open'
          : 'texture-driven-articulated';

  const tags = [
    brightnessTag,
    textureTag,
    `element-instrumentation-${primary}`,
    harmonyRegister === 'wide'
      ? 'register-harmony-wide'
      : harmonyRegister === 'low'
        ? 'register-harmony-low'
        : 'register-harmony-mid',
  ];

  return { tags };
}

/** Identity-level tags only (no prose); planetary branches removed (unreachable upstream). */
function deriveChartIdentityTags(narrative: CompositionNarrativePlan): string[] {
  const tags: string[] = [];

  const stellium = narrative.stellium;
  if (stellium?.hasCluster) {
    const el = stellium.element ?? narrative.primaryElement;
    if (el === 'fire') {
      tags.push('stellium-fire-motif-strong', 'stellium-fire-rhythm-intense');
    } else if (el === 'earth') {
      tags.push('stellium-earth-harmony-heavy', 'stellium-earth-bass-strong');
    } else if (el === 'air') {
      tags.push('stellium-air-melody-agile', 'stellium-air-interlocking-lines');
    } else {
      tags.push('stellium-water-sustained', 'stellium-water-overlapping-pads');
    }
  }

  const angular = narrative.angularDominance;
  if (angular) {
    if (angular.first) {
      tags.push('angle-1st-strong-intro', 'angle-1st-rhythm-assertive');
    }
    if (angular.fourth) {
      tags.push('angle-4th-deep-bass', 'angle-4th-harmonic-bed');
    }
    if (angular.seventh) {
      tags.push('angle-7th-call-response', 'angle-7th-dual-voices');
    }
    if (angular.tenth) {
      tags.push('angle-10th-strong-peak', 'angle-10th-clear-cadence');
    }
  }

  const lum = narrative.luminaryDominance;
  if (lum === 'sun') {
    tags.push('luminary-sun-dominant', 'melody-central-solar');
  } else if (lum === 'moon') {
    tags.push('luminary-moon-dominant', 'dynamics-fluid-lunar');
  } else {
    tags.push('luminary-balanced');
  }

  const aspects = narrative.aspectSignatures;
  if (aspects) {
    if (aspects.trineHeavy) {
      tags.push('aspects-trine-heavy', 'harmony-smooth-flowing');
    }
    if (aspects.squareHeavy) {
      tags.push('aspects-square-heavy', 'harmony-gritty', 'tension-accented');
    }
    if (aspects.oppositionHeavy) {
      tags.push('aspects-opposition-heavy', 'gesture-alternation', 'register-dialogue');
    }
  }

  return tags;
}

function tempoBucket(bpm: number): string {
  if (bpm < 90) return 'slow-tempo';
  if (bpm < 120) return 'medium-tempo';
  return 'fast-tempo';
}

function densityBucket(d: number): string {
  if (d < 0.4) return 'sparse';
  if (d < 0.7) return 'moderate-density';
  return 'dense';
}

function brightnessBucket(t: number): string {
  if (t < 0.3) return 'soft-tonality';
  if (t < 0.7) return 'balanced-tonality';
  return 'vivid-tonality';
}

function tensionBucket(t: number): string {
  if (t < 0.33) return 'low-tension';
  if (t < 0.66) return 'medium-tension';
  return 'high-tension';
}

function emphasisBucket(motifRate: number, rhythmTemplateId: number): string {
  if (motifRate > 0.6) return 'melodic';
  if (rhythmTemplateId >= 4) return 'rhythmic';
  return 'balanced';
}

function genreFamily(g?: string): string {
  const x = (g || 'house').toLowerCase();
  if (x === 'classical') return 'orchestral';
  if (x === 'jazz') return 'jazz';
  if (x === 'ambient') return 'ambient';
  return 'electronic';
}

function tonalField(narrative: CompositionNarrativePlan): string {
  const p = narrative.tonalPolarity;
  if (p === 'bright') return 'tonal_bright';
  if (p === 'dark') return 'tonal_dark';
  return 'tonal_balanced';
}

function rhythmicDriveTagField(narrative: CompositionNarrativePlan): string {
  if (narrative.rhythmicDrive >= 0.66) return 'strong_rhythmic_drive';
  if (narrative.rhythmicDrive <= 0.33) return 'gentle_rhythmic_motion';
  return 'steady_rhythmic_flow';
}

const ANGULAR_ORDER = ['1st', '4th', '7th', '10th'] as const;

function angularHousesField(narrative: CompositionNarrativePlan): string {
  const a = narrative.angularDominance;
  if (!a) return 'none';
  const picked: string[] = [];
  if (a.first) picked.push('1st');
  if (a.fourth) picked.push('4th');
  if (a.seventh) picked.push('7th');
  if (a.tenth) picked.push('10th');
  if (picked.length === 0) return 'none';
  return ANGULAR_ORDER.filter((h) => picked.includes(h)).join('|');
}

function sortDedupTokens(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...tags].sort((a, b) => a.localeCompare(b))) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function pipeJoinTokens(tags: string[]): string {
  const s = sortDedupTokens(tags);
  return s.length === 0 ? 'none' : s.map(tokenToSnake).join('|');
}

type SpecRow = { key: string; value: string };

/** Fixed key order for lyria_spec_v1 (must match product contract). */
const SPEC_KEY_ORDER: string[] = [
  'lyria_spec_v',
  'duration_s',
  'instrumental',
  'constraints',
  'genre_family',
  'tempo_class',
  'bpm',
  'density_ctrl',
  'tension_ctrl',
  'emphasis',
  'brightness',
  'tonal',
  'element_primary',
  'element_secondary',
  'arc',
  'energy',
  'peak',
  'ending',
  'density_profile',
  'rhythm_drive',
  'syncopation',
  'harmonic',
  'harmonic_secondary',
  'rhythm_groove',
  'register_texture',
  'register_brightness',
  'stellium_active',
  'stellium_element',
  'angular_houses',
  'luminary',
  'aspects_trine_heavy',
  'aspects_square_heavy',
  'aspects_opposition_heavy',
  'chart_identity_tags',
  'facet_tags',
];

/** Same key order as `lyria_spec_v1` / `rowsToPrompt` (exported for focused contract tests). */
export const LYRIA_SPEC_V1_KEY_ORDER: readonly string[] = SPEC_KEY_ORDER;

/** Lyria prompt conditioning profile (audio export only; does not alter canonical or projection outputs). */
export type LyriaPromptProfile = 'default' | 'aggregate_relational_weather_v1';

function primaryStem(token: string): string {
  const t = token.trim();
  if (!t) return '';
  const i = t.indexOf('_');
  return i === -1 ? t : t.slice(0, i);
}

function stemCapFor(stem: string): number {
  return stem === 'angle' ? 3 : 2;
}

function parsePipeBucket(raw: string | undefined): string[] {
  const s = String(raw ?? '').trim();
  if (!s || s === 'none') return [];
  return s
    .split('|')
    .map((x) => tokenToSnake(x.trim()))
    .filter(Boolean);
}

/**
 * Deterministic tag-bucket collapse for aggregate relational weather audio only.
 * Operates only on chart_identity_tags and facet_tags (lyria_spec_v1).
 */
export function collapseRelationalWeatherLyriaTagBuckets(rows: SpecRow[]): SpecRow[] {
  const ciKey = 'chart_identity_tags';
  const ftKey = 'facet_tags';

  let ci = [...new Set(parsePipeBucket(rows.find((r) => r.key === ciKey)?.value))].sort((a, b) => a.localeCompare(b, 'en'));
  let ft = [...new Set(parsePipeBucket(rows.find((r) => r.key === ftKey)?.value))].sort((a, b) => a.localeCompare(b, 'en'));

  const ciSet = new Set(ci);
  ft = ft.filter((t) => !ciSet.has(t));

  const stems = new Set<string>();
  for (const t of [...ci, ...ft]) {
    const st = primaryStem(t);
    if (st) stems.add(st);
  }

  const orderedStems = [...stems].sort((a, b) => a.localeCompare(b, 'en'));
  for (const stem of orderedStems) {
    const cap = stemCapFor(stem);
    const ciStem = ci.filter((t) => primaryStem(t) === stem).sort((a, b) => a.localeCompare(b, 'en'));
    const ftStem = ft.filter((t) => primaryStem(t) === stem).sort((a, b) => a.localeCompare(b, 'en'));
    const kept: string[] = [];
    for (const t of ciStem) {
      if (kept.length >= cap) break;
      kept.push(t);
    }
    for (const t of ftStem) {
      if (kept.length >= cap) break;
      kept.push(t);
    }
    const keptSet = new Set(kept);
    ci = ci.filter((t) => primaryStem(t) !== stem || keptSet.has(t));
    ft = ft.filter((t) => primaryStem(t) !== stem || keptSet.has(t));
  }

  const ciOut = ci.length ? [...ci].sort((a, b) => a.localeCompare(b, 'en')).join('|') : 'none';
  const ftOut = ft.length ? [...ft].sort((a, b) => a.localeCompare(b, 'en')).join('|') : 'none';

  return rows.map((r) => {
    if (r.key === ciKey) return { ...r, value: ciOut };
    if (r.key === ftKey) return { ...r, value: ftOut };
    return r;
  });
}

function rowsToPrompt(rows: SpecRow[]): string {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return SPEC_KEY_ORDER.map((k) => `${k}=${map.get(k) ?? 'none'}`).join('\n');
}

function buildFacetTags(params: {
  harmonicTags: string[];
  rhythmicTags: string[];
  registerTags: string[];
  modalityTags: string[];
  densityProfileTag: string;
  arcTags: string[];
}): string[] {
  const {
    harmonicTags,
    rhythmicTags,
    registerTags,
    modalityTags,
    densityProfileTag,
    arcTags,
  } = params;
  return [
    ...harmonicTags.slice(2),
    ...rhythmicTags.slice(1),
    ...registerTags.slice(2),
    ...modalityTags,
    densityProfileTag,
    ...arcTags,
  ].filter(Boolean);
}

function buildLyriaSpecRowsFromNarrative(
  payload: ControlSurfacePayload,
  plan: Plan | { bpm?: number; key?: string } | undefined,
  narrative: CompositionNarrativePlan
): SpecRow[] {
  const tempoNorm = typeof payload.tempo_norm === 'number' ? payload.tempo_norm : 0.5;
  const density = typeof payload.density_level === 'number' ? payload.density_level : 0.5;
  const tension = typeof payload.aspect_tension === 'number' ? payload.aspect_tension : 0.5;
  const motifRate = typeof payload.motif_rate === 'number' ? payload.motif_rate : 0.5;
  const rhythmTemplateId = typeof payload.rhythm_template_id === 'number' ? payload.rhythm_template_id : 0;

  const bpm =
    plan && typeof (plan as Plan).bpm === 'number' ? (plan as Plan).bpm : Math.round(90 + tempoNorm * 60);

  const harmonic = deriveHarmonicBehavior(narrative, payload, plan);
  const rhythmicDetail = deriveRhythmicCharacter(narrative, payload);
  const registerAndInstr = deriveRegisterAndInstrumentation(narrative, payload);
  const chartIdentityTagsRaw = deriveChartIdentityTags(narrative);

  const modalityTags = [
    narrative.modalityBalance.cardinal > 0.45 ? 'cardinal-pulse' : '',
    narrative.modalityBalance.fixed > 0.45 ? 'fixed-grounded' : '',
    narrative.modalityBalance.mutable > 0.45 ? 'mutable-shift' : '',
  ].filter(Boolean);

  const densityProfileTag = `density-${narrative.densityProfile}`;
  const arcTags = [
    `arc-${narrative.arcShape}`,
    `energy-${narrative.energyCurve}`,
    `peak-${narrative.peakWindow}`,
    `ending-${narrative.endingStyle}`,
  ];

  const facetTagsRaw = buildFacetTags({
    harmonicTags: harmonic.tags,
    rhythmicTags: rhythmicDetail.tags,
    registerTags: registerAndInstr.tags,
    modalityTags,
    densityProfileTag,
    arcTags,
  });

  const chartIdentitySorted = sortDedupTokens(chartIdentityTagsRaw).slice(0, MAX_CHART_IDENTITY_TAGS);
  const facetSorted = sortDedupTokens(facetTagsRaw).slice(0, MAX_FACET_TAGS);

  const secondaryEl = narrative.secondaryElement;

  const stellium = narrative.stellium;
  const stelliumActive = stellium?.hasCluster ? '1' : '0';
  const stelliumElement =
    stellium?.hasCluster ? (stellium.element ?? narrative.primaryElement) : 'none';

  const aspects = narrative.aspectSignatures;

  return [
    { key: 'lyria_spec_v', value: '1' },
    { key: 'duration_s', value: '30' },
    { key: 'instrumental', value: '1' },
    { key: 'constraints', value: CONSTRAINTS_FULL },
    { key: 'genre_family', value: genreFamily(payload.genre) },
    { key: 'tempo_class', value: tokenToSnake(tempoBucket(bpm)) },
    { key: 'bpm', value: String(Math.round(bpm)) },
    { key: 'density_ctrl', value: tokenToSnake(densityBucket(density)) },
    { key: 'tension_ctrl', value: tokenToSnake(tensionBucket(tension)) },
    { key: 'emphasis', value: emphasisBucket(motifRate, rhythmTemplateId) },
    { key: 'brightness', value: tokenToSnake(brightnessBucket(narrative.brightnessIndex)) },
    { key: 'tonal', value: tonalField(narrative) },
    { key: 'element_primary', value: narrative.primaryElement },
    { key: 'element_secondary', value: secondaryEl ?? 'none' },
    { key: 'arc', value: narrative.arcShape },
    { key: 'energy', value: narrative.energyCurve },
    { key: 'peak', value: narrative.peakWindow },
    { key: 'ending', value: narrative.endingStyle },
    { key: 'density_profile', value: narrative.densityProfile },
    { key: 'rhythm_drive', value: rhythmicDriveTagField(narrative) },
    { key: 'syncopation', value: tokenToSnake(rhythmicDetail.tags[2] ?? 'rhythm-syncopated-medium') },
    { key: 'harmonic', value: tokenToSnake(harmonic.tags[0] ?? 'harmonic-modal-balanced') },
    { key: 'harmonic_secondary', value: tokenToSnake(harmonic.tags[1] ?? 'harmonic-medium-tension') },
    { key: 'rhythm_groove', value: tokenToSnake(rhythmicDetail.tags[0] ?? 'rhythm-drive-medium') },
    {
      key: 'register_texture',
      value: tokenToSnake(registerAndInstr.tags[1] ?? 'texture-wide-blended'),
    },
    {
      key: 'register_brightness',
      value: tokenToSnake(registerAndInstr.tags[0] ?? 'register-balanced-mid-center'),
    },
    { key: 'stellium_active', value: stelliumActive },
    { key: 'stellium_element', value: stelliumElement },
    { key: 'angular_houses', value: angularHousesField(narrative) },
    { key: 'luminary', value: narrative.luminaryDominance },
    { key: 'aspects_trine_heavy', value: aspects?.trineHeavy ? '1' : '0' },
    { key: 'aspects_square_heavy', value: aspects?.squareHeavy ? '1' : '0' },
    { key: 'aspects_opposition_heavy', value: aspects?.oppositionHeavy ? '1' : '0' },
    { key: 'chart_identity_tags', value: pipeJoinTokens(chartIdentitySorted) },
    { key: 'facet_tags', value: pipeJoinTokens(facetSorted) },
  ];
}

/** Legacy path: no narrative plan — deterministic neutral facet defaults. */
function buildLyriaSpecRowsLegacy(payload: ControlSurfacePayload, plan: Plan | { bpm?: number; key?: string } | undefined): SpecRow[] {
  const tempoNorm = typeof payload.tempo_norm === 'number' ? payload.tempo_norm : 0.5;
  const density = typeof payload.density_level === 'number' ? payload.density_level : 0.5;
  const tension = typeof payload.aspect_tension === 'number' ? payload.aspect_tension : 0.5;
  const motifRate = typeof payload.motif_rate === 'number' ? payload.motif_rate : 0.5;
  const rhythmTemplateId = typeof payload.rhythm_template_id === 'number' ? payload.rhythm_template_id : 0;

  const bpm =
    plan && typeof (plan as Plan).bpm === 'number' ? (plan as Plan).bpm : Math.round(90 + tempoNorm * 60);

  return [
    { key: 'lyria_spec_v', value: '1' },
    { key: 'duration_s', value: '30' },
    { key: 'instrumental', value: '1' },
    { key: 'constraints', value: CONSTRAINTS_FULL },
    { key: 'genre_family', value: genreFamily(payload.genre) },
    { key: 'tempo_class', value: tokenToSnake(tempoBucket(bpm)) },
    { key: 'bpm', value: String(Math.round(bpm)) },
    { key: 'density_ctrl', value: tokenToSnake(densityBucket(density)) },
    { key: 'tension_ctrl', value: tokenToSnake(tensionBucket(tension)) },
    { key: 'emphasis', value: emphasisBucket(motifRate, rhythmTemplateId) },
    { key: 'brightness', value: tokenToSnake(brightnessBucket(0.5)) },
    { key: 'tonal', value: 'tonal_balanced' },
    { key: 'element_primary', value: 'water' },
    { key: 'element_secondary', value: 'none' },
    { key: 'arc', value: 'cyclic' },
    { key: 'energy', value: 'stable' },
    { key: 'peak', value: 'mid' },
    { key: 'ending', value: 'open' },
    { key: 'density_profile', value: 'stable' },
    { key: 'rhythm_drive', value: 'steady_rhythmic_flow' },
    { key: 'syncopation', value: 'rhythm_syncopated_medium' },
    { key: 'harmonic', value: 'harmonic_modal_balanced' },
    { key: 'harmonic_secondary', value: 'harmonic_medium_tension' },
    { key: 'rhythm_groove', value: 'rhythm_drive_medium' },
    { key: 'register_texture', value: 'texture_wide_blended' },
    { key: 'register_brightness', value: 'register_balanced_mid_center' },
    { key: 'stellium_active', value: '0' },
    { key: 'stellium_element', value: 'none' },
    { key: 'angular_houses', value: 'none' },
    { key: 'luminary', value: 'balanced' },
    { key: 'aspects_trine_heavy', value: '0' },
    { key: 'aspects_square_heavy', value: '0' },
    { key: 'aspects_opposition_heavy', value: '0' },
    { key: 'chart_identity_tags', value: 'luminary_balanced' },
    { key: 'facet_tags', value: 'none' },
  ];
}

function applyElisionAndLengthCap(rows: SpecRow[]): { text: string; truncated: boolean } {
  const mapFromRows = (r: SpecRow[]) => new Map(r.map((x) => [x.key, x.value]));
  const rebuild = (mp: Map<string, string>): SpecRow[] =>
    SPEC_KEY_ORDER.map((k) => ({ key: k, value: mp.get(k) ?? 'none' }));

  const m = mapFromRows(rows);
  let working = rebuild(m);
  let truncated = false;

  const lengthOf = (): number => rowsToPrompt(working).length;

  let text = rowsToPrompt(working);
  if (text.length <= LYRIA_MAX_PROMPT_CHARS) {
    return { text, truncated: false };
  }

  truncated = true;

  // 1) facet_tags → none
  m.set('facet_tags', 'none');
  working = rebuild(m);
  text = rowsToPrompt(working);
  if (text.length <= LYRIA_MAX_PROMPT_CHARS) {
    return { text, truncated: true };
  }

  // 2) trim chart_identity_tags by dropping tail tokens (pipe preserves lex sort order)
  const ciKey = 'chart_identity_tags';
  let parts = (m.get(ciKey) ?? 'none').split('|').filter(Boolean);
  while (parts.length > 0 && lengthOf() > LYRIA_MAX_PROMPT_CHARS) {
    parts = parts.slice(0, -1);
    m.set(ciKey, parts.length === 0 ? 'none' : parts.join('|'));
    working = rebuild(m);
  }
  text = rowsToPrompt(working);
  if (text.length <= LYRIA_MAX_PROMPT_CHARS) {
    return { text, truncated: true };
  }

  // 3) ELIDE_VALUE_NONE_KEYS in order (set value to none / 0 for aspect flags)
  for (const key of ELIDE_VALUE_NONE_KEYS) {
    if (text.length <= LYRIA_MAX_PROMPT_CHARS) break;
    if (key.startsWith('aspects_')) {
      m.set(key, '0');
    } else {
      m.set(key, 'none');
    }
    working = rebuild(m);
    text = rowsToPrompt(working);
  }
  if (text.length <= LYRIA_MAX_PROMPT_CHARS) {
    return { text, truncated: true };
  }

  // minimal safe: collapse to legacy-neutral single row set
  try {
    console.warn('[LYRIA_PROMPT_META]', JSON.stringify({ elision: 'minimal_safe' }));
  } catch {
    /* ignore */
  }

  const bpmVal = m.get('bpm') ?? '100';
  const genreVal = m.get('genre_family') ?? 'electronic';
  const tempoClass = m.get('tempo_class') ?? 'medium_tempo';
  const densityCtrl = m.get('density_ctrl') ?? 'moderate_density';
  const tensionCtrl = m.get('tension_ctrl') ?? 'medium_tension';
  const emphasisVal = m.get('emphasis') ?? 'balanced';

  const minimal: SpecRow[] = [
    { key: 'lyria_spec_v', value: '1' },
    { key: 'duration_s', value: '30' },
    { key: 'instrumental', value: '1' },
    { key: 'constraints', value: CONSTRAINTS_FULL },
    { key: 'genre_family', value: genreVal },
    { key: 'tempo_class', value: tempoClass },
    { key: 'bpm', value: bpmVal },
    { key: 'density_ctrl', value: densityCtrl },
    { key: 'tension_ctrl', value: tensionCtrl },
    { key: 'emphasis', value: emphasisVal },
    { key: 'brightness', value: 'balanced_tonality' },
    { key: 'tonal', value: 'tonal_balanced' },
    { key: 'element_primary', value: 'water' },
    { key: 'element_secondary', value: 'none' },
    { key: 'arc', value: 'cyclic' },
    { key: 'energy', value: 'stable' },
    { key: 'peak', value: 'mid' },
    { key: 'ending', value: 'open' },
    { key: 'density_profile', value: 'stable' },
    { key: 'rhythm_drive', value: 'steady_rhythmic_flow' },
    { key: 'syncopation', value: 'none' },
    { key: 'harmonic', value: 'none' },
    { key: 'harmonic_secondary', value: 'none' },
    { key: 'rhythm_groove', value: 'none' },
    { key: 'register_texture', value: 'none' },
    { key: 'register_brightness', value: 'none' },
    { key: 'stellium_active', value: '0' },
    { key: 'stellium_element', value: 'none' },
    { key: 'angular_houses', value: 'none' },
    { key: 'luminary', value: 'balanced' },
    { key: 'aspects_trine_heavy', value: '0' },
    { key: 'aspects_square_heavy', value: '0' },
    { key: 'aspects_opposition_heavy', value: '0' },
    { key: 'chart_identity_tags', value: 'none' },
    { key: 'facet_tags', value: 'none' },
  ];

  const minimalText = rowsToPrompt(minimal);
  if (minimalText.length > LYRIA_MAX_PROMPT_CHARS) {
    try {
      console.warn('[LYRIA_PROMPT_META]', JSON.stringify({ elision: 'minimal_safe_still_overflow', length: minimalText.length }));
    } catch {
      /* ignore */
    }
  }
  return { text: minimalText, truncated: true };
}

function logLyriaPromptMeta(length: number, keyCount: number, truncated: boolean): void {
  try {
    console.log(
      '[LYRIA_PROMPT_META]',
      JSON.stringify({
        length,
        key_count: keyCount,
        truncated,
        limit: LYRIA_MAX_PROMPT_CHARS,
      })
    );
  } catch {
    /* logging must never break prompt build */
  }
}

/**
 * Build Lyria prompt: deterministic `lyria_spec_v1` key=value lines (no prose).
 */
export function buildLyriaPrompt(
  payload: ControlSurfacePayload,
  plan?: Plan | { bpm?: number; key?: string },
  narrative?: CompositionNarrativePlan,
  lyriaPromptProfile: LyriaPromptProfile = 'default'
): string {
  let rows = narrative
    ? buildLyriaSpecRowsFromNarrative(payload, plan, narrative)
    : buildLyriaSpecRowsLegacy(payload, plan);

  if (lyriaPromptProfile === 'aggregate_relational_weather_v1') {
    rows = collapseRelationalWeatherLyriaTagBuckets(rows);
  }

  const { text, truncated } = applyElisionAndLengthCap(rows);
  logLyriaPromptMeta(text.length, SPEC_KEY_ORDER.length, truncated);
  return text;
}
