/**
 * Phase D — deterministic projection post-processing (same SemanticCore; no authority rerun).
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type {
  ExpansionTier,
  ProjectionOptions,
  ProjectionSurface,
  ProjectionValidation,
  ProjectedExplanationSection,
} from './projection-types';
import { SURFACE_SCHEMAS, expansionKeysFor } from './surface-schemas';
import { lintSectionBody } from './language-lint';
import { validateDensity, densityForSurfaceBaseline } from './density-validate';
import {
  buildClaimMechanismExpressionParagraph,
  buildTensionIntegrationParagraph,
  buildCampaignPressureResponseParagraph,
  buildSupplementalPanel,
  claimSentencesFromRange,
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

const FEED_FALLBACK_SENTENCES = [
  'This card stays narrow by design: it highlights one encoded activation thread from the same semantic source.',
  'Use this card as a short signal check, then open a full report when you need broader synthesis.',
  'The feed surface is intentionally compressed, so it favors one clear observation over full narrative depth.',
];

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

function nextFallbackSentence(
  seed: string,
  pool: string[],
  used?: Set<string>
): string {
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
  usedFallback?: Set<string>
): string {
  let t = text.trim();
  if (!t) t = nextFallbackSentence(`${seed}:base`, fallbackPool, usedFallback);
  let n = countSentences(t);
  let i = 0;
  while (n < minSentences && i < 8) {
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

/** Join audio explanation paragraphs into one block (sentence order preserved; no paraphrase). */
function normalizeAudioExplanationBody(audioText: string): string {
  return audioText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
}

function buildFinalProjectionValidation(
  tierRequested: ExpansionTier,
  tierEffective: ExpansionTier,
  validateResult: { ok: boolean; violations: string[] },
  priorAttemptViolations?: string[]
): ProjectionValidation {
  const downgraded =
    tierRequested !== 'baseline' &&
    tierEffective === 'baseline' &&
    priorAttemptViolations != null &&
    priorAttemptViolations.length > 0;
  const out: ProjectionValidation = {
    ok: validateResult.ok,
    tierRequested,
    tierEffective,
    violations: validateResult.violations,
  };
  if (downgraded) {
    out.downgradedFrom = tierRequested;
    out.prior_attempt_violations = [...priorAttemptViolations!];
  }
  return out;
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

function tierOpeningClause(surface: ProjectionSurface, tier: ExpansionTier, seed: string): string | null {
  if (tier === 'baseline') return null;
  const bySurface: Record<ProjectionSurface, { expanded: string[]; extended: string[] }> = {
    profile: {
      expanded: [
        'Expanded pass: this read adds mid-rank claims that often explain how the same pattern shifts across context.',
      ],
      extended: [
        'Extended pass: this read folds in lower-ranked moderator claims to map nuance, not just the dominant headline.',
      ],
    },
    daily: {
      expanded: ['Expanded daily pass: this read adds near-term timing nuance around the same active sky signal.'],
      extended: ['Extended daily pass: this read adds secondary timing modifiers and contrast handling.'],
    },
    sandbox: {
      expanded: ['Expanded sandbox pass: this lab read adds additional override-sensitive interpretation threads.'],
      extended: ['Extended sandbox pass: this lab read adds second-order effects for edge-condition sensitivity.'],
    },
    overlay_pair: {
      expanded: ['Expanded overlay pass: this read adds more explicit natal-versus-transit layering detail.'],
      extended: ['Extended overlay pass: this read adds moderator threads across both time layers.'],
    },
    compat_pair: {
      expanded: ['Expanded pair pass: this read adds interaction-mode detail beyond the baseline compatibility frame.'],
      extended: ['Extended pair pass: this read adds secondary pair moderators and contrast handling.'],
    },
    group: {
      expanded: ['Expanded group pass: this read adds field-level distribution detail across participants.'],
      extended: ['Extended group pass: this read adds subcluster-level moderators in the ensemble field.'],
    },
    campaign: {
      expanded: ['Expanded campaign pass: this read adds pressure-response detail beyond baseline pacing guidance.'],
      extended: ['Extended campaign pass: this read adds secondary pressure moderators for turn-level adaptation.'],
    },
    feed: {
      expanded: ['Expanded feed pass: this card adds one additional context layer while staying concise.'],
      extended: ['Extended feed pass: this card adds one deeper synthesis hint without turning into a full report.'],
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
    // Keep structural blocks even when no explicit claim ids are attached.
    return;
  }
}

function applyAggregateSurfaceIdentityOverrides(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface,
  seed: string
): ProjectedExplanationSection[] {
  if (surface !== 'compat_pair' && surface !== 'group') return sections;
  const out = sections.map((s) => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    const s = out[i];
    if (s.id !== 'relational_field') continue;
    if (surface === 'compat_pair') {
      s.text = lintSectionBody(
        expandSentencesToMin(
          pickVariant(`${seed}:compat:rel`, [
            'Pair field framing: this section prioritizes dyadic pacing and mutual regulation loops before broader generalization.',
            'Pair field framing: this section reads relational activation as two-person interface dynamics, not ensemble diffusion.',
          ]),
          3,
          `${seed}:compat:rel:sent`
        )
      ).text;
    } else {
      s.text = lintSectionBody(
        expandSentencesToMin(
          pickVariant(`${seed}:group:rel`, [
            'Group field framing: this section prioritizes ensemble distribution effects before any single dyad is highlighted.',
            'Group field framing: this section reads activation as a multi-node field with local clusters, not one pair axis.',
          ]),
          3,
          `${seed}:group:rel:sent`
        )
      ).text;
    }
    out[i] = s;
  }
  return out;
}

function enrichSectionText(
  baseText: string,
  extraParagraphs: string[],
  density: 'short' | 'medium' | 'long',
  seed: string,
  claimIds: string[],
  usedFallback?: Set<string>,
  fallbackPool: string[] = PAD_SENTENCES
): { text: string; claimIds: string[] } {
  const rules =
    density === 'short'
      ? { minP: 1, minS: 3 }
      : density === 'medium'
        ? { minP: 2, minS: 3 }
        : { minP: 3, minS: 4 };

  let p1 = expandSentencesToMin(baseText.trim(), rules.minS, `${seed}:p1`, fallbackPool, usedFallback);
  const blocks: string[] = [p1];
  for (let e = 0; e < extraParagraphs.length; e++) {
    blocks.push(expandSentencesToMin(extraParagraphs[e], rules.minS, `${seed}:ex:${e}`, fallbackPool, usedFallback));
  }
  let merged = blocks.join('\n\n');
  let paras = splitIntoParagraphs(merged);
  if (paras.length < rules.minP) {
    const needed = rules.minP - paras.length;
    for (let k = 0; k < needed; k++) {
      paras.push(
        expandSentencesToMin(
          nextFallbackSentence(`${seed}:fill:${k}`, fallbackPool, usedFallback),
          rules.minS,
          `${seed}:fillS:${k}`,
          fallbackPool,
          usedFallback
        )
      );
    }
  }
  merged = paras.join('\n\n');
  const linted = lintSectionBody(merged);
  return { text: linted.text, claimIds };
}

export function buildFeedSections(core: SemanticCore, seed: string): ProjectedExplanationSection[] {
  const claimSlice = claimSentencesFromRange(core, 0, 2, `${seed}:feed:signal`);
  const fallbackUsed = new Set<string>();
  const t1 = expandSentencesToMin(
    claimSlice.text,
    3,
    `${seed}:feed`,
    FEED_FALLBACK_SENTENCES,
    fallbackUsed
  );
  const lint1 = lintSectionBody(t1);
  const s1: ProjectedExplanationSection = {
    id: 'feed_signal',
    title: 'Signal',
    text: lint1.text,
    meta: { claimIdsReferenced: claimSlice.claimIds.slice(0, 4), phaseD: true },
  };
  const extra = pickVariant(seed + 'feed2', [
    'This card is intentionally short and highlights one activation thread rather than a full interpretive report.',
    'Use this card as a quick signal check, then open a full report for broader synthesis.',
  ]);
  const s2: ProjectedExplanationSection = {
    id: 'feed_context',
    title: 'Scope',
    text: lintSectionBody(expandSentencesToMin(extra, 3, `${seed}:feed2`, FEED_FALLBACK_SENTENCES, fallbackUsed)).text,
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
  const tierMetaRequested: ExpansionTier = options.originalTierRequested ?? options.tier ?? 'baseline';
  let tierEff: ExpansionTier = options.tier ?? 'baseline';
  const schema = SURFACE_SCHEMAS[surface];

  if (surface === 'feed') {
    const tierRequested = options.tier ?? 'baseline';
    const feed = buildFeedSections(core, seed);
    const vr = validateReportSections(feed, surface, 'baseline', core, tierRequested);
    const pv = buildFinalProjectionValidation(tierRequested, 'baseline', vr, undefined);
    feed[feed.length - 1].meta = { ...feed[feed.length - 1].meta, projection_validation: pv };
    return feed;
  }

  const densityDefault = densityForSurfaceBaseline(schema.baselineDensityDefault, tierEff);
  const reportPadUsed = new Set<string>();
  const mep = buildClaimMechanismExpressionParagraph(core, seed, tierEff);
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
            'Sandbox framing: this read reflects override-sensitive lab conditions and should be compared against a baseline chart for control.',
            'Sandbox framing: this lab pass emphasizes sensitivity to overrides, not fixed life conclusions.',
          ])
        );
      }
    } else if (idx === 1) {
      const pan = buildSupplementalPanel(core, `${seed}:s1`, 0, tierEff);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, pan);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, campaignBaselineExtra);
      appendSectionGroupBlock(extras, cids, usedWithinGroup, campaignExpandedExtra);
    } else {
      const pan = buildSupplementalPanel(core, `${seed}:sx`, idx, tierEff);
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
      const synClaim = claimSentencesFromRange(core, 4, 2, `${seed}:synA`);
      const syn = [
        pickVariant(seed + ':syn', [
          `Cross-section synthesis: this pass ties together mid-rank claims that moderate the dominant pattern.`,
          `Synthesis note: this pass adds secondary claims that refine where intensity softens or concentrates.`,
        ]),
        synClaim.text,
      ]
        .filter(Boolean)
        .join(' ');
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
      const synClaim = claimSentencesFromRange(core, 7, 3, `${seed}:synB`);
      const syn = [
        pickVariant(seed + ':synb', [
          `Extended synthesis: this pass incorporates lower-ranked moderator claims to map nuance around the headline pattern.`,
          `Second-pass synthesis: this layer adds moderator claims that can alter pacing without replacing the primary signal.`,
        ]),
        synClaim.text,
      ]
        .filter(Boolean)
        .join(' ');
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
      const syn = pickVariant(seed + ':temp', [
        `Temporal integration: today’s activation tends to ride on top of slower baseline patterns; what feels urgent may still be a short spike on a longer curve.`,
        `Daily integration: if tension shows up in the sky snapshot, it may still move within hours; smaller adjustments often beat global conclusions.`,
      ]);
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
        `Trait bridge: elemental and tonal signals in this readout often travel together; changing context can shift which side of the pattern shows up first.`,
        `Trait bridge: structural claims may show up in skills under stress before they show up in self-description; both tracks can be valid.`,
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
        `Interaction map: when pair-level claims include both harmony and friction bands, many people experience alternating seasons rather than a steady average.`,
        `Interaction map: divergence claims, when present, suggest different stress languages; explicit naming often reduces unnecessary fusion.`,
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
        `Field distribution: ensemble reads often concentrate activation in a subset of slots; look for repeated participant indices in claim metadata rather than assuming equal spread.`,
        `Field distribution: when relational weather is present, treat harmony and friction as field properties before reducing them to any single dyad.`,
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
        `Layering: natal versus sky snapshots can disagree; treat the readout as two simultaneous fields rather than one merged verdict.`,
        `Layering: transit emphasis may spike briefly while baseline emphasis steers the longer arc; both can be true at different timescales.`,
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
        `Sandbox delta: overrides change the encoded field; compare sections against a known baseline chart outside this lab readout when you need a control.`,
        `Sandbox delta: treat strong shifts here as sensitivity tests for how the engine narrates edge configurations, not as fixed life predictions.`,
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
          `Contrast handling: keep both constructive and challenging threads visible without forcing a single winner; the semantic readout is intentionally multi-valued.`,
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
      `Subcluster note: if several claims share the same participant slot indices, that cluster may act as a local hotspot within the wider field.`,
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
    const pan = buildSupplementalPanel(core, `${seed}:fillpanel`, panelIdx++, tierEff);
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

  const audio = buildAudioExplanationBlock(core, tierEff, options.narrativePlan ?? null, surface);
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
    const bridge = pickVariant(seed + ':ath', [
      `Audio thread: staging is designed to track the same tension curve as the text readout; listen for how pacing and density mirror the encoded claims above.`,
    ]);
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
  framed = applyAggregateSurfaceIdentityOverrides(framed, surface, seed);

  const validationResult = validateReportSections(framed, surface, tierEff, core, tierEff);

  if (!validationResult.ok && tierEff !== 'baseline' && _retryDepth < 1) {
    return applyPhaseDProjection(
      raw,
      core,
      seed,
      {
        ...options,
        tier: 'baseline',
        originalTierRequested: tierMetaRequested,
        _priorAttemptViolations: [...validationResult.violations],
      },
      _retryDepth + 1
    );
  }

  const projectionValidation = buildFinalProjectionValidation(
    tierMetaRequested,
    tierEff,
    validationResult,
    options._priorAttemptViolations
  );

  framed[framed.length - 1].meta = {
    ...framed[framed.length - 1].meta,
    projection_validation: projectionValidation,
  };

  return framed;
}

function validateReportSections(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface,
  tier: ExpansionTier,
  core: SemanticCore,
  tierForDensity: ExpansionTier
): { ok: boolean; violations: string[] } {
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

  return { ok: violations.length === 0, violations };
}
