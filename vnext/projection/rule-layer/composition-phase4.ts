/**
 * **Proj:** composition layer “phase4” (deterministic reorder only) — not **Product:Phase-4**.
 * Spec: provenance-only; no contentProvenance; no text/padding mutation;
 * intra-TaggedParagraph reorder only; audio_thread relocation only cross-section move.
 *
 * Assembly coupling (required for real sections, still deterministic):
 * — `SYNTHESIS_*` paragraphs may be wrapper-only, claim-only, or combined after enrich `\n\n` splits.
 * — `ANCHORED` paragraphs may be `synthesis_wrapper`-only fragments without `claim_body` in that paragraph.
 * — Non-`audio_staging` bullet blocks inherit parent section grammar; `audio_staging` bullets stay `(AS)+ (PD)*`.
 * — `ANCHORED` / `PLAIN_TEMPLATE` units with sentence count > MAX_BRUTE_M: no factorial search; run-length only + validation grammar skip.
 */
import type {
  Phase4CompositionReport,
  Phase4UnitRef,
  ProjectionSurface,
  ProjectedExplanationSection,
  ProvenanceType,
  TaggedParagraph,
  TaggedSectionBody,
  TaggedSentence,
} from '../projection-types';
import { reconstructTaggedSectionBody } from '../tagged-text';
import { PHASE2_ANCHORED_SECTION_IDS } from './phase2-sentence-load';

const SYMBOL_ORDER: Record<ProvenanceType, number> = {
  assembler_glue: 0,
  tier_scaffold: 1,
  template: 2,
  claim_body: 3,
  synthesis_wrapper: 4,
  preface: 5,
  audio_staging: 6,
  audio_thread: 7,
  padding: 8,
};

const RUN_MAX: Record<ProvenanceType, number> = {
  assembler_glue: 1,
  tier_scaffold: 1,
  template: 6,
  claim_body: 8,
  synthesis_wrapper: 2,
  preface: 3,
  audio_staging: 4,
  audio_thread: 2,
  padding: 2,
};

const MAX_BRUTE_M = 10;

export type SectionKind =
  | 'PREFACE'
  | 'FEED_SIGNAL'
  | 'FEED_CONTEXT'
  | 'SYNTHESIS_AB'
  | 'TEMPORAL'
  | 'PRESSURE'
  | 'CONTRADICTION'
  | 'SUBCLUSTER'
  | 'WRAPPER_ONLY'
  | 'DEPTH'
  | 'AUDIO_STAGING'
  | 'AUDIO_THREAD'
  | 'RELATIONAL_AGG'
  | 'ANCHORED'
  | 'PLAIN_TEMPLATE';

export type { Phase4CompositionReport, Phase4UnitRef };

function rankSym(p: ProvenanceType): number {
  const r = SYMBOL_ORDER[p];
  if (r === undefined) return 999;
  return r;
}

export function sectionKind(section: ProjectedExplanationSection, surface: ProjectionSurface): SectionKind {
  const id = section.id;
  if (id === 'connection_structure' || id === 'ensemble_framing') return 'PREFACE';
  if (id === 'feed_signal') return 'FEED_SIGNAL';
  if (id === 'feed_context') return 'FEED_CONTEXT';
  if (id === 'synthesis_a' || id === 'synthesis_b') return 'SYNTHESIS_AB';
  if (id === 'temporal_integration') return 'TEMPORAL';
  if (id === 'pressure_response') return 'PRESSURE';
  if (id === 'contradiction_map') return 'CONTRADICTION';
  if (id === 'subcluster') return 'SUBCLUSTER';
  if (
    id === 'trait_bridge' ||
    id === 'interaction_map' ||
    id === 'field_distribution' ||
    id === 'layering' ||
    id === 'delta_emphasis'
  ) {
    return 'WRAPPER_ONLY';
  }
  if (/^depth_panel_\d+$/.test(id)) return 'DEPTH';
  if (id === 'audio_staging') return 'AUDIO_STAGING';
  if (id === 'audio_thread') return 'AUDIO_THREAD';
  if (id === 'relational_field' && (surface === 'compat_pair' || surface === 'group')) return 'RELATIONAL_AGG';
  if (PHASE2_ANCHORED_SECTION_IDS.has(id)) return 'ANCHORED';
  return 'PLAIN_TEMPLATE';
}

function maxRunViolations(syms: ProvenanceType[]): boolean {
  if (syms.length === 0) return false;
  let i = 0;
  while (i < syms.length) {
    const p = syms[i]!;
    const cap = RUN_MAX[p];
    let len = 0;
    while (i < syms.length && syms[i] === p) {
      len++;
      i++;
    }
    if (cap !== undefined && len > cap) return true;
  }
  return false;
}

/** Strict block grammar: each segment is { sym, min, max } max -1 = infinity */
function matchesBlocks(syms: ProvenanceType[], segments: { sym: ProvenanceType; min: number; max: number }[]): boolean {
  let i = 0;
  for (const seg of segments) {
    let count = 0;
    while (i < syms.length && syms[i] === seg.sym && (seg.max < 0 || count < seg.max)) {
      count++;
      i++;
    }
    if (count < seg.min) return false;
  }
  return i === syms.length;
}

function onlySymbols(syms: ProvenanceType[], allowed: Set<ProvenanceType>): boolean {
  return syms.every((s) => allowed.has(s));
}

function acceptsPreface(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['preface', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'preface', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsFeedSignal(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['claim_body', 'template', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'claim_body', min: 1, max: -1 },
    { sym: 'template', min: 0, max: 1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsFeedContext(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['template', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'template', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

/** One `TaggedParagraph` from synthesis_* may be wrapper-only, claim-only, or combined (post-enrich split). */
function acceptsSynthesisAbParagraph(s: ProvenanceType[]): boolean {
  const allowed = new Set<ProvenanceType>(['synthesis_wrapper', 'claim_body', 'padding']);
  if (!onlySymbols(s, allowed)) return false;
  if (
    matchesBlocks(s, [
      { sym: 'synthesis_wrapper', min: 1, max: -1 },
      { sym: 'claim_body', min: 1, max: -1 },
      { sym: 'padding', min: 0, max: -1 },
    ])
  ) {
    return true;
  }
  if (matchesBlocks(s, [{ sym: 'synthesis_wrapper', min: 1, max: -1 }, { sym: 'padding', min: 0, max: -1 }])) return true;
  if (matchesBlocks(s, [{ sym: 'claim_body', min: 1, max: -1 }, { sym: 'padding', min: 0, max: -1 }])) return true;
  return false;
}

function acceptsTemporal(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['template', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'template', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsPressure(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['claim_body', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'claim_body', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsSwPd(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['synthesis_wrapper', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'synthesis_wrapper', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsDepth(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['claim_body', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'claim_body', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsAudioStaging(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['audio_staging', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'audio_staging', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsAudioThread(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, new Set<ProvenanceType>(['audio_thread', 'padding']))) return false;
  return matchesBlocks(s, [
    { sym: 'audio_thread', min: 1, max: -1 },
    { sym: 'padding', min: 0, max: -1 },
  ]);
}

function acceptsRelationalAgg(s: ProvenanceType[]): boolean {
  const allowed = new Set<ProvenanceType>(['synthesis_wrapper', 'claim_body', 'padding', 'template']);
  if (!onlySymbols(s, allowed)) return false;
  if (!s.some((x) => x === 'claim_body' || x === 'template')) {
    return matchesBlocks(s, [
      { sym: 'synthesis_wrapper', min: 1, max: -1 },
      { sym: 'padding', min: 0, max: -1 },
    ]);
  }
  let i = 0;
  while (i < s.length && s[i] === 'synthesis_wrapper') i++;
  if (i === 0) return false;
  while (i < s.length && s[i] === 'claim_body') i++;
  while (i < s.length && s[i] === 'padding') i++;
  while (i < s.length && s[i] === 'template') i++;
  return i === s.length;
}

const ANCHORED_ALLOWED = new Set<ProvenanceType>([
  'assembler_glue',
  'template',
  'tier_scaffold',
  'claim_body',
  'synthesis_wrapper',
  'padding',
]);

function acceptsAnchoredNoCb(s: ProvenanceType[]): boolean {
  if (s.some((x) => x === 'synthesis_wrapper')) return false;
  let i = 0;
  if (i < s.length && s[i] === 'assembler_glue') {
    i++;
    if (i < s.length && s[i] === 'assembler_glue') return false;
  }
  while (i < s.length && s[i] === 'template') i++;
  if (i < s.length && s[i] === 'tier_scaffold') i++;
  while (i < s.length && s[i] === 'template') i++;
  while (i < s.length && s[i] === 'padding') i++;
  return i === s.length;
}

function restMatchesAnchoredTail(s: ProvenanceType[], i: number): boolean {
  while (i < s.length && s[i] === 'synthesis_wrapper') i++;
  while (i < s.length && s[i] === 'template') i++;
  while (i < s.length && s[i] === 'claim_body') i++;
  while (i < s.length && s[i] === 'synthesis_wrapper') i++;
  while (i < s.length && s[i] === 'padding') i++;
  return i === s.length;
}

/** One total order matching anchored grammar (CB)+ split via take-loop). */
function matchesAnchoredSequence(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, ANCHORED_ALLOWED)) return false;
  if (!s.includes('claim_body')) {
    if (s.some((x) => x === 'synthesis_wrapper')) {
      return matchesBlocks(s, [
        { sym: 'synthesis_wrapper', min: 1, max: -1 },
        { sym: 'padding', min: 0, max: -1 },
      ]);
    }
    return acceptsAnchoredNoCb(s);
  }
  let i = 0;
  if (i < s.length && s[i] === 'assembler_glue') {
    i++;
    if (i < s.length && s[i] === 'assembler_glue') return false;
  }
  while (i < s.length && s[i] === 'template') i++;
  if (i < s.length && s[i] === 'tier_scaffold') i++;
  while (i < s.length && s[i] === 'template') i++;
  let k = 0;
  while (i + k < s.length && s[i + k] === 'claim_body') k++;
  if (k < 1) return false;
  for (let take = 1; take <= k; take++) {
    if (restMatchesAnchoredTail(s, i + take)) return true;
  }
  return false;
}

function acceptsAnchored(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, ANCHORED_ALLOWED)) return false;
  if (s.length > MAX_BRUTE_M) return !maxRunViolations(s);
  let ok = false;
  eachPermutation(s.length, (perm) => {
    const out = perm.map((j) => s[j]!);
    if (maxRunViolations(out)) return;
    if (matchesAnchoredSequence(out)) ok = true;
  });
  return ok;
}

const PLAIN_ALLOWED = new Set<ProvenanceType>([
  'template',
  'tier_scaffold',
  'claim_body',
  'synthesis_wrapper',
  'padding',
]);

/** Remainder after TM* TW? TM* : (CB)* (SW)* (TM)* (CB)* (SW)* (PD)* */
function matchPlainRemainder(s: ProvenanceType[], i: number): boolean {
  const tryFrom = (pos: number, stage: 0 | 1 | 2 | 3 | 4 | 5): boolean => {
    if (stage === 0) {
      if (pos === s.length) return true;
      if (s[pos] === 'claim_body') return tryFrom(pos + 1, 0) || tryFrom(pos, 1);
      return tryFrom(pos, 1);
    }
    if (stage === 1) {
      if (pos === s.length) return tryFrom(pos, 2);
      if (s[pos] === 'synthesis_wrapper') return tryFrom(pos + 1, 1) || tryFrom(pos, 2);
      return tryFrom(pos, 2);
    }
    if (stage === 2) {
      if (pos === s.length) return tryFrom(pos, 3);
      if (s[pos] === 'template') return tryFrom(pos + 1, 2) || tryFrom(pos, 3);
      return tryFrom(pos, 3);
    }
    if (stage === 3) {
      if (pos === s.length) return tryFrom(pos, 4);
      if (s[pos] === 'claim_body') return tryFrom(pos + 1, 3) || tryFrom(pos, 4);
      return tryFrom(pos, 4);
    }
    if (stage === 4) {
      if (pos === s.length) return tryFrom(pos, 5);
      if (s[pos] === 'synthesis_wrapper') return tryFrom(pos + 1, 4) || tryFrom(pos, 5);
      return tryFrom(pos, 5);
    }
    if (stage === 5) {
      while (pos < s.length && s[pos] === 'padding') pos++;
      return pos === s.length;
    }
    return false;
  };
  return tryFrom(i, 0);
}

function matchesPlainSequence(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, PLAIN_ALLOWED)) return false;
  const iFirstCb = s.findIndex((x) => x === 'claim_body');
  for (let j = 0; j < (iFirstCb === -1 ? 0 : iFirstCb); j++) {
    if (s[j] === 'synthesis_wrapper') return false;
  }
  let i = 0;
  while (i < s.length && s[i] === 'template') i++;
  if (i < s.length && s[i] === 'tier_scaffold') i++;
  while (i < s.length && s[i] === 'template') i++;
  return matchPlainRemainder(s, i);
}

function acceptsPlainTemplate(s: ProvenanceType[]): boolean {
  if (!onlySymbols(s, PLAIN_ALLOWED)) return false;
  if (s.length > MAX_BRUTE_M) return !maxRunViolations(s);
  let ok = false;
  eachPermutation(s.length, (perm) => {
    const out = perm.map((j) => s[j]!);
    if (maxRunViolations(out)) return;
    if (matchesPlainSequence(out)) ok = true;
  });
  return ok;
}

/** Feasibility: ∃ permutation (bounded) for anchor/plain; ordered check for others. */
function grammarAccepts(kind: SectionKind, syms: ProvenanceType[]): boolean {
  switch (kind) {
    case 'PREFACE':
      return acceptsPreface(syms);
    case 'FEED_SIGNAL':
      return acceptsFeedSignal(syms);
    case 'FEED_CONTEXT':
      return acceptsFeedContext(syms);
    case 'SYNTHESIS_AB':
      return acceptsSynthesisAbParagraph(syms);
    case 'TEMPORAL':
      return acceptsTemporal(syms);
    case 'PRESSURE':
      return acceptsPressure(syms);
    case 'CONTRADICTION':
    case 'SUBCLUSTER':
    case 'WRAPPER_ONLY':
      return acceptsSwPd(syms);
    case 'DEPTH':
      return acceptsDepth(syms);
    case 'AUDIO_STAGING':
      return acceptsAudioStaging(syms);
    case 'AUDIO_THREAD':
      return acceptsAudioThread(syms);
    case 'RELATIONAL_AGG':
      return acceptsRelationalAgg(syms);
    case 'ANCHORED':
      return acceptsAnchored(syms);
    case 'PLAIN_TEMPLATE':
      return acceptsPlainTemplate(syms);
    default:
      return false;
  }
}

/** Validates this exact symbol order (post-permutation candidate). */
function grammarAcceptsOrdered(kind: SectionKind, syms: ProvenanceType[]): boolean {
  if (maxRunViolations(syms)) return false;
  switch (kind) {
    case 'ANCHORED':
      return matchesAnchoredSequence(syms);
    case 'PLAIN_TEMPLATE':
      return matchesPlainSequence(syms);
    case 'PREFACE':
      return acceptsPreface(syms);
    case 'FEED_SIGNAL':
      return acceptsFeedSignal(syms);
    case 'FEED_CONTEXT':
      return acceptsFeedContext(syms);
    case 'SYNTHESIS_AB':
      return acceptsSynthesisAbParagraph(syms);
    case 'TEMPORAL':
      return acceptsTemporal(syms);
    case 'PRESSURE':
      return acceptsPressure(syms);
    case 'CONTRADICTION':
    case 'SUBCLUSTER':
    case 'WRAPPER_ONLY':
      return acceptsSwPd(syms);
    case 'DEPTH':
      return acceptsDepth(syms);
    case 'AUDIO_STAGING':
      return acceptsAudioStaging(syms);
    case 'AUDIO_THREAD':
      return acceptsAudioThread(syms);
    case 'RELATIONAL_AGG':
      return acceptsRelationalAgg(syms);
    default:
      return false;
  }
}

/** `audio_staging` bullets are `audio_staging`; other sections' bullets follow template/claim tagging — use parent kind. */
function grammarKindForBulletBlock(section: ProjectedExplanationSection, surface: ProjectionSurface): SectionKind {
  if (section.id === 'audio_staging') return 'AUDIO_STAGING';
  return sectionKind(section, surface);
}

function cloneSent(s: TaggedSentence): TaggedSentence {
  return {
    text: s.text,
    provenance: s.provenance,
    ...(s.contentProvenance !== undefined ? { contentProvenance: s.contentProvenance } : {}),
  };
}

function lexLessSymSeq(a: ProvenanceType[], b: ProvenanceType[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ra = rankSym(a[i]!);
    const rb = rankSym(b[i]!);
    if (ra !== rb) return ra < rb;
  }
  return a.length < b.length;
}

function lexLessIdxSeq(a: number[], b: number[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]!) return a[i]! < b[i]!;
  }
  return a.length < b.length;
}

function compareBest(
  bestSym: ProvenanceType[] | null,
  bestIdx: number[] | null,
  candSym: ProvenanceType[],
  candIdx: number[]
): 'replace' | 'keep' {
  if (bestSym === null) return 'replace';
  if (lexLessSymSeq(candSym, bestSym)) return 'replace';
  if (lexLessSymSeq(bestSym, candSym)) return 'keep';
  if (lexLessIdxSeq(candIdx, bestIdx!)) return 'replace';
  return 'keep';
}

function eachPermutation(m: number, callback: (perm: number[]) => void): void {
  const a = Array.from({ length: m }, (_, i) => i);
  function permute(l: number): void {
    if (l === m - 1) {
      callback([...a]);
      return;
    }
    for (let j = l; j < m; j++) {
      const t = a[l]!;
      a[l] = a[j]!;
      a[j] = t;
      permute(l + 1);
      const u = a[l]!;
      a[l] = a[j]!;
      a[j] = u;
    }
  }
  if (m > 0) permute(0);
}

function findCanonicalPermutation(
  rows: TaggedSentence[],
  kind: SectionKind
): { perm: number[] | null; infeasible: boolean } {
  const m = rows.length;
  if (m === 0) return { perm: null, infeasible: false };
  const syms = rows.map((r) => r.provenance);
  if (grammarAccepts(kind, syms)) {
    return { perm: null, infeasible: false };
  }
  if (m > MAX_BRUTE_M) {
    return { perm: null, infeasible: true };
  }
  let bestSym: ProvenanceType[] | null = null;
  let bestIdx: number[] | null = null;
  eachPermutation(m, (perm) => {
    const outSym = perm.map((j) => syms[j]!);
    if (!grammarAcceptsOrdered(kind, outSym)) return;
    if (compareBest(bestSym, bestIdx, outSym, perm) === 'replace') {
      bestSym = outSym;
      bestIdx = [...perm];
    }
  });
  if (bestIdx === null) return { perm: null, infeasible: true };
  const chosen: number[] = bestIdx;
  const identity = Array.from({ length: m }, (_, idx) => idx);
  const isIdentity = chosen.every((v, idx) => v === idx);
  if (isIdentity) return { perm: null, infeasible: false };
  return { perm: chosen, infeasible: false };
}

function applyPermToParagraph(p: TaggedParagraph, perm: number[] | null): TaggedParagraph {
  if (perm === null) return { sentences: p.sentences.map(cloneSent) };
  return { sentences: perm.map((j) => cloneSent(p.sentences[j]!)) };
}

function processTaggedBody(
  body: TaggedSectionBody,
  section: ProjectedExplanationSection,
  surface: ProjectionSurface,
  report: Phase4CompositionReport,
  path: { unit: 'paragraph' | 'bullet'; paragraphIndex: number; bulletIndex?: number }
): TaggedSectionBody {
  const kindBase = sectionKind(section, surface);
  const nextParas = body.paragraphs.map((para, pi) => {
    const rows = para.sentences;
    const kind = path.unit === 'bullet' ? grammarKindForBulletBlock(section, surface) : kindBase;
    const { perm, infeasible } = findCanonicalPermutation(rows, kind);
    if (infeasible) {
      report.unitInfeasible.push({
        sectionId: section.id,
        unit: path.unit,
        paragraphIndex: pi,
        bulletIndex: path.bulletIndex,
        reason: 'UNIT_INFEASIBLE',
      });
    }
    return applyPermToParagraph(para, perm);
  });
  const bulletBlocks = body.bulletBlocks?.map((bb, bi) =>
    processTaggedBody(bb, section, surface, report, {
      unit: 'bullet',
      paragraphIndex: 0,
      bulletIndex: bi,
    })
  );
  return {
    paragraphs: nextParas,
    ...(bulletBlocks?.length ? { bulletBlocks } : {}),
  };
}

function relocateAudioThread(sections: ProjectedExplanationSection[]): {
  next: ProjectedExplanationSection[];
  relocated: boolean;
} {
  const n = sections.length;
  const idx = sections.findIndex((s) => s.id === 'audio_thread');
  if (idx < 0) return { next: sections, relocated: false };
  const k =
    sections[0]?.id === 'connection_structure' || sections[0]?.id === 'ensemble_framing' ? 1 : 0;
  const lBs = n - 1;
  const p = Math.min(2, lBs);
  const tTarget = Math.min(k + p, n - 1);
  if (idx === tTarget) return { next: sections, relocated: false };
  const copy = [...sections];
  const [thr] = copy.splice(idx, 1);
  const insertAt = idx < tTarget ? tTarget - 1 : tTarget;
  copy.splice(insertAt, 0, thr!);
  return { next: copy, relocated: true };
}

function rebuildSectionText(sec: ProjectedExplanationSection): ProjectedExplanationSection {
  const tagged = sec.meta?.tagged;
  if (!tagged) return sec;
  const text = reconstructTaggedSectionBody(tagged);
  const bullets = sec.bullets?.length
    ? tagged.bulletBlocks?.map((bb) => reconstructTaggedSectionBody(bb))
    : undefined;
  return {
    ...sec,
    text,
    bullets: bullets && bullets.length === sec.bullets?.length ? bullets : sec.bullets,
  };
}

/**
 * Apply Phase 4: audio_thread relocation, then per-paragraph canonical permutation.
 */
export function applyCompositionPhase4(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface
): { sections: ProjectedExplanationSection[]; report: Phase4CompositionReport } {
  const report: Phase4CompositionReport = { unitInfeasible: [], audioThreadRelocated: false };
  const { next: afterAudio, relocated } = relocateAudioThread(sections);
  report.audioThreadRelocated = relocated;
  const out = afterAudio.map((sec) => {
    const tagged = sec.meta?.tagged;
    if (!tagged) return sec;
    const nextTagged = processTaggedBody(tagged, sec, surface, report, { unit: 'paragraph', paragraphIndex: 0 });
    const rebuilt = rebuildSectionText({ ...sec, meta: { ...sec.meta, tagged: nextTagged } });
    return rebuilt;
  });
  return { sections: out, report };
}

export function validatePhase4GrammarAndRuns(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const sec of sections) {
    const kind = sectionKind(sec, surface);
    const grammarOkForValidation = (k: SectionKind, syms: ProvenanceType[]): boolean => {
      if ((k === 'ANCHORED' || k === 'PLAIN_TEMPLATE') && syms.length > MAX_BRUTE_M) return true;
      if (k === 'ANCHORED' || k === 'PLAIN_TEMPLATE') return grammarAccepts(k, syms);
      return grammarAcceptsOrdered(k, syms);
    };
    const walk = (body: TaggedSectionBody, label: string) => {
      for (let pi = 0; pi < body.paragraphs.length; pi++) {
        const syms = body.paragraphs[pi]!.sentences.map((s) => s.provenance);
        const k = label.startsWith('bullet') ? grammarKindForBulletBlock(sec, surface) : kind;
        if (maxRunViolations(syms)) violations.push(`${sec.id}:${label}:p${pi}:runlength`);
        if (!grammarOkForValidation(k, syms)) violations.push(`${sec.id}:${label}:p${pi}:grammar`);
      }
      for (let bi = 0; bi < (body.bulletBlocks?.length ?? 0); bi++) {
        walk(body.bulletBlocks![bi]!, `bullet[${bi}]`);
      }
    };
    if (sec.meta?.tagged) walk(sec.meta.tagged, 'body');
  }
  return { ok: violations.length === 0, violations };
}
