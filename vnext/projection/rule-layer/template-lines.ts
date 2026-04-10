/**
 * Raw template lines — only consumed by assemble-sections.
 * Perceptual listen language uses audio-lexicon; templates avoid repeating the full listen stack.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { SectionTemplateId } from '../../semantic/ontology-codes';
import type { ClaimId } from '../../semantic/ontology-codes';
import type { RelationalBandCode } from '../../semantic/ontology-codes';
import {
  arcChangePhraseFromCore,
  densityPhraseFromCore,
  harmonicTensionPhraseFromCore,
  lightListenHintFromCore,
  pacingPhraseFromCore,
} from './audio-lexicon';
import type { TopologyClass } from './topology-classify';
import type { TemporalVoiceBucket } from './temporal-classify';
import type { ProjectionSurface } from '../projection-types';

function hasClaim(core: SemanticCore, id: ClaimId): boolean {
  return core.claims.some((c) => c.claim_id === id);
}

function primaryElementLabel(core: SemanticCore): string {
  if (hasClaim(core, 'ELEMENT_FIRE_DOM')) return 'fire';
  if (hasClaim(core, 'ELEMENT_EARTH_DOM')) return 'earth';
  if (hasClaim(core, 'ELEMENT_AIR_DOM')) return 'air';
  if (hasClaim(core, 'ELEMENT_WATER_DOM')) return 'water';
  return 'balanced';
}

function tonalLabel(core: SemanticCore): string {
  if (hasClaim(core, 'TONAL_BRIGHT')) return 'bright';
  if (hasClaim(core, 'TONAL_DARK')) return 'dark';
  return 'balanced';
}

function pickVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

function ctxSurface(ctx: TemplateContext): ProjectionSurface {
  return ctx.surface ?? 'profile';
}

/** WHO + WHEN clause (campaign avoids chart language). */
function anchorWhoWhen(ctx: TemplateContext): string {
  const surf = ctxSurface(ctx);
  if (ctx.suppressAstrologyTitles) {
    const when =
      ctx.temporalBucket === 'activated'
        ? 'right now, under fresh pressure,'
        : ctx.temporalBucket === 'mixed'
          ? 'in this beat, with both steady and shifting layers,'
          : 'at this point in the story,';
    return `In this scenario, you, ${when}`;
  }
  if (surf === 'group') {
    const when =
      ctx.temporalBucket === 'activated'
        ? 'in this moment, with the group activated,'
        : ctx.temporalBucket === 'mixed'
          ? 'today, with mixed steady and active layers,'
          : 'at baseline,';
    return `For this group, you, ${when}`;
  }
  if (surf === 'compat_pair') {
    const when =
      ctx.temporalBucket === 'activated'
        ? 'right now, when contact feels heightened,'
        : ctx.temporalBucket === 'mixed'
          ? 'today, with both steady and sparky layers,'
          : 'at baseline,';
    return `For this connection, you, ${when}`;
  }
  const when =
    ctx.temporalBucket === 'activated'
      ? 'right now, with today’s sky leaning in,'
      : ctx.temporalBucket === 'mixed'
        ? 'today, with both your usual baseline and a livelier layer,'
        : 'at baseline,';
  return `In this chart, you, ${when}`;
}

function humanRelBand(code: RelationalBandCode): string {
  const m: Record<string, string> = {
    REL_BAND_HARMONY_HIGH: 'cooperation feels strong',
    REL_BAND_HARMONY_MED: 'cooperation feels moderate',
    REL_BAND_HARMONY_LOW: 'cooperation feels muted',
    REL_BAND_FRICTION_HIGH: 'friction feels pronounced',
    REL_BAND_FRICTION_MED: 'friction feels workable',
    REL_BAND_FRICTION_LOW: 'friction feels light',
    REL_BAND_INTENSITY_HIGH: 'contact feels intense',
    REL_BAND_INTENSITY_MED: 'contact feels moderate',
    REL_BAND_INTENSITY_LOW: 'contact feels gentle',
  };
  return m[code] ?? 'a relational tone is present';
}

export type TemplateContext = {
  readonly suppressAstrologyTitles: boolean;
  readonly topologyClass: TopologyClass;
  readonly temporalBucket: TemporalVoiceBucket;
  readonly surface?: ProjectionSurface;
};

function signaturesTitle(ctx: TemplateContext): string {
  if (ctx.suppressAstrologyTitles) return 'What shows up';
  return 'Astrological Signatures';
}

function aggregateFieldText(core: SemanticCore, seed: string, topology: TopologyClass): string {
  const who =
    topology === 'field'
      ? 'For this ensemble, you'
      : topology === 'dyad'
        ? 'For this pair, you'
        : 'Here, you';
  const base = `${who}, at baseline, see several pictures merged; the words follow only what those pictures share, not private details from any single slot.`;
  if (topology === 'dyad') {
    return pickVariant(`${seed}:agg:dyad`, [
      `${base} The pair-weighted blend stays explicit.`,
      `${base} The dyad blend stays explicit.`,
    ]);
  }
  if (topology === 'field') {
    return pickVariant(`${seed}:agg:field`, [
      `${base} The many-voice blend stays explicit.`,
      `${base} The wider-room blend stays explicit.`,
    ]);
  }
  return base;
}

export function temporalIntegrationLine(bucket: TemporalVoiceBucket, seed: string): string {
  if (bucket === 'static') {
    return pickVariant(`${seed}:temp:static`, [
      `Your slower-moving pattern stays primary; treat short spikes as seasoning, not a new identity.`,
      `What changes slowly still steers the story; keep quick shifts in proportion to that steadier layer.`,
    ]);
  }
  if (bucket === 'activated') {
    return pickVariant(`${seed}:temp:act`, [
      `What feels urgent today sits on top of slower personal baselines; the spike may pass while the baseline remains.`,
      `Today’s layer can move within hours; small adjustments often beat sweeping conclusions.`,
    ]);
  }
  return pickVariant(`${seed}:temp:mix`, [
    `Both steady and quick layers count; name which timescale you mean before you lock one story.`,
    `Near-term and long-haul signals both show; context usually decides which one speaks loudest.`,
  ]);
}

export function lineForTemplate(
  templateId: SectionTemplateId,
  core: SemanticCore,
  seed: string,
  ctx: TemplateContext
): { title: string; text: string; bullets?: string[] } {
  const el = primaryElementLabel(core);
  const tonal = tonalLabel(core);
  const aw = anchorWhoWhen(ctx);
  const temporalExtra =
    ctx.temporalBucket !== 'static' ? ` ${temporalIntegrationLine(ctx.temporalBucket, `${seed}:inline`)}` : '';

  /** Identity sections: one light listen cue only (full stack lives in audio_staging). */
  const hint = lightListenHintFromCore(core);
  const audioP = pacingPhraseFromCore(core);
  const audioD = densityPhraseFromCore(core);
  const audioH = harmonicTensionPhraseFromCore(core);
  const audioA = arcChangePhraseFromCore(core);

  switch (templateId) {
    case 'SECTION_SIGNATURES':
      if (ctx.suppressAstrologyTitles) {
        return {
          title: signaturesTitle(ctx),
          text: pickVariant(seed, [
            `${aw} what stands out is a ${tonal} mood carried with ${el} weight; the situation asks you to notice how that mix lands today.${temporalExtra}`,
            `${aw} the dominant feel is ${el} coloring through a ${tonal} mood; keep attention on how that shows in choices under pressure.${temporalExtra}`,
          ]),
        };
      }
      return {
        title: signaturesTitle(ctx),
        text: pickVariant(seed, [
          `${aw} the primary emphasis is ${el} coloring with a ${tonal} mood; that pairing is the headline for how strength shows up.${temporalExtra} A light listen cue: ${hint}.`,
          `${aw} elemental weight centers on ${el} with ${tonal} shading; treat that as the main handle before finer details.${temporalExtra} You may also notice ${hint}.`,
        ]),
      };
    case 'SECTION_SIGNIFICANCE':
      return {
        title: ctx.suppressAstrologyTitles ? 'Why it matters' : 'Personal Significance',
        text: pickVariant(seed, [
          `${aw} what is happening is that ${tonal} coloring and ${el} weight shape how impact lands: moments feel sharper or softer because of that mix.${temporalExtra}`,
          `${aw} the personal punch comes from carrying ${el} qualities inside a ${tonal} mood; stress and relief often route through that pairing.${temporalExtra}`,
        ]),
      };
    case 'SECTION_MUSICAL':
      return {
        title: ctx.suppressAstrologyTitles ? 'Listen metaphor' : 'Musical Identity and Flow',
        text: pickVariant(seed, [
          `${aw} when you imagine this as sound, keep ${el} as the timbre and ${tonal} as the brightness curve; let ${audioA} mark where the feeling turns, and let ${audioH} name the pressure you hear.${temporalExtra}`,
        ]),
        bullets: [
          `Color: ${el}-weighted palette.`,
          `Contour: ${tonal} brightness.`,
          `Motion and pressure: ${audioP}; ${audioD}.`,
        ],
      };
    case 'SECTION_SKY_SUMMARY': {
      const temporalHint =
        ctx.temporalBucket !== 'static' ? ` ${temporalIntegrationLine(ctx.temporalBucket, `${seed}:sky`)}` : '';
      return {
        title: 'Sky Summary',
        text: `${aw} today’s layer adds ${el} emphasis and ${tonal} shading; ${hint} names part of how that shows up in passing.${temporalHint}`,
      };
    }
    case 'SECTION_PERSONAL_EMPHASIS':
      return {
        title: 'Personal Emphasis',
        text: `${aw} what you personally carry is ${el} emphasis with ${tonal} shading; ${audioP} and ${audioH} sketch how that feels in motion.${temporalExtra}`,
      };
    case 'SECTION_LIKELY_EXPRESSIONS':
      return {
        title: 'Likely Expressions',
        text: `${aw} what tends to show outward is ${el}-leaning style voiced in a ${tonal} register; ${audioD} and ${audioH} hint at how tightly the moment is packed.${temporalExtra}`,
      };
    case 'SECTION_WATCH_FORS':
      return {
        title: 'Watch-Fors',
        text: `${aw} watch for moments when ${audioH} climbs and the ${tonal} mood shifts, especially if ${el} heat runs high; ${audioA} marks where change clusters.${temporalExtra}`,
      };
    case 'SECTION_INTEGRATION':
      return {
        title: 'Integration Prompt',
        text: `${aw} integration means balancing ${el} drive with the ${tonal} frame; ease the phrasing where ${audioH} peaks and ${audioD} feels crowded.${temporalExtra}`,
      };
    case 'SECTION_MUSIC_TRANSLATION':
      return {
        title: 'Music Translation',
        text: `${aw} translate this into sound by letting harmony lean ${el}, melody trace ${tonal} brightness, and ${audioA} with ${audioP} steer how change arrives.${temporalExtra}`,
      };
    case 'SECTION_COMPARISON_SIGNATURES':
      return {
        title: 'Shared and Divergent Signatures',
        text: hasClaim(core, 'CROSS_ELEMENT_DRIFT_HIGH')
          ? `${anchorWhoWhen(ctx)} the two pictures diverge strongly in elemental mix; keep comparisons honest instead of blending them away.${temporalExtra}`
          : `${anchorWhoWhen(ctx)} the two pictures share enough ${el} thread to compare fairly, with contrast still visible.${temporalExtra}`,
      };
    case 'SECTION_COMPARISON_BRIDGE':
      return {
        title: 'Bridge',
        text: hasClaim(core, 'CROSS_TENSION_DELTA_HIGH')
          ? `${anchorWhoWhen(ctx)} tension habits differ enough that one single story may not fit both; alternate language can help.${temporalExtra}`
          : `${anchorWhoWhen(ctx)} tension habits are close enough to share one listening arc without forcing sameness.${temporalExtra}`,
      };
    case 'SECTION_AGGREGATE_FIELD':
      return {
        title: 'Composite field',
        text: aggregateFieldText(core, seed, ctx.topologyClass),
      };
    case 'SECTION_RELATIONAL_WEATHER': {
      const rel = core.relational;
      const bands = rel?.activation_profile?.length
        ? rel.activation_profile.map((c) => humanRelBand(c as RelationalBandCode)).join(' · ')
        : 'relational tones were not available for this pass';
      return {
        title: 'Relational field (structural)',
        text: `${anchorWhoWhen(ctx)} between people, the picture highlights: ${bands}.${temporalExtra}`,
      };
    }
    default:
      return { title: 'Section', text: '' };
  }
}

export const idMap: Partial<Record<SectionTemplateId, string>> = {
  SECTION_SIGNATURES: 'signatures',
  SECTION_SIGNIFICANCE: 'significance',
  SECTION_MUSICAL: 'musical',
  SECTION_SKY_SUMMARY: 'sky_summary',
  SECTION_PERSONAL_EMPHASIS: 'personal_emphasis',
  SECTION_LIKELY_EXPRESSIONS: 'likely_expressions',
  SECTION_WATCH_FORS: 'watch_fors',
  SECTION_INTEGRATION: 'integration_prompt',
  SECTION_MUSIC_TRANSLATION: 'music_translation',
  SECTION_COMPARISON_SIGNATURES: 'signatures',
  SECTION_COMPARISON_BRIDGE: 'significance',
  SECTION_AGGREGATE_FIELD: 'relational_field',
  SECTION_RELATIONAL_WEATHER: 'relational_weather_v1',
};
