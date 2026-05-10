/**
 * **Proj:** Step 8 — sole module that constructs ProjectedExplanationSection[] (before tone pass).
 * Pipeline ordinal only (not Product phase, not Acct:Stage-*). See apply-unified-projection for execution order.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { EphemerisSnapshot } from '../../contracts';
import type { SemanticClaim, SemanticCore } from '../../semantic/semantic-core';
import type {
  DensityClass,
  ExpansionTier,
  ProjectionOptions,
  ProjectionSurface,
  ProjectedExplanationSection,
  TaggedSectionBody,
} from '../projection-types';
import { SURFACE_SCHEMAS, expansionKeysFor } from '../surface-schemas';
import { densityForSurfaceBaseline, minClaimBodiesForDensity } from '../density-validate';
import type { ClaimOptionalRole } from './claim-expression-bundles';
import {
  buildCampaignPressureResponseParagraph,
  buildSupplementalPanel,
  claimSentencesFromRange,
  capToMaxSentences,
  synthesizeClaimSentences,
} from './claim-synthesize';
import { claimWindow } from './claim-select';
import { selectDominantMechanismSignals } from './dominant-signal-selection';
import { applySurfaceMechanismComposition } from './surface-mechanism-composition';
import { buildAudioStagingBlock } from './audio-lexicon';
import { applyConnectionPreface } from './connection-preface';
import {
  assembleLibraryPlanetaryAspects,
  assembleLibraryRelationalField,
  assembleLibraryRelationalWeather,
} from './library-sections';
import { lineForTemplate, idMap, temporalIntegrationLine, type TemplateContext } from './template-lines';
import { classifyTopology } from './topology-classify';
import { densityForSectionId } from './validate-projection';
import {
  applyAnchorAndTemporalToSectionBody,
  applyAnchorAndTemporalToTaggedSection,
  assertTemplateHasNoLegacyAnchor,
  reducedPadPool,
  repairPhase2ParagraphLoads,
  repairTaggedPhase2ParagraphLoads,
  validatePhase2Sections,
} from './phase2-sentence-load';
import { enrichSectionTextWithTagged } from './assemble-section-tagged';
import { sortUniqueClaimIds } from './section-ownership';
import {
  reconstructTaggedSectionBody,
  taggedSectionBodyFromText,
  taggedSectionFromTemplateLine,
} from '../tagged-text';
import {
  buildAspectKey,
  getAspectInsight,
  getRelationalInsight,
  getStructuralInsight,
  type AspectInsight,
} from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../insight-library/synastry-aspect-library-render';
import { buildPlacementKeys, PLANET_TIERS, type PlacementKey } from '../placement-keys';
import type { DirectedSnapshotAspect } from '../../synastry/synastry-types';

function pickVariant(seed: string, variants: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

const PAD_SENTENCES = reducedPadPool();

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function normalizeAudioExplanationBody(audioText: string): string {
  return audioText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
}

function tierOpeningClause(surface: ProjectionSurface, tier: ExpansionTier, seed: string): string | null {
  if (tier === 'baseline') return null;
  const bySurface: Record<ProjectionSurface, { expanded: string[]; extended: string[] }> = {
    profile: {
      expanded: ['Expanded pass adds mid-rank threads that explain how the same pattern shifts across context.'],
      extended: ['Extended pass folds in lower-ranked moderator threads to map nuance, not just the dominant headline.'],
    },
    daily: {
      expanded: ['Expanded daily pass adds near-term timing nuance around the same active sky signal.'],
      extended: ['Expanded daily pass adds secondary timing modifiers and contrast handling.'],
    },
    sandbox: {
      expanded: ['Expanded sandbox pass adds threads that shift when you change lab controls.'],
      extended: ['Expanded sandbox pass adds second-order effects for edge-condition sensitivity.'],
    },
    overlay_pair: {
      expanded: ['Expanded overlay pass adds explicit natal-versus-sky layering detail.'],
      extended: ['Expanded overlay pass adds moderator threads across both time layers.'],
    },
    compat_pair: {
      expanded: ['Expanded pass adds mid-level threads beyond the baseline framing.'],
      extended: ['Extended pass adds secondary moderators and contrast handling.'],
    },
    group: {
      expanded: ['Expanded pass adds mid-level threads beyond the baseline framing.'],
      extended: ['Extended pass adds secondary moderators and contrast handling.'],
    },
    campaign: {
      expanded: ['Expanded campaign pass adds pressure-response detail beyond baseline response guidance.'],
      extended: ['Extended campaign pass adds secondary pressure moderators for turn-level adaptation.'],
    },
    feed: {
      expanded: ['Expanded feed pass adds one context layer while staying concise.'],
      extended: ['Extended feed pass adds one deeper synthesis hint without turning into a full report.'],
    },
  };
  const variants = tier === 'expanded' ? bySurface[surface].expanded : bySurface[surface].extended;
  return pickVariant(`${seed}:open:${surface}:${tier}`, variants);
}

function appendSectionGroupBlock(
  extras: string[],
  claimIds: string[],
  usedWithinGroup: Set<string>,
  block: { text: string; claimIds: string[] } | null
): void {
  if (!block) return;
  const fresh = block.claimIds.filter((id) => !usedWithinGroup.has(id));
  if (fresh.length === 0 && block.claimIds.length > 0) return;
  extras.push(block.text);
  for (const id of fresh) {
    usedWithinGroup.add(id);
    claimIds.push(id);
  }
  if (block.claimIds.length === 0) {
    return;
  }
}

/**
 * Appends a block to section extras. Only `provenance === 'claim_body'` ids are recorded in
 * `bodyClaimIdsOut` (actual `renderClaimExpressionBlock` usage — mep and supplemental panels).
 * Non-claim_body blocks always append when non-null (synthesis_wrapper, tier_scaffold, padding).
 */
function appendSectionGroupTagged(
  extras: string[],
  extrasTagged: TaggedSectionBody[],
  usedWithinGroup: Set<string>,
  block: { text: string; claimIds: string[] } | null,
  provenance: import('../projection-types').ProvenanceType,
  bodyClaimIdsOut: string[]
): void {
  if (!block) return;
  if (provenance === 'claim_body') {
    const fresh = block.claimIds.filter((id) => !usedWithinGroup.has(id));
    if (fresh.length === 0 && block.claimIds.length > 0) return;
    extras.push(block.text);
    extrasTagged.push(taggedSectionBodyFromText(block.text, provenance));
    for (const id of fresh) {
      usedWithinGroup.add(id);
      bodyClaimIdsOut.push(id);
    }
    return;
  }
  extras.push(block.text);
  extrasTagged.push(taggedSectionBodyFromText(block.text, provenance));
}

function applyAggregateSurfaceIdentityOverrides(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface,
  seed: string,
  core: SemanticCore,
  tierEff: ExpansionTier,
  reportPadUsed: Set<string>
): ProjectedExplanationSection[] {
  if (surface !== 'compat_pair' && surface !== 'group') return sections;
  const out = sections.map((s) => ({ ...s }));
  const schema = SURFACE_SCHEMAS[surface];
  const defaultD = densityForSurfaceBaseline(schema.baselineDensityDefault, tierEff);
  const d = densityForSectionId('relational_field', defaultD);
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    if (s.id !== 'relational_field') continue;
    const baseIdentity =
      surface === 'compat_pair'
        ? pickVariant(`${seed}:compat:rel`, [
            'Two-person timing and mutual regulation stay in view before wider generalization.',
            'Contact stays an interface between two people, not a crowd average.',
            'Dyad framing keeps both people visible as separate centers before blend reads.',
            'The baseline picture weights what both charts show together, not a solo verdict.',
          ])
        : pickVariant(`${seed}:group:rel`, [
            'Emphasis spreads across the room before zooming to one pair.',
            'The room holds many voices and local clusters; it is not only one pair story.',
            'A wider field shows before any single dyad line carries the whole meaning.',
            'Several centers stay visible; the blend is not reducible to one corner of the room.',
          ]);
    const idTagged = taggedSectionBodyFromText(baseIdentity, 'synthesis_wrapper');
    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      baseIdentity,
      idTagged,
      [],
      [],
      d,
      `${seed}:${surface === 'compat_pair' ? 'compat' : 'group'}:rel:enrich:${i}`,
      [],
      reportPadUsed,
      PAD_SENTENCES
    );
    out[i] = {
      ...s,
      text,
      meta: { ...s.meta, claimIdsReferenced: sortUniqueClaimIds(claimIds), phaseD: true, tagged, enrichDensity: d },
    };
  }
  return out;
}

/** Phase 3 — must not appear in sandbox (stripped in assembly, validated in validate-projection). */
const SANDBOX_STRIP_SECTION_IDS = new Set<string>([
  'relational_field',
  'relational_weather_v1',
  'connection_structure',
  'ensemble_framing',
  'interaction_map',
  'field_distribution',
  'subcluster',
  'audio_thread',
  'contradiction_map',
  'synthesis_b',
]);

function bySectionIdBucket(sections: ProjectedExplanationSection[]): Map<string, ProjectedExplanationSection[]> {
  const m = new Map<string, ProjectedExplanationSection[]>();
  for (const s of sections) {
    const a = m.get(s.id) ?? [];
    a.push(s);
    m.set(s.id, a);
  }
  return m;
}

function pluckId(m: Map<string, ProjectedExplanationSection[]>, id: string): ProjectedExplanationSection[] {
  const a = m.get(id);
  if (!a) return [];
  m.delete(id);
  return a;
}

function depthPanelSectionsSorted(sections: ProjectedExplanationSection[]): ProjectedExplanationSection[] {
  return sections
    .filter((s) => /^depth_panel_\d+$/.test(s.id))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * Phase 3 — deterministic final section order; does not change section bodies (only array order;
 * for sandbox, also strips disallowed ids before ordering).
 */
function filterAndOrderPhase3Sections(sections: ProjectedExplanationSection[], surface: ProjectionSurface): ProjectedExplanationSection[] {
  if (!['profile', 'sandbox', 'group', 'compat_pair'].includes(surface)) {
    return sections;
  }
  const base =
    surface === 'sandbox' ? sections.filter((s) => !SANDBOX_STRIP_SECTION_IDS.has(s.id)) : sections.slice();
  if (base.length === 0) return base;

  const depthSorted = depthPanelSectionsSorted(base);
  const m = bySectionIdBucket(
    base.filter((s) => !/^depth_panel_\d+$/.test(s.id))
  );

  const withDepths = (order: (string | '__DEPTH__')[]): ProjectedExplanationSection[] => {
    const out: ProjectedExplanationSection[] = [];
    for (const id of order) {
      if (id === '__DEPTH__') {
        out.push(...depthSorted);
        continue;
      }
      out.push(...pluckId(m, id as string));
    }
    for (const [, arr] of m) {
      for (const s of arr) out.push(s);
    }
    return out;
  };

  if (surface === 'profile') {
    const o = withDepths([
      'core_identity',
      'personal_expression',
      'growth_expansion',
      'evolutionary_currents',
      'aspects',
      'signatures',
      'trait_bridge',
      'synthesis_a',
      'synthesis_b',
      'musical',
      'contradiction_map',
      '__DEPTH__',
      'audio_staging',
      'audio_thread',
    ]);
    return o;
  }

  if (surface === 'sandbox') {
    return withDepths([
      'aspects',
      'delta_emphasis',
      'synthesis_a',
      'musical',
      '__DEPTH__',
      'audio_staging',
    ]);
  }

  if (surface === 'compat_pair') {
    return withDepths([
      'core_identity',
      'personal_expression',
      'growth_expansion',
      'evolutionary_currents',
      'no_activations',
      'synthesis_a',
      'synthesis_b',
      'connection_structure',
      'relational_field',
      'relational_weather_v1',
      'aspects',
      'interaction_map',
      'musical',
      '__DEPTH__',
      'audio_staging',
      'audio_thread',
    ]);
  }

  if (surface === 'group') {
    return withDepths([
      'ensemble_framing',
      'group_key_interactions_v1',
      'relational_field',
      'relational_weather_v1',
      'signatures',
      'field_distribution',
      'synthesis_a',
      'synthesis_b',
      'subcluster',
      'musical',
      '__DEPTH__',
      'audio_staging',
      'audio_thread',
    ]);
  }

  return base;
}

export function buildEmphasisRawSections(
  core: SemanticCore,
  seed: string,
  templateCtx: TemplateContext
): ProjectedExplanationSection[] {
  const out: ProjectedExplanationSection[] = [];
  let i = 0;
  for (const tid of core.text.emphasis_order) {
    const id = idMap[tid];
    if (!id) continue;
    const { title, text, bullets } = lineForTemplate(tid, core, `${seed}:${i++}`, templateCtx);
    out.push({
      id,
      title,
      text,
      bullets,
      meta: { tagged: taggedSectionFromTemplateLine(text, bullets) },
    });
  }
  return out;
}

export function buildFeedSections(
  core: SemanticCore,
  seed: string,
  options: ProjectionOptions
): ProjectedExplanationSection[] {
  const sections: ProjectedExplanationSection[] = [];
  const sectionRoleDeque: ClaimOptionalRole[] = [];
  const paragraphNormDeque: string[] = [];
  const claimSlice = claimSentencesFromRange(
    core,
    0,
    1,
    `${seed}:feed:signal`,
    'feed',
    'baseline',
    sectionRoleDeque,
    paragraphNormDeque,
    'feed_signal'
  );
  const feedSignalClaim = claimSlice.claimIds[0];
  const feedStructInsight = feedSignalClaim ? getStructuralInsight(feedSignalClaim) : undefined;
  if (feedStructInsight?.feed) {
    const feedSignalText = capToMaxSentences(feedStructInsight.feed, 2);
    sections.push({
      id: 'feed_signal',
      title: 'Signal',
      text: feedSignalText,
      meta: {
        enrichDensity: 'short',
        claimIdsReferenced: sortUniqueClaimIds([feedSignalClaim]),
        phaseD: true,
        tagged: taggedSectionBodyFromText(feedSignalText, 'claim_body'),
      },
    });
  }

  const feedThemes: readonly string[] = options.relationalWeatherThemes ?? [];
  const feedWeatherInsight = feedThemes[0] ? getRelationalInsight(feedThemes[0]) : undefined;
  if (feedWeatherInsight?.feed) {
    const feedContextText = capToMaxSentences(feedWeatherInsight.feed, 2);
    sections.push({
      id: 'feed_context',
      title: 'Scope',
      text: feedContextText,
      meta: {
        enrichDensity: 'short',
        claimIdsReferenced: [],
        phaseD: true,
        tagged: taggedSectionBodyFromText(feedContextText, 'claim_body'),
      },
    });
  }

  return sections;
}

export type PhaseDAssemblyParams = {
  /** @deprecated Ignored — sections are rebuilt with full TemplateContext (surface-aware). */
  raw?: ProjectedExplanationSection[];
  core: SemanticCore;
  seed: string;
  options: ProjectionOptions;
  tierMetaRequested: ExpansionTier;
  tierEff: ExpansionTier;
  surface: ProjectionSurface;
  temporalBucket: import('./temporal-classify').TemporalVoiceBucket;
};

/**
 * Assemble placement sections for Profile Identity
 * Creates 4-tier graduated depth structure
 */
function assembleProfileIdentityPlacementSections(snapshot: EphemerisSnapshot): ProjectedExplanationSection[] {
  const placementKeys = buildPlacementKeys(snapshot);
  const sections: ProjectedExplanationSection[] = [];

  sections.push(
    assemblePlacementTier({
      tierId: 'core_identity',
      title: 'Core Identity Architecture',
      subtitle: 'The Foundation of Self',
      planets: PLANET_TIERS.core_identity,
      placementKeys,
      depth: 'full',
    })
  );
  sections.push(
    assemblePlacementTier({
      tierId: 'personal_expression',
      title: 'Personal Expression',
      subtitle: 'How You Communicate, Connect, and Create',
      planets: PLANET_TIERS.personal_expression,
      placementKeys,
      depth: 'full',
    })
  );
  sections.push(
    assemblePlacementTier({
      tierId: 'growth_expansion',
      title: 'Growth and Expansion',
      subtitle: 'Your Path of Development',
      planets: PLANET_TIERS.growth_expansion,
      placementKeys,
      depth: 'medium',
    })
  );
  sections.push(
    assemblePlacementTier({
      tierId: 'evolutionary_currents',
      title: 'Evolutionary Currents',
      subtitle: 'Generational Themes and Deep Transformation',
      planets: PLANET_TIERS.evolutionary_currents,
      placementKeys,
      depth: 'concise',
    })
  );

  return sections.filter((s) => s.text && s.text.trim().length > 0);
}

function assemblePlacementTier(config: {
  tierId: string;
  title: string;
  subtitle: string;
  planets: readonly string[];
  placementKeys: PlacementKey[];
  depth: 'full' | 'medium' | 'concise';
}): ProjectedExplanationSection {
  const paragraphs: string[] = [];

  for (const planetName of config.planets) {
    const placement = config.placementKeys.find((pk) => pk.planet === planetName);
    if (!placement) continue;

    const planetBlock = assemblePlanetPlacement(placement, config.depth);
    if (planetBlock) paragraphs.push(planetBlock);
  }

  const body = paragraphs.join('\n\n---\n\n');
  const text = config.subtitle ? `${config.subtitle}\n\n${body}`.trim() : body;
  return {
    id: config.tierId,
    title: config.title,
    text,
    bullets: [],
    meta: { tagged: taggedSectionBodyFromText(text, 'template') },
  };
}

function assemblePlanetPlacement(placement: PlacementKey, depth: 'full' | 'medium' | 'concise'): string | null {
  const signInsight = getAspectInsight(placement.signKey);
  const houseInsight = getAspectInsight(placement.houseKey);

  if (!signInsight && !houseInsight) return null;

  const parts: string[] = [];
  const planetDisplay = placement.planet.charAt(0).toUpperCase() + placement.planet.slice(1).toLowerCase();
  const signDisplay = placement.sign.charAt(0).toUpperCase() + placement.sign.slice(1).toLowerCase();
  const ordinal = getOrdinalSuffix(placement.house);
  parts.push(`### ${planetDisplay} in ${signDisplay}, ${ordinal} House`);

  if (signInsight) {
    if (depth === 'full' || depth === 'medium') {
      parts.push('**Archetypal Expression**');
      parts.push(signInsight.core || '');
      parts.push('**Observable Patterns**');
      parts.push(signInsight.behavioral || '');
      if (depth === 'full') {
        parts.push('**Sonic Signature**');
        parts.push(signInsight.sonic || '');
      }
    } else {
      parts.push(signInsight.core || '');
    }
  }

  if (houseInsight) {
    if (depth === 'full') {
      parts.push('**Life Arena**');
      parts.push(houseInsight.core || '');
      parts.push('**Manifestation Context**');
      parts.push(houseInsight.behavioral || '');
      parts.push('**Aesthetic Resonance**');
      parts.push(houseInsight.sonic || '');
    } else if (depth === 'medium') {
      parts.push('**Life Arena**');
      parts.push(houseInsight.core || '');
      parts.push('**Manifestation Context**');
      parts.push(houseInsight.behavioral || '');
    } else {
      parts.push('**Life Context**');
      parts.push(houseInsight.core || '');
    }
  }

  return parts.filter((p) => p && p.trim().length > 0).join('\n\n');
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function formatPlanetName(planet: string): string {
  const p = String(planet || '').toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatSignName(sign: string): string {
  const s = String(sign || '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHouseName(house: number): string {
  return `${getOrdinalSuffix(house)} House`;
}

function formatAspectName(aspect: string): string {
  return String(aspect || '').toLowerCase();
}

function buildMinimalOverlaySections(): ProjectedExplanationSection[] {
  const text =
    'Your natal chart is in a relatively quiet period with no significant transiting aspects forming close connections to your personal planets.';
  return [
    {
      id: 'no_activations',
      title: 'Current Transit Window',
      text,
      bullets: [],
      meta: { tagged: taggedSectionBodyFromText(text, 'template') },
    },
  ];
}

function assembleOverlayActivationSections(options: ProjectionOptions): ProjectedExplanationSection[] {
  const natalSnapshot = options.snapshot;
  const transitSnapshot = options.secondarySnapshot;
  if (!natalSnapshot || !transitSnapshot) return buildMinimalOverlaySections();

  const transitAspects = [...(options.pairInteractionAspects ?? [])];
  if (transitAspects.length === 0) return buildMinimalOverlaySections();

  const tiers: Array<{
    id: string;
    title: string;
    subtitle: string;
    natalBodies: readonly string[];
    depth: 'full' | 'medium' | 'concise';
  }> = [
    {
      id: 'core_identity',
      title: 'Core Identity Architecture',
      subtitle: 'Fundamental Self-Expression Under Current Influence',
      natalBodies: PLANET_TIERS.core_identity,
      depth: 'full',
    },
    {
      id: 'personal_expression',
      title: 'Personal Expression',
      subtitle: 'Communication, Values, and Drive in Current Context',
      natalBodies: PLANET_TIERS.personal_expression,
      depth: 'full',
    },
    {
      id: 'growth_expansion',
      title: 'Growth and Expansion',
      subtitle: 'Long-Term Development and Structure',
      natalBodies: PLANET_TIERS.growth_expansion,
      depth: 'medium',
    },
    {
      id: 'evolutionary_currents',
      title: 'Evolutionary Currents',
      subtitle: 'Generational and Transformative Forces',
      natalBodies: PLANET_TIERS.evolutionary_currents,
      depth: 'concise',
    },
  ];

  const natalPlacements = buildPlacementKeys(natalSnapshot);
  const transitPlacements = buildPlacementKeys(transitSnapshot);
  const sections: ProjectedExplanationSection[] = [];

  for (const tier of tiers) {
    const tierAspects = transitAspects.filter((aspect) =>
      tier.natalBodies.includes(String(aspect.bodyA || '').toUpperCase())
    );
    if (tierAspects.length === 0) continue;

    const activationsByPlanet = groupBy(tierAspects, (a) => String(a.bodyA || '').toUpperCase());
    const planetNarratives: string[] = [];

    for (const natalPlanet of tier.natalBodies) {
      const aspects = activationsByPlanet[natalPlanet];
      if (!aspects || aspects.length === 0) continue;

      const natalPlacement = natalPlacements.find((p) => p.planet === natalPlanet);
      if (!natalPlacement) continue;

      const natalSignInsight = getAspectInsight(natalPlacement.signKey);
      const natalHouseInsight = getAspectInsight(natalPlacement.houseKey);
      const natalPlacementCore = [natalSignInsight?.core, natalHouseInsight?.core]
        .filter(Boolean)
        .join(' ');
      if (!natalPlacementCore) continue;

      let planetText = `**Your ${formatPlanetName(natalPlanet)} in ${formatSignName(natalPlacement.sign)}, ${formatHouseName(natalPlacement.house)}**\n\n`;
      if (tier.depth === 'full') {
        planetText += `${natalPlacementCore}\n\n`;
      } else if (tier.depth === 'medium') {
        planetText += `${natalPlacementCore.split('.')[0]}.\n\n`;
      } else {
        planetText += `Your ${natalPlanet.toLowerCase()} placement.\n\n`;
      }

      for (const aspect of aspects) {
        const transitPlanet = String(aspect.bodyB || '').toUpperCase();
        const transitPlacement = transitPlacements.find((p) => p.planet === transitPlanet);
        if (!transitPlacement) continue;

        const aspectKey = buildAspectKey(String(aspect.bodyA || ''), String(aspect.bodyB || ''), String(aspect.type || ''));
        const aspectInsight = getAspectInsight(aspectKey);
        if (!aspectInsight) continue;

        planetText += `Your ${natalPlanet.toLowerCase()} is currently being activated by **transiting ${formatPlanetName(transitPlanet)} in ${formatSignName(transitPlacement.sign)}** (${formatHouseName(transitPlacement.house)}), forming a ${formatAspectName(String(aspect.type || ''))}. `;

        const aspectText = [aspectInsight.core_transit || aspectInsight.core, aspectInsight.behavioral_transit || aspectInsight.behavioral]
          .filter(Boolean)
          .join(' ');
        planetText += `${aspectText}\n\n`;

        const transitSignInsight = getAspectInsight(transitPlacement.signKey);
        const transitHouseInsight = getAspectInsight(transitPlacement.houseKey);
        const transitPlacementCore = [transitSignInsight?.core, transitHouseInsight?.core]
          .filter(Boolean)
          .join(' ');
        if (transitPlacementCore) {
          if (tier.depth === 'full') {
            planetText += `Transiting ${transitPlanet.toLowerCase()} ${transitPlacementCore}\n\n`;
          } else if (tier.depth === 'medium') {
            planetText += `Transiting ${transitPlanet.toLowerCase()} ${transitPlacementCore.split('.')[0]}.\n\n`;
          }
        }
        planetText += '---\n\n';
      }
      planetNarratives.push(planetText.trim());
    }

    if (planetNarratives.length > 0) {
      const text = `${tier.subtitle}\n\n${planetNarratives.join('\n\n')}`.trim();
      sections.push({
        id: tier.id,
        title: tier.title,
        text,
        bullets: [],
        meta: { tagged: taggedSectionBodyFromText(text, 'template') },
      });
    }
  }

  return sections.length > 0 ? sections : buildMinimalOverlaySections();
}

function buildMinimalCompatSynastryActivationSections(): ProjectedExplanationSection[] {
  const text =
    'No seeker-to-partner activations matched the personal-planet tiers in this pass. The compatibility sections below still describe how your charts meet in the shared field.';
  return [
    {
      id: 'no_activations',
      title: 'Synastry Overview',
      text,
      bullets: [],
      meta: { tagged: taggedSectionBodyFromText(text, 'template') },
    },
  ];
}

const GROUP_KEY_INTERACTIONS_V1_MAX = 10;

/**
 * Phase 6E-Beta — labeled top synastry rows for group aggregates (3+ participants).
 * Skips when labels or directed synastry are absent, or when no library rows survive kill-list + lookup.
 */
function assembleGroupKeyInteractionsV1(
  options: ProjectionOptions,
  seed: string,
  reportPadUsed: Set<string>,
  densityDefault: DensityClass
): ProjectedExplanationSection[] {
  if (options.surface !== 'group') return [];
  if ((options.participantCount ?? 0) <= 2) return [];
  const labels = options.aggregateParticipantLabelsV1;
  if (!labels || labels.length === 0) return [];
  const v2 = options.pairInteractionAspectsV2;
  if (!v2 || v2.length === 0) return [];

  const labelAt = (slot: number): string => {
    const row = labels.find((l) => l.slotIndex === slot);
    return row?.label ?? `Person ${slot + 1}`;
  };

  /** "YOUR Mars" / "Alice's Mars" — avoid "YOUR's Mars". */
  const possessivePlanetPhrase = (label: string, planetDisplay: string): string =>
    label === 'YOUR' ? `YOUR ${planetDisplay}` : `${label}'s ${planetDisplay}`;

  const connectionMode = options.connectionMode ?? 'none';
  const romanticPairSurface =
    connectionMode === 'lovers' || (connectionMode as string) === 'romantic';
  const synVariant: 'romantic' | 'friendship' = romanticPairSurface ? 'romantic' : 'friendship';

  const blocks: string[] = [];
  const seenUnorderedPairAndAspect = new Set<string>();
  for (const asp of v2) {
    if (blocks.length >= GROUP_KEY_INTERACTIONS_V1_MAX) break;
    const key = buildAspectKey(String(asp.bodyA), String(asp.bodyB), String(asp.type));
    if (isAspectLibraryKillListed(key)) continue;
    const slotLo = Math.min(asp.sourceSlotIndex, asp.targetSlotIndex);
    const slotHi = Math.max(asp.sourceSlotIndex, asp.targetSlotIndex);
    const dedupeKey = `${slotLo}|${slotHi}|${key}`;
    if (seenUnorderedPairAndAspect.has(dedupeKey)) continue;
    const insight = getAspectInsight(key);
    if (!insight) continue;
    seenUnorderedPairAndAspect.add(dedupeKey);
    const src = labelAt(asp.sourceSlotIndex);
    const tgt = labelAt(asp.targetSlotIndex);
    const header = `${possessivePlanetPhrase(src, formatPlanetName(String(asp.bodyA)))} ${formatAspectName(String(asp.type))} ${possessivePlanetPhrase(tgt, formatPlanetName(String(asp.bodyB)))}`;
    const body = composeSynastryMepAspectParagraph(insight, synVariant);
    blocks.push(`${header}\n\n${body}`);
  }

  if (blocks.length === 0) return [];

  const combined = blocks.join('\n\n---\n\n');
  const synTagged = taggedSectionBodyFromText(combined, 'template');
  const d = densityForSectionId('group_key_interactions_v1', densityDefault);
  const { text, claimIds, tagged } = enrichSectionTextWithTagged(
    combined,
    synTagged,
    [],
    [],
    d,
    `${seed}:gki`,
    [],
    reportPadUsed,
    PAD_SENTENCES
  );

  return [
    {
      id: 'group_key_interactions_v1',
      title: 'Key interactions',
      text,
      meta: {
        enrichDensity: d,
        claimIdsReferenced: sortUniqueClaimIds(claimIds),
        phaseD: true,
        tagged,
      },
    },
  ];
}

/**
 * Phase 6C — seeker-anchored synastry activation tiers (compat_pair). Mirrors overlay tiering; uses synastry library fields via `composeSynastryMepAspectParagraph`.
 * Requires Alpha options: `pairInteractionAspectsV2`, `comparisonSeekerContextV1`, `snapshot` (seeker), `secondarySnapshot` (target).
 */
function assembleCompatActivationSections(options: ProjectionOptions): ProjectedExplanationSection[] {
  const seekerSnap = options.snapshot;
  const targetSnap = options.secondarySnapshot;
  const v2 = options.pairInteractionAspectsV2;
  const ctx = options.comparisonSeekerContextV1;
  if (!seekerSnap || !targetSnap || !v2 || !ctx) {
    return buildMinimalCompatSynastryActivationSections();
  }

  const connectionMode = options.connectionMode ?? 'none';
  const romanticPairSurface =
    connectionMode === 'lovers' || (connectionMode as string) === 'romantic';
  const synVariant = romanticPairSurface ? 'romantic' : 'friendship';

  const seekerDirected = v2.filter(
    (a) =>
      a.sourceSlotIndex === ctx.seekerSlotIndex && a.targetSlotIndex === ctx.targetSlotIndex
  );
  if (seekerDirected.length === 0) {
    return buildMinimalCompatSynastryActivationSections();
  }

  const tiers: Array<{
    id: string;
    title: string;
    subtitle: string;
    natalBodies: readonly string[];
    depth: 'full' | 'medium' | 'concise';
  }> = [
    {
      id: 'core_identity',
      title: 'Core Identity Architecture',
      subtitle: 'Fundamental Self-Expression in Relationship',
      natalBodies: PLANET_TIERS.core_identity,
      depth: 'full',
    },
    {
      id: 'personal_expression',
      title: 'Personal Expression',
      subtitle: 'Communication, Values, and Drive Between You',
      natalBodies: PLANET_TIERS.personal_expression,
      depth: 'full',
    },
    {
      id: 'growth_expansion',
      title: 'Growth and Expansion',
      subtitle: 'Long-Term Development and Structure',
      natalBodies: PLANET_TIERS.growth_expansion,
      depth: 'medium',
    },
    {
      id: 'evolutionary_currents',
      title: 'Evolutionary Currents',
      subtitle: 'Generational and Transformative Forces',
      natalBodies: PLANET_TIERS.evolutionary_currents,
      depth: 'concise',
    },
  ];

  const seekerPlacements = buildPlacementKeys(seekerSnap);
  const targetPlacements = buildPlacementKeys(targetSnap);
  const sections: ProjectedExplanationSection[] = [];

  for (const tier of tiers) {
    const tierAspects = seekerDirected.filter((aspect) =>
      tier.natalBodies.includes(String(aspect.bodyA || '').toUpperCase())
    );
    if (tierAspects.length === 0) continue;

    const activationsByPlanet = groupBy(tierAspects, (a) => String(a.bodyA || '').toUpperCase());
    const planetNarratives: string[] = [];

    for (const natalPlanet of tier.natalBodies) {
      const aspects = activationsByPlanet[natalPlanet];
      if (!aspects || aspects.length === 0) continue;

      const natalPlacement = seekerPlacements.find((p) => p.planet === natalPlanet);
      if (!natalPlacement) continue;

      const natalSignInsight = getAspectInsight(natalPlacement.signKey);
      const natalHouseInsight = getAspectInsight(natalPlacement.houseKey);
      const natalPlacementCore = [natalSignInsight?.core, natalHouseInsight?.core]
        .filter(Boolean)
        .join(' ');
      if (!natalPlacementCore) continue;

      let planetText = `**Your ${formatPlanetName(natalPlanet)} in ${formatSignName(natalPlacement.sign)}, ${formatHouseName(natalPlacement.house)}**\n\n`;
      if (tier.depth === 'full') {
        planetText += `${natalPlacementCore}\n\n`;
      } else if (tier.depth === 'medium') {
        planetText += `${natalPlacementCore.split('.')[0]}.\n\n`;
      } else {
        planetText += `Your ${natalPlanet.toLowerCase()} placement.\n\n`;
      }

      for (const aspect of aspects) {
        const theirPlanet = String(aspect.bodyB || '').toUpperCase();
        const theirPlacement = targetPlacements.find((p) => p.planet === theirPlanet);
        if (!theirPlacement) continue;

        const aspectKey = buildAspectKey(
          String(aspect.bodyA || ''),
          String(aspect.bodyB || ''),
          String(aspect.type || '')
        );
        if (isAspectLibraryKillListed(aspectKey)) continue;
        const aspectInsight = getAspectInsight(aspectKey);
        if (!aspectInsight) continue;

        planetText += `Your ${natalPlanet.toLowerCase()} is activated by **their ${formatPlanetName(theirPlanet)} in ${formatSignName(theirPlacement.sign)}** (${formatHouseName(theirPlacement.house)}), forming a ${formatAspectName(String(aspect.type || ''))}. `;

        planetText += `${composeSynastryMepAspectParagraph(aspectInsight, synVariant)}\n\n`;
        planetText += '---\n\n';
      }
      planetNarratives.push(planetText.trim());
    }

    if (planetNarratives.length > 0) {
      const text = `${tier.subtitle}\n\n${planetNarratives.join('\n\n')}`.trim();
      sections.push({
        id: tier.id,
        title: tier.title,
        text,
        bullets: [],
        meta: { tagged: taggedSectionBodyFromText(text, 'template') },
      });
    }
  }

  return sections.length > 0 ? sections : buildMinimalCompatSynastryActivationSections();
}

/** Gamma — top N seeker→partner aspects per synthesis block (ranked). */
const SYNASTRY_SYNTH_A_MAX = 6;
const SYNASTRY_SYNTH_B_MAX = 6;

/**
 * Phase 6C-Gamma — library-driven synthesis bodies for compat_pair when V2 + seeker context exist.
 */
function buildSynastryLibrarySynthesisSectionBodies(
  options: ProjectionOptions,
  includeSynthesisB: boolean
): { aText: string; bText: string | null } {
  const v2 = options.pairInteractionAspectsV2;
  const ctx = options.comparisonSeekerContextV1;
  if (!v2 || !ctx) {
    return { aText: '', bText: null };
  }
  const connectionMode = options.connectionMode ?? 'none';
  const romanticPair = connectionMode === 'lovers' || (connectionMode as string) === 'romantic';
  const variant = romanticPair ? 'romantic' : 'friendship';

  const directed = v2.filter(
    (a) => a.sourceSlotIndex === ctx.seekerSlotIndex && a.targetSlotIndex === ctx.targetSlotIndex
  );

  const ranked: { asp: DirectedSnapshotAspect; insight: AspectInsight }[] = [];
  for (const asp of directed) {
    const key = buildAspectKey(asp.bodyA, asp.bodyB, asp.type);
    if (isAspectLibraryKillListed(key)) continue;
    const insight = getAspectInsight(key);
    if (!insight) continue;
    ranked.push({ asp, insight });
  }
  ranked.sort((x, y) => {
    const dex = (y.asp.exactness ?? 0) - (x.asp.exactness ?? 0);
    if (dex !== 0) return dex;
    const dpb = (y.asp.priorityBase ?? 0) - (x.asp.priorityBase ?? 0);
    if (dpb !== 0) return dpb;
    return (x.asp.orb ?? 99) - (y.asp.orb ?? 99);
  });

  const block = (slice: { asp: DirectedSnapshotAspect; insight: AspectInsight }[]) =>
    slice
      .map(({ asp, insight }) => {
        const header = `**${formatPlanetName(String(asp.bodyA))} ${formatAspectName(String(asp.type))} ${formatPlanetName(String(asp.bodyB))}**`;
        return `${header}\n\n${composeSynastryMepAspectParagraph(insight, variant)}`;
      })
      .join('\n\n');

  const sliceA = ranked.slice(0, SYNASTRY_SYNTH_A_MAX);
  const sliceB = includeSynthesisB
    ? ranked.slice(SYNASTRY_SYNTH_A_MAX, SYNASTRY_SYNTH_A_MAX + SYNASTRY_SYNTH_B_MAX)
    : [];

  const aText = block(sliceA).trim();
  const bRaw = block(sliceB).trim();
  const bText = includeSynthesisB && bRaw.length > 0 ? bRaw : null;
  return { aText, bText };
}

export function assemblePhaseDSections(params: PhaseDAssemblyParams): ProjectedExplanationSection[] {
  const { core, seed, options, tierEff, surface, temporalBucket } = params;
  const schema = SURFACE_SCHEMAS[surface];

  if (surface === 'feed') {
    return buildFeedSections(core, seed, options);
  }

  if (surface === 'overlay_pair') {
    return assembleOverlayActivationSections(options);
  }

  const templateCtx: TemplateContext = {
    suppressAstrologyTitles: surface === 'campaign',
    topologyClass: classifyTopology(options),
    temporalBucket,
    surface,
  };
  const rawBuilt = buildEmphasisRawSections(core, seed, templateCtx);
  const temporalLine =
    temporalBucket !== 'static' ? temporalIntegrationLine(temporalBucket, `${seed}:anch-temp`) : null;
  const raw = rawBuilt.map((sec) => {
    assertTemplateHasNoLegacyAnchor(sec.text, sec.id);
    const merged = applyAnchorAndTemporalToSectionBody(sec.id, sec.text, templateCtx, seed, temporalLine);
    const mergedTagged = applyAnchorAndTemporalToTaggedSection(
      sec.id,
      sec.meta!.tagged!,
      templateCtx,
      temporalLine
    );
    if (merged !== reconstructTaggedSectionBody(mergedTagged)) {
      throw new Error(`[Phase3] anchor/temporal text mismatch ${sec.id}`);
    }
    return {
      ...sec,
      text: repairPhase2ParagraphLoads(merged, 'template', sec.id),
      meta: {
        ...sec.meta,
        tagged: repairTaggedPhase2ParagraphLoads(mergedTagged, 'template', sec.id),
      },
    };
  });

  const densityDefault = densityForSurfaceBaseline(schema.baselineDensityDefault, tierEff);
  const reportPadUsed = new Set<string>();
  const window = claimWindow(tierEff);
  const baseSlice = core.claims.slice(0, window);
  const { claims: mechanismSliceView } = applySurfaceMechanismComposition(baseSlice, {
    surface,
    tier: tierEff,
    seed,
    options,
  });
  const dominantIdsDiscipline = selectDominantMechanismSignals(mechanismSliceView, tierEff);
  const dominantClaimsForDiscipline: SemanticClaim[] = [];
  for (const id of dominantIdsDiscipline) {
    const found = mechanismSliceView.find((c) => c.claim_id === id);
    if (found) dominantClaimsForDiscipline.push(found);
  }
  const campaignBaselineExtra =
    surface === 'campaign' && tierEff === 'baseline'
      ? buildCampaignPressureResponseParagraph(core, seed + ':camp:base', options)
      : null;
  const campaignExpandedExtra =
    surface === 'campaign' && tierEff !== 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp', options) : null;

  const globalExclusiveBodyClaimIds = new Set<string>();
  /** Synthesis + dominant — depth panels may not reintroduce these. */
  const depthExcludeClaimIds = (): Set<string> => {
    const s = new Set<string>(globalExclusiveBodyClaimIds);
    for (const c of dominantClaimsForDiscipline) s.add(c.claim_id);
    return s;
  };

  const out: ProjectedExplanationSection[] = raw.map((sec, idx) => {
    const d = densityForSectionId(sec.id, densityDefault);
    const extras: string[] = [];
    const extrasTagged: TaggedSectionBody[] = [];
    const bodyClaimIdsOut: string[] = [];
    const usedWithinGroup = new Set<string>();
    const isFirstSupplementalSlot =
      surface === 'daily' && idx === 1;

    if (isFirstSupplementalSlot) {
      const sectionRoleDeque: ClaimOptionalRole[] = [];
      const paragraphNormDeque: string[] = [];
      const pan = buildSupplementalPanel(
        core,
        `${seed}:s1`,
        sec.id,
        0,
        tierEff,
        surface,
        sectionRoleDeque,
        paragraphNormDeque,
        globalExclusiveBodyClaimIds,
        d,
        dominantClaimsForDiscipline
      );
      const panProv = pan.claimIds.length > 0 ? ('claim_body' as const) : ('padding' as const);
      appendSectionGroupTagged(extras, extrasTagged, usedWithinGroup, pan, panProv, bodyClaimIdsOut);
      appendSectionGroupTagged(
        extras,
        extrasTagged,
        usedWithinGroup,
        campaignBaselineExtra,
        'synthesis_wrapper',
        bodyClaimIdsOut
      );
      appendSectionGroupTagged(
        extras,
        extrasTagged,
        usedWithinGroup,
        campaignExpandedExtra,
        'synthesis_wrapper',
        bodyClaimIdsOut
      );
    } else {
      const sectionRoleDeque: ClaimOptionalRole[] = [];
      const paragraphNormDeque: string[] = [];
      const pan = buildSupplementalPanel(
        core,
        `${seed}:sx`,
        sec.id,
        idx,
        tierEff,
        surface,
        sectionRoleDeque,
        paragraphNormDeque,
        globalExclusiveBodyClaimIds,
        d,
        dominantClaimsForDiscipline
      );
      const panProv = pan.claimIds.length > 0 ? ('claim_body' as const) : ('padding' as const);
      appendSectionGroupTagged(extras, extrasTagged, usedWithinGroup, pan, panProv, bodyClaimIdsOut);
    }

    const bodyMeta = sortUniqueClaimIds(bodyClaimIdsOut);
    for (const id of bodyMeta) {
      globalExclusiveBodyClaimIds.add(id);
    }

    const minNeed = minClaimBodiesForDensity(d);
    let effectiveDensity: 'short' | 'medium' | 'long' =
      bodyMeta.length < minNeed ? ('short' as const) : d;

    const claimIdsForEnrich = bodyMeta;

    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      sec.text,
      sec.meta!.tagged!,
      extras,
      extrasTagged,
      effectiveDensity,
      `${seed}:en:${sec.id}:${idx}`,
      claimIdsForEnrich,
      reportPadUsed,
      PAD_SENTENCES
    );
    const finalText = text;
    const finalTagged = tagged;

    const claimIdsReferenced = sortUniqueClaimIds(claimIds);
    return {
      ...sec,
      text: finalText,
      meta: {
        ...sec.meta,
        claimIdsReferenced,
        phaseD: true,
        tagged: finalTagged,
        enrichDensity: effectiveDensity,
      },
    };
  });

  const extraKeys = expansionKeysFor(surface, tierEff);

  for (const key of extraKeys) {
    if (key === 'audio_thread') continue;
    if (key === 'synthesis_a') {
      if (
        surface === 'compat_pair' &&
        options.pairInteractionAspectsV2 != null &&
        options.comparisonSeekerContextV1 != null
      ) {
        const includeB = extraKeys.includes('synthesis_b');
        const { aText, bText } = buildSynastryLibrarySynthesisSectionBodies(options, includeB);
        if (!aText.trim()) continue;

        const tagA = taggedSectionBodyFromText(aText, 'template');
        const enrichedA = enrichSectionTextWithTagged(
          aText,
          tagA,
          [],
          [],
          'short',
          `${seed}:synlibA`,
          [],
          reportPadUsed,
          PAD_SENTENCES,
          { feed: true }
        );
        out.push({
          id: 'synthesis_a',
          title: 'Synastry synthesis',
          text: enrichedA.text,
          meta: {
            enrichDensity: 'short',
            claimIdsReferenced: sortUniqueClaimIds(enrichedA.claimIds),
            phaseD: true,
            tagged: enrichedA.tagged,
          },
        });
        if (includeB && bText != null) {
          const tagB = taggedSectionBodyFromText(bText, 'template');
          const enrichedB = enrichSectionTextWithTagged(
            bText,
            tagB,
            [],
            [],
            'short',
            `${seed}:synlibB`,
            [],
            reportPadUsed,
            PAD_SENTENCES,
            { feed: true }
          );
          out.push({
            id: 'synthesis_b',
            title: 'Extended synastry',
            text: enrichedB.text,
            meta: {
              enrichDensity: 'short',
              claimIdsReferenced: sortUniqueClaimIds(enrichedB.claimIds),
              phaseD: true,
              tagged: enrichedB.tagged,
            },
          });
        }
        continue;
      }
    }
    if (key === 'synthesis_b') {
      continue;
    }
  }

  let panelIdx = 0;
  while (out.length < schema.baselineMinSections - 1) {
    if (surface === 'sandbox') break;
    const fillSecRole: ClaimOptionalRole[] = [];
    const fillParaNorm: string[] = [];
    // Phase 3: depth panels exclude all prior claim use + MEP + dominant (no reintroduction).
    const pan = buildSupplementalPanel(
      core,
      `${seed}:fillpanel`,
      `depth_panel_${panelIdx}`,
      panelIdx++,
      tierEff,
      surface,
      fillSecRole,
      fillParaNorm,
      depthExcludeClaimIds(),
      densityForSectionId('depth_panel_x', 'short'),
      dominantClaimsForDiscipline
    );
    const panProvFill = pan.claimIds.length > 0 ? ('claim_body' as const) : ('padding' as const);
    const panTagged = taggedSectionBodyFromText(pan.text, panProvFill);
    const fillBodyMeta = sortUniqueClaimIds(pan.claimIds);
    for (const id of fillBodyMeta) {
      globalExclusiveBodyClaimIds.add(id);
    }
    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      pan.text,
      panTagged,
      [],
      [],
      densityForSectionId('depth_panel_x', 'short'),
      `${seed}:dp:${panelIdx}`,
      fillBodyMeta,
      reportPadUsed,
      PAD_SENTENCES,
      { feed: true }
    );
    out.push({
      id: `depth_panel_${panelIdx}`,
      title: pan.title,
      text,
      meta: {
        enrichDensity: densityForSectionId('depth_panel_x', 'short'),
        claimIdsReferenced: sortUniqueClaimIds(claimIds),
        phaseD: true,
        tagged,
      },
    });
  }

  const audio = buildAudioStagingBlock(core, tierEff, options.narrativePlan ?? null, surface);
  const audioBodyNormalized = normalizeAudioExplanationBody(audio.text);
  if (tierEff === 'baseline') {
    const clauses = audioBodyNormalized.split(/;\s+/).map((c) => c.trim()).filter(Boolean);
    const shortAudio =
      clauses.length >= 5 ? clauses.slice(0, 5).join('; ') : audioBodyNormalized;
    // One tagged sentence: library/clause fusion uses many periods; splitting would exceed audio_staging run caps in phase4.
    const shortTagged: TaggedSectionBody = {
      paragraphs: [{ sentences: [{ text: shortAudio, provenance: 'audio_staging' }] }],
    };
    const { text, tagged } = enrichSectionTextWithTagged(
      shortAudio,
      shortTagged,
      [],
      [],
      'short',
      `${seed}:aud`,
      [],
      reportPadUsed,
      PAD_SENTENCES
    );
    out.push({
      id: 'audio_staging',
      title: audio.title,
      text,
      meta: { enrichDensity: 'short', claimIdsReferenced: [], phaseD: true, tagged },
    });
  } else {
    const fullTagged = taggedSectionBodyFromText(audioBodyNormalized, 'audio_staging');
    const bulletBlocks = audio.bullets?.map((b) => taggedSectionBodyFromText(b, 'audio_staging'));
    const { text, tagged } = enrichSectionTextWithTagged(
      audioBodyNormalized,
      fullTagged,
      [],
      [],
      densityForSectionId('audio_staging', 'short'),
      `${seed}:audf`,
      [],
      reportPadUsed,
      PAD_SENTENCES
    );
    if (bulletBlocks?.length) {
      tagged.bulletBlocks = bulletBlocks;
    }
    out.push({
      id: 'audio_staging',
      title: audio.title,
      text,
      bullets: audio.bullets,
      meta: {
        enrichDensity: densityForSectionId('audio_staging', 'short'),
        claimIdsReferenced: [],
        phaseD: true,
        tagged,
      },
    });
  }

  const snapshotMaybe = (options as ProjectionOptions & { snapshot?: EphemerisSnapshot }).snapshot;
  const placementSections =
    surface === 'profile' && snapshotMaybe ? assembleProfileIdentityPlacementSections(snapshotMaybe) : [];

  /** Phase 6C — prepend seeker-anchored synastry activations when directed metadata + seeker context exist. */
  const compatActivationSections =
    surface === 'compat_pair' &&
    options.pairInteractionAspectsV2 != null &&
    options.comparisonSeekerContextV1 != null
      ? assembleCompatActivationSections(options)
      : [];

  const groupKeyInteractionSections =
    surface === 'group' ? assembleGroupKeyInteractionsV1(options, seed, reportPadUsed, densityDefault) : [];
  const relationalSections = assembleLibraryRelationalField({ options, surface });
  const weatherSections = assembleLibraryRelationalWeather({ options, surface });
  const aspectSections = assembleLibraryPlanetaryAspects({
    options,
    surface,
    connectionMode: options.connectionMode,
    maxAspects: 5,
  });

  let framed = applyConnectionPreface(
    [
      ...compatActivationSections,
      ...placementSections,
      ...groupKeyInteractionSections,
      ...relationalSections,
      ...weatherSections,
      ...aspectSections,
      ...out,
    ],
    {
      surface,
      connectionMode: options.connectionMode,
      participantCount: options.participantCount,
      tier: tierEff,
      seed,
      suppressEnsembleFraming: options.suppressEnsembleFraming,
    }
  );
  framed = applyAggregateSurfaceIdentityOverrides(framed, surface, seed, core, tierEff, reportPadUsed);
  framed = filterAndOrderPhase3Sections(framed, surface);

  for (const s of framed) {
    if (s.id === 'audio_staging') continue;
    const prov = s.id === 'connection_structure' || s.id === 'ensemble_framing' ? 'preface' : 'template';
    s.text = repairPhase2ParagraphLoads(s.text, prov, s.id);
    if (s.meta?.tagged) {
      const tagged = repairTaggedPhase2ParagraphLoads(s.meta.tagged, prov, s.id);
      s.meta = {
        ...s.meta,
        tagged,
      };
      const bb = tagged.bulletBlocks;
      if (bb?.length && s.bullets?.length === bb.length) {
        s.bullets = bb.map((b) => reconstructTaggedSectionBody(b));
      }
    }
  }

  return framed;
}
