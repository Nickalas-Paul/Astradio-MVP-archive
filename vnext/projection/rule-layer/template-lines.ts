/**
 * Raw template lines — only consumed by assemble-sections.
 * Phase 2: no legacy anchor clauses here; assembler injects anchor + optional temporal block.
 * Perceptual listen language: see phase2 audio table in assemble / audio-lexicon.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { SectionTemplateId } from '../../semantic/ontology-codes';
import type { ClaimId } from '../../semantic/ontology-codes';
import type { RelationalBandCode } from '../../semantic/ontology-codes';
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
  const base =
    'The ensemble merges several pictures. The words follow only what those pictures share, not private details from any single slot.';
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

const LISTEN_POINTER = 'Listen detail lives in “How this sounds (listen metaphor)” below.';

export function lineForTemplate(
  templateId: SectionTemplateId,
  core: SemanticCore,
  seed: string,
  ctx: TemplateContext
): { title: string; text: string; bullets?: string[] } {
  const el = primaryElementLabel(core);
  const tonal = tonalLabel(core);

  switch (templateId) {
    case 'SECTION_SIGNATURES':
      if (ctx.suppressAstrologyTitles) {
        return {
          title: signaturesTitle(ctx),
          text: pickVariant(seed, [
            `A ${tonal} mood carries ${el} weight. The situation asks you to notice how that mix lands today.\n\n${LISTEN_POINTER}`,
            `The dominant feel is ${el} coloring through a ${tonal} mood.\n\n${LISTEN_POINTER}`,
          ]),
        };
      }
      return {
        title: signaturesTitle(ctx),
        text: pickVariant(seed, [
          `The primary emphasis is ${el} coloring with a ${tonal} mood.\n\n${LISTEN_POINTER}`,
          `Elemental weight centers on ${el} with ${tonal} shading.\n\n${LISTEN_POINTER}`,
        ]),
      };
    case 'SECTION_SIGNIFICANCE':
      return {
        title: ctx.suppressAstrologyTitles ? 'Why it matters' : 'Personal Significance',
        text: pickVariant(seed, [
          `The ${tonal} mood and ${el} weight shape how impact lands. Moments can feel sharper or softer because of that mix.`,
          `The personal punch comes from carrying ${el} qualities inside a ${tonal} mood. Stress and relief often route through that pairing.`,
        ]),
      };
    case 'SECTION_MUSICAL':
      return {
        title: ctx.suppressAstrologyTitles ? 'Listen metaphor' : 'Musical Identity and Flow',
        text: pickVariant(seed, [
          `Keep ${el} as timbre and ${tonal} as brightness.\n\n${LISTEN_POINTER}`,
        ]),
        bullets: [
          `Color: ${el}-weighted palette.`,
          `Contour: ${tonal} brightness.`,
          `Motion and pressure cues route through the listen section below.`,
        ],
      };
    case 'SECTION_SKY_SUMMARY':
      return {
        title: 'Sky Summary',
        text: `Today’s layer adds ${el} emphasis and ${tonal} shading.\n\n${LISTEN_POINTER}`,
      };
    case 'SECTION_PERSONAL_EMPHASIS':
      return {
        title: 'Personal Emphasis',
        text: `You carry ${el} emphasis with ${tonal} shading.\n\n${LISTEN_POINTER}`,
      };
    case 'SECTION_LIKELY_EXPRESSIONS':
      return {
        title: 'Likely Expressions',
        text: `Outward style leans ${el} in a ${tonal} register.\n\n${LISTEN_POINTER}`,
      };
    case 'SECTION_WATCH_FORS':
      return {
        title: 'Watch-Fors',
        text: `Watch for moments when felt pressure rises and the ${tonal} mood shifts, especially if ${el} heat runs high.`,
      };
    case 'SECTION_INTEGRATION':
      return {
        title: 'Integration Prompt',
        text: `Integration balances ${el} drive with the ${tonal} frame.`,
      };
    case 'SECTION_MUSIC_TRANSLATION':
      return {
        title: 'Music Translation',
        text: `Harmony leans ${el}; melody traces ${tonal} brightness.\n\n${LISTEN_POINTER}`,
      };
    case 'SECTION_COMPARISON_SIGNATURES':
      return {
        title: 'Shared and Divergent Signatures',
        text: hasClaim(core, 'CROSS_ELEMENT_DRIFT_HIGH')
          ? `The two pictures diverge strongly in elemental mix. Keep comparisons honest instead of blending them away.`
          : `The two pictures share enough ${el} thread to compare fairly, with contrast still visible.`,
      };
    case 'SECTION_COMPARISON_BRIDGE':
      return {
        title: 'Bridge',
        text: hasClaim(core, 'CROSS_TENSION_DELTA_HIGH')
          ? `Tension habits differ enough that one single story may not fit both. Alternate language can help.`
          : `Tension habits are close enough to share one listening arc without forcing sameness.`,
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
        text: `Between people, the picture highlights: ${bands}.`,
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
