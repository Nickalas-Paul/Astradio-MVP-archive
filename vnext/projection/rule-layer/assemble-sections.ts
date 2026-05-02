/**
 * **Proj:** Step 8 — sole module that constructs ProjectedExplanationSection[] (before tone pass).
 * Pipeline ordinal only (not Product phase, not Acct:Stage-*). See apply-unified-projection for execution order.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { SnapshotAspect } from '../../contracts';
import type { SemanticClaim, SemanticCore } from '../../semantic/semantic-core';
import type {
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
  buildClaimMechanismExpressionParagraph,
  buildControlledMechanismExpressionParagraph,
  buildTensionIntegrationParagraph,
  buildCampaignPressureResponseParagraph,
  buildSupplementalPanel,
  buildDisciplinedSynthesisClaimBodies,
  claimSentencesFromRange,
  capToMaxSentences,
  synthesizeClaimSentences,
  renderMechanismArcBlock,
} from './claim-synthesize';
import { claimWindow } from './claim-select';
import { selectDominantMechanismSignals } from './dominant-signal-selection';
import { applySurfaceMechanismComposition } from './surface-mechanism-composition';
import { buildAudioStagingBlock } from './audio-lexicon';
import { applyConnectionPreface } from './connection-preface';
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
import { sortUniqueClaimIds, splitMepBodyForTaggedParagraphs } from './section-ownership';
import {
  mergeTaggedSectionBodiesVertical,
  reconstructTaggedSectionBody,
  splitParasForTagged,
  splitSentsForTagged,
  taggedSectionBodyFromBlocks,
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

/** Optional upstream snapshot / compat payloads not yet on `SemanticCore` typing. */
type CoreWithInsightExtensions = SemanticCore & {
  snapshot?: { aspects?: readonly SnapshotAspect[] };
  compatibility?: { outputs?: { class_code?: string } };
  relational_weather?: { themes?: readonly string[] };
};

function pickVariant(seed: string, variants: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

function isSparseCompatibilityCase(core: SemanticCore, surface: ProjectionSurface): boolean {
  if (surface !== 'compat_pair') return false;
  const rel = core.relational?.activation_profile ?? [];
  const hasIntensityLow = rel.includes('REL_BAND_INTENSITY_LOW');
  const hasIntensityMed = rel.includes('REL_BAND_INTENSITY_MED');
  const hasIntensityHigh = rel.includes('REL_BAND_INTENSITY_HIGH');
  const hasFrictionLow = rel.includes('REL_BAND_FRICTION_LOW');
  const hasHarmonyLow = rel.includes('REL_BAND_HARMONY_LOW');
  const lowTension = core.audio.tension_bias === 'AUDIO_TENSION_LOW';
  const medTension = core.audio.tension_bias === 'AUDIO_TENSION_MED';
  const lowTexture =
    core.audio.relational_texture === 'REL_TEXTURE_NEUTRAL' ||
    core.audio.relational_texture === 'REL_TEXTURE_STATIC';
  const lowDensity = core.audio.density_band === 'DENSITY_SPARSE' || core.audio.density_band === 'DENSITY_BALANCED';
  const topStrength = core.claims.slice(0, 3).reduce((m, c) => Math.max(m, c.strength), 0);
  const weakStructure = topStrength < 0.7;
  const fewClaimEdges = (core.tension_harmony?.claim_edges?.length ?? 0) <= 1;
  const weakInteraction = hasIntensityLow || (hasIntensityMed && !hasIntensityHigh);
  const lowDirectionalPressure = lowTension || medTension;
  return (
    weakInteraction &&
    lowDirectionalPressure &&
    (lowDensity || lowTexture || hasFrictionLow || hasHarmonyLow || weakStructure || fewClaimEdges)
  );
}

const PAD_SENTENCES = reducedPadPool();

const FEED_SCOPE_SENTENCE = 'This card stays narrow by design.';

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/**
 * Synthesis openers only (read register). Must stay disjoint from `AUDIO_LEXICON_CLAUSE_STRINGS`
 * in audio-lexicon (R3: one listen-family match per kind outside `audio_staging`). Exactly six each.
 */
const SYNTH_WRAPPER_A: readonly string[] = [
  `This read weaves side threads and mid-rank cues so a single dominant thread still leads.`,
  `Here the phrasing darts between sub-claims, keeping a brisk alternation with one through-line in front.`,
  `The case stacks several small moves; the central line returns before the section runs long.`,
  `A wider cadence between beats lets side comments land, then the main line comes back in plain form.`,
  `Tilted counterpoints now trade in sharper back-and-forth, yet the spine of the case stays nameable.`,
  `Secondary material stays in orbit, echoing the headline without eclipsing the first-order point.`,
];
const SYNTH_WRAPPER_B: readonly string[] = [
  `Second pass widens the field, roping in quieter side constraints that reweight the same headline, not dethroning it.`,
  `A brisker recheck places different moderators up front, keeping the through-line while sharpening the visible edges.`,
  `More subclaims are named in one field of view, so the felt busyness rises while the top line still reads as one path.`,
  `A slower handoff from headline to detail gives more leg room, same through-line, calmer path back to the lead.`,
  `Nuance comes through as give-and-take between lines, while the opening sentence of the case still governs the page.`,
  `Hangers-on sit closer to the main line, nudging emphasis in place, without a rewrite of the first sentence.`,
];

function countSentences(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const chunks = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  return Math.max(chunks.length, 1);
}

function nextFallbackSentence(seed: string, pool: string[], used?: Set<string>): string {
  const list = pool.length ? pool : PAD_SENTENCES;
  if (list.length === 0) return '';
  const start = hashSeed(seed) % list.length;
  for (let i = 0; i < list.length; i++) {
    const candidate = list[(start + i) % list.length];
    if (!used || !used.has(candidate)) {
      used?.add(candidate);
      return candidate;
    }
  }
  const fallback = list[start];
  used?.add(fallback);
  return fallback;
}

function expandSentencesToMin(
  text: string,
  minSentences: number,
  seed: string,
  fallbackPool: string[] = PAD_SENTENCES,
  usedFallback?: Set<string>,
  maxPadIterations = 1
): string {
  let t = text.trim();
  if (!t) t = nextFallbackSentence(`${seed}:base`, fallbackPool, usedFallback);
  let n = countSentences(t);
  let i = 0;
  while (n < minSentences && i < maxPadIterations) {
    t += ' ' + nextFallbackSentence(`${seed}:pad:${i}`, fallbackPool, usedFallback);
    n = countSentences(t);
    i++;
  }
  return t;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
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
      'signatures',
      'significance',
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
    return withDepths(['significance', 'signatures', 'delta_emphasis', 'synthesis_a', 'musical', '__DEPTH__', 'audio_staging']);
  }

  if (surface === 'compat_pair') {
    return withDepths([
      'connection_structure',
      'relational_field',
      'relational_weather_v1',
      'signatures',
      'significance',
      'interaction_map',
      'synthesis_a',
      'synthesis_b',
      'musical',
      '__DEPTH__',
      'audio_staging',
      'audio_thread',
    ]);
  }

  if (surface === 'group') {
    return withDepths([
      'ensemble_framing',
      'relational_field',
      'relational_weather_v1',
      'signatures',
      'significance',
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
    const { title, text, bullets } = lineForTemplate(tid, core, `${seed}:${i++}`, templateCtx);
    out.push({
      id: idMap[tid] ?? tid.toLowerCase(),
      title,
      text,
      bullets,
      meta: { tagged: taggedSectionFromTemplateLine(text, bullets) },
    });
  }
  return out;
}

function taggedFeedSignalBody(fullText: string): TaggedSectionBody {
  const paras = splitParasForTagged(fullText);
  return {
    paragraphs: paras.map((p) => ({
      sentences: splitSentsForTagged(p).map((t) => ({
        text: t,
        provenance: t === FEED_SCOPE_SENTENCE ? ('template' as const) : ('claim_body' as const),
      })),
    })),
  };
}

export function buildFeedSections(core: SemanticCore, seed: string): ProjectedExplanationSection[] {
  const sectionRoleDeque: ClaimOptionalRole[] = [];
  const paragraphNormDeque: string[] = [];
  const claimSlice = claimSentencesFromRange(
    core,
    0,
    2,
    `${seed}:feed:signal`,
    'feed',
    'baseline',
    sectionRoleDeque,
    paragraphNormDeque,
    'feed_signal'
  );
  const fallbackUsed = new Set<string>();
  const t1Raw = expandSentencesToMin(claimSlice.text, 1, `${seed}:feed`, [FEED_SCOPE_SENTENCE], fallbackUsed, 0);
  let feedSignalText = capToMaxSentences(t1Raw, 2);
  const feedSignalClaim = claimSlice.claimIds[0];
  const feedStructInsight = feedSignalClaim ? getStructuralInsight(feedSignalClaim) : undefined;
  if (feedStructInsight?.feed) {
    feedSignalText = capToMaxSentences(feedStructInsight.feed + ' ' + feedSignalText, 2);
  }
  const s1: ProjectedExplanationSection = {
    id: 'feed_signal',
    title: 'Signal',
    text: feedSignalText,
    meta: {
      enrichDensity: 'short',
      claimIdsReferenced: sortUniqueClaimIds(claimSlice.claimIds),
      phaseD: true,
      tagged: taggedFeedSignalBody(feedSignalText),
    },
  };
  const coreX = core as CoreWithInsightExtensions;
  const feedThemes: readonly string[] = coreX.relational_weather?.themes ?? [];
  const feedWeatherInsight = feedThemes[0] ? getRelationalInsight(feedThemes[0]) : undefined;
  let feedContextText = FEED_SCOPE_SENTENCE;
  let feedContextTagged = taggedSectionBodyFromText(FEED_SCOPE_SENTENCE, 'template');
  if (feedWeatherInsight?.feed) {
    feedContextText = capToMaxSentences(feedWeatherInsight.feed, 2);
    feedContextTagged = taggedSectionBodyFromText(feedContextText, 'claim_body');
  }
  const s2: ProjectedExplanationSection = {
    id: 'feed_context',
    title: 'Scope',
    text: feedContextText,
    meta: {
      enrichDensity: 'short',
      claimIdsReferenced: [],
      phaseD: true,
      tagged: feedContextTagged,
    },
  };
  return [s1, s2];
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

export function assemblePhaseDSections(params: PhaseDAssemblyParams): ProjectedExplanationSection[] {
  const { core, seed, options, tierEff, surface, temporalBucket } = params;
  const schema = SURFACE_SCHEMAS[surface];

  if (surface === 'feed') {
    return buildFeedSections(core, seed);
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
  const mepSectionRole: ClaimOptionalRole[] = [];
  const mepParagraphNorm: string[] = [];
  const mep =
    options.mechanismExpressionDominantSignals === true
      ? buildControlledMechanismExpressionParagraph(
          core,
          seed,
          tierEff,
          surface,
          mepSectionRole,
          mepParagraphNorm,
          dominantIdsDiscipline,
          'signatures',
          mechanismSliceView
        )
      : buildClaimMechanismExpressionParagraph(
          core,
          seed,
          tierEff,
          surface,
          mepSectionRole,
          mepParagraphNorm,
          'signatures',
          mechanismSliceView
        );
  const mepOrdered = mep.orderedClaims;
  const openingClause = tierOpeningClause(surface, tierEff, seed);
  const tensionBlock = tierEff === 'baseline' ? null : buildTensionIntegrationParagraph(core, seed + ':ten');
  const campaignBaselineExtra =
    surface === 'campaign' && tierEff === 'baseline'
      ? buildCampaignPressureResponseParagraph(core, seed + ':camp:base', options)
      : null;
  const campaignExpandedExtra =
    surface === 'campaign' && tierEff !== 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp', options) : null;

  const globalExclusiveBodyClaimIds = new Set<string>();
  /** MEP + synthesis + dominant — depth panels may not reintroduce these. */
  const depthExcludeClaimIds = (): Set<string> => {
    const s = new Set<string>(globalExclusiveBodyClaimIds);
    for (const id of mep.claimIds) s.add(id);
    for (const c of dominantClaimsForDiscipline) s.add(c.claim_id);
    return s;
  };

  const emphasisHasSignatures = raw.some((s) => s.id === 'signatures');

  const out: ProjectedExplanationSection[] = raw.map((sec, idx) => {
    const d = densityForSectionId(sec.id, densityDefault);
    const extras: string[] = [];
    const extrasTagged: TaggedSectionBody[] = [];
    const bodyClaimIdsOut: string[] = [];
    const usedWithinGroup = new Set<string>();
    let mepAspectLibraryText: string | undefined;
    const isMus = sec.id === 'musical' || sec.id === 'music_translation';
    /** Phase 3: MEP must stay on `signatures` (or first spine section when no signatures id, e.g. daily). */
    const mepHere = sec.id === 'signatures' || (!emphasisHasSignatures && idx === 0);
    const isFirstSupplementalSlot =
      sec.id === 'significance' || (surface === 'daily' && idx === 1 && !isMus);
    const relOnly = sec.id === 'relational_field' || sec.id === 'relational_weather_v1';

    if (mepHere) {
      if (openingClause) {
        extras.push(openingClause);
        extrasTagged.push(taggedSectionBodyFromText(openingClause, 'tier_scaffold'));
      }
      for (const mepBlock of splitMepBodyForTaggedParagraphs(mep.text, mep.claimIds)) {
        appendSectionGroupTagged(extras, extrasTagged, usedWithinGroup, mepBlock, 'claim_body', bodyClaimIdsOut);
      }
      appendSectionGroupTagged(extras, extrasTagged, usedWithinGroup, tensionBlock, 'synthesis_wrapper', bodyClaimIdsOut);
      if (surface === 'sandbox') {
        const lab = pickVariant(`${seed}:sandbox:lab:${tierEff}`, [
          'Sandbox framing: this picture reflects lab conditions you changed on purpose.',
          'Sandbox framing: this lab pass emphasizes sensitivity to those changes, not fixed life conclusions.',
        ]);
        extras.push(lab);
        extrasTagged.push(taggedSectionBodyFromText(lab, 'synthesis_wrapper'));
      }
      const coreInsight = core as CoreWithInsightExtensions;
      const rawAspects: readonly SnapshotAspect[] = coreInsight.snapshot?.aspects ?? [];
      const aspectInsights: AspectInsight[] = rawAspects
        .slice(0, 3)
        .map((a) => getAspectInsight(buildAspectKey(a.bodyA, a.bodyB, a.type)))
        .filter((ins): ins is AspectInsight => ins !== undefined);
      if (aspectInsights.length > 0) {
        const effSurface = options?.surface ?? surface;
        const connectionMode = options?.connectionMode ?? 'none';
        const romanticPairSurface =
          connectionMode === 'lovers' || (connectionMode as string) === 'romantic';
        const context = romanticPairSurface ? 'romantic' : 'friendship';
        mepAspectLibraryText = aspectInsights
          .map((ins) => {
            if (effSurface === 'feed') return ins.feed;
            if (effSurface === 'compat_pair' || effSurface === 'group') {
              return [ins.core, ins.behavioral, context === 'romantic' ? ins.romantic : ins.friendship]
                .filter(Boolean)
                .join(' ');
            }
            return [ins.core, ins.behavioral].filter(Boolean).join(' ');
          })
          .join('\n\n');
      }
    } else if (isMus) {
      const musRole: ClaimOptionalRole[] = [];
      const musNorm: string[] = [];
      const n = mepOrdered.length;
      const musLines: string[] = [];
      for (let mi = 0; mi < n; mi++) {
        const c = mepOrdered[mi]!;
        const block = renderMechanismArcBlock({
          claim: c,
          index: mi,
          n,
          sectionRoleDeque: musRole,
          paragraphNormDeque: musNorm,
          seed: `${seed}|${c.claim_id}|listen`,
          sectionId: 'musical',
          register: 'listen',
        });
        musLines.push(block.text);
      }
      const musicalJoined =
        musLines.length > 0 ? synthesizeClaimSentences(musLines, mep.claimIds, `${seed}:mep`) : '';
      for (const musBlock of splitMepBodyForTaggedParagraphs(musicalJoined, mep.claimIds)) {
        appendSectionGroupTagged(extras, extrasTagged, usedWithinGroup, musBlock, 'claim_body', bodyClaimIdsOut);
      }
    } else if (isFirstSupplementalSlot) {
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
    } else if (relOnly) {
      /* template-only: relational field / weather (no MEP, no supplemental here) */
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
    if (isMus) {
      effectiveDensity = 'short';
    }

    const claimIdsForEnrich = isMus ? [...mep.claimIds] : bodyMeta;

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
    let finalText = text;
    let finalTagged = tagged;

    if (mepHere && mepAspectLibraryText) {
      // Template (not claim_body): ANCHORED sections require scaffold/templates before claim_body runs (phase4 grammar).
      const libTagged = taggedSectionBodyFromText(mepAspectLibraryText, 'template');
      finalTagged = mergeTaggedSectionBodiesVertical(libTagged, tagged);
      finalText = reconstructTaggedSectionBody(finalTagged);
    }

    if (relOnly) {
      const coreX = core as CoreWithInsightExtensions;
      if (sec.id === 'relational_field') {
        const classCode = coreX.compatibility?.outputs?.class_code;
        if (classCode) {
          const compatInsight = getRelationalInsight(classCode);
          if (compatInsight) {
            const connectionMode = options?.connectionMode ?? 'none';
            const effSurface = options?.surface ?? surface;
            const romanticPairSurface =
              connectionMode === 'lovers' || (connectionMode as string) === 'romantic';
            const context = romanticPairSurface
              ? 'romantic'
              : (effSurface as string) === 'discovery'
                ? 'discovery'
                : 'friendship';
            const contextText =
              context === 'romantic'
                ? compatInsight.romantic
                : context === 'discovery'
                  ? compatInsight.discovery
                  : compatInsight.friendship;
            const libraryText = [compatInsight.core, compatInsight.behavioral, contextText].filter(Boolean).join(' ');
            if (libraryText) {
              finalText = libraryText;
              finalTagged = taggedSectionBodyFromText(libraryText, 'claim_body');
            }
          }
        }
      }
      if (sec.id === 'relational_weather_v1') {
        const themes: readonly string[] = coreX.relational_weather?.themes ?? [];
        const primaryTheme = themes[0];
        if (primaryTheme) {
          const weatherInsight = getRelationalInsight(primaryTheme);
          if (weatherInsight) {
            const effSurface = options?.surface ?? surface;
            const weatherText =
              effSurface === 'feed'
                ? weatherInsight.feed
                : [weatherInsight.core, weatherInsight.behavioral].join(' ');
            if (weatherText) {
              finalText = weatherText;
              finalTagged = taggedSectionBodyFromText(weatherText, 'claim_body');
            }
          }
        }
      }
    }

    const claimIdsReferenced = isMus ? [...mep.claimIds] : sortUniqueClaimIds(claimIds);
    return {
      ...sec,
      text: finalText,
      ...(isMus ? { bullets: undefined } : {}),
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
  const coreAudio = core.audio;
  const sparseCompat = isSparseCompatibilityCase(core, surface);
  // Ordinal maps: TEMPO/DENSITY/TENSION bands → 0,1,2; ARC (four codes) and REL_TEXTURE (four codes) share buckets per inline rules.
  const tempoOrdinal: 0 | 1 | 2 =
    coreAudio.tempo_band === 'TEMPO_LOW' ? 0 : coreAudio.tempo_band === 'TEMPO_MED' ? 1 : 2; // TEMPO_HIGH
  const densityOrdinal: 0 | 1 | 2 =
    coreAudio.density_band === 'DENSITY_SPARSE' ? 0 : coreAudio.density_band === 'DENSITY_DENSE' ? 2 : 1; // DENSITY_BALANCED
  const arcOrdinal: 0 | 1 | 2 =
    coreAudio.arc_bias === 'ARC_CYCLIC' ? 1 : coreAudio.arc_bias === 'ARC_FALL' ? 2 : 0; // ARC_RISE & ARC_SURGE_RESOLVE → 0
  const tensionOrdinal: 0 | 1 | 2 =
    coreAudio.tension_bias === 'AUDIO_TENSION_LOW' ? 0 : coreAudio.tension_bias === 'AUDIO_TENSION_MED' ? 1 : 2; // HIGH
  const textureOrdinal: 0 | 1 | 2 =
    coreAudio.relational_texture === 'REL_TEXTURE_NEUTRAL' || coreAudio.relational_texture === 'REL_TEXTURE_STATIC'
      ? 0
      : coreAudio.relational_texture === 'REL_TEXTURE_FLUID'
        ? 1
        : 2; // REL_TEXTURE_CALL_RESPONSE

  for (const key of extraKeys) {
    if (key === 'audio_thread') continue;
    if (key === 'synthesis_a') {
      const synSecRole: ClaimOptionalRole[] = [];
      const synParaNorm: string[] = [];
      const synClaim = buildDisciplinedSynthesisClaimBodies(
        core,
        dominantClaimsForDiscipline,
        2,
        `${seed}:synA`,
        surface,
        tierEff,
        synSecRole,
        synParaNorm,
        globalExclusiveBodyClaimIds,
        'synthesis_a'
      );
      const baseKeyA = `${seed}|synthesis_a|${coreAudio.density_band}|${coreAudio.arc_bias}|${coreAudio.tension_bias}|${coreAudio.relational_texture}`;
      const idxA =
        (hashSeed(baseKeyA) +
          tempoOrdinal +
          densityOrdinal +
          arcOrdinal +
          tensionOrdinal +
          textureOrdinal) %
        6;
      const wrap = sparseCompat
        ? pickVariant(`${seed}:sparse:support`, [
            'Interaction remains weak, so both people can keep independent decision timing with only light coordination demand.',
            'Coordination pressure stays low in this sparse field, so each person can act independently without heavy synchronization.',
            'The exchange remains lightly coupled, so planning and communication can proceed independently unless external pressure rises.',
          ])
        : SYNTH_WRAPPER_A[idxA]!;
      const synBody = sparseCompat ? '' : capToMaxSentences(synClaim.text, 3);
      const syn = [wrap, synBody].filter((x) => x.trim().length > 0).join('\n\n');
      const synTagged =
        synBody.trim().length > 0
          ? taggedSectionBodyFromBlocks([
              { text: wrap, provenance: 'synthesis_wrapper' },
              { text: synBody, provenance: 'claim_body' },
            ])
          : taggedSectionBodyFromText(wrap, 'synthesis_wrapper');
      const synBodyMeta = sortUniqueClaimIds(synClaim.claimIds);
      for (const id of synBodyMeta) {
        globalExclusiveBodyClaimIds.add(id);
      }
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        'short',
        `${seed}:synbody`,
        synBodyMeta,
        reportPadUsed,
        PAD_SENTENCES,
        { feed: true }
      );
      out.push({
        id: 'synthesis_a',
        title: 'Synthesis',
        text,
        meta: { enrichDensity: 'short', claimIdsReferenced: sortUniqueClaimIds(claimIds), phaseD: true, tagged },
      });
    }
    if (key === 'synthesis_b' && surface !== 'sandbox') {
      const synBSecRole: ClaimOptionalRole[] = [];
      const synBParaNorm: string[] = [];
      const synClaim = buildDisciplinedSynthesisClaimBodies(
        core,
        dominantClaimsForDiscipline,
        3,
        `${seed}:synB`,
        surface,
        tierEff,
        synBSecRole,
        synBParaNorm,
        globalExclusiveBodyClaimIds,
        'synthesis_b'
      );
      const baseKeyB = `${seed}|synthesis_b|${coreAudio.density_band}|${coreAudio.arc_bias}|${coreAudio.tension_bias}|${coreAudio.relational_texture}`;
      const idxB =
        (hashSeed(baseKeyB) +
          tempoOrdinal +
          densityOrdinal +
          arcOrdinal +
          tensionOrdinal +
          textureOrdinal) %
        6;
      const wrapB =
        sparseCompat && surface === 'compat_pair'
          ? pickVariant(`${seed}:sparse:limit`, [
              'Directional pressure stays low, so urgency remains limited and role shifts are not strongly forced.',
              'Low interaction pressure keeps escalation demand minimal, with little need to reorganize roles or pacing.',
              'With weak coupling in the field, directional pressure stays light and conflict urgency remains contained.',
            ])
          : SYNTH_WRAPPER_B[idxB]!;
      const synBodyB = sparseCompat && surface === 'compat_pair' ? '' : capToMaxSentences(synClaim.text, 3);
      const syn = [wrapB, synBodyB].filter((x) => x.trim().length > 0).join('\n\n');
      const synTagged =
        synBodyB.trim().length > 0
          ? taggedSectionBodyFromBlocks([
              { text: wrapB, provenance: 'synthesis_wrapper' },
              { text: synBodyB, provenance: 'claim_body' },
            ])
          : taggedSectionBodyFromText(wrapB, 'synthesis_wrapper');
      const synBodyMetaB = sortUniqueClaimIds(synClaim.claimIds);
      for (const id of synBodyMetaB) {
        globalExclusiveBodyClaimIds.add(id);
      }
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        'short',
        `${seed}:synb`,
        synBodyMetaB,
        reportPadUsed,
        PAD_SENTENCES,
        { feed: true }
      );
      out.push({
        id: 'synthesis_b',
        title: 'Extended synthesis',
        text,
        meta: { enrichDensity: 'short', claimIdsReferenced: sortUniqueClaimIds(claimIds), phaseD: true, tagged },
      });
    }
    if (key === 'temporal_integration' && surface === 'daily') {
      const syn = temporalIntegrationLine(params.temporalBucket, `${seed}:temp`);
      const synTagged = taggedSectionBodyFromText(syn, 'template');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:ti`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'temporal_integration',
        title: 'Temporal integration',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
    if (key === 'trait_bridge' && surface === 'profile') {
      const syn = pickVariant(seed + ':trait', [
        `Trait bridge: elemental and tonal signals often travel together; changing context can shift which side shows up first.`,
        `Trait bridge: structure in skills under stress may show before self-description; both tracks can be valid.`,
      ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:tb`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'trait_bridge',
        title: 'Trait bridge',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
    if (key === 'interaction_map' && surface === 'compat_pair') {
      const syn = sparseCompat
        ? pickVariant(seed + ':im:sparse', [
            `Interaction remains weak in this field, so coordination demand stays low and each person can keep independent timing.`,
            `No strong shared push dominates this connection, so communication and decisions can proceed with light coordination pressure.`,
            `This sparse exchange carries low interaction load, with minimal directional pressure on planning or role changes.`,
          ])
        : pickVariant(seed + ':im', [
            `Interaction map: reinforcing patterns stabilize repeatable timing, escalating patterns increase urgency, cross-pressuring patterns pull decisions in competing directions, dissolving patterns diffuse shared structure, and transforming patterns reconfigure roles across communication and resource choices.`,
            `Interaction map: reinforcing exchange aligns repeatable routines, escalating exchange amplifies pressure windows, cross-pressuring exchange creates competing directives, dissolving exchange weakens shared structure, and transforming exchange shifts role boundaries in real-world planning.`,
          ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:im`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'interaction_map',
        title: 'Interaction map',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
    if (key === 'field_distribution' && surface === 'group') {
      const syn = pickVariant(seed + ':fd', [
        `Field distribution: emphasis often concentrates on a subset of people, which increases coordination load for decision timing and redistributes communication responsibility.`,
        `Field distribution: support and friction can spread unevenly, restricting some resource channels while destabilizing timing in specific local domains.`,
      ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:fd`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'field_distribution',
        title: 'Field distribution',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
    if (key === 'pressure_response' && surface === 'campaign') {
      const pr = buildCampaignPressureResponseParagraph(core, seed + ':pr', options);
      const prTagged = taggedSectionBodyFromText(pr.text, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        pr.text,
        prTagged,
        [],
        [],
        densityDefault,
        `${seed}:pr`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'pressure_response',
        title: 'Pressure → response',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
    if (key === 'layering' && surface === 'overlay_pair') {
      const syn = pickVariant(seed + ':lay', [
        `Layering: two time layers can disagree; treat them as two simultaneous pictures rather than one merged verdict.`,
        `Layering: a short spike can sit on a longer personal arc; both can be true at different timescales.`,
      ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:lay`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'layering',
        title: 'Layering (natal / sky)',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
    if (key === 'delta_emphasis' && surface === 'sandbox') {
      const syn = pickVariant(seed + ':de', [
        `Sandbox delta: the picture changes when you move controls; compare against a known baseline chart outside the lab when you need a control.`,
        `Sandbox delta: strong shifts can be sensitivity tests for edge configurations, not fixed life predictions.`,
      ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:de`,
        [],
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'delta_emphasis',
        title: 'Sandbox note',
        text,
        meta: {
          enrichDensity: densityDefault,
          claimIdsReferenced: sortUniqueClaimIds(claimIds),
          phaseD: true,
          tagged,
        },
      });
    }
  }

  if (surface === 'profile' && tierEff === 'extended' && extraKeys.includes('contradiction') && tensionBlock) {
    const con2 = pickVariant(seed + ':con2', [
      `Contrast handling keeps constructive and challenging threads visible without forcing a single winner; the view stays multi-valued on purpose.`,
    ]);
    const baseTagged = taggedSectionBodyFromText(tensionBlock.text, 'synthesis_wrapper');
    const extraTagged = taggedSectionBodyFromText(con2, 'synthesis_wrapper');
    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      tensionBlock.text,
      baseTagged,
      [con2],
      [extraTagged],
      densityDefault,
      `${seed}:con`,
      [],
      reportPadUsed,
      PAD_SENTENCES
    );
    out.push({
      id: 'contradiction_map',
      title: 'Contrast map',
      text,
      meta: {
        enrichDensity: densityDefault,
        /** Phase 3: omit claim-id refs from meta (tension can overlap MEP); body text unchanged. */
        claimIdsReferenced: [],
        phaseD: true,
        tagged,
      },
    });
  }

  if (tierEff === 'extended' && surface === 'group' && extraKeys.includes('subcluster')) {
    const syn = pickVariant(seed + ':sub', [
      `Subcluster note: several threads may cluster on the same people; that cluster can act as a local hotspot before the spread picture tightens.`,
    ]);
    const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      syn,
      synTagged,
      [],
      [],
      densityDefault,
      `${seed}:sub`,
      [],
      reportPadUsed,
      PAD_SENTENCES
    );
    out.push({
      id: 'subcluster',
      title: 'Subcluster',
      text,
      meta: {
        enrichDensity: densityDefault,
        claimIdsReferenced: sortUniqueClaimIds(claimIds),
        phaseD: true,
        tagged,
      },
    });
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

  if (surface !== 'sandbox' && tierEff === 'extended' && extraKeys.includes('audio_thread')) {
    const bridge =
      'Listen detail lives in “How this sounds (listen metaphor)” below; it mirrors the words above without repeating every clause.';
    const bridgeTagged = taggedSectionBodyFromText(bridge, 'audio_thread');
    const { text, tagged } = enrichSectionTextWithTagged(
      bridge,
      bridgeTagged,
      [],
      [],
      'short',
      `${seed}:at`,
      [],
      reportPadUsed,
      PAD_SENTENCES
    );
    out.splice(Math.min(2, out.length), 0, {
      id: 'audio_thread',
      title: 'Audio thread',
      text,
      meta: { enrichDensity: 'short', claimIdsReferenced: [], phaseD: true, tagged },
    });
  }

  let framed = applyConnectionPreface(out, {
    surface,
    connectionMode: options.connectionMode,
    participantCount: options.participantCount,
    tier: tierEff,
    seed,
  });
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
