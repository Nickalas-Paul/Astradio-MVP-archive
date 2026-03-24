/**
 * Phase D — deterministic projection post-processing (same SemanticCore; no authority rerun).
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type { ExpansionTier, ProjectionOptions, ProjectionSurface, ProjectionValidation, ProjectedExplanationSection } from './projection-types';
import { SURFACE_SCHEMAS, expansionKeysFor } from './surface-schemas';
import { lintSectionBody } from './language-lint';
import { validateDensity, densityForSurfaceBaseline } from './density-validate';
import {
  buildClaimMechanismExpressionParagraph,
  buildTensionIntegrationParagraph,
  buildCampaignPressureResponseParagraph,
  buildSupplementalPanel,
} from './claim-beats';
import { buildAudioExplanationBlock } from './audio-explanation';
import { applyConnectionPreface } from './connection-framing';

function pickVariant(seed: string, variants: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

const PAD_SENTENCES = [
  'This pattern tends to be context-sensitive rather than fixed: the same emphasis may read louder under stress and softer under safety.',
  'Many people with similar encoding describe the feel as more situational than permanent, especially when life load changes week to week.',
  'Integration often works better as small experiments than as a single decisive relabeling of the self or the relationship.',
];

function countSentences(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const chunks = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  return Math.max(chunks.length, 1);
}

function expandSentencesToMin(text: string, minSentences: number, seed: string): string {
  let t = text.trim();
  if (!t) t = pickVariant(seed, PAD_SENTENCES);
  let n = countSentences(t);
  let i = 0;
  while (n < minSentences && i < 8) {
    t += ' ' + pickVariant(`${seed}:pad:${i}`, PAD_SENTENCES);
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

function densityForSectionId(sectionId: string, defaultD: 'short' | 'medium' | 'long'): 'short' | 'medium' | 'long' {
  if (
    /^(audio_|connection_|ensemble_|feed_)/.test(sectionId) ||
    sectionId === 'audio_thread' ||
    sectionId.startsWith('depth_panel_')
  ) {
    return 'short';
  }
  return defaultD;
}

function enrichSectionText(
  baseText: string,
  extraParagraphs: string[],
  density: 'short' | 'medium' | 'long',
  seed: string,
  claimIds: string[]
): { text: string; claimIds: string[] } {
  const rules =
    density === 'short'
      ? { minP: 1, minS: 3 }
      : density === 'medium'
        ? { minP: 2, minS: 3 }
        : { minP: 3, minS: 4 };

  let p1 = expandSentencesToMin(baseText.trim(), rules.minS, `${seed}:p1`);
  const blocks: string[] = [p1];
  for (let e = 0; e < extraParagraphs.length; e++) {
    blocks.push(expandSentencesToMin(extraParagraphs[e], rules.minS, `${seed}:ex:${e}`));
  }
  let merged = blocks.join('\n\n');
  let paras = splitIntoParagraphs(merged);
  if (paras.length < rules.minP) {
    const needed = rules.minP - paras.length;
    for (let k = 0; k < needed; k++) {
      paras.push(expandSentencesToMin(pickVariant(`${seed}:fill:${k}`, PAD_SENTENCES), rules.minS, `${seed}:fillS:${k}`));
    }
  }
  merged = paras.join('\n\n');
  const linted = lintSectionBody(merged);
  return { text: linted.text, claimIds };
}

export function buildFeedSections(core: SemanticCore, seed: string): ProjectedExplanationSection[] {
  const me = buildClaimMechanismExpressionParagraph(core, seed, 'baseline');
  const t1 = expandSentencesToMin(me.text.split(/[.!?]+/).slice(0, 2).join('.').trim() || me.text, 3, `${seed}:feed`);
  const lint1 = lintSectionBody(t1);
  const s1: ProjectedExplanationSection = {
    id: 'feed_signal',
    title: 'Signal',
    text: lint1.text,
    meta: { claimIdsReferenced: me.claimIds.slice(0, 4), phaseD: true },
  };
  const extra = pickVariant(seed + 'feed2', [
    'This card is intentionally short: it highlights a single activation thread rather than a full interpretive report.',
    'For a deeper read, open the full surface report; this card only surfaces a narrow slice of the same semantic readout.',
  ]);
  const s2: ProjectedExplanationSection = {
    id: 'feed_context',
    title: 'Scope',
    text: lintSectionBody(expandSentencesToMin(extra, 3, `${seed}:feed2`)).text,
    meta: { claimIdsReferenced: [], phaseD: true },
  };
  return [s1, s2];
}

export function applyPhaseDProjection(
  raw: ProjectedExplanationSection[],
  core: SemanticCore,
  seed: string,
  options: ProjectionOptions,
  _retryDepth = 0
): ProjectedExplanationSection[] {
  const surface = options.surface;
  let tierEff: ExpansionTier = options.tier ?? 'baseline';
  const schema = SURFACE_SCHEMAS[surface];

  if (surface === 'feed') {
    const feed = buildFeedSections(core, seed);
    const validation = validateReport(feed, surface, 'baseline', core, tierEff);
    feed[feed.length - 1].meta = { ...feed[feed.length - 1].meta, projection_validation: validation };
    return feed;
  }

  const densityDefault = densityForSurfaceBaseline(schema.baselineDensityDefault, tierEff);
  const mep = buildClaimMechanismExpressionParagraph(core, seed, tierEff);
  const tensionBlock = tierEff === 'baseline' ? null : buildTensionIntegrationParagraph(core, seed + ':ten');
  const campaignExtra =
    surface === 'campaign' && tierEff !== 'baseline' ? buildCampaignPressureResponseParagraph(core, seed + ':camp') : null;

  const out: ProjectedExplanationSection[] = raw.map((sec, idx) => {
    const d = densityForSectionId(sec.id, densityDefault);
    const extras: string[] = [];
    let cids = [...mep.claimIds];

    if (idx === 0) {
      extras.push(mep.text);
      if (tensionBlock) {
        extras.push(tensionBlock.text);
        cids.push(...tensionBlock.claimIds);
      }
    } else if (idx === 1) {
      const pan = buildSupplementalPanel(core, `${seed}:s1`, 0, tierEff);
      extras.push(pan.text);
      cids.push(...pan.claimIds);
      if (campaignExtra) {
        extras.push(campaignExtra.text);
        cids.push(...campaignExtra.claimIds);
      }
    } else {
      const pan = buildSupplementalPanel(core, `${seed}:sx`, idx, tierEff);
      extras.push(pan.text);
      cids.push(...pan.claimIds);
    }

    const { text, claimIds } = enrichSectionText(sec.text, extras, d, `${seed}:en:${sec.id}:${idx}`, cids);
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
      const syn = pickVariant(seed + ':syn', [
        `Cross-section synthesis: the same semantic readout tends to repeat a single rhythmic theme across sections; treat this as one pattern seen from multiple angles rather than separate truths.`,
        `Synthesis note: when multiple sections echo similar tensions, this often indicates one dominant configuration rather than unrelated issues; integration can focus on one lever with wide leverage.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityForSectionId('synthesis_a', densityDefault),
        `${seed}:synbody`,
        mep.claimIds.slice(0, 6)
      );
      out.push({
        id: 'synthesis_a',
        title: 'Synthesis',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'synthesis_b') {
      const syn = pickVariant(seed + ':synb', [
        `Extended synthesis: lower-ranked claims in the same SemanticCore inventory can still matter as moderators—they often describe where relief enters or where intensity softens without disappearing.`,
        `Second-pass synthesis: if earlier sections feel repetitive, that repetition is usually a signal of one dominant configuration; the moderating claims are the levers to test next.`,
      ]);
      const { text, claimIds } = enrichSectionText(
        syn,
        [],
        densityDefault,
        `${seed}:synb`,
        mep.claimIds.slice(0, 10)
      );
      out.push({
        id: 'synthesis_b',
        title: 'Extended synthesis',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'temporal_integration' && surface === 'daily') {
      const syn = pickVariant(seed + ':temp', [
        `Temporal integration: today’s activation tends to ride on top of slower baseline patterns; what feels urgent may still be a short spike on a longer curve.`,
        `Daily integration: if tension shows up in the sky snapshot, it may still move within hours; smaller adjustments often beat global conclusions.`,
      ]);
      const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:ti`, mep.claimIds.slice(0, 4));
      out.push({
        id: 'temporal_integration',
        title: 'Temporal integration',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'trait_bridge' && surface === 'profile') {
      const syn = pickVariant(seed + ':trait', [
        `Trait bridge: elemental and tonal signals in this readout often travel together; changing context can shift which side of the pattern shows up first.`,
        `Trait bridge: structural claims may show up in skills under stress before they show up in self-description; both tracks can be valid.`,
      ]);
      const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:tb`, mep.claimIds.slice(0, 5));
      out.push({
        id: 'trait_bridge',
        title: 'Trait bridge',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'interaction_map' && surface === 'compat_pair') {
      const syn = pickVariant(seed + ':im', [
        `Interaction map: when pair-level claims include both harmony and friction bands, many people experience alternating seasons rather than a steady average.`,
        `Interaction map: divergence claims, when present, suggest different stress languages; explicit naming often reduces unnecessary fusion.`,
      ]);
      const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:im`, mep.claimIds.slice(0, 6));
      out.push({
        id: 'interaction_map',
        title: 'Interaction map',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'field_distribution' && surface === 'group') {
      const syn = pickVariant(seed + ':fd', [
        `Field distribution: ensemble reads often concentrate activation in a subset of slots; look for repeated participant indices in claim metadata rather than assuming equal spread.`,
        `Field distribution: when relational weather is present, treat harmony and friction as field properties before reducing them to any single dyad.`,
      ]);
      const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:fd`, mep.claimIds.slice(0, 6));
      out.push({
        id: 'field_distribution',
        title: 'Field distribution',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'pressure_response' && surface === 'campaign') {
      const pr = buildCampaignPressureResponseParagraph(core, seed + ':pr');
      const { text, claimIds } = enrichSectionText(pr.text, [], densityDefault, `${seed}:pr`, pr.claimIds);
      out.push({
        id: 'pressure_response',
        title: 'Pressure → response',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'layering' && surface === 'overlay_pair') {
      const syn = pickVariant(seed + ':lay', [
        `Layering: natal versus sky snapshots can disagree; treat the readout as two simultaneous fields rather than one merged verdict.`,
        `Layering: transit emphasis may spike briefly while baseline emphasis steers the longer arc; both can be true at different timescales.`,
      ]);
      const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:lay`, mep.claimIds.slice(0, 5));
      out.push({
        id: 'layering',
        title: 'Layering (natal / sky)',
        text,
        meta: { claimIdsReferenced: claimIds, phaseD: true },
      });
    }
    if (key === 'delta_emphasis' && surface === 'sandbox') {
      const syn = pickVariant(seed + ':de', [
        `Sandbox delta: overrides change the encoded field; compare sections against a known baseline chart outside this lab readout when you need a control.`,
        `Sandbox delta: treat strong shifts here as sensitivity tests for how the engine narrates edge configurations, not as fixed life predictions.`,
      ]);
      const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:de`, mep.claimIds.slice(0, 4));
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
          `Contrast handling: keep both constructive and challenging threads visible without forcing a single winner; the semantic readout is intentionally multi-valued.`,
        ]),
      ],
      densityDefault,
      `${seed}:con`,
      tensionBlock.claimIds
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
      `Subcluster note: if several claims share the same participant slot indices, that cluster may act as a local hotspot within the wider field.`,
    ]);
    const { text, claimIds } = enrichSectionText(syn, [], densityDefault, `${seed}:sub`, mep.claimIds.slice(0, 8));
    out.push({
      id: 'subcluster',
      title: 'Subcluster',
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true },
    });
  }

  let panelIdx = 0;
  while (out.length < schema.baselineMinSections - 1) {
    const pan = buildSupplementalPanel(core, `${seed}:fillpanel`, panelIdx++, tierEff);
    const { text, claimIds } = enrichSectionText(
      pan.text,
      [],
      densityForSectionId('depth_panel_x', 'short'),
      `${seed}:dp:${panelIdx}`,
      pan.claimIds
    );
    out.push({
      id: `depth_panel_${panelIdx}`,
      title: pan.title,
      text,
      meta: { claimIdsReferenced: claimIds, phaseD: true },
    });
  }

  const audio = buildAudioExplanationBlock(core, tierEff, options.narrativePlan ?? null);
  if (tierEff === 'baseline') {
    const parts = audio.text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const shortAudio = parts.slice(0, 2).join(' ');
    const { text } = enrichSectionText(shortAudio, [], 'short', `${seed}:aud`, []);
    out.push({
      id: 'audio_staging',
      title: audio.title,
      text,
      meta: { claimIdsReferenced: [], phaseD: true },
    });
  } else {
    const { text } = enrichSectionText(audio.text, [], densityForSectionId('audio_staging', 'short'), `${seed}:audf`, []);
    out.push({
      id: 'audio_staging',
      title: audio.title,
      text,
      bullets: audio.bullets,
      meta: { claimIdsReferenced: [], phaseD: true },
    });
  }

  if (tierEff === 'extended' && extraKeys.includes('audio_thread')) {
    const bridge = pickVariant(seed + ':ath', [
      `Audio thread: staging is designed to track the same tension curve as the text readout; listen for how pacing and density mirror the encoded claims above.`,
    ]);
    const { text } = enrichSectionText(bridge, [], 'short', `${seed}:at`, []);
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

  let validation = validateReport(framed, surface, tierEff, core, tierEff);

  if (!validation.ok && tierEff !== 'baseline' && _retryDepth < 1) {
    return applyPhaseDProjection(raw, core, seed + ':retry', { ...options, tier: 'baseline' }, _retryDepth + 1);
  }

  framed[framed.length - 1].meta = {
    ...framed[framed.length - 1].meta,
    projection_validation: validation,
  };

  return framed;
}

function validateReport(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface,
  tier: ExpansionTier,
  core: SemanticCore,
  tierForDensity: ExpansionTier
): ProjectionValidation {
  const schema = SURFACE_SCHEMAS[surface];
  const violations: string[] = [];
  if (sections.length < schema.baselineMinSections) {
    violations.push(`sections:${sections.length}<${schema.baselineMinSections}`);
  }
  if (surface === 'feed' && schema.maxSectionsFeed && sections.length > schema.maxSectionsFeed) {
    violations.push(`feed_sections_overflow`);
  }

  const defaultD = densityForSurfaceBaseline(schema.baselineDensityDefault, tierForDensity);
  for (const sec of sections) {
    const d = densityForSectionId(sec.id, defaultD);
    const claims =
      sec.meta?.claimIdsReferenced && sec.meta.claimIdsReferenced.length > 0
        ? sec.meta.claimIdsReferenced
        : core.claims.slice(0, 8).map((c) => c.claim_id);
    const v = validateDensity(sec.text, d, claims);
    if (!v.ok) violations.push(`${sec.id}:${v.reasons.join(';')}`);
  }

  return { ok: violations.length === 0, tierEffective: tier, violations };
}
