import type { ControlSurfacePayload } from '../explainer/contracts';
import type { Plan } from '../contracts';
import type { CompositionNarrativePlan } from '../audio/composition-narrative';

/**
 * Internal audio pipeline audit (Lyria prompt surface)
 *
 * - Current Feature Fields: control surface payload exposes arc_shape, density_level, tempo_norm,
 *   step_bias, leap_cap, rhythm_template_id, syncopation_bias, motif_rate, element_dominance,
 *   aspect_tension, modality and genre; plan contributes bpm and key only.
 * - Current Prompt Structure: BASE_SAFE_PROMPT (30s, instrumental, no vocals) plus deterministic
 *   distilled tags and short phrases ordered canonically for Lyria.
 * - Duration Handling: compose pipeline and providers are pinned to DEFAULT_DURATION_S (30s);
 *   prompt text already specifies "30 second instrumental track" with no explicit section timing.
 * - Section Logic: musical sections and arc (Encounter/Recognition/Integration) are planned inside
 *   the v6 narrative planner; provider-facing prompt now carries a compact arc summary instead of
 *   long-form prose.
 * - Elemental Mapping: element_dominance and narrative signatures map to short instrumentation and
 *   mood descriptors rather than paragraphs of symbolic commentary.
 */

const BASE_SAFE_PROMPT =
  'Generate a 30 second instrumental track. Focus on original sound design, evolving rhythm, and clear musical development. No vocals, no spoken word, no lyrics. Avoid recognizable melodies or famous motifs so the composition remains clearly original. Do not imitate, continue, or recreate any existing song, recording, or melody; compose entirely new material.';
const LYRIA_MAX_PROMPT_CHARS = 1800;

/** Fixed ending instruction appended in narrative path; space for this is reserved before reduction. */
const ENDING_GUARD = ' End with a clear resolved landing; no abrupt cutoff.';

/**
 * Phase timing aligned with planner (Encounter 4 bars, Recognition 8, Integration 4; 16 bars, 30s).
 * 30/16 = 1.875 s/bar → opening 0-7.5s, development 7.5-22.5s, resolution 22.5-30s. Rounded for prompt.
 */
const PHASE_OPENING_END_S = 8;
const PHASE_DEVELOPMENT_END_S = 22;
const PHASE_RESOLUTION_END_S = 30;

/** Compact three-phase structure for Lyria derived from planner Encounter/Recognition/Integration. Reserved for future use; not included in provider prompt body. */
function buildPlannerPhaseStructureSentence(): string {
  return `Structure over 30s: opening 0–${PHASE_OPENING_END_S}s introduce motif and space, development ${PHASE_OPENING_END_S}–${PHASE_DEVELOPMENT_END_S}s build motion and tension, resolution ${PHASE_DEVELOPMENT_END_S}–${PHASE_RESOLUTION_END_S}s reach a clear harmonic cadence and final landing.`;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function deriveModalColor(
  narrative: CompositionNarrativePlan,
  plan?: Plan | { key?: string }
): { label: string; tag: string } {
  const key = (plan && (plan as any).key) as string | undefined;
  const lower = key ? key.toLowerCase() : '';
  const isMinor = lower.includes('minor');
  const isMajor = lower.includes('major');

  let mode: 'major' | 'minor' | 'ambiguous' = 'ambiguous';
  if (isMinor && !isMajor) mode = 'minor';
  else if (isMajor && !isMinor) mode = 'major';

  const polarity = narrative.tonalPolarity;

  if (mode === 'minor') {
    if (polarity === 'bright') {
      return {
        label:
          'Treat the key as minor but with a slightly luminous, modal edge (think dorian/lydian inflections rather than pure darkness).',
        tag: 'harmonic-minor-bright-modal',
      };
    }
    if (polarity === 'dark') {
      return {
        label:
          'Keep harmony clearly minor-leaning, with enough tension tones to feel emotionally charged but not bleak.',
        tag: 'harmonic-minor-shadowed',
      };
    }
    return {
      label:
        'Let the minor center feel balanced—neither overly bright nor relentlessly dark—using a mix of stable triads and a few color tones.',
      tag: 'harmonic-minor-balanced',
    };
  }

  if (mode === 'major') {
    if (polarity === 'bright') {
      return {
        label:
          'Keep the harmony broadly major-leaning and optimistic, with occasional extended chords for sophistication.',
        tag: 'harmonic-major-open',
      };
    }
    if (polarity === 'dark') {
      return {
        label:
          'Use a major center but allow more suspended and added-tone chords so it feels reflective rather than simply cheerful.',
        tag: 'harmonic-major-with-suspensions',
      };
    }
    return {
      label:
        'Let the harmony pivot between major color and more neutral or suspended sonorities to stay emotionally balanced.',
      tag: 'harmonic-major-balanced',
    };
  }

  // Ambiguous / mode-neutral
  if (polarity === 'bright') {
    return {
      label:
        'Allow the harmony to feel modality-rich rather than strictly major/minor—favoring open, spacious voicings with some bright color tones.',
      tag: 'harmonic-modal-bright',
    };
  }
  if (polarity === 'dark') {
    return {
      label:
        'Treat the harmony as subtly modal and introspective, with more suspended and minor color tones than simple triads.',
      tag: 'harmonic-modal-shadowed',
    };
  }
  return {
    label:
      'Keep the harmonic language gently modal, mixing stable triads with a few extensions and suspensions so the color can tilt either way.',
    tag: 'harmonic-modal-balanced',
  };
}

function deriveHarmonicBehavior(
  narrative: CompositionNarrativePlan,
  payload: ControlSurfacePayload,
  plan?: Plan | { key?: string }
): { sentence: string; tags: string[] } {
  const tensionSignal = clamp01(narrative.tensionIndex);
  const aspectTension =
    typeof payload.aspect_tension === 'number'
      ? clamp01(payload.aspect_tension)
      : tensionSignal;
  const harmonicTension = clamp01(0.6 * tensionSignal + 0.4 * aspectTension);
  const resolutionStrength = clamp01(narrative.resolutionIndex);

  let tensionLabel: string;
  let tensionTag: string;
  if (harmonicTension <= 0.33) {
    tensionLabel =
      'keep harmonic tension relatively low overall, relying more on consonant intervals and gentle color tones than on sharp dissonances';
    tensionTag = 'harmonic-low-tension';
  } else if (harmonicTension >= 0.67) {
    tensionLabel =
      'allow a noticeable amount of harmonic tension through extensions, non-chord tones, and occasional clashes that resolve with intention';
    tensionTag = 'harmonic-high-tension';
  } else {
    tensionLabel =
      'maintain a moderate level of harmonic tension, with clear moments of rest balanced by a few more charged sonorities';
    tensionTag = 'harmonic-medium-tension';
  }

  let cadenceLabel: string;
  let cadenceTag: string;
  if (resolutionStrength >= 0.67) {
    cadenceLabel =
      'cadences near the ending should feel clear and grounded, with a strong sense of arrival on the home center';
    cadenceTag = 'cadence-strong-resolution';
  } else if (resolutionStrength <= 0.33) {
    cadenceLabel =
      'avoid overly strong perfect cadences; instead, let endings hover on suspended or gently unresolved chords';
    cadenceTag = 'cadence-soft-or-open';
  } else {
    cadenceLabel =
      'use a mix of softer and clearer cadences so that the piece can breathe before settling near the end';
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
      0.5 * (typeof (payload as any).density_level === 'number'
        ? (payload as any).density_level
        : chordDensitySignal)
  );

  let chordDensityLabel: string;
  let chordDensityTag: string;
  if (densityControl <= 0.33) {
    chordDensityLabel =
      'Keep chord voicings relatively lean—triads or light seventh chords—with only a few extra extensions in the peak section.';
    chordDensityTag = 'chord-density-lean';
  } else if (densityControl >= 0.67) {
    chordDensityLabel =
      'Allow richer chord voicings with added tones, gentle clusters, or layered pads, especially through the development and peak.';
    chordDensityTag = 'chord-density-rich';
  } else {
    chordDensityLabel =
      'Use medium-density voicings: mostly simple chords with selective extensions to highlight key moments.';
    chordDensityTag = 'chord-density-medium';
  }

  const sentence = `Harmonic behavior: ${modal.label} Within that frame, ${tensionLabel}, and ${cadenceLabel}. ${chordDensityLabel}`;

  return {
    sentence,
    tags: [modal.tag, tensionTag, cadenceTag, chordDensityTag],
  };
}

function deriveRhythmicCharacter(
  narrative: CompositionNarrativePlan,
  payload: ControlSurfacePayload
): { sentence: string; tags: string[] } {
  const drive = clamp01(narrative.rhythmicDrive);
  const { cardinal, fixed, mutable } = narrative.modalityBalance;
  const primaryModality =
    cardinal >= fixed && cardinal >= mutable
      ? 'cardinal'
      : fixed >= mutable
        ? 'fixed'
        : 'mutable';

  let grooveDescriptor: string;
  let intensityTag: string;
  if (drive >= 0.67) {
    grooveDescriptor =
      'Rhythm should have a clearly articulated, forward-driving groove with a confident pulse that stays musical rather than aggressive.';
    intensityTag = 'rhythm-drive-strong';
  } else if (drive <= 0.33) {
    grooveDescriptor =
      'Rhythm should feel gentle and supportive, giving plenty of room for harmony and texture without losing a sense of pulse.';
    intensityTag = 'rhythm-drive-soft';
  } else {
    grooveDescriptor =
      'Rhythm should provide a steady, present groove that supports melody and texture without dominating them.';
    intensityTag = 'rhythm-drive-medium';
  }

  let modalityLine: string;
  let modalityTag: string;
  if (primaryModality === 'cardinal') {
    modalityLine =
      'Accent the downbeats slightly and let transitions between sections feel like intentional pushes forward rather than resets.';
    modalityTag = 'rhythm-cardinal-pulse';
  } else if (primaryModality === 'fixed') {
    modalityLine =
      'Favor a stable, repeating groove with subtle micro-variations, so the listener feels a strong foundation under the arc.';
    modalityTag = 'rhythm-fixed-groove';
  } else {
    modalityLine =
      'Introduce more variation and occasional syncopation, especially in the development, so the groove feels flexible and adaptive.';
    modalityTag = 'rhythm-mutable-variation';
  }

  const syncBias =
    typeof (payload as any).syncopation_bias === 'number'
      ? clamp01((payload as any).syncopation_bias)
      : 0.5;
  let syncLine: string;
  let syncTag: string;
  if (syncBias >= 0.67) {
    syncLine =
      'Allow noticeable syncopation in percussion and supporting parts, especially around the peak, while keeping the core pulse intelligible.';
    syncTag = 'rhythm-syncopated-strong';
  } else if (syncBias <= 0.33) {
    syncLine =
      'Keep syncopation subtle; most accents should sit close to the grid so the feel remains smooth and grounded.';
    syncTag = 'rhythm-syncopated-soft';
  } else {
    syncLine =
      'Use moderate syncopation—enough to keep the groove alive but not so much that the pulse becomes obscured.';
    syncTag = 'rhythm-syncopated-medium';
  }

  const sentence = `${grooveDescriptor} ${modalityLine} ${syncLine}`;

  return {
    sentence,
    tags: [intensityTag, modalityTag, syncTag],
  };
}

function deriveRegisterAndInstrumentation(
  narrative: CompositionNarrativePlan,
  payload: ControlSurfacePayload
): { sentence: string; tags: string[] } {
  const primary = narrative.primaryElement;
  const secondary = narrative.secondaryElement;
  const brightness = clamp01(narrative.brightnessIndex);
  const isBright = brightness >= 0.65;
  const isDark = brightness <= 0.35;

  let melodicRegister: 'low' | 'mid' | 'high';
  if (isBright || primary === 'air' || primary === 'fire') {
    melodicRegister = 'high';
  } else if (primary === 'earth') {
    melodicRegister = 'mid';
  } else {
    melodicRegister = 'mid';
  }

  let harmonyRegister: 'low' | 'mid' | 'wide';
  if (primary === 'earth') {
    harmonyRegister = 'low';
  } else if (primary === 'water') {
    harmonyRegister = 'wide';
  } else {
    harmonyRegister = 'mid';
  }

  let leadFamily: string;
  let harmonyFamily: string;
  let percussionFamily: string;

  if (primary === 'fire') {
    leadFamily =
      'brighter, slightly percussive synth leads or plucked instruments that can cut through the mix.';
    harmonyFamily =
      'supporting harmonic layers that stay relatively lean rather than heavy orchestral pads.';
    percussionFamily =
      'clear, punchy drums with crisp transients and a present high-frequency layer (hats, shakers).';
  } else if (primary === 'earth') {
    leadFamily =
      'weightier melodic instruments—warm synths, electric pianos, or lower-register leads with solid body.';
    harmonyFamily =
      'thicker pads and chordal textures that reinforce the low-mid range and feel grounded.';
    percussionFamily =
      'steady, rounded drums with a strong kick/bass relationship rather than hyper-detailed tops.';
  } else if (primary === 'air') {
    leadFamily =
      'lighter, agile melodic instruments in a higher register—flutes, bells, or airy synth leads with clear articulation.';
    harmonyFamily =
      'light to medium-weight pads that leave space around the melody and emphasize openness.';
    percussionFamily =
      'delicate but articulated percussion: ticks, soft claps, and subtle high-frequency patterns.';
  } else {
    // water
    leadFamily =
      'soft-attack melodic voices—bows, vocal-like synths, or smooth keys—with gentle onset and expressive sustain.';
    harmonyFamily =
      'sustained, blended pads with long releases and a sense of liquid continuity between chords.';
    percussionFamily =
      'softer, rounded percussion with smoothed transients and more emphasis on swells than on sharp attacks.';
  }

  if (secondary === 'fire') {
    leadFamily +=
      ' Add a few fire-like accent gestures (quick runs or stabs) to underline peak moments.';
  } else if (secondary === 'earth') {
    harmonyFamily +=
      ' Let a secondary earth influence reinforce bass or low-mid layers so the track never feels weightless.';
  } else if (secondary === 'air') {
    leadFamily +=
      ' Let a secondary air influence introduce small filigree lines or counter-melodies in the upper register.';
  } else if (secondary === 'water') {
    harmonyFamily +=
      ' A secondary water influence can show up as extra reverb, chorus, or gentle modulation, helping layers melt together.';
  }

  let registerSentence: string;
  if (melodicRegister === 'high' && harmonyRegister === 'low') {
    registerSentence =
      'Keep melody mostly in the upper-mid to high register while anchoring harmony and bass clearly in the low range.';
  } else if (melodicRegister === 'high' && harmonyRegister === 'wide') {
    registerSentence =
      'Let melody sit high while harmony stretches across low and mid registers, creating a wide, immersive field.';
  } else if (melodicRegister === 'mid' && harmonyRegister === 'low') {
    registerSentence =
      'Center melody in the mid register with strong low anchors and only occasional high ornamentation.';
  } else if (harmonyRegister === 'wide') {
    registerSentence =
      'Distribute harmony across low, mid, and some high support voices so the piece feels spacious but not hollow.';
  } else {
    registerSentence =
      'Keep melody and harmony mostly in the mid register, with bass clearly defined and high content used for detail rather than constant brightness.';
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

  const sentence = `Register and texture: ${registerSentence} For instrumentation, favor ${leadFamily} Use ${harmonyFamily} Underpin this with ${percussionFamily}`;

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

  return { sentence, tags };
}

function deriveChartIdentityBehavior(
  narrative: CompositionNarrativePlan
): { sentence: string; tags: string[] } {
  const parts: string[] = [];
  const tags: string[] = [];

  const stellium = narrative.stellium;
  if (stellium?.hasCluster) {
    const el = stellium.element ?? narrative.primaryElement;
    if (el === 'fire') {
      parts.push(
        'Because the chart carries a clustered, fire-leaning signature, treat the main motif as a strong fingerprint: repeat it clearly and let variations become more animated through the development and peak, with extra rhythmic intensity rather than drift.'
      );
      tags.push('stellium-fire-motif-strong', 'stellium-fire-rhythm-intense');
    } else if (el === 'earth') {
      parts.push(
        'A clustered earth signature should show up as layered harmonic weight: build thicker chord stacks and low-end reinforcement in the middle of the piece, then release that weight deliberately near the end.'
      );
      tags.push('stellium-earth-harmony-heavy', 'stellium-earth-bass-strong');
    } else if (el === 'air') {
      parts.push(
        'An air-oriented cluster calls for quicker, more agile melodic motion with interlocking figures, especially between 6–18 seconds, so the identity feels intricate rather than static.'
      );
      tags.push('stellium-air-melody-agile', 'stellium-air-interlocking-lines');
    } else {
      parts.push(
        'A water-oriented cluster should be expressed as overlapping sustained harmonies and swells, with voices weaving in and out so the texture feels fluid and continuous.'
      );
      tags.push('stellium-water-sustained', 'stellium-water-overlapping-pads');
    }
  }

  const angular = narrative.angularDominance;
  if (angular) {
    if (angular.first) {
      parts.push(
        'If there is a first-house emphasis, let the opening bars state a clear rhythmic and melodic identity, as if the track is confidently announcing itself in the first few seconds.'
      );
      tags.push('angle-1st-strong-intro', 'angle-1st-rhythm-assertive');
    }
    if (angular.fourth) {
      parts.push(
        'A fourth-house emphasis should be reflected as deeper bass anchors and thicker harmonic beds that feel like “home base” whenever they return.'
      );
      tags.push('angle-4th-deep-bass', 'angle-4th-harmonic-bed');
    }
    if (angular.seventh) {
      parts.push(
        'Seventh-house emphasis is best expressed as call-and-response: let two melodic or textural voices trade phrases, especially through the middle section.'
      );
      tags.push('angle-7th-call-response', 'angle-7th-dual-voices');
    }
    if (angular.tenth) {
      parts.push(
        'With tenth-house strength, shape a particularly clear arrival near the 18–26 second peak and a decisive cadence into the final seconds, as if the track is stepping into focus.'
      );
      tags.push('angle-10th-strong-peak', 'angle-10th-clear-cadence');
    }
  }

  const lum = narrative.luminaryDominance;
  if (lum === 'sun') {
    parts.push(
      'When the Sun is dominant, keep one bright, central melodic voice in focus and allow cadences to feel confident and direct, as if everything orbits that line.'
    );
    tags.push('luminary-sun-dominant', 'melody-central-solar');
  } else if (lum === 'moon') {
    parts.push(
      'When the Moon dominates, favor more fluid phrasing, gentle dynamic swells, and softer harmonic transitions, so the track feels like a continuous emotional tide.'
    );
    tags.push('luminary-moon-dominant', 'dynamics-fluid-lunar');
  } else {
    tags.push('luminary-balanced');
  }

  const planets = narrative.planetarySignatures;
  if (planets) {
    if (planets.mars) {
      parts.push(
        'Mars strength should come through as sharper rhythmic attacks, more active percussion figures, and quicker motif articulations—especially around the peak.'
      );
      tags.push('planet-mars-strong', 'attack-sharp', 'percussion-active');
    }
    if (planets.venus) {
      parts.push(
        'Venus strength suggests smoother melodic contours, legato connections between notes, and harmonies that tilt toward consonance and richness rather than raw crunch.'
      );
      tags.push('planet-venus-strong', 'melody-smooth', 'harmony-lush');
    }
    if (planets.jupiter) {
      parts.push(
        'Jupiter prominence favors slightly wider melodic intervals and more expansive harmonic spacing, so the track feels open and generous rather than cramped.'
      );
      tags.push('planet-jupiter-strong', 'melody-wide-intervals', 'harmony-wide-spaced');
    }
    if (planets.saturn) {
      parts.push(
        'Saturn strength should appear as restrained pacing: simpler, well-defined motifs that repeat with intention, and a groove that feels stable rather than restless.'
      );
      tags.push('planet-saturn-strong', 'pacing-restrained', 'motif-simple-repeated');
    }
    if (planets.pluto) {
      parts.push(
        'Pluto emphasis points to deeper tonal gravity and more dramatic tension arcs—allow darker modal inflections and slightly longer builds into and out of the peak without becoming cinematic.'
      );
      tags.push('planet-pluto-strong', 'gravity-deep', 'tension-arc-dramatic');
    }
  }

  const aspects = narrative.aspectSignatures;
  if (aspects) {
    if (aspects.trineHeavy) {
      parts.push(
        'If the chart leans heavily on trines, let harmonic motion feel especially smooth and flowing, with voice-leading that glides rather than jumps.'
      );
      tags.push('aspects-trine-heavy', 'harmony-smooth-flowing');
    }
    if (aspects.squareHeavy) {
      parts.push(
        'When many squares are present, allow for a bit more harmonic grit—moments of tension, accented dissonances, or rhythmic friction that resolve deliberately.'
      );
      tags.push('aspects-square-heavy', 'harmony-gritty', 'tension-accented');
    }
    if (aspects.oppositionHeavy) {
      parts.push(
        'Opposition clusters can be expressed as musical dialogue: alternate gestures between registers or instrument groups so ideas seem to answer each other.'
      );
      tags.push('aspects-opposition-heavy', 'gesture-alternation', 'register-dialogue');
    }
  }

  const sentence = parts.length
    ? `Chart identity: ${parts.join(' ')}`
    : '';

  return { sentence, tags };
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

/**
 * Build Lyria prompt: rich internal description → compact, deterministic provider prompt.
 */
export function buildLyriaPrompt(
  payload: ControlSurfacePayload,
  plan?: Plan | { bpm?: number; key?: string },
  narrative?: CompositionNarrativePlan
): string {
  const tempoNorm = typeof payload.tempo_norm === 'number' ? payload.tempo_norm : 0.5;
  const density = typeof payload.density_level === 'number' ? payload.density_level : 0.5;
  const tension = typeof payload.aspect_tension === 'number' ? payload.aspect_tension : 0.5;
  const motifRate = typeof payload.motif_rate === 'number' ? payload.motif_rate : 0.5;
  const rhythmTemplateId = typeof payload.rhythm_template_id === 'number' ? payload.rhythm_template_id : 0;

  const bpm = plan && typeof (plan as Plan).bpm === 'number' ? (plan as Plan).bpm : Math.round(90 + tempoNorm * 60);
  const baseTags: string[] = [
    tempoBucket(bpm),
    densityBucket(density),
    tensionBucket(tension),
    emphasisBucket(motifRate, rhythmTemplateId),
    genreFamily(payload.genre),
  ];

  if (!narrative) {
    const legacyTags = [...baseTags, brightnessBucket(0.5)];
    const prompt = `${BASE_SAFE_PROMPT} Tags: ${legacyTags.join(', ')}.`;
    const finalPrompt = enforcePromptLength(prompt, {
      distilled: false,
      source: 'legacy-no-narrative',
      tagCount: legacyTags.length,
    });
    return finalPrompt;
  }

  const arcTags: string[] = [
    `arc-${narrative.arcShape}`,
    `energy-${narrative.energyCurve}`,
    `peak-${narrative.peakWindow}`,
    `ending-${narrative.endingStyle}`,
  ];

  const elementTags: string[] = [
    `element-${narrative.primaryElement}`,
    narrative.secondaryElement ? `secondary-${narrative.secondaryElement}` : '',
  ].filter(Boolean);

  const tonalTag = `tonal-${narrative.tonalPolarity}`;

  const brightnessTag = brightnessBucket(narrative.brightnessIndex);

  const modalityTags = [
    narrative.modalityBalance.cardinal > 0.45 ? 'cardinal-pulse' : '',
    narrative.modalityBalance.fixed > 0.45 ? 'fixed-grounded' : '',
    narrative.modalityBalance.mutable > 0.45 ? 'mutable-shift' : '',
  ].filter(Boolean);

  const densityProfileTag = `density-${narrative.densityProfile}`;
  const rhythmicDriveTag =
    narrative.rhythmicDrive >= 0.66
      ? 'strong-rhythmic-drive'
      : narrative.rhythmicDrive <= 0.33
        ? 'gentle-rhythmic-motion'
        : 'steady-rhythmic-flow';

  const harmonic = deriveHarmonicBehavior(narrative, payload, plan);
  const rhythmicDetail = deriveRhythmicCharacter(narrative, payload);
  const registerAndInstr = deriveRegisterAndInstrumentation(narrative, payload);
  const chartIdentity = deriveChartIdentityBehavior(narrative);

  const tags: string[] = [
    ...baseTags,
    brightnessTag,
    tonalTag,
    ...elementTags,
    ...arcTags,
    // Select a small, high-value subset of behavior/register tags for diversity.
    harmonic.tags[0],
    harmonic.tags[1],
    rhythmicDetail.tags[0],
    registerAndInstr.tags[0],
  ].filter(Boolean);

  // Stage A (internal description) is captured in the rich tags and narrative-derived helpers above.
  // Stage B: distill to a compact, canonical provider-facing prompt with a hard length guard.

  const primaryMood =
    narrative.tonalPolarity === 'bright'
      ? 'bright and open'
      : narrative.tonalPolarity === 'dark'
        ? 'shadowed and introspective'
        : 'balanced and nuanced';

  const brightnessLabel =
    brightnessTag === 'soft-tonality'
      ? 'soft edges'
      : brightnessTag === 'vivid-tonality'
        ? 'vivid tone color'
        : 'balanced tone color';

  const elementLabel =
    narrative.primaryElement === 'fire'
      ? 'fire-forward energy'
      : narrative.primaryElement === 'earth'
        ? 'grounded earth weight'
        : narrative.primaryElement === 'air'
          ? 'light, agile air motion'
          : 'fluid water texture';

  const secondaryElementLabel = narrative.secondaryElement
    ? narrative.secondaryElement === 'fire'
      ? 'fire as a secondary accent'
      : narrative.secondaryElement === 'earth'
        ? 'earth reinforcing the low-end'
        : narrative.secondaryElement === 'air'
          ? 'air adding melodic sparkle'
          : 'water softening transitions'
    : '';

  const moodSentence = secondaryElementLabel
    ? `Overall mood: ${primaryMood} ${genreFamily(payload.genre)} instrumental with ${elementLabel} and ${secondaryElementLabel}.`
    : `Overall mood: ${primaryMood} ${genreFamily(payload.genre)} instrumental with ${elementLabel}.`;

  const energySentence = `Energy arc: ${narrative.arcShape} shape with ${narrative.energyCurve} energy curve and ${narrative.densityProfile} density over 30 seconds.`;

  const rhythmicDriveLabel =
    rhythmicDriveTag === 'strong-rhythmic-drive'
      ? 'strong rhythmic drive'
      : rhythmicDriveTag === 'gentle-rhythmic-motion'
        ? 'gentle supporting motion'
        : 'steady supporting groove';

  const emphasis = emphasisBucket(motifRate, rhythmTemplateId);
  const rhythmSentence = `Rhythm: ${tempoBucket(bpm)} (~${bpm} BPM), ${rhythmicDriveLabel}, ${emphasis}-forward phrasing with syncopation set by controls.`;

  const textureSentence = `Texture: ${densityBucket(density)} layers with ${brightnessLabel}, using register and instrumentation chosen from the chart-derived narrative.`;

  const endingLabel =
    narrative.endingStyle === 'resolved'
      ? 'clear resolved landing'
      : narrative.endingStyle === 'suspended'
        ? 'suspended open landing'
        : narrative.endingStyle === 'dissipating'
          ? 'dissipating tail'
          : narrative.endingStyle === 'triumphant'
            ? 'small triumphant peak then release'
            : 'gentle open tail';

  const structureSentence = `Structure: intro, development, peak, and ending are aligned with a ${narrative.arcShape} arc and a ${endingLabel} in the final seconds.`;

  const astroBits: string[] = [];
  if (narrative.stellium?.hasCluster) {
    astroBits.push(`stellium emphasis in ${narrative.stellium.element || narrative.primaryElement}`);
  }
  if (narrative.angularDominance) {
    const angles: string[] = [];
    if (narrative.angularDominance.first) angles.push('1st');
    if (narrative.angularDominance.fourth) angles.push('4th');
    if (narrative.angularDominance.seventh) angles.push('7th');
    if (narrative.angularDominance.tenth) angles.push('10th');
    if (angles.length) astroBits.push(`angular focus around houses ${angles.join('/')}`);
  }
  if (narrative.luminaryDominance && narrative.luminaryDominance !== 'balanced') {
    astroBits.push(`${narrative.luminaryDominance}-dominated luminary tone`);
  }

  const astroSentence = '';

  const orderedTags: string[] = [
    // Core control-surface dimensions
    tempoBucket(bpm),
    densityBucket(density),
    tensionBucket(tension),
    emphasisBucket(motifRate, rhythmTemplateId),
    genreFamily(payload.genre),
    // One brightness / tonal slot
    brightnessTag,
    tonalTag,
    // Primary / secondary element
    ...elementTags,
    // One coarse harmonic cue
    harmonic.tags[0],
    // One coarse rhythmic/register cue
    rhythmicDriveTag,
    registerAndInstr.tags[0],
  ].filter(Boolean);

  // Reserve space for ending guard so the final prompt never exceeds LYRIA_MAX_PROMPT_CHARS.
  const maxCharsForBody = LYRIA_MAX_PROMPT_CHARS - ENDING_GUARD.length;
  const { prompt, meta } = buildDistilledPrompt(
    {
      orderedTags,
      moodSentence,
      energySentence,
      rhythmSentence,
      textureSentence,
      structureSentence,
      astroSentence,
    },
    maxCharsForBody
  );

  const promptWithGuard = prompt + ENDING_GUARD;
  const finalPrompt = enforcePromptLength(promptWithGuard, {
    distilled: true,
    source: 'narrative',
    tagCount: meta.tagsUsed,
    segmentsDropped: meta.segmentsDropped,
    hardTrimApplied: meta.hardTrimApplied,
    endingGuardApplied: true,
    phaseStructureIncluded: false,
  });

  return finalPrompt;
}

interface DistilledPromptInput {
  orderedTags: string[];
  /** Planner-derived three-phase structure (high priority; placed after base so it survives reduction). */
  phaseStructureSentence?: string;
  moodSentence: string;
  energySentence: string;
  rhythmSentence: string;
  textureSentence: string;
  structureSentence: string;
  astroSentence: string;
}

interface DistilledPromptMeta {
  tagsUsed: number;
  segmentsDropped: number;
  hardTrimApplied: boolean;
}

function buildDistilledPrompt(
  input: DistilledPromptInput,
  maxChars: number = LYRIA_MAX_PROMPT_CHARS
): { prompt: string; meta: DistilledPromptMeta } {
  const base = BASE_SAFE_PROMPT;

  // Order: base first (never dropped), then mood/energy/rhythm/texture/structure (dropped last-to-first), then astro (dropped first).
  const segments: string[] = [base];
  segments.push(
    input.moodSentence,
    input.energySentence,
    input.rhythmSentence,
    input.textureSentence,
    input.structureSentence
  );
  if (input.astroSentence) {
    segments.push(input.astroSentence);
  }

  let tagCap = Math.min(input.orderedTags.length, 10);
  let hardTrimApplied = false;

  const buildWithCap = (cap: number, currentSegments: string[]): { text: string; tagsUsed: number } => {
    const tags = input.orderedTags.slice(0, cap);
    const tagSentence = tags.length ? `Tags: ${tags.join(', ')}.` : '';
    const allSegments = tagSentence ? [...currentSegments, tagSentence] : [...currentSegments];
    const text = allSegments.join(' ');
    return { text, tagsUsed: tags.length };
  };

  let workingSegments = [...segments];
  let tagsUsed = 0;
  let segmentsDropped = 0;

  let { text } = buildWithCap(tagCap, workingSegments);
  if (text.length > maxChars) {
    const tagCaps = [8, 6, 4];
    let found = false;
    for (const cap of tagCaps) {
      if (cap <= 0) continue;
      const attempt = buildWithCap(Math.min(cap, tagCap), workingSegments);
      if (attempt.text.length <= maxChars) {
        text = attempt.text;
        tagCap = Math.min(cap, tagCap);
        tagsUsed = attempt.tagsUsed;
        found = true;
        break;
      }
    }
    if (!found) {
      tagCap = Math.min(6, tagCap);
      const attempt = buildWithCap(tagCap, workingSegments);
      text = attempt.text;
      tagsUsed = attempt.tagsUsed;
    }
  } else {
    const attempt = buildWithCap(tagCap, workingSegments);
    text = attempt.text;
    tagsUsed = attempt.tagsUsed;
  }

  while (text.length > maxChars && workingSegments.length > 1) {
    workingSegments.pop();
    segmentsDropped++;
    const attempt = buildWithCap(tagCap, workingSegments);
    text = attempt.text;
    tagsUsed = attempt.tagsUsed;
  }

  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
    hardTrimApplied = true;
  }

  return {
    prompt: text,
    meta: {
      tagsUsed,
      segmentsDropped,
      hardTrimApplied,
    },
  };
}

interface PromptLengthMeta {
  distilled: boolean;
  source: 'legacy-no-narrative' | 'narrative';
  tagCount: number;
  segmentsDropped?: number;
  hardTrimApplied?: boolean;
  /** True when narrative path appended the protected ending guard. */
  endingGuardApplied?: boolean;
  /** True when prompt includes planner-derived three-phase structure. */
  phaseStructureIncluded?: boolean;
}

function enforcePromptLength(prompt: string, meta: PromptLengthMeta): string {
  let finalPrompt = prompt;
  let hardTrimApplied = !!meta.hardTrimApplied;

  if (finalPrompt.length > LYRIA_MAX_PROMPT_CHARS) {
    finalPrompt = finalPrompt.slice(0, LYRIA_MAX_PROMPT_CHARS);
    hardTrimApplied = true;
  }

  try {
    console.log(
      '[LYRIA_PROMPT_META]',
      JSON.stringify({
        length: finalPrompt.length,
        limit: LYRIA_MAX_PROMPT_CHARS,
        distilled: meta.distilled,
        source: meta.source,
        tagCount: meta.tagCount,
        segmentsDropped: meta.segmentsDropped ?? 0,
        hardTrimApplied,
        endingGuardApplied: meta.endingGuardApplied ?? false,
        phaseStructureIncluded: meta.phaseStructureIncluded ?? false,
      })
    );
  } catch {
    // logging must never interfere with prompt construction
  }

  return finalPrompt;
}
