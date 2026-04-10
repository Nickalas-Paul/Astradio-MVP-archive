/**
 * Raw template lines — only consumed by assemble-sections.
 * Musical / pacing / density / harmonic tension / arc wording uses audio-lexicon only.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { SectionTemplateId } from '../../semantic/ontology-codes';
import type { ClaimId } from '../../semantic/ontology-codes';
import {
  arcChangePhraseFromCore,
  densityPhraseFromCore,
  harmonicTensionPhraseFromCore,
  pacingPhraseFromCore,
  rhythmGroovePhraseFromCore,
} from './audio-lexicon';
import type { TopologyClass } from './topology-classify';
import type { TemporalVoiceBucket } from './temporal-classify';

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

export type TemplateContext = {
  readonly suppressAstrologyTitles: boolean;
  readonly topologyClass: TopologyClass;
  readonly temporalBucket: TemporalVoiceBucket;
};

function signaturesTitle(ctx: TemplateContext): string {
  if (ctx.suppressAstrologyTitles) return 'Encoded signatures';
  return 'Astrological Signatures';
}

function aggregateFieldText(core: SemanticCore, seed: string, topology: TopologyClass): string {
  const base =
    'Composite vector blends multiple charts; anchor geometry follows the pinned slot while this text reflects merged claims only.';
  if (topology === 'dyad') {
    return pickVariant(`${seed}:agg:dyad`, [
      `Pair-weighted field: ${base}`,
      `Dyad-composite field: ${base}`,
    ]);
  }
  if (topology === 'field') {
    return pickVariant(`${seed}:agg:field`, [
      `Ensemble-weighted field: ${base}`,
      `Multi-participant field: ${base}`,
    ]);
  }
  return base;
}

export function temporalIntegrationLine(bucket: TemporalVoiceBucket, seed: string): string {
  if (bucket === 'static') {
    return pickVariant(`${seed}:temp:static`, [
      `Temporal read: baseline emphasis stays primary; treat short spikes as modifiers rather than identity replacements.`,
      `Temporal read: slower-varying patterns steer the longer arc; keep near-term signals in proportion to that baseline.`,
    ]);
  }
  if (bucket === 'activated') {
    return pickVariant(`${seed}:temp:act`, [
      `Temporal integration: activated emphasis rides on top of slower baseline patterns; what feels urgent may still be a short spike on a longer curve.`,
      `Daily integration: when the field reads as transit-weighted, shifts may move within hours; smaller adjustments often beat global conclusions.`,
    ]);
  }
  return pickVariant(`${seed}:temp:mix`, [
    `Temporal blend: both baseline and activation layers carry weight; name which timescale you are answering before fixing a single story.`,
    `Mixed temporal weighting: near-term and enduring signals both appear; context usually decides which layer speaks loudest.`,
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
  const audioP = pacingPhraseFromCore(core);
  const audioD = densityPhraseFromCore(core);
  const audioH = harmonicTensionPhraseFromCore(core);
  const audioA = arcChangePhraseFromCore(core);
  const audioG = rhythmGroovePhraseFromCore(core);

  switch (templateId) {
    case 'SECTION_SIGNATURES':
      return {
        title: signaturesTitle(ctx),
        text: pickVariant(seed, [
          `The chart emphasizes ${el} tones with ${tonal} overall coloring; the audio envelope reads ${audioG} in the same semantic source.`,
          `Elemental weighting centers on ${el}, read as ${tonal} in tone, with ${audioH} and ${audioD} describing staging in the encoded envelope.`,
        ]),
      };
    case 'SECTION_SIGNIFICANCE':
      return {
        title: 'Personal Significance',
        text: pickVariant(seed, [
          `This pattern suggests emphasis that follows the ${tonal} band, using ${el} as the primary carrier for moment-to-moment feel, while ${audioP} summarizes motion in the envelope.`,
          `Personal salience clusters around ${el} qualities, expressed through a ${tonal} register, with ${audioH} and ${audioD} naming how intensity layers in staging.`,
        ]),
      };
    case 'SECTION_MUSICAL':
      return {
        title: 'Musical Identity and Flow',
        text: pickVariant(seed, [
          `Musically, treat ${el} as the timbral center, keep dynamics aligned with ${tonal} contour; ${audioG} captures groove, ${audioA} captures arc change, and ${audioH} captures harmonic tension staging from the same envelope.`,
        ]),
        bullets: [
          `Color: ${el}-weighted palette.`,
          `Contour: ${tonal} brightness curve.`,
          `Groove / arc / tension (envelope): ${audioG}; ${audioA}; ${audioH}.`,
        ],
      };
    case 'SECTION_SKY_SUMMARY': {
      const temporalHint =
        ctx.temporalBucket !== 'static'
          ? ` ${temporalIntegrationLine(ctx.temporalBucket, `${seed}:sky`)}`
          : '';
      return {
        title: 'Sky Summary',
        text: `The active sky snapshot reads with ${el} emphasis, ${tonal} tonal coloring, and ${audioG} in the encoded field.${temporalHint}`,
      };
    }
    case 'SECTION_PERSONAL_EMPHASIS':
      return {
        title: 'Personal Emphasis',
        text: `Personal emphasis follows ${el} with ${tonal} shading; keep attention on how ${audioP} and ${audioH} read together in the envelope.`,
      };
    case 'SECTION_LIKELY_EXPRESSIONS':
      return {
        title: 'Likely Expressions',
        text: `Likely expressions skew toward ${el} modes, voiced in a ${tonal} register, with ${audioH} and ${audioD} describing how intensity stacks in staging.`,
      };
    case 'SECTION_WATCH_FORS':
      return {
        title: 'Watch-Fors',
        text: `Watch for shifts where ${audioH} steepens and ${tonal} register moves, especially when ${el} emphasis runs hot; ${audioA} marks where change tends to cluster.`,
      };
    case 'SECTION_INTEGRATION':
      return {
        title: 'Integration Prompt',
        text: `Integrate by balancing ${el} drive with the ${tonal} frame, using steadier phrasing where ${audioH} peaks and ${audioD} feels crowded in the envelope.`,
      };
    case 'SECTION_MUSIC_TRANSLATION':
      return {
        title: 'Music Translation',
        text: `Translate to sound by anchoring harmony in ${el}, letting melody trace ${tonal} brightness, and letting ${audioG} with ${audioA} steer how change is staged in the same readout.`,
      };
    case 'SECTION_COMPARISON_SIGNATURES':
      return {
        title: 'Shared and Divergent Signatures',
        text: hasClaim(core, 'CROSS_ELEMENT_DRIFT_HIGH')
          ? 'Charts diverge strongly in elemental mix; keep comparisons explicit rather than blended.'
          : 'Charts show moderate elemental alignment; shared ${el} threads still appear.'.replace('${el}', el),
      };
    case 'SECTION_COMPARISON_BRIDGE':
      return {
        title: 'Bridge',
        text: hasClaim(core, 'CROSS_TENSION_DELTA_HIGH')
          ? 'Tension profiles differ markedly; alternate phrases rather than forcing a single arc.'
          : 'Tension profiles are close enough for a unified listening arc.',
      };
    case 'SECTION_AGGREGATE_FIELD':
      return {
        title: 'Composite field',
        text: aggregateFieldText(core, seed, ctx.topologyClass),
      };
    case 'SECTION_RELATIONAL_WEATHER': {
      const rel = core.relational;
      const bands = rel?.activation_profile?.length
        ? rel.activation_profile.join(' · ')
        : 'relational bands unavailable';
      return {
        title: 'Relational field (structural)',
        text: `Encoded relational activation profile: ${bands}. Copy is fixed from SemanticCore relational block only.`,
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
