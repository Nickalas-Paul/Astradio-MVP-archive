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

  const tags: string[] = [
    ...baseTags,
    brightnessTag,
    tonalTag,
    densityProfileTag,
    rhythmicDriveTag,
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
    structureSentence,
  ].join(' ');

  return `${fullPrompt} Tags: ${tags.join(', ')}.`;
}
