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
import { densityForSurfaceBaseline } from '../density-validate';
import type { ClaimOptionalRole } from './claim-expression-bundles';
import {
  claimSentencesFromRange,
  capToMaxSentences,
  synthesizeClaimSentences,
} from './claim-synthesize';
import { applyConnectionPreface } from './connection-preface';
import { assembleHomeSkySections } from './home-sky-sections';
import {
  assembleLibraryPlanetaryAspects,
  assembleLibraryRelationalField,
  assembleLibraryRelationalWeather,
} from './library-sections';
import { classifyTopology } from './topology-classify';
import { densityForSectionId } from './validate-projection';
import {
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
import {
  applyDiversificationPenalty,
  diversificationContextFromSelected,
  filterNatalToTransitAspects,
  groupActivationsByTier,
  MAX_ACTIVATIONS_PER_DAY,
  rankTransitActivations,
  selectTopActivationsWithDiversity,
  sortRankedActivations,
} from './transit-overlay-curation';
import { buildTransitListenMetaphor } from './transit-listen-metaphor';

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
            'This connection runs on chemistry you can feel before you can explain it. The friction is real, but so is the pull.',
            'You two operate on different frequencies. That tension is also the interest.',
            'This is a relationship that moves; neither of you stays still in it.',
            'What you have here is specific to the two of you, not a crowd read and not a generic verdict.',
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

  const m = bySectionIdBucket(base);

  const withOrder = (order: string[]): ProjectedExplanationSection[] => {
    const out: ProjectedExplanationSection[] = [];
    for (const id of order) {
      out.push(...pluckId(m, id));
    }
    for (const [, arr] of m) {
      for (const s of arr) out.push(s);
    }
    return out;
  };

  if (surface === 'profile') {
    const o = withOrder([
      'core_identity',
      'direction_foundation',
      'personal_expression',
      'growth_expansion',
      'evolutionary_currents',
      'aspects',
      'signatures',
      'trait_bridge',
      'synthesis_a',
      'synthesis_b',
      'contradiction_map',
      'audio_thread',
    ]);
    return o;
  }

  if (surface === 'sandbox') {
    return withOrder([
      'core_identity',
      'direction_foundation',
      'personal_expression',
      'growth_expansion',
      'evolutionary_currents',
      'aspects',
    ]);
  }

  if (surface === 'compat_pair') {
    return withOrder([
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
      'audio_thread',
    ]);
  }

  if (surface === 'group') {
    return withOrder([
      'ensemble_framing',
      'group_key_interactions_v1',
      'relational_field',
      'relational_weather_v1',
      'signatures',
      'field_distribution',
      'synthesis_a',
      'synthesis_b',
      'subcluster',
      'audio_thread',
    ]);
  }

  return base;
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
function assembleProfileIdentityPlacementSections(
  snapshot: EphemerisSnapshot,
  options?: { condensed?: boolean }
): ProjectedExplanationSection[] {
  const condensed = options?.condensed === true;
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
      condensed,
    })
  );
  sections.push(
    assemblePlacementTier({
      tierId: 'direction_foundation',
      title: 'Direction and Foundation',
      subtitle: 'Public Calling and Private Roots',
      planets: PLANET_TIERS.direction_foundation,
      placementKeys,
      depth: 'full',
      condensed,
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
      condensed,
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
      condensed,
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
      condensed,
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
  condensed?: boolean;
}): ProjectedExplanationSection {
  const paragraphs: string[] = [];
  const condensed = config.condensed === true;

  for (const planetName of config.planets) {
    const placement = config.placementKeys.find((pk) => pk.planet === planetName);
    if (!placement) continue;

    const planetBlock = ANGLE_PLACEMENT_BODIES.has(placement.planet)
      ? assembleAnglePlacement(placement, condensed)
      : assemblePlanetPlacement(placement, config.depth, condensed);
    if (planetBlock) paragraphs.push(planetBlock);
  }

  const body = paragraphs.join('\n\n');
  const text = config.subtitle ? `${config.subtitle}\n\n${body}`.trim() : body;
  return {
    id: config.tierId,
    title: config.title,
    text,
    bullets: [],
    meta: {
      tagged: taggedSectionBodyFromText(text, 'template'),
      planets: config.planets.map((p: string) => p.toUpperCase()),
    },
  };
}

const ANGLE_PLACEMENT_BODIES = new Set(['ASCENDANT', 'MC', 'IC']);

const ANGLE_DISPLAY_NAMES: Record<string, string> = {
  ASCENDANT: 'Ascendant',
  MC: 'Midheaven',
  IC: 'IC',
};

function getAngleFieldLabels(planet: string): { core: string; behavioral: string; sonic: string } {
  if (planet === 'ASCENDANT') {
    return {
      core: 'First Impressions',
      behavioral: 'Natural Approach',
      sonic: 'Physical Presence',
    };
  }
  if (planet === 'MC') {
    return {
      core: 'Public Direction',
      behavioral: 'Achievement Style',
      sonic: 'Legacy Sound',
    };
  }
  if (planet === 'IC') {
    return {
      core: 'Emotional Foundation',
      behavioral: 'Private Sanctuary',
      sonic: 'Interior Resonance',
    };
  }
  return { core: '', behavioral: '', sonic: '' };
}

function assembleAnglePlacement(placement: PlacementKey, condensed = false): string | null {
  const signInsight = getAspectInsight(placement.signKey);
  if (!signInsight) return null;

  const labels = getAngleFieldLabels(placement.planet);
  if (!labels.core) return null;

  const angleName = ANGLE_DISPLAY_NAMES[placement.planet] ?? placement.planet;
  const signDisplay = placement.sign.charAt(0).toUpperCase() + placement.sign.slice(1).toLowerCase();

  const parts: string[] = [];
  parts.push(`### ${angleName} in ${signDisplay}`);

  const coreText = capToMaxSentences(signInsight.core || '', 2);
  if (coreText) {
    parts.push(`**${labels.core}**`);
    parts.push(coreText);
  }

  if (!condensed) {
    const behavioralText = capToMaxSentences(signInsight.behavioral || '', 2);
    if (behavioralText) {
      parts.push(`**${labels.behavioral}**`);
      parts.push(behavioralText);
    }
  }

  const sonicText = signInsight.sonic ? capToMaxSentences(signInsight.sonic, 1) : '';
  if (sonicText) {
    parts.push(`**${labels.sonic}**`);
    parts.push(sonicText);
  }

  return parts.filter((p) => p && p.trim().length > 0).join('\n\n');
}

function assemblePlanetPlacement(
  placement: PlacementKey,
  _depth: 'full' | 'medium' | 'concise',
  condensed = false
): string | null {
  const signInsight = getAspectInsight(placement.signKey);
  const houseInsight = getAspectInsight(placement.houseKey);

  if (!signInsight && !houseInsight) return null;

  const parts: string[] = [];
  const planetDisplay = placement.planet.charAt(0).toUpperCase() + placement.planet.slice(1).toLowerCase();
  const signDisplay = placement.sign.charAt(0).toUpperCase() + placement.sign.slice(1).toLowerCase();
  const ordinal = getOrdinalSuffix(placement.house);
  parts.push(`### ${planetDisplay} in ${signDisplay}, ${ordinal} House`);

  if (signInsight) {
    const signCore = capToMaxSentences(signInsight.core || '', 2);
    const signBehavioral = capToMaxSentences(signInsight.behavioral || '', 2);
    const signSonic = signInsight.sonic ? capToMaxSentences(signInsight.sonic, 1) : '';
    if (signCore) {
      parts.push('**Archetypal Expression**');
      parts.push(signCore);
    }
    if (!condensed && signBehavioral) {
      parts.push('**Observable Patterns**');
      parts.push(signBehavioral);
    }
    if (signSonic) {
      parts.push('**Sonic Signature**');
      parts.push(signSonic);
    }
  }

  if (houseInsight) {
    const houseCore = capToMaxSentences(houseInsight.core || '', 2);
    const houseBehavioral = capToMaxSentences(houseInsight.behavioral || '', 2);
    const houseSonic = houseInsight.sonic ? capToMaxSentences(houseInsight.sonic, 1) : '';
    if (houseCore) {
      parts.push('**Life Arena**');
      parts.push(houseCore);
    }
    if (!condensed) {
      if (houseBehavioral) {
        parts.push('**Manifestation Context**');
        parts.push(houseBehavioral);
      }
      if (houseSonic) {
        parts.push('**Aesthetic Resonance**');
        parts.push(houseSonic);
      }
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

function assembleOverlayActivationSections(
  options: ProjectionOptions,
  semanticCore: SemanticCore
): ProjectedExplanationSection[] {
  const natalSnapshot = options.snapshot;
  const transitSnapshot = options.secondarySnapshot;
  if (!natalSnapshot || !transitSnapshot) return buildMinimalOverlaySections();

  const rawAspects =
    options.pairInteractionAspectsV2 != null && options.pairInteractionAspectsV2.length > 0
      ? [...options.pairInteractionAspectsV2]
      : [...(options.pairInteractionAspects ?? [])];
  const natalToTransit = filterNatalToTransitAspects(rawAspects);
  if (natalToTransit.length === 0) return buildMinimalOverlaySections();

  const unpenalizedRanked = rankTransitActivations(natalToTransit);
  if (unpenalizedRanked.length === 0) return buildMinimalOverlaySections();

  const penalized = applyDiversificationPenalty(
    unpenalizedRanked,
    options.transitDiversificationContext
  );
  const penalizedSorted = sortRankedActivations(penalized);
  const unpenalizedSorted = sortRankedActivations(unpenalizedRanked);
  const selected = selectTopActivationsWithDiversity(
    penalizedSorted,
    unpenalizedSorted,
    MAX_ACTIVATIONS_PER_DAY
  );
  if (selected.length === 0) return buildMinimalOverlaySections();

  const calendarDate =
    options.transitCalendarDate?.slice(0, 10) ??
    String(transitSnapshot.ts || '').slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  const curationMeta = diversificationContextFromSelected(selected, calendarDate);

  const tiers: Array<{
    id: string;
    title: string;
    subtitle: string;
    natalBodies: readonly string[];
  }> = [
    {
      id: 'core_identity',
      title: 'Core Identity Architecture',
      subtitle: 'Fundamental Self-Expression Under Current Influence',
      natalBodies: PLANET_TIERS.core_identity,
    },
    {
      id: 'personal_expression',
      title: 'Personal Expression',
      subtitle: 'Communication, Values, and Drive in Current Context',
      natalBodies: PLANET_TIERS.personal_expression,
    },
    {
      id: 'growth_expansion',
      title: 'Growth and Expansion',
      subtitle: 'Long-Term Development and Structure',
      natalBodies: PLANET_TIERS.growth_expansion,
    },
    {
      id: 'evolutionary_currents',
      title: 'Evolutionary Currents',
      subtitle: 'Generational and Transformative Forces',
      natalBodies: PLANET_TIERS.evolutionary_currents,
    },
  ];

  const natalPlacements = buildPlacementKeys(natalSnapshot);
  const transitPlacements = buildPlacementKeys(transitSnapshot);
  const byTier = groupActivationsByTier(selected);
  const sections: ProjectedExplanationSection[] = [];

  for (const tier of tiers) {
    const tierActivations = byTier.get(tier.id) ?? [];
    if (tierActivations.length === 0) continue;

    const activationsByPlanet = groupBy(tierActivations, (a) => a.natalBody);
    const planetNarratives: string[] = [];
    const tierAspectKeys: string[] = [];

    for (const natalPlanet of tier.natalBodies) {
      const activations = activationsByPlanet[natalPlanet];
      if (!activations || activations.length === 0) continue;
      /** Only planets with a globally selected activation appear (≤ MAX_ACTIVATIONS_PER_DAY total). */

      const natalPlacement = natalPlacements.find((p) => p.planet === natalPlanet);
      if (!natalPlacement) continue;

      const natalSignInsight = getAspectInsight(natalPlacement.signKey);
      const natalAnchorText = capToMaxSentences(natalSignInsight?.core ?? '', 1);
      if (!natalAnchorText) continue;

      let planetText = `**Your ${formatPlanetName(natalPlanet)} in ${formatSignName(natalPlacement.sign)}, ${formatHouseName(natalPlacement.house)}**\n\n`;
      planetText += `${natalAnchorText}\n\n`;

      for (const ranked of activations) {
        const aspect = ranked.aspect;
        const transitPlanet = ranked.transitBody;
        const transitPlacement = transitPlacements.find((p) => p.planet === transitPlanet);
        if (!transitPlacement) continue;

        const aspectInsight = getAspectInsight(ranked.aspectKey);
        if (!aspectInsight) continue;

        tierAspectKeys.push(ranked.aspectKey);

        planetText += `Your ${natalPlanet.toLowerCase()} is currently being activated by **transiting ${formatPlanetName(transitPlanet)} in ${formatSignName(transitPlacement.sign)}** (${formatHouseName(transitPlacement.house)}), forming a ${formatAspectName(String(aspect.type || ''))}. `;

        const aspectText = capToMaxSentences(
          aspectInsight.core_transit || aspectInsight.core || '',
          2
        );
        if (aspectText) {
          planetText += `${aspectText}\n\n`;
        }
        const sonicText = capToMaxSentences(aspectInsight.sonic ?? '', 1);
        if (sonicText) {
          planetText += `${sonicText}\n\n`;
        }
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
        meta: {
          tagged: taggedSectionBodyFromText(text, 'template'),
          transitCuration: {
            aspectKeys: tierAspectKeys,
            natalBodies: [...new Set(tierActivations.map((a) => a.natalBody))],
            transitBodies: [...new Set(tierActivations.map((a) => a.transitBody))],
            calendarDate,
          },
        },
      });
    }
  }

  if (sections.length === 0) return buildMinimalOverlaySections();

  for (const s of sections) {
    if (s.meta && typeof s.meta === 'object') {
      (s.meta as Record<string, unknown>).transitCurationFull = curationMeta;
    }
  }

  const listenText = buildTransitListenMetaphor(semanticCore, selected);
  if (listenText) {
    sections.push({
      id: 'todays_sound',
      title: "Today's Sound",
      text: listenText,
      bullets: [],
      meta: { tagged: taggedSectionBodyFromText(listenText, 'template') },
    });
  }

  return sections;
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

  const combined = blocks.join('\n\n');
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

/** Personal planets only for connection activation blocks (outer planets omitted). */
const COMPAT_ACTIVATION_PERSONAL_PLANETS = new Set(['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS']);
const COMPAT_ACTIVATION_MAX_HITS_PER_PLANET = 2;

function sortDirectedAspectByStrength(
  a: Pick<DirectedSnapshotAspect, 'exactness' | 'orb' | 'strength'>,
  b: Pick<DirectedSnapshotAspect, 'exactness' | 'orb' | 'strength'>
): number {
  const exA = typeof a.exactness === 'number' ? a.exactness : typeof a.strength === 'number' ? a.strength : 0;
  const exB = typeof b.exactness === 'number' ? b.exactness : typeof b.strength === 'number' ? b.strength : 0;
  if (exB !== exA) return exB - exA;
  const orbA = typeof a.orb === 'number' ? a.orb : 999;
  const orbB = typeof b.orb === 'number' ? b.orb : 999;
  return orbA - orbB;
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
      if (!COMPAT_ACTIVATION_PERSONAL_PLANETS.has(natalPlanet)) continue;

      const aspects = activationsByPlanet[natalPlanet];
      if (!aspects || aspects.length === 0) continue;

      const topAspects = [...aspects]
        .sort(sortDirectedAspectByStrength)
        .slice(0, COMPAT_ACTIVATION_MAX_HITS_PER_PLANET);

      let planetText = '';

      for (const aspect of topAspects) {
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
      }
      if (planetText.trim()) {
        planetNarratives.push(planetText.trim());
      }
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
  const { core, seed, options, tierEff, surface } = params;
  const schema = SURFACE_SCHEMAS[surface];

  if (surface === 'feed') {
    return buildFeedSections(core, seed, options);
  }

  if (surface === 'overlay_pair') {
    return assembleOverlayActivationSections(options, core);
  }

  const snapshotMaybe = (options as ProjectionOptions & { snapshot?: EphemerisSnapshot }).snapshot;
  if (surface === 'daily' && snapshotMaybe) {
    return assembleHomeSkySections(snapshotMaybe);
  }

  // Phase 4A: template infrastructure removed.
  // HOME daily returns above through Phase 4B library assembly.
  const raw: ProjectedExplanationSection[] = [];

  const densityDefault = densityForSurfaceBaseline(schema.baselineDensityDefault, tierEff);
  const reportPadUsed = new Set<string>();

  const out: ProjectedExplanationSection[] = raw.map((sec, idx) => {
    const effectiveDensity = 'short' as const;
    const claimIdsForEnrich = sortUniqueClaimIds(sec.meta?.claimIdsReferenced ?? []);

    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      sec.text,
      sec.meta!.tagged!,
      [],
      [],
      effectiveDensity,
      `${seed}:en:${sec.id}:${idx}`,
      claimIdsForEnrich,
      reportPadUsed,
      PAD_SENTENCES,
      { feed: true }
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

  const placementSections =
    (surface === 'profile' || surface === 'sandbox') && snapshotMaybe
      ? assembleProfileIdentityPlacementSections(snapshotMaybe, { condensed: surface === 'sandbox' })
      : [];

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
    maxAspects: surface === 'compat_pair' ? 3 : 5,
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
