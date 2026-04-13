/**
 * Unified audio lexicon — perceptual, user-facing language from SemanticCore.audio.
 * Projection rule layer only; no semantic authority changes.
 */

import type { SemanticCore } from '../../semantic/semantic-core';
import type { CompositionNarrativePlan } from '../../audio/composition-narrative';
import type { ExpansionTier } from '../projection-types';
import type { ProjectionSurface } from '../projection-types';

/** Single dimension: pulse / motion (one listen clause per call; maps `SemanticCore.audio.tempo_band` only). No trailing period. */
export function mapTempo(code: string): string {
  if (code === 'TEMPO_HIGH') return 'The pulse runs light and quick, so phrases turn on short notice';
  if (code === 'TEMPO_LOW') return 'The pulse lengthens, letting each phrase finish before the next';
  return 'The pulse sits in a steady mid-gear';
}

/** Space / crowding between entries (one listen clause per call; `density_band` only). No trailing period. */
export function mapDensity(code: string): string {
  if (code === 'DENSITY_DENSE') return 'Entries stack close, with little air between them';
  if (code === 'DENSITY_SPARSE') return 'Rests stay wide enough to hear each entry clearly';
  return 'Spacing alternates tight and open in a workable balance';
}

/** Energy arc over time (one listen clause per call; `arc_bias` only). No trailing period. */
export function mapArc(code: string): string {
  if (code === 'ARC_SURGE_RESOLVE') return 'Energy lifts sharply, then finds a clear landing';
  if (code === 'ARC_FALL') return 'Energy thins and releases toward the close';
  if (code === 'ARC_RISE') return 'Energy climbs and thickens as the section goes on';
  return 'Energy keeps shifting rather than parking on one plateau';
}

/** Listening pressure (one listen clause per call; `tension_bias` only). No trailing period. */
export function mapTensionBias(code: string): string {
  if (code === 'AUDIO_TENSION_HIGH') return 'Listening pressure stays high, so resolutions defer';
  if (code === 'AUDIO_TENSION_LOW') return 'Listening pressure eases earlier in each gesture';
  return 'Listening pressure sits halfway between ease and strain';
}

/** Voicing / interplay (one listen clause per call; `relational_texture` only). No trailing period. */
export function mapTexture(code: string): string {
  if (code === 'REL_TEXTURE_FLUID') return 'Voices overlap in sustained blend';
  if (code === 'REL_TEXTURE_CALL_RESPONSE') return 'Figures trade in clear answer phrases';
  if (code === 'REL_TEXTURE_STATIC') return 'Layers hold a steady stack with little handoff';
  return 'Voicing stays even, without a strong call-and-response pull';
}

/** Deterministic bridge from ExplainSpec BPM to canonical tempo band codes (expression only). */
export function tempoBandCodeFromExplainerBpm(bpm: number): 'TEMPO_HIGH' | 'TEMPO_MED' | 'TEMPO_LOW' {
  if (bpm >= 118) return 'TEMPO_HIGH';
  if (bpm <= 82) return 'TEMPO_LOW';
  return 'TEMPO_MED';
}

/** Deterministic bridge from ExplainSpec density bucket to canonical density codes (expression only). */
export function densityBandCodeFromExplainerBucket(
  bucket: 'low' | 'med' | 'high'
): 'DENSITY_SPARSE' | 'DENSITY_BALANCED' | 'DENSITY_DENSE' {
  if (bucket === 'high') return 'DENSITY_DENSE';
  if (bucket === 'low') return 'DENSITY_SPARSE';
  return 'DENSITY_BALANCED';
}

/** Generic daily / explainer fallback: names the five listen axes without inventing new ones. */
export function genericScoreListenTranslationFallback(): string {
  return 'The score maps the chart into the same five listen dimensions as the main read (pulse, spacing, arc, listening pressure, and voicing) without inventing a second story.';
}

/** First tempo clause only, for mid-sentence glue (same lexicon as `mapTempo`). */
export function mapTempoLeadClauseForEmbed(code: string): string {
  const t = mapTempo(code);
  const comma = t.indexOf(',');
  return comma > 0 ? t.slice(0, comma) : t;
}

export function pacingPhraseFromCore(core: SemanticCore): string {
  return withTerminalPeriod(mapTempo(core.audio.tempo_band));
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
  return withTerminalPeriod(mapTempoLeadClauseForEmbed(core.audio.tempo_band));
}

/**
 * Full perceptual summary for the audio_staging owner section only.
 */
export function withTerminalPeriod(s: string): string {
  const t = s.trim();
  if (t.endsWith('.')) return t;
  return `${t}.`;
}

export function fullPerceptualListenSummaryFromCore(core: SemanticCore): string {
  const a = core.audio;
  /** Single tagged sentence for `audio_staging` grammar; clauses are one field each, separated by `;`. */
  return `${mapTempo(a.tempo_band)}; ${mapDensity(a.density_band)}; ${mapTensionBias(a.tension_bias)}; ${mapArc(
    a.arc_bias
  )}; ${mapTexture(a.relational_texture)}.`;
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
  const tSent = t.charAt(0).toUpperCase() + t.slice(1);
  const hSent = h.charAt(0).toLowerCase() + h.slice(1);
  return `${tSent}, and ${hSent}.`;
}

function narrativePlanExperientialNote(plan: CompositionNarrativePlan): string {
  return `The narrative plan traces ${plan.energyCurve} energy toward a ${plan.endingStyle} ending; overall shape reads ${plan.arcShape.replace(/_/g, ' ')}.`;
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
    group: `Here, listen spans blended emphasis first, then detail tightens: ${listen}`,
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
    const extra = `Groove and brightness track the plan’s ${narrativePlan.energyCurve} curve toward a ${narrativePlan.endingStyle} close, aligned with the words above.`;
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
