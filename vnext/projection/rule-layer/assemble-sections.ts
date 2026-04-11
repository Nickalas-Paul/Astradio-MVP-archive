/**
 * Step 8 — sole module that constructs ProjectedExplanationSection[] (before tone pass).
 * See apply-unified-projection for execution order.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type {
  ExpansionTier,
  ProjectionOptions,
  ProjectionSurface,
  ProjectedExplanationSection,
} from '../projection-types';
import { SURFACE_SCHEMAS, expansionKeysFor } from '../surface-schemas';
import { densityForSurfaceBaseline } from '../density-validate';
import type { ClaimOptionalRole } from './claim-expression-bundles';
import {
  buildClaimMechanismExpressionParagraph,
  buildTensionIntegrationParagraph,
  buildCampaignPressureResponseParagraph,
  buildSupplementalPanel,
  claimSentencesFromRange,
} from './claim-synthesize';
import { buildAudioStagingBlock } from './audio-lexicon';
import { applyConnectionPreface } from './connection-preface';
import { lineForTemplate, idMap, temporalIntegrationLine, type TemplateContext } from './template-lines';
import { classifyTopology } from './topology-classify';
import { densityForSectionId } from './validate-projection';
import {
  applyAnchorAndTemporalToSectionBody,
  assertTemplateHasNoLegacyAnchor,
  reducedPadPool,
  repairPhase2ParagraphLoads,
  validatePhase2Sections,
} from './phase2-sentence-load';

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
      expanded: ['Expanded pair pass adds interaction-mode detail beyond the baseline compatibility frame.'],
      extended: ['Expanded pair pass adds secondary pair moderators and contrast handling.'],
    },
    group: {
      expanded: ['Expanded group pass: this picture adds how emphasis spreads across people in the room.'],
      extended: ['Expanded group pass: this picture adds smaller clusters inside the wider group story.'],
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

function enrichSectionText(
  baseText: string,
  extraParagraphs: string[],
  density: 'short' | 'medium' | 'long',
  seed: string,
  claimIds: string[],
  usedFallback?: Set<string>,
  fallbackPool: string[] = PAD_SENTENCES,
  enrichOpts?: { feed?: boolean; campaignExtendedFill?: boolean }
): { text: string; claimIds: string[] } {
  const rules =
    density === 'short'
      ? { minP: 1, minS: 1 }
      : density === 'medium'
        ? { minP: 1, minS: 2 }
        : { minP: 2, minS: 2 };

  const maxPad = enrichOpts?.feed ? 0 : 1;
  let p1 = expandSentencesToMin(
    baseText.trim(),
    rules.minS,
    `${seed}:p1`,
    fallbackPool,
    usedFallback,
    maxPad
  );
  const blocks: string[] = [p1];
  for (let e = 0; e < extraParagraphs.length; e++) {
    blocks.push(
      expandSentencesToMin(extraParagraphs[e], rules.minS, `${seed}:ex:${e}`, fallbackPool, usedFallback, maxPad)
    );
  }
  let merged = blocks.join('\n\n');
  let paras = splitIntoParagraphs(merged);
  if (paras.length < rules.minP && enrichOpts?.campaignExtendedFill) {
    paras.push(
      expandSentencesToMin(
        nextFallbackSentence(`${seed}:fill:0`, fallbackPool, usedFallback),
        rules.minS,
        `${seed}:fillS:0`,
        fallbackPool,
        usedFallback,
        1
      )
    );
  }
  paras = paras.map((para, pi) => {
    const need = rules.minS;
    const n = countSentences(para);
    if (n >= need) return para;
    const paraPadCap = enrichOpts?.feed ? 0 : Math.min(2, Math.max(1, need));
    return expandSentencesToMin(para, need, `${seed}:para:${pi}`, fallbackPool, usedFallback, paraPadCap);
  });
  merged = paras.join('\n\n');
  return { text: merged, claimIds };
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
          ])
        : pickVariant(`${seed}:group:rel`, [
            'Emphasis spreads across the room before zooming to one pair.',
            'The room holds many voices and local clusters; it is not only one pair story.',
          ]);
    const claimIdsIn =
      s.meta?.claimIdsReferenced && s.meta.claimIdsReferenced.length > 0
        ? [...s.meta.claimIdsReferenced]
        : core.claims.slice(0, 8).map((c) => c.claim_id);
    const { text, claimIds } = enrichSectionText(
      baseIdentity,
      [],
      d,
      `${seed}:${surface === 'compat_pair' ? 'compat' : 'group'}:rel:enrich:${i}`,
      claimIdsIn,
      reportPadUsed
    );
    out[i] = {
      ...s,
      text,
      meta: { ...s.meta, claimIdsReferenced: [...new Set(claimIds)], phaseD: true },
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
    });
  }
  return out;
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
  const t1 = expandSentencesToMin(claimSlice.text, 1, `${seed}:feed`, [FEED_SCOPE_SENTENCE], fallbackUsed, 0);
  const s1: ProjectedExplanationSection = {
    id: 'feed_signal',
    title: 'Signal',
    text: t1,
    meta: { claimIdsReferenced: claimSlice.claimIds.slice(0, 4), phaseD: true },
  };
  const s2: ProjectedExplanationSection = {
    id: 'feed_context',
    title: 'Scope',
    text: FEED_SCOPE_SENTENCE,
    meta: { claimIdsReferenced: [], phaseD: true },
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
    return {
      ...sec,
      text: repairPhase2ParagraphLoads(merged, 'template', sec.id),
    };
  });

  const densityDefault = densityForSurfaceBaseline(schema.baselineDensityDefault, tierEff);
  const reportPadUsed = new Set<string>();
  const mepSectionRole: ClaimOptionalRole[] = [];
  const mepParagraphNorm: string[] = [];
  const mep = buildClaimMechanismExpressionParagraph(core, seed, tierEff, surface, mepSectionRole, mepParagraphNorm);
  const openingClause = tierOpeningClause(surface, tierEff, seed);
  const tensionBlock = tierEff === 'baseline' ? null : buildTensionIntegrationParagraph(core, seed + ':ten');
  const campaignBaselineExtra =
    surface === 'campaign' && tierEff === 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp:base') : null;
  const campaignExpandedExtra =
    surface === 'campaign' && tierEff !== 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp') : null;

  const out: ProjectedExplanationSection[] = raw.map((sec, idx) => {
    const d = densityForSectionId(sec.id, densityDefault);
    const extras: string[] = [];
    let cids = [...mep.claimIds];
    const usedWithinGroup = new Set<string>(mep.claimIds);

    if (idx === 0) {
      if (openingClause) extras.push(openingClause);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, mep);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, tensionBlock);
      if (surface === 'sandbox') {
        extras.push(
          pickVariant(`${seed}:sandbox:lab:${tierEff}`, [
            'Sandbox framing: this picture reflects lab conditions you changed on purpose.',
            'Sandbox framing: this lab pass emphasizes sensitivity to those changes, not fixed life conclusions.',
          ])
        );
      }
    } else if (idx === 1) {
      const sectionRoleDeque: ClaimOptionalRole[] = [];
      const paragraphNormDeque: string[] = [];
      const pan = buildSupplementalPanel(core, `${seed}:s1`, 0, tierEff, surface, sectionRoleDeque, paragraphNormDeque);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, pan);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, campaignBaselineExtra);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, campaignExpandedExtra);
    } else {
      const sectionRoleDeque: ClaimOptionalRole[] = [];
      const paragraphNormDeque: string[] = [];
      const pan = buildSupplementalPanel(core, `${seed}:sx`, idx, tierEff, surface, sectionRoleDeque, paragraphNormDeque);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, pan);
    }

    const { text, claimIds } = enrichSectionText(
      sec.text,
      extras,
      d,
      `${seed}:en:${sec.id}:${idx}`,
      cids,
      reportPadUsed
    );
    return {
      ...sec,
      text,
      meta: { claimIdsReferenced: [...new Set(claimIds)], phaseD: true },
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
      const syn = [
        pickVariant(seed + ':syn', [
          `Cross-section synthesis ties together mid-rank threads that moderate the dominant pattern.`,
          `Synthesis adds secondary threads that refine where intensity softens or concentrates.`,
        ]),
        synClaim.text,
      ]
        .filter(Boolean)
        .join('\n\n');
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityForSectionId('synthesis_a', densityDefault),
        `${seed}:synbody`,
        [...new Set([...mep.claimIds.slice(0, 6), ...synClaim.claimIds])],
        reportPadUsed
      );
      out.push({
        id: 'synthesis_a',
        title: 'Synthesis',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
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
      const syn = [
        pickVariant(seed + ':synb', [
          `Extended synthesis brings in lower-ranked moderator threads to map nuance around the headline pattern.`,
          `Second-pass synthesis adds moderator threads that can shift emphasis without replacing the primary signal.`,
        ]),
        synClaim.text,
      ]
        .filter(Boolean)
        .join('\n\n');
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:synb`,
        [...new Set([...mep.claimIds.slice(0, 10), ...synClaim.claimIds])],
        reportPadUsed
      );
      out.push({
        id: 'synthesis_b',
        title: 'Extended synthesis',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'temporal_integration' && surface === 'daily') {
      const syn = temporalIntegrationLine(params.temporalBucket, `${seed}:temp`);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:ti`,
        mep.claimIds.slice(0, 4),
        reportPadUsed
      );
      out.push({
        id: 'temporal_integration',
        title: 'Temporal integration',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'trait_bridge' && surface === 'profile') {
      const syn = pickVariant(seed + ':trait', [
        `Trait bridge: elemental and tonal signals often travel together; changing context can shift which side shows up first.`,
        `Trait bridge: structure in skills under stress may show before self-description; both tracks can be valid.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:tb`,
        mep.claimIds.slice(0, 5),
        reportPadUsed
      );
      out.push({
        id: 'trait_bridge',
        title: 'Trait bridge',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'interaction_map' && surface === 'compat_pair') {
      const syn = pickVariant(seed + ':im', [
        `Interaction map: alternating seasons can show when harmony and friction both appear, rather than one steady average.`,
        `Interaction map: different stress languages can appear when divergence shows; naming them often reduces unnecessary fusion.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:im`,
        mep.claimIds.slice(0, 6),
        reportPadUsed
      );
      out.push({
        id: 'interaction_map',
        title: 'Interaction map',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'field_distribution' && surface === 'group') {
      const syn = pickVariant(seed + ':fd', [
        `Field distribution: emphasis often concentrates on a few people rather than spreading evenly.`,
        `Field distribution: harmony and friction can read as room-wide qualities before shrinking them to one pair.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:fd`,
        mep.claimIds.slice(0, 6),
        reportPadUsed
      );
      out.push({
        id: 'field_distribution',
        title: 'Field distribution',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'pressure_response' && surface === 'campaign') {
      const pr = buildCampaignPressureResponseParagraph(core, seed + ':pr');
      const { text, claimIds } = enrichSectionText(
        pr.text,
        [],
        densityDefault,
        `${seed}:pr`,
        pr.claimIds,
        reportPadUsed
      );
      out.push({
        id: 'pressure_response',
        title: 'Pressure → response',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'layering' && surface === 'overlay_pair') {
      const syn = pickVariant(seed + ':lay', [
        `Layering: two time layers can disagree; treat them as two simultaneous pictures rather than one merged verdict.`,
        `Layering: a short spike can sit on a longer personal arc; both can be true at different timescales.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:lay`,
        mep.claimIds.slice(0, 5),
        reportPadUsed
      );
      out.push({
        id: 'layering',
        title: 'Layering (natal / sky)',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'delta_emphasis' && surface === 'sandbox') {
      const syn = pickVariant(seed + ':de', [
        `Sandbox delta: the picture changes when you move controls; compare against a known baseline chart outside the lab when you need a control.`,
        `Sandbox delta: strong shifts can be sensitivity tests for edge configurations, not fixed life predictions.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:de`,
        mep.claimIds.slice(0, 4),
        reportPadUsed
      );
      out.push({
        id: 'delta_emphasis',
        title: 'Sandbox note',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
  }

  if (tierEff === 'extended' && extraKeys.includes('contradiction') && tensionBlock) {
    const { text, claimIds } = enrichSectionText(
      tensionBlock.text,
      [
        pickVariant(seed + ':con2', [
          `Contrast handling keeps constructive and challenging threads visible without forcing a single winner; the view stays multi-valued on purpose.`,
        ]),
      ],
      densityDefault,
      `${seed}:con`,
      tensionBlock.claimIds,
      reportPadUsed
    );
    out.push({
      id: 'contradiction_map',
      title: 'Contrast map',
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true },
    });
  }

  if (tierEff === 'extended' && surface === 'group' && extraKeys.includes('subcluster')) {
    const syn = pickVariant(seed + ':sub', [
      `Subcluster note: several threads may cluster on the same people; that cluster can act as a local hotspot in the wider room.`,
    ]);
    const { text, claimIds } = enrichSectionText(
      syn,
      [],
      densityDefault,
      `${seed}:sub`,
      mep.claimIds.slice(0, 8),
      reportPadUsed
    );
    out.push({
      id: 'subcluster',
      title: 'Subcluster',
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true },
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
    const { text, claimIds } = enrichSectionText(
      pan.text,
      [],
      densityForSectionId('depth_panel_x', 'short'),
      `${seed}:dp:${panelIdx}`,
      pan.claimIds,
      reportPadUsed
    );
    out.push({
      id: `depth_panel_${panelIdx}`,
      title: pan.title,
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true },
    });
  }

  const audio = buildAudioStagingBlock(core, tierEff, options.narrativePlan ?? null, surface);
  const audioBodyNormalized = normalizeAudioExplanationBody(audio.text);
  if (tierEff === 'baseline') {
    const parts = audioBodyNormalized.split(/(?<=[.!?])\s+/).filter(Boolean);
    const shortAudio = parts.slice(0, 2).join(' ');
    const { text } = enrichSectionText(shortAudio, [], 'short', `${seed}:aud`, [], reportPadUsed);
    out.push({
      id: 'audio_staging',
      title: audio.title,
      text,
      meta: { claimIdsReferenced: [], phaseD: true },
    });
  } else {
    const { text } = enrichSectionText(
      audioBodyNormalized,
      [],
      densityForSectionId('audio_staging', 'short'),
      `${seed}:audf`,
      [],
      reportPadUsed
    );
    out.push({
      id: 'audio_staging',
      title: audio.title,
      text,
      bullets: audio.bullets,
      meta: { claimIdsReferenced: [], phaseD: true },
    });
  }

  if (tierEff === 'extended' && extraKeys.includes('audio_thread')) {
    const bridge =
      'Listen detail lives in “How this sounds (listen metaphor)” below; it mirrors the words above without repeating every clause.';
    const { text } = enrichSectionText(bridge, [], 'short', `${seed}:at`, [], reportPadUsed);
    out.splice(Math.min(2, out.length), 0, {
      id: 'audio_thread',
      title: 'Audio thread',
      text,
      meta: { claimIdsReferenced: [], phaseD: true },
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
  }

  return framed;
}
