import type { ControlSurfacePayload } from '../explainer/contracts';
import type { Plan } from '../contracts';
import type { CompositionNarrativePlan } from '../audio/composition-narrative';

/**
 * Internal audio pipeline audit (Lyria prompt surface)
 *
 * - Current Feature Fields: control surface payload exposes arc_shape, density_level, tempo_norm,
 *   step_bias, leap_cap, rhythm_template_id, syncopation_bias, motif_rate, element_dominance,
 *   aspect_tension, modality and genre; plan contributes bpm and key only.
 * - Current Prompt Structure: BASE_SAFE_PROMPT (30s, instrumental, no vocals) plus 6 coarse tags:
 *   tempo bucket, density bucket, "brightness" bucket (previously tension-proxy), tension bucket,
 *   melodic vs rhythmic emphasis, and broad genre family (electronic/ambient/orchestral/jazz).
 * - Duration Handling: compose pipeline and providers are pinned to DEFAULT_DURATION_S (30s);
 *   prompt text already specifies "30 second instrumental track" with no explicit section timing.
 * - Section Logic: musical sections and arc (Encounter/Recognition/Integration) are planned inside
 *   the v6 narrative planner, but Lyria prompt previously carried no explicit intro/development/peak/
 *   resolution envelope or time-coded structure.
 * - Elemental Mapping: element_dominance influenced student controls and text atoms, but Lyria prompt
 *   only received generic tags; no dedicated elemental instrumentation, density, or pacing descriptors.
 */

const BASE_SAFE_PROMPT =
  'Generate a 30 second instrumental track. Focus on original sound design, evolving rhythm, and clear musical development. No vocals, no spoken word, no lyrics. Avoid recognizable melodies or famous motifs so the composition remains clearly original.';

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

  const sentence = `Harmonic behavior: ${modal.label} Within that frame, ${tensionLabel}, and ${cadenceLabel}. ${chordDensityLabel} Also, make sure there is no abrupt cutoff or hard stop at the end; let the final harmony feel like an intentional landing rather than a sudden drop.`;

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
 * Build Lyria prompt: safe base + up to 6 deterministic tags to avoid recitation blocks.
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
    return `${BASE_SAFE_PROMPT} Tags: ${legacyTags.join(', ')}.`;
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

  const tags: string[] = [
    ...baseTags,
    brightnessTag,
    tonalTag,
    densityProfileTag,
    rhythmicDriveTag,
     ...harmonic.tags,
     ...rhythmicDetail.tags,
     ...registerAndInstr.tags,
    ...elementTags,
    ...modalityTags,
    ...arcTags,
  ];

  const primaryElementPhrase =
    narrative.primaryElement === 'fire'
      ? 'forward rhythmic drive, bright harmonics, and a rising sense of momentum'
      : narrative.primaryElement === 'earth'
        ? 'grounded low-end, weighty harmony, and steady, patient pacing'
        : narrative.primaryElement === 'air'
          ? 'melodic motion in a higher register, light percussion, and agile phrasing'
          : 'sustained textures, gentle swells, and smoothly blended transitions';

  const secondaryElementPhrase = narrative.secondaryElement
    ? narrative.secondaryElement === 'fire'
      ? 'with subtle fire accents adding extra movement'
      : narrative.secondaryElement === 'earth'
        ? 'with earth underpinnings that keep the pulse anchored'
        : narrative.secondaryElement === 'air'
          ? 'with air details adding melodic spark and space'
          : 'with water inflections that soften edges and blur contours'
    : '';

  const tonalPhrase =
    narrative.tonalPolarity === 'bright'
      ? 'Keep the harmony generally bright and open, with occasional contrast for depth.'
      : narrative.tonalPolarity === 'dark'
        ? 'Use a warmer, more shadowed color palette without becoming oppressive or overly cinematic.'
        : 'Maintain a balanced tonal palette that can tilt warmer or cooler as the chart suggests, but never purely one-note.';

  const densityPhrase =
    narrative.densityProfile === 'sparse_to_full'
      ? 'Start with a relatively sparse texture and gradually introduce more layers and detail over time.'
      : narrative.densityProfile === 'full_to_sparse'
        ? 'Begin with a fuller texture and deliberately thin out layers toward the ending to create a sense of release.'
        : 'Keep the texture broadly stable, with subtle variation in layers rather than abrupt density shifts.';

  const rhythmicPhrase =
    rhythmicDriveTag === 'strong-rhythmic-drive'
      ? 'Rhythm should be clearly articulated and forward-driving, but avoid feeling aggressive.'
      : rhythmicDriveTag === 'gentle-rhythmic-motion'
        ? 'Rhythm should feel gentle and supporting, giving space to harmony and texture.'
        : 'Rhythm should feel steady and supportive, with groove present but not overwhelming.';

  const structurePhraseIntro =
    '0–6s: establish the core motif and palette with a clear but gentle introduction, avoiding sudden full-band entries.';

  const structurePhraseDevelopment =
    '6–18s: develop the motif and texture with variation and interplay between parts, so the middle does not reset or collapse but feels like a coherent expansion.';

  const structurePhrasePeak =
    narrative.arcShape === 'surge_then_resolve' || narrative.arcShape === 'rise'
      ? '18–26s: build to a focused peak in energy and intensity that feels like a crest rather than a restart.'
      : narrative.arcShape === 'tension_release'
        ? '18–26s: let harmonic and textural tension reach a clear high point, then begin releasing it in a controlled way.'
        : '18–26s: allow the musical ideas to bloom fully, with one or two standout gestures that feel like a culmination rather than background loops.';

  const endingPhrase =
    narrative.endingStyle === 'resolved'
      ? '26–30s: guide the harmony toward a clear, intentional resolution on the home center, with a short, natural decay—no abrupt cutoffs.'
      : narrative.endingStyle === 'suspended'
        ? '26–30s: land on a suspended or open chord that feels like a thoughtful question mark, with a smooth tail and no hard stop.'
        : narrative.endingStyle === 'dissipating'
          ? '26–30s: gradually thin out rhythm and harmony so the sound dissolves into a soft tail, avoiding sudden drops in energy.'
          : narrative.endingStyle === 'triumphant'
            ? '26–30s: shape a small but confident climax, then clearly resolve to the home center with a brief, satisfying tail.'
            : '26–30s: finish with an open but gentle sonority that suggests continuity beyond the track, keeping the final seconds intentional and unhurried.';

  const structureSentence = `${structurePhraseIntro} ${structurePhraseDevelopment} ${structurePhrasePeak} ${endingPhrase}`;

  const elementSentence = secondaryElementPhrase
    ? `Lean into ${primaryElementPhrase}, ${secondaryElementPhrase}.`
    : `Lean into ${primaryElementPhrase}.`;

  const fullPrompt = [
    BASE_SAFE_PROMPT,
    elementSentence,
    tonalPhrase,
    densityPhrase,
    rhythmicPhrase,
    harmonic.sentence,
    rhythmicDetail.sentence,
    registerAndInstr.sentence,
    structureSentence,
  ].join(' ');

  return `${fullPrompt} Tags: ${tags.join(', ')}.`;
}
