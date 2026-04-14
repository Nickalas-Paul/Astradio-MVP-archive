/**
 * **Proj:** Step 8 — sole module that constructs ProjectedExplanationSection[] (before tone pass).
 * Pipeline ordinal only (not Product phase, not Acct:Stage-*). See apply-unified-projection for execution order.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type {
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
  buildClaimMechanismExpressionParagraph,
  buildControlledMechanismExpressionParagraph,
  buildTensionIntegrationParagraph,
  buildCampaignPressureResponseParagraph,
  buildSupplementalPanel,
  claimSentencesFromRange,
  capToMaxSentences,
} from './claim-synthesize';
import { claimWindow } from './claim-select';
import { selectDominantMechanismSignals } from './dominant-signal-selection';
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
import {
  reconstructTaggedSectionBody,
  splitParasForTagged,
  splitSentsForTagged,
  taggedSectionBodyFromBlocks,
  taggedSectionBodyFromText,
  taggedSectionFromTemplateLine,
} from '../tagged-text';

function pickVariant(seed: string, variants: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

const PAD_SENTENCES = reducedPadPool();

const FEED_SCOPE_SENTENCE = 'This card stays narrow by design.';

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

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

function appendSectionGroupTagged(
  extras: string[],
  extrasTagged: TaggedSectionBody[],
  claimIds: string[],
  usedWithinGroup: Set<string>,
  block: { text: string; claimIds: string[] } | null,
  provenance: import('../projection-types').ProvenanceType
): void {
  if (!block) return;
  const fresh = block.claimIds.filter((id) => !usedWithinGroup.has(id));
  if (fresh.length === 0 && block.claimIds.length > 0) return;
  extras.push(block.text);
  extrasTagged.push(taggedSectionBodyFromText(block.text, provenance));
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
    const claimIdsIn =
      s.meta?.claimIdsReferenced && s.meta.claimIdsReferenced.length > 0
        ? [...s.meta.claimIdsReferenced]
        : core.claims.slice(0, 8).map((c) => c.claim_id);
    const idTagged = taggedSectionBodyFromText(baseIdentity, 'synthesis_wrapper');
    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      baseIdentity,
      idTagged,
      [],
      [],
      d,
      `${seed}:${surface === 'compat_pair' ? 'compat' : 'group'}:rel:enrich:${i}`,
      claimIdsIn,
      reportPadUsed,
      PAD_SENTENCES
    );
    out[i] = {
      ...s,
      text,
      meta: { ...s.meta, claimIdsReferenced: [...new Set(claimIds)], phaseD: true, tagged },
    };
  }
  return out;
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
    paragraphNormDeque
  );
  const fallbackUsed = new Set<string>();
  const t1Raw = expandSentencesToMin(claimSlice.text, 1, `${seed}:feed`, [FEED_SCOPE_SENTENCE], fallbackUsed, 0);
  const t1 = capToMaxSentences(t1Raw, 2);
  const s1: ProjectedExplanationSection = {
    id: 'feed_signal',
    title: 'Signal',
    text: t1,
    meta: {
      claimIdsReferenced: claimSlice.claimIds.slice(0, 4),
      phaseD: true,
      tagged: taggedFeedSignalBody(t1),
    },
  };
  const s2: ProjectedExplanationSection = {
    id: 'feed_context',
    title: 'Scope',
    text: FEED_SCOPE_SENTENCE,
    meta: {
      claimIdsReferenced: [],
      phaseD: true,
      tagged: taggedSectionBodyFromText(FEED_SCOPE_SENTENCE, 'template'),
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
          selectDominantMechanismSignals(core.claims.slice(0, claimWindow(tierEff)), tierEff)
        )
      : buildClaimMechanismExpressionParagraph(core, seed, tierEff, surface, mepSectionRole, mepParagraphNorm);
  const openingClause = tierOpeningClause(surface, tierEff, seed);
  const tensionBlock = tierEff === 'baseline' ? null : buildTensionIntegrationParagraph(core, seed + ':ten');
  const campaignBaselineExtra =
    surface === 'campaign' && tierEff === 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp:base') : null;
  const campaignExpandedExtra =
    surface === 'campaign' && tierEff !== 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp') : null;

  const out: ProjectedExplanationSection[] = raw.map((sec, idx) => {
    const d = densityForSectionId(sec.id, densityDefault);
    const extras: string[] = [];
    const extrasTagged: TaggedSectionBody[] = [];
    let cids = [...mep.claimIds];
    const usedWithinGroup = new Set<string>(mep.claimIds);

    if (idx === 0) {
      if (openingClause) {
        extras.push(openingClause);
        extrasTagged.push(taggedSectionBodyFromText(openingClause, 'tier_scaffold'));
      }
      appendSectionGroupTagged(extras, extrasTagged, cids, usedWithinGroup, mep, 'claim_body');
      appendSectionGroupTagged(extras, extrasTagged, cids, usedWithinGroup, tensionBlock, 'synthesis_wrapper');
      if (surface === 'sandbox') {
        const lab = pickVariant(`${seed}:sandbox:lab:${tierEff}`, [
          'Sandbox framing: this picture reflects lab conditions you changed on purpose.',
          'Sandbox framing: this lab pass emphasizes sensitivity to those changes, not fixed life conclusions.',
        ]);
        extras.push(lab);
        extrasTagged.push(taggedSectionBodyFromText(lab, 'synthesis_wrapper'));
      }
    } else if (idx === 1) {
      const sectionRoleDeque: ClaimOptionalRole[] = [];
      const paragraphNormDeque: string[] = [];
      const pan = buildSupplementalPanel(core, `${seed}:s1`, 0, tierEff, surface, sectionRoleDeque, paragraphNormDeque);
      appendSectionGroupTagged(extras, extrasTagged, cids, usedWithinGroup, pan, 'claim_body');
      appendSectionGroupTagged(extras, extrasTagged, cids, usedWithinGroup, campaignBaselineExtra, 'claim_body');
      appendSectionGroupTagged(extras, extrasTagged, cids, usedWithinGroup, campaignExpandedExtra, 'claim_body');
    } else {
      const sectionRoleDeque: ClaimOptionalRole[] = [];
      const paragraphNormDeque: string[] = [];
      const pan = buildSupplementalPanel(core, `${seed}:sx`, idx, tierEff, surface, sectionRoleDeque, paragraphNormDeque);
      appendSectionGroupTagged(extras, extrasTagged, cids, usedWithinGroup, pan, 'claim_body');
    }

    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      sec.text,
      sec.meta!.tagged!,
      extras,
      extrasTagged,
      d,
      `${seed}:en:${sec.id}:${idx}`,
      cids,
      reportPadUsed,
      PAD_SENTENCES
    );
    return {
      ...sec,
      text,
      meta: { ...sec.meta, claimIdsReferenced: [...new Set(claimIds)], phaseD: true, tagged },
    };
  });

  const extraKeys = expansionKeysFor(surface, tierEff);
  for (const key of extraKeys) {
    if (key === 'audio_thread') continue;
    if (key === 'synthesis_a') {
      const synSecRole: ClaimOptionalRole[] = [];
      const synParaNorm: string[] = [];
      const synClaim = claimSentencesFromRange(
        core,
        4,
        2,
        `${seed}:synA`,
        surface,
        tierEff,
        synSecRole,
        synParaNorm
      );
      const wrap = pickVariant(seed + ':syn', [
        `Cross-section synthesis ties together mid-rank threads that moderate the dominant pattern.`,
        `Synthesis adds secondary threads that refine where intensity softens or concentrates.`,
      ]);
      const synBody = capToMaxSentences(synClaim.text, 3);
      const syn = [wrap, synBody].filter((x) => x.trim().length > 0).join('\n\n');
      const synTagged =
        synBody.trim().length > 0
          ? taggedSectionBodyFromBlocks([
              { text: wrap, provenance: 'synthesis_wrapper' },
              { text: synBody, provenance: 'claim_body' },
            ])
          : taggedSectionBodyFromText(wrap, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        'short',
        `${seed}:synbody`,
        [...new Set([...mep.claimIds.slice(0, 6), ...synClaim.claimIds])],
        reportPadUsed,
        PAD_SENTENCES,
        { feed: true }
      );
      out.push({
        id: 'synthesis_a',
        title: 'Synthesis',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
      });
    }
    if (key === 'synthesis_b') {
      const synBSecRole: ClaimOptionalRole[] = [];
      const synBParaNorm: string[] = [];
      const synClaim = claimSentencesFromRange(
        core,
        7,
        3,
        `${seed}:synB`,
        surface,
        tierEff,
        synBSecRole,
        synBParaNorm
      );
      const wrapB = pickVariant(seed + ':synb', [
        `Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern.`,
        `Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal.`,
      ]);
      const synBodyB = capToMaxSentences(synClaim.text, 3);
      const syn = [wrapB, synBodyB].filter((x) => x.trim().length > 0).join('\n\n');
      const synTagged =
        synBodyB.trim().length > 0
          ? taggedSectionBodyFromBlocks([
              { text: wrapB, provenance: 'synthesis_wrapper' },
              { text: synBodyB, provenance: 'claim_body' },
            ])
          : taggedSectionBodyFromText(wrapB, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        'short',
        `${seed}:synb`,
        [...new Set([...mep.claimIds.slice(0, 10), ...synClaim.claimIds])],
        reportPadUsed,
        PAD_SENTENCES,
        { feed: true }
      );
      out.push({
        id: 'synthesis_b',
        title: 'Extended synthesis',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
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
        mep.claimIds.slice(0, 4),
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'temporal_integration',
        title: 'Temporal integration',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
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
        mep.claimIds.slice(0, 5),
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'trait_bridge',
        title: 'Trait bridge',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
      });
    }
    if (key === 'interaction_map' && surface === 'compat_pair') {
      const syn = pickVariant(seed + ':im', [
        `Interaction map: alternating seasons can show when harmony and friction both appear, rather than one steady average.`,
        `Interaction map: different stress languages can appear when divergence shows; naming them often reduces unnecessary fusion.`,
      ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:im`,
        mep.claimIds.slice(0, 6),
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'interaction_map',
        title: 'Interaction map',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
      });
    }
    if (key === 'field_distribution' && surface === 'group') {
      const syn = pickVariant(seed + ':fd', [
        `Field distribution: emphasis often concentrates on a few people rather than spreading evenly.`,
        `Field distribution: harmony and friction can read as uneven spread before local detail tightens.`,
      ]);
      const synTagged = taggedSectionBodyFromText(syn, 'synthesis_wrapper');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        syn,
        synTagged,
        [],
        [],
        densityDefault,
        `${seed}:fd`,
        mep.claimIds.slice(0, 6),
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'field_distribution',
        title: 'Field distribution',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
      });
    }
    if (key === 'pressure_response' && surface === 'campaign') {
      const pr = buildCampaignPressureResponseParagraph(core, seed + ':pr');
      const prTagged = taggedSectionBodyFromText(pr.text, 'claim_body');
      const { text, claimIds, tagged } = enrichSectionTextWithTagged(
        pr.text,
        prTagged,
        [],
        [],
        densityDefault,
        `${seed}:pr`,
        pr.claimIds,
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'pressure_response',
        title: 'Pressure → response',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
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
        mep.claimIds.slice(0, 5),
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'layering',
        title: 'Layering (natal / sky)',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
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
        mep.claimIds.slice(0, 4),
        reportPadUsed,
        PAD_SENTENCES
      );
      out.push({
        id: 'delta_emphasis',
        title: 'Sandbox note',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
      });
    }
  }

  if (tierEff === 'extended' && extraKeys.includes('contradiction') && tensionBlock) {
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
      tensionBlock.claimIds,
      reportPadUsed,
      PAD_SENTENCES
    );
    out.push({
      id: 'contradiction_map',
      title: 'Contrast map',
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
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
      mep.claimIds.slice(0, 8),
      reportPadUsed,
      PAD_SENTENCES
    );
    out.push({
      id: 'subcluster',
      title: 'Subcluster',
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
    });
  }

  let panelIdx = 0;
  while (out.length < schema.baselineMinSections - 1) {
    const fillSecRole: ClaimOptionalRole[] = [];
    const fillParaNorm: string[] = [];
    const pan = buildSupplementalPanel(
      core,
      `${seed}:fillpanel`,
      panelIdx++,
      tierEff,
      surface,
      fillSecRole,
      fillParaNorm
    );
    const panTagged = taggedSectionBodyFromText(pan.text, 'claim_body');
    const { text, claimIds, tagged } = enrichSectionTextWithTagged(
      pan.text,
      panTagged,
      [],
      [],
      densityForSectionId('depth_panel_x', 'short'),
      `${seed}:dp:${panelIdx}`,
      pan.claimIds,
      reportPadUsed,
      PAD_SENTENCES,
      { feed: true }
    );
    out.push({
      id: `depth_panel_${panelIdx}`,
      title: pan.title,
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true, tagged },
    });
  }

  const audio = buildAudioStagingBlock(core, tierEff, options.narrativePlan ?? null, surface);
  const audioBodyNormalized = normalizeAudioExplanationBody(audio.text);
  if (tierEff === 'baseline') {
    const parts = audioBodyNormalized.split(/(?<=[.!?])\s+/).filter(Boolean);
    const shortAudio = parts.slice(0, 2).join(' ');
    const shortTagged = taggedSectionBodyFromText(shortAudio, 'audio_staging');
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
      meta: { claimIdsReferenced: [], phaseD: true, tagged },
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
      meta: { claimIdsReferenced: [], phaseD: true, tagged },
    });
  }

  if (tierEff === 'extended' && extraKeys.includes('audio_thread')) {
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
      meta: { claimIdsReferenced: [], phaseD: true, tagged },
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
