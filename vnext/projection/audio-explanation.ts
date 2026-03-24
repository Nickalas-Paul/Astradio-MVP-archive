/**
 * Phase D — audio explanation from SemanticCore.audio, tension_harmony, and narrative plan (no new meaning).
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type { CompositionNarrativePlan } from '../audio/composition-narrative';
import type { ExpansionTier } from './projection-types';

function mapTempo(code: string): string {
  if (code === 'TEMPO_HIGH') return 'faster pacing and shorter phrase windows';
  if (code === 'TEMPO_LOW') return 'slower pacing and longer sustain windows';
  return 'mid pacing with moderate phrase windows';
}

function mapDensity(code: string): string {
  if (code === 'DENSITY_DENSE') return 'denser layering and less empty space between events';
  if (code === 'DENSITY_SPARSE') return 'sparser layering with more room between events';
  return 'balanced density between sparse and full';
}

function mapArc(code: string): string {
  if (code === 'ARC_SURGE_RESOLVE') return 'a surge-then-resolve arc bias';
  if (code === 'ARC_FALL') return 'a falling or release-leaning arc bias';
  if (code === 'ARC_RISE') return 'a rising or build-leaning arc bias';
  return 'a cyclic arc bias';
}

function mapTensionBias(code: string): string {
  if (code === 'AUDIO_TENSION_HIGH') return 'higher harmonic tension staging';
  if (code === 'AUDIO_TENSION_LOW') return 'lower harmonic tension staging';
  return 'moderate harmonic tension staging';
}

function mapTexture(code: string): string {
  if (code === 'REL_TEXTURE_FLUID') return 'fluid relational texture';
  if (code === 'REL_TEXTURE_CALL_RESPONSE') return 'call-and-response relational texture';
  if (code === 'REL_TEXTURE_STATIC') return 'static or held relational texture';
  return 'neutral relational texture';
}

export function buildAudioExplanationBlock(
  core: SemanticCore,
  tier: ExpansionTier,
  narrativePlan: CompositionNarrativePlan | null | undefined
): { title: string; text: string; bullets?: string[]; claimIds: string[] } {
  const a = core.audio;
  const th = core.tension_harmony;
  const claimIds: string[] = [];

  const baselineSentences = [
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
