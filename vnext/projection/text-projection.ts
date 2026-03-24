/**
 * TextProjection: deterministic strings from SemanticCore only (no new claims).
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type { SectionTemplateId } from '../semantic/ontology-codes';
import type { ClaimId } from '../semantic/ontology-codes';
import type { ProjectionOptions } from './projection-types';
import type { ProjectedExplanationSection } from './projection-types';
import { applyPhaseDProjection } from './phase-d-projection';

export type { ProjectedExplanationSection };

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

function tensionLabel(core: SemanticCore): string {
  if (hasClaim(core, 'TENSION_BAND_HIGH')) return 'high';
  if (hasClaim(core, 'TENSION_BAND_LOW')) return 'low';
  return 'moderate';
}

/** Seeded tie-break for template variant selection (deterministic). */
function pickVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

function lineForTemplate(
  templateId: SectionTemplateId,
  core: SemanticCore,
  seed: string
): { title: string; text: string; bullets?: string[] } {
  const el = primaryElementLabel(core);
  const tonal = tonalLabel(core);
  const tension = tensionLabel(core);

  switch (templateId) {
    case 'SECTION_SIGNATURES':
      return {
        title: 'Astrological Signatures',
        text: pickVariant(seed, [
          `The chart emphasizes ${el} tones with ${tonal} overall coloring and ${tension} structural tension in the feature field.`,
          `Elemental weighting centers on ${el}, read as ${tonal} in tone, with tension registers at a ${tension} level.`,
        ]),
      };
    case 'SECTION_SIGNIFICANCE':
      return {
        title: 'Personal Significance',
        text: pickVariant(seed, [
          `This pattern suggests pacing and emphasis that follow the ${tonal} band, using ${el} as the primary carrier for moment-to-moment feel.`,
          `Personal salience clusters around ${el} qualities, expressed through a ${tonal} register and ${tension} pressure in the harmonic field.`,
        ]),
      };
    case 'SECTION_MUSICAL':
      return {
        title: 'Musical Identity and Flow',
        text: pickVariant(seed, [
          `Musically, treat ${el} as the timbral center, keep dynamics aligned with ${tonal} contour, and let rhythm reflect ${tension} tension.`,
        ]),
        bullets: [
          `Color: ${el}-weighted palette.`,
          `Contour: ${tonal} brightness curve.`,
          `Groove: ${tension} tension pocket.`,
        ],
      };
    case 'SECTION_SKY_SUMMARY':
      return {
        title: 'Sky Summary',
        text: `The active sky snapshot reads with ${el} emphasis, ${tonal} tonal coloring, and ${tension} tension in the encoded field.`,
      };
    case 'SECTION_PERSONAL_EMPHASIS':
      return {
        title: 'Personal Emphasis',
        text: `Personal emphasis follows ${el} with ${tonal} shading; keep attention on how ${tension} tension shapes pacing.`,
      };
    case 'SECTION_LIKELY_EXPRESSIONS':
      return {
        title: 'Likely Expressions',
        text: `Likely expressions skew toward ${el} modes, voiced in a ${tonal} register, with ${tension} harmonic pressure.`,
      };
    case 'SECTION_WATCH_FORS':
      return {
        title: 'Watch-Fors',
        text: `Watch for ${tension} tension spikes and ${tonal} shifts that ask for steadier phrasing when ${el} runs hot.`,
      };
    case 'SECTION_INTEGRATION':
      return {
        title: 'Integration Prompt',
        text: `Integrate by balancing ${el} drive with the ${tonal} frame, using breath where ${tension} tension peaks.`,
      };
    case 'SECTION_MUSIC_TRANSLATION':
      return {
        title: 'Music Translation',
        text: `Translate to sound by anchoring harmony in ${el}, letting melody trace ${tonal} brightness, and keeping rhythm in a ${tension} pocket.`,
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
        text: 'Composite vector blends multiple charts; anchor geometry follows the pinned slot while this text reflects merged claims only.',
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

const idMap: Partial<Record<SectionTemplateId, string>> = {
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

/**
 * Raw sections from SemanticCore.text emphasis order (Phase B/C templates).
 */
export function buildRawProjectedSections(core: SemanticCore, seed: string): ProjectedExplanationSection[] {
  const out: ProjectedExplanationSection[] = [];
  let i = 0;
  for (const tid of core.text.emphasis_order) {
    const { title, text, bullets } = lineForTemplate(tid, core, `${seed}:${i++}`);
    out.push({
      id: idMap[tid] ?? tid.toLowerCase(),
      title,
      text,
      bullets,
    });
  }
  return out;
}

/**
 * Produce UI sections from core.text emphasis order. Optional Phase D post-process.
 * Two-argument form preserves legacy template-only output for scripts/tests.
 */
export function projectTextFromSemanticCore(
  core: SemanticCore,
  seed: string,
  options?: ProjectionOptions
): ProjectedExplanationSection[] {
  const raw = buildRawProjectedSections(core, seed);
  if (!options || options.phaseD === false) {
    return raw;
  }
  return applyPhaseDProjection(raw, core, seed, options);
}

/** FYP-style short card from the same SemanticCore (Phase D feed surface). */
export function projectFeedCardFromSemanticCore(core: SemanticCore, seed: string): ProjectedExplanationSection[] {
  return applyPhaseDProjection([], core, seed, { phaseD: true, surface: 'feed', tier: 'baseline' });
}
