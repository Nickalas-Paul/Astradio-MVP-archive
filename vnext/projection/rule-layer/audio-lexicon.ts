/**
 * Unified audio lexicon — single source for user-facing pacing, rhythm, density,
 * harmonic tension staging, and arc/change language derived from SemanticCore.audio.
 * Projection rule layer only; no semantic authority changes.
 */

import type { SemanticCore } from '../../semantic/semantic-core';
import type { CompositionNarrativePlan } from '../../audio/composition-narrative';
import type { ExpansionTier } from '../projection-types';
import type { ProjectionSurface } from '../projection-types';

export function mapTempo(code: string): string {
  if (code === 'TEMPO_HIGH') return 'faster pacing and shorter phrase windows';
  if (code === 'TEMPO_LOW') return 'slower pacing and longer sustain windows';
  return 'mid pacing with moderate phrase windows';
}

export function mapDensity(code: string): string {
  if (code === 'DENSITY_DENSE') return 'denser layering and less empty space between events';
  if (code === 'DENSITY_SPARSE') return 'sparser layering with more room between events';
  return 'balanced density between sparse and full';
}

/** Arc / change bias (disruption and directional motion in the audio envelope). */
export function mapArc(code: string): string {
  if (code === 'ARC_SURGE_RESOLVE') return 'a surge-then-resolve arc bias with clear directional change';
  if (code === 'ARC_FALL') return 'a falling or release-leaning arc bias with softening change over time';
  if (code === 'ARC_RISE') return 'a rising or build-leaning arc bias with accumulating change';
  return 'a cyclic arc bias with recurring change rather than a single fixed plateau';
}

export function mapTensionBias(code: string): string {
  if (code === 'AUDIO_TENSION_HIGH') return 'higher harmonic tension staging';
  if (code === 'AUDIO_TENSION_LOW') return 'lower harmonic tension staging';
  return 'moderate harmonic tension staging';
}

export function mapTexture(code: string): string {
  if (code === 'REL_TEXTURE_FLUID') return 'fluid relational texture';
  if (code === 'REL_TEXTURE_CALL_RESPONSE') return 'call-and-response relational texture';
  if (code === 'REL_TEXTURE_STATIC') return 'static or held relational texture';
  return 'neutral relational texture';
}

export function pacingPhraseFromCore(core: SemanticCore): string {
  return mapTempo(core.audio.tempo_band);
}

export function densityPhraseFromCore(core: SemanticCore): string {
  return mapDensity(core.audio.density_band);
}

export function harmonicTensionPhraseFromCore(core: SemanticCore): string {
  return mapTensionBias(core.audio.tension_bias);
}

export function arcChangePhraseFromCore(core: SemanticCore): string {
  return mapArc(core.audio.arc_bias);
}

/** Groove / rhythm characterization — must come from audio envelope, not claim tension. */
export function rhythmGroovePhraseFromCore(core: SemanticCore): string {
  return `${mapTempo(core.audio.tempo_band)}, with ${mapDensity(core.audio.density_band)} and ${mapTensionBias(core.audio.tension_bias)}`;
}

export function buildAudioStagingBlock(
  core: SemanticCore,
  tier: ExpansionTier,
  narrativePlan: CompositionNarrativePlan | null | undefined,
  surface?: ProjectionSurface
): { title: string; text: string; bullets?: string[]; claimIds: string[] } {
  const a = core.audio;
  const th = core.tension_harmony;
  const claimIds: string[] = [];

  const surfaceLead: Record<ProjectionSurface, string> = {
    profile: `Profile audio framing: this staging follows enduring trait-level tendencies in the same semantic readout, with ${mapTempo(
      a.tempo_band
    )} as the baseline motion.`,
    daily: `Daily audio framing: this staging emphasizes short-window sky activation and ${mapTempo(a.tempo_band)} in the encoded field.`,
    sandbox: `Sandbox audio framing: this staging reflects override-sensitive lab conditions with ${mapDensity(a.density_band)} in the encoded field.`,
    overlay_pair: `Overlay audio framing: this staging keeps natal and transit layers visible as parallel threads, using ${mapArc(a.arc_bias)} as the arc read.`,
    compat_pair: `Compatibility audio framing: this staging follows pair dynamics using ${mapTexture(a.relational_texture)} together with ${mapTensionBias(
      a.tension_bias
    )}.`,
    group: `Group audio framing: this staging reflects ensemble-level field behavior using ${mapDensity(a.density_band)} before dyadic reduction.`,
    campaign: `Campaign audio framing: this staging follows pressure-to-response motion using ${mapTempo(a.tempo_band)} in the same semantic profile.`,
    feed: `Feed audio framing: this staging surfaces a short signal thread using ${mapTensionBias(a.tension_bias)} from the same semantic source.`,
  };

  const baselineSentences = [
    surface ? surfaceLead[surface] : surfaceLead.profile,
    `Composition staging tends to align with ${mapTempo(a.tempo_band)}, ${mapDensity(a.density_band)}, and ${mapTensionBias(a.tension_bias)} in the encoded audio envelope.`,
    `Arc bias in the audio envelope reads as ${mapArc(a.arc_bias)}, while relational texture reads as ${mapTexture(a.relational_texture)}.`,
  ];

  if (th) {
    baselineSentences.push(
      `Tension and harmony buckets in the semantic readout are encoded as ${th.tension_band} tension alongside ${th.harmony_band} harmony; this is descriptive staging, not a verdict about outcome.`
    );
  }

  let text = baselineSentences.join(' ');
  const bullets: string[] = [];

  if (tier !== 'baseline' && narrativePlan) {
    bullets.push(
      `Narrative plan arc shape: ${narrativePlan.arcShape}; energy curve: ${narrativePlan.energyCurve}; ending style: ${narrativePlan.endingStyle}.`
    );
    bullets.push(
      `Rhythmic drive index (staging): ${narrativePlan.rhythmicDrive.toFixed(3)}; density profile: ${narrativePlan.densityProfile}; peak window: ${narrativePlan.peakWindow}.`
    );
    const extra = [
      `When the same semantic readout is staged for audio, melodic motion often traces the ${narrativePlan.tonalPolarity} tonal polarity while groove follows the encoded tension curve rather than inventing a separate story.`,
      `Extended read: staging may emphasize ${mapArc(a.arc_bias)} together with ${narrativePlan.energyCurve} energy shaping; this mirrors the narrative plan derived from the same SemanticCore as the text readout.`,
    ];
    text = text + '\n\n' + extra.join(' ');
  }

  if (tier === 'extended' && narrativePlan) {
    text +=
      '\n\n' +
      `Integrated note: ${mapTempo(a.tempo_band)}, ${mapDensity(a.density_band)}, and ${mapTensionBias(a.tension_bias)} should be read as one thread alongside the interpretive sections above; if text highlights friction claims, audio staging typically preserves tension rather than cancelling it unless contrast is explicitly present in the same semantic sources.`;
  }

  return {
    title: 'Audio staging (same SemanticCore)',
    text,
    bullets: tier === 'baseline' ? undefined : bullets.length ? bullets : undefined,
    claimIds,
  };
}
