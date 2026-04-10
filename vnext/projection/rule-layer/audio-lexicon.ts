/**
 * Unified audio lexicon — perceptual, user-facing language from SemanticCore.audio.
 * Projection rule layer only; no semantic authority changes.
 */

import type { SemanticCore } from '../../semantic/semantic-core';
import type { CompositionNarrativePlan } from '../../audio/composition-narrative';
import type { ExpansionTier } from '../projection-types';
import type { ProjectionSurface } from '../projection-types';

/** Single dimension: how motion feels (experiential, not parameter labels). */
export function mapTempo(code: string): string {
  if (code === 'TEMPO_HIGH') return 'motion feels quick and changeable';
  if (code === 'TEMPO_LOW') return 'motion feels slow and sustained';
  return 'motion feels moderate and steady';
}

/** Space / crowding between moments. */
export function mapDensity(code: string): string {
  if (code === 'DENSITY_DENSE') return 'the texture feels tight and crowded';
  if (code === 'DENSITY_SPARSE') return 'the texture feels open with room between moments';
  return 'the texture balances open and full';
}

/** How energy moves over time (experiential). */
export function mapArc(code: string): string {
  if (code === 'ARC_SURGE_RESOLVE') return 'energy surges then settles';
  if (code === 'ARC_FALL') return 'energy softens and releases over time';
  if (code === 'ARC_RISE') return 'energy builds and gathers';
  return 'energy circles and shifts rather than locking flat';
}

/** Listening pressure / harmonic pull (felt). */
export function mapTensionBias(code: string): string {
  if (code === 'AUDIO_TENSION_HIGH') return 'listening pressure feels heavy';
  if (code === 'AUDIO_TENSION_LOW') return 'listening pressure feels light';
  return 'listening pressure feels moderate';
}

export function mapTexture(code: string): string {
  if (code === 'REL_TEXTURE_FLUID') return 'voices weave together smoothly';
  if (code === 'REL_TEXTURE_CALL_RESPONSE') return 'one voice answers another in turns';
  if (code === 'REL_TEXTURE_STATIC') return 'the interplay stays steady and held';
  return 'the interplay feels even and neutral';
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

/**
 * One light cue for non-owner sections (avoid repeating the full listen stack).
 */
export function lightListenHintFromCore(core: SemanticCore): string {
  return mapTempo(core.audio.tempo_band);
}

/**
 * Full perceptual summary for the audio_staging owner section only.
 */
export function fullPerceptualListenSummaryFromCore(core: SemanticCore): string {
  const a = core.audio;
  return `${mapTempo(a.tempo_band)}; ${mapDensity(a.density_band)}; ${mapTensionBias(a.tension_bias)}; ${mapArc(
    a.arc_bias
  )}; together the atmosphere feels ${mapTexture(a.relational_texture).toLowerCase()}.`;
}

/** @deprecated for templates — use lightListenHintFromCore or fullPerceptualListenSummaryFromCore on owner. */
export function rhythmGroovePhraseFromCore(core: SemanticCore): string {
  return fullPerceptualListenSummaryFromCore(core);
}

function humanTensionHarmonySentence(core: SemanticCore): string | null {
  const th = core.tension_harmony;
  if (!th) return null;
  const t =
    th.tension_band === 'TENSION_BUCKET_HIGH'
      ? 'structure carries noticeable contrast'
      : th.tension_band === 'TENSION_BUCKET_MED'
        ? 'structure carries workable contrast'
        : 'structure carries gentle contrast';
  const h =
    th.harmony_band === 'HARMONY_BUCKET_HIGH'
      ? 'resolution comes a little easier'
      : th.harmony_band === 'HARMONY_BUCKET_LOW'
        ? 'resolution asks for more patience'
        : 'resolution sits in the middle';
  return `In the listening metaphor, ${t}, and ${h}; this stays descriptive, not a verdict about how life must go.`;
}

function narrativePlanExperientialNote(plan: CompositionNarrativePlan): string {
  return `The piece shapes energy in a ${plan.energyCurve} way, moves toward a ${plan.endingStyle} close, and keeps an overall arc that feels ${plan.arcShape.replace(/_/g, ' ')} without naming raw numbers.`;
}

export function buildAudioStagingBlock(
  core: SemanticCore,
  tier: ExpansionTier,
  narrativePlan: CompositionNarrativePlan | null | undefined,
  surface?: ProjectionSurface
): { title: string; text: string; bullets?: string[]; claimIds: string[] } {
  const a = core.audio;
  const claimIds: string[] = [];
  const listen = fullPerceptualListenSummaryFromCore(core);

  const surfaceLead: Record<ProjectionSurface, string> = {
    profile: `For your profile listen, you keep a baseline feel: ${listen}`,
    daily: `For today’s listen, you catch what the sky adds on top of your baseline: ${listen}`,
    sandbox: `In this lab listen, you stress-test how the same picture sounds when conditions shift: ${listen}`,
    overlay_pair: `In this overlay listen, you hold two time layers side by side: ${listen}`,
    compat_pair: `For this pair’s listen, you notice how two voices meet: ${listen}`,
    group: `For this group listen, you hear the whole room before any single pair: ${listen}`,
    campaign: `For this scenario’s listen, you track pressure and response in sound: ${listen}`,
    feed: `For this short card, you get one clear listen cue: ${listen}`,
  };

  const baselineParts = [surface ? surfaceLead[surface] : surfaceLead.profile];
  const thSent = humanTensionHarmonySentence(core);
  if (thSent) baselineParts.push(thSent);

  let text = baselineParts.join(' ');
  const bullets: string[] = [];

  if (tier !== 'baseline' && narrativePlan) {
    bullets.push(narrativePlanExperientialNote(narrativePlan));
    const extra = `As you listen, melody brightness leans ${narrativePlan.tonalPolarity}, and groove follows the same contrast curve as the words above rather than telling a separate story.`;
    text = `${text}\n\n${extra}`;
  }

  if (tier === 'extended' && narrativePlan) {
    text = `${text}\n\nIf the words name friction, the sound usually keeps that tension honest instead of smoothing it away, unless contrast is already explicit in the same picture.`;
  }

  return {
    title: 'How this sounds (listen metaphor)',
    text,
    bullets: tier === 'baseline' ? undefined : bullets.length ? bullets : undefined,
    claimIds,
  };
}
