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

export function listenPointerLine(seed: string, surface: ProjectionSurface | undefined): string {
  const s = surface ?? 'profile';
  return pickVariant(`${seed}|lp|${s}`, [
    'Listen detail lives in “How this sounds (listen metaphor)” below.',
    'The listen metaphor under “How this sounds (listen metaphor)” below carries the sonic read for this pass.',
    'A separate listen line below (same section family) matches these words to texture without duplicating every clause here.',
    'Sonic phrasing is grouped under the listen metaphor below; keep this page as the wording layer.',
    'For replay language, use the listen metaphor section below; it is the paired audio-adjacent line to this text.',
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
  const lp = listenPointerLine(`${seed}:lt`, ctx.surface);

  switch (templateId) {
    case 'SECTION_SIGNIFICANCE':
      return {
        title: ctx.suppressAstrologyTitles ? 'Why it matters' : 'Personal Significance',
        text: pickVariant(seed, [
          `The ${tonal} mood and ${el} weight shape how impact lands. Moments can feel sharper or softer because of that mix.`,
          `The personal punch comes from carrying ${el} qualities inside a ${tonal} mood. Stress and relief often route through that pairing.`,
        ]),
      };
    case 'SECTION_SKY_SUMMARY':
      return {
        title: 'Sky Summary',
        text: `Today’s layer adds ${el} emphasis and ${tonal} shading.\n\n${lp}`,
      };
    case 'SECTION_PERSONAL_EMPHASIS':
      return {
        title: 'Personal Emphasis',
        text: `You carry ${el} emphasis with ${tonal} shading.\n\n${lp}`,
      };
    case 'SECTION_LIKELY_EXPRESSIONS':
      return {
        title: 'Likely Expressions',
        text: `Outward style leans ${el} in a ${tonal} register.\n\n${lp}`,
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
    case 'SECTION_COMPARISON_BRIDGE':
      return {
        title: 'Bridge',
        text: hasClaim(core, 'CROSS_TENSION_DELTA_HIGH')
          ? `Tension habits differ enough that one single story may not fit both. Alternate language can help.`
          : `Tension habits are close enough to share one listening arc without forcing sameness.`,
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
  SECTION_SIGNIFICANCE: 'significance',
  SECTION_SKY_SUMMARY: 'sky_summary',
  SECTION_PERSONAL_EMPHASIS: 'personal_emphasis',
  SECTION_LIKELY_EXPRESSIONS: 'likely_expressions',
  SECTION_WATCH_FORS: 'watch_fors',
  SECTION_INTEGRATION: 'integration_prompt',
  SECTION_COMPARISON_BRIDGE: 'significance',
  SECTION_RELATIONAL_WEATHER: 'relational_weather_v1',
};
