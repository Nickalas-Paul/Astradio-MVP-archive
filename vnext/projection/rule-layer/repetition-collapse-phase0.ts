/**
 * Phase 0 — repetition collapse (approved spec only).
 * Post tone-pass, pre validation. Deterministic; no semantic similarity.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ExpansionTier, ProjectionSurface, ProjectedExplanationSection } from '../projection-types';
import { stripLintHedgeFromParagraph } from '../language-lint';
import { cloneTaggedSectionBody, splitSentsForTagged, stripTaggedLintFromSectionBody } from '../tagged-text';
import { SURFACE_SCHEMAS } from '../surface-schemas';
import { validateDensity, densityForSurfaceBaseline, countSentences } from '../density-validate';
import { densityForSectionId, validateReportSections } from './validate-projection';
import { AUDIO_LEXICON_CLAUSE_STRINGS } from './audio-lexicon';

/** Mirror `tone-pass.ts` `normalizeSentence` — must stay byte-identical for NORM. */
export function projectionNormSentence(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[""''`]/g, '');
}

/** Mirror `assemble-sections.ts` `hashSeed`. */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Mirror `tone-pass.ts` `SECTION_RANK` / `sectionRank`. */
const SECTION_RANK: Record<string, number> = {
  connection_structure: 5,
  ensemble_framing: 5,
  signatures: 10,
  sky_summary: 12,
  significance: 14,
  relational_field: 15,
  feed_signal: 18,
  feed_context: 19,
  audio_staging: 20,
  musical: 24,
  audio_thread: 25,
  personal_emphasis: 30,
  likely_expressions: 32,
  watch_fors: 34,
  integration_prompt: 36,
  music_translation: 38,
  synthesis_a: 40,
  synthesis_b: 41,
  temporal_integration: 42,
  trait_bridge: 43,
  interaction_map: 44,
  field_distribution: 45,
  pressure_response: 46,
  layering: 47,
  delta_emphasis: 48,
  contradiction_map: 49,
  subcluster: 50,
  depth_panel_1: 55,
  depth_panel_2: 56,
  depth_panel_3: 57,
  relational_weather_v1: 16,
};

function sectionRank(id: string): number {
  if (SECTION_RANK[id] !== undefined) return SECTION_RANK[id];
  if (id.startsWith('depth_panel_')) return 55;
  return 200;
}

const PADDING_LITERALS = [
  'This pattern tends to be context-sensitive rather than fixed: the same emphasis may read louder under stress and softer under safety.',
  'Many people with a similar picture describe the feel as more situational than permanent, especially when life load changes week to week.',
  'Integration often works better as small experiments than as a single decisive relabeling of the self or the relationship.',
] as const;

const FEED_PADDING_LITERALS = [
  'This card stays narrow by design: it highlights one active thread from the same picture.',
  'Use this card as a short signal check, then open a full report when you need broader synthesis.',
  'This feed view is intentionally compressed, so it favors one clear observation over full narrative depth.',
] as const;

const GENERIC_FALLBACK_LITERALS = [
  'This picture carries an additional emphasis shows up strongly in this view; it may show up as subtle shifts rather than a single fixed behavioral label.',
  'This picture carries an additional emphasis shows up moderately in this view; it may show up as subtle shifts rather than a single fixed behavioral label.',
] as const;

const TEMPORAL_LITERALS = [
  'Your slower-moving pattern stays primary; treat short spikes as seasoning, not a new identity.',
  'What changes slowly still steers the story; keep quick shifts in proportion to that steadier layer.',
  'What feels urgent today sits on top of slower personal baselines; the spike may pass while the baseline remains.',
  "Today's layer can move within hours; small adjustments often beat sweeping conclusions.",
  'Both steady and quick layers count; name which timescale you mean before you lock one story.',
  'Near-term and long-haul signals both show; context usually decides which one speaks loudest.',
] as const;

/** Phase 0 catalog phrases — must match `AUDIO_LEXICON_CLAUSE_STRINGS` (listen lexicon only). */
const AUDIO_PHRASE_CATALOG: readonly string[] = AUDIO_LEXICON_CLAUSE_STRINGS;

/** Deterministic test hook: Phase 0 audio catalog is the lexicon clause table. */
export function phase0AudioCatalogClauseRef(): readonly string[] {
  return AUDIO_PHRASE_CATALOG;
}

const GLUE_LITERALS = [
  'In the same picture,',
  'Alongside that signal,',
  'Taken together with the prior emphasis,',
] as const;

const CLAIM_OR_GLUE_GUARD_LITERALS: readonly string[] = (() => {
  const strong = 'shows up strongly in this view';
  const moderate = 'shows up moderately in this view';
  const lines: string[] = [...GLUE_LITERALS.map((g) => g)];
  const add = (tpl: string) => {
    lines.push(tpl.replace('${strengthNote}', strong));
    lines.push(tpl.replace('${strengthNote}', moderate));
  };
  add(
    'A fire-weighted emphasis ${strengthNote} often correlates with quicker initiation and visible expressive heat in how the pattern lands.'
  );
  add(
    'An earth-weighted emphasis ${strengthNote} often correlates with stepwise stabilization and a preference for tangible, incremental adjustment.'
  );
  add(
    'An air-weighted emphasis ${strengthNote} often correlates with conceptual mobility and a tendency to narrate or reframe experience quickly.'
  );
  add(
    'A water-weighted emphasis ${strengthNote} often correlates with emotional permeability and layered processing before outward commitment.'
  );
  lines.push(
    'Higher structural contrast in this view often shows up as sharper differences moment to moment without implying a single crisis label.'
  );
  lines.push(
    'Moderate contrast in this view often shows up as workable friction: enough edge to move things, without constant crisis signaling.'
  );
  lines.push(
    'Lower contrast in this view often shows up as smoother continuity and fewer abrupt breaks between emphasis beats.'
  );
  lines.push(
    'A brighter tonal register in this view often correlates with outward lift and a tendency to emphasize possibility over heaviness.'
  );
  lines.push(
    'A darker tonal register in this view often correlates with depth-first processing and a tendency to take tension seriously rather than glossing it.'
  );
  lines.push(
    'A balanced tonal register in this view often correlates with mixed brightness cues that can flex with context rather than locking one mood.'
  );
  lines.push(
    'High harmony-band signaling between people often correlates with cooperative resonance and easier mutual coordination when contact rises.'
  );
  lines.push(
    'High friction-band signaling between people often correlates with edge-rich contact where misunderstandings can spike if timing is ignored.'
  );
  lines.push(
    'High intensity-band signaling between people often correlates with amplified contact: more signal per interaction, for better or sharper.'
  );
  lines.push(
    'Strong cross-chart elemental drift often correlates with divergent baseline styles; blending language too quickly may flatten real differences.'
  );
  lines.push(
    'A large tension delta between charts often correlates with alternating stress profiles; a single unified arc may not fit both baselines.'
  );
  lines.push(
    'A clustered structural signature often correlates with concentrated emphasis: many threads pulling through the same thematic doorway.'
  );
  lines.push('Surging motion often correlates with forward impulse and rapid ramps in how energy is spent.');
  lines.push(
    'Inward motion often correlates with consolidation phases where outward visibility lags behind internal processing.'
  );
  lines.push('Anchored gravity often correlates with weighty emphasis and slower release in how resolution arrives.');
  return lines;
})();

const PADDING_NORM = new Set(PADDING_LITERALS.map(projectionNormSentence));
const FEED_PADDING_NORM = new Set(FEED_PADDING_LITERALS.map(projectionNormSentence));

/** Phase 0.1 — fixed union of normalized padding pool literals only (not derived from report text). */
export const PoolNormSet: ReadonlySet<string> = new Set<string>([
  ...PADDING_LITERALS.map((lit) => projectionNormSentence(lit)),
  ...FEED_PADDING_LITERALS.map((lit) => projectionNormSentence(lit)),
]);
const GENERIC_FALLBACK_NORM = new Set(GENERIC_FALLBACK_LITERALS.map(projectionNormSentence));
const TEMPORAL_NORM = new Set(TEMPORAL_LITERALS.map(projectionNormSentence));
const CLAIM_GUARD_NORM = new Set(CLAIM_OR_GLUE_GUARD_LITERALS.map(projectionNormSentence));

type RemovableClass =
  | 'PADDING'
  | 'FEED_PADDING'
  | 'GENERIC_FALLBACK'
  | 'TEMPORAL_LITERAL'
  | 'AUDIO_CATALOG_REDUNDANT';

const RETENTION: Record<RemovableClass, number> = {
  PADDING: 10,
  FEED_PADDING: 11,
  GENERIC_FALLBACK: 20,
  TEMPORAL_LITERAL: 30,
  AUDIO_CATALOG_REDUNDANT: 40,
};

type SentAddr = {
  secIdx: number;
  bulletIdx: number | null;
  paraIdx: number;
  sentIdx: number;
};

type Classified = SentAddr & {
  raw: string;
  norm: string;
  cls: RemovableClass | 'OTHER';
};

function splitParas(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSents(para: string): string[] {
  const t = para.trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinParas(paras: string[]): string {
  return paras.join('\n\n');
}

function joinSents(sents: string[]): string {
  return sents.join(' ');
}

function applyLintStripToBody(body: string): string {
  const paras = splitParas(body);
  if (paras.length === 0) return body.trim();
  return joinParas(paras.map(stripLintHedgeFromParagraph));
}

function cloneSections(sections: ProjectedExplanationSection[]): ProjectedExplanationSection[] {
  return sections.map((s) => ({
    ...s,
    meta: s.meta
      ? {
          ...s.meta,
          ...(s.meta.tagged ? { tagged: cloneTaggedSectionBody(s.meta.tagged) } : {}),
        }
      : undefined,
    bullets: s.bullets ? [...s.bullets] : undefined,
  }));
}

function classifySentence(norm: string, audioNormBlob: string, secId: string): Classified['cls'] {
  if (CLAIM_GUARD_NORM.has(norm)) return 'OTHER';
  if (TEMPORAL_NORM.has(norm)) return 'TEMPORAL_LITERAL';
  if (PADDING_NORM.has(norm)) return 'PADDING';
  if (FEED_PADDING_NORM.has(norm)) return 'FEED_PADDING';
  if (GENERIC_FALLBACK_NORM.has(norm)) return 'GENERIC_FALLBACK';
  if (secId !== 'audio_staging') {
    for (const p of AUDIO_PHRASE_CATALOG) {
      const pn = projectionNormSentence(p);
      if (norm === pn && audioNormBlob.includes(pn)) return 'AUDIO_CATALOG_REDUNDANT';
    }
  }
  return 'OTHER';
}

function collectClassified(sections: ProjectedExplanationSection[]): Classified[] {
  const audioSec = sections.find((s) => s.id === 'audio_staging');
  let audioNormBlob = '';
  if (audioSec) {
    const blob = [audioSec.text, ...(audioSec.bullets ?? [])].join(' ');
    audioNormBlob = projectionNormSentence(blob.replace(/\s+/g, ' '));
  }
  const out: Classified[] = [];
  sections.forEach((sec, secIdx) => {
    const walkBody = (body: string, bulletIdx: number | null) => {
      splitParas(body).forEach((para, paraIdx) => {
        splitSents(para).forEach((raw, sentIdx) => {
          const norm = projectionNormSentence(raw);
          out.push({
            secIdx,
            bulletIdx,
            paraIdx,
            sentIdx,
            raw,
            norm,
            cls: classifySentence(norm, audioNormBlob, sec.id),
          });
        });
      });
    };
    walkBody(sec.text, null);
    (sec.bullets ?? []).forEach((b, bi) => walkBody(b, bi));
  });
  return out;
}

function addrKey(a: SentAddr): string {
  return `${a.secIdx}|${a.bulletIdx ?? 't'}|${a.paraIdx}|${a.sentIdx}`;
}

function addrCmp(a: SentAddr, b: SentAddr): number {
  if (a.secIdx !== b.secIdx) return a.secIdx - b.secIdx;
  const af = a.bulletIdx === null ? 0 : 1;
  const bf = b.bulletIdx === null ? 0 : 1;
  if (af !== bf) return af - bf;
  if (a.bulletIdx !== b.bulletIdx) return (a.bulletIdx ?? 0) - (b.bulletIdx ?? 0);
  if (a.paraIdx !== b.paraIdx) return a.paraIdx - b.paraIdx;
  return a.sentIdx - b.sentIdx;
}

/** True iff `b` should replace `a` as survivor (higher retention, then lower section rank, then smaller address). */
function survivorPreferB(a: Classified, b: Classified, secIds: string[]): boolean {
  const ra = RETENTION[a.cls as RemovableClass];
  const rb = RETENTION[b.cls as RemovableClass];
  if (rb !== ra) return rb > ra;
  const rsa = sectionRank(secIds[a.secIdx]);
  const rsb = sectionRank(secIds[b.secIdx]);
  if (rsa !== rsb) return rsb < rsa;
  return (
    addrCmp(
      { secIdx: a.secIdx, bulletIdx: a.bulletIdx, paraIdx: a.paraIdx, sentIdx: a.sentIdx },
      { secIdx: b.secIdx, bulletIdx: b.bulletIdx, paraIdx: b.paraIdx, sentIdx: b.sentIdx }
    ) > 0
  );
}

function reportSectionsOk(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface,
  validateTier: ExpansionTier,
  tierForDensity: ExpansionTier,
  core: SemanticCore
): boolean {
  return validateReportSections(sections, surface, validateTier, core, tierForDensity).ok;
}

function repairPoolLiterals(surface: ProjectionSurface): readonly string[] {
  const pool = surface === 'feed' ? FEED_PADDING_LITERALS : PADDING_LITERALS;
  return [...pool].sort((a, b) => {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    const len = Math.max(ba.length, bb.length);
    for (let i = 0; i < len; i++) {
      const va = i < ba.length ? ba[i] : -1;
      const vb = i < bb.length ? bb[i] : -1;
      if (va !== vb) return va - vb;
    }
    return 0;
  });
}

function normsInParagraph(para: string): Set<string> {
  const s = new Set<string>();
  for (const x of splitSents(para)) {
    s.add(projectionNormSentence(x));
  }
  return s;
}

/** Phase 0.1 — deterministic full-report scan: pool norms already present (membership in PoolNormSet only). */
function collectInitialPoolReportPresence(sections: ProjectedExplanationSection[]): Set<string> {
  const P_report = new Set<string>();
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]!;
    const walkBody = (body: string) => {
      for (const para of splitParas(body)) {
        for (const raw of splitSents(para)) {
          const n = projectionNormSentence(raw);
          if (PoolNormSet.has(n)) P_report.add(n);
        }
      }
    };
    walkBody(sec.text);
    const bullets = sec.bullets ?? [];
    for (let bi = 0; bi < bullets.length; bi++) {
      walkBody(bullets[bi]!);
    }
  }
  return P_report;
}

function buildAudioNormBlob(sections: ProjectedExplanationSection[]): string {
  const audioSec = sections.find((s) => s.id === 'audio_staging');
  if (!audioSec) return '';
  const blob = [audioSec.text, ...(audioSec.bullets ?? [])].join(' ');
  return projectionNormSentence(blob.replace(/\s+/g, ' '));
}

/** Reject repair if it would duplicate an audio catalog phrase outside audio_staging (same rule as classifySentence). */
function repairLiteralViolatesAudioSafety(candNorm: string, targetSecId: string, audioNormBlob: string): boolean {
  if (targetSecId === 'audio_staging') return false;
  if (!audioNormBlob) return false;
  for (const p of AUDIO_PHRASE_CATALOG) {
    const pn = projectionNormSentence(p);
    if (candNorm === pn && audioNormBlob.includes(pn)) return true;
  }
  return false;
}

/**
 * Phase 0.1 — returns null if no literal is valid (paragraph + report uniqueness + audio safety).
 * LOCKED: no fallback when exhausted.
 */
function pickRepairLiteral(
  R_ORDERED: readonly string[],
  ctx: { seed: string; surface: ProjectionSurface; tierForDensity: ExpansionTier },
  t: number,
  paraText: string,
  P_report: ReadonlySet<string>,
  targetSecId: string,
  audioNormBlob: string
): string | null {
  const normsPara = normsInParagraph(paraText);
  const tryCandidate = (c: string): string | null => {
    const cn = projectionNormSentence(c);
    if (normsPara.has(cn)) return null;
    if (P_report.has(cn)) return null;
    if (repairLiteralViolatesAudioSafety(cn, targetSecId, audioNormBlob)) return null;
    return c;
  };
  for (let tryT = t; tryT < 48; tryT++) {
    const idx = hashSeed(`${ctx.seed}|${ctx.surface}|${ctx.tierForDensity}|repair|${tryT}`) % R_ORDERED.length;
    const c = R_ORDERED[idx]!;
    const ok = tryCandidate(c);
    if (ok !== null) return ok;
  }
  for (let j = 0; j < R_ORDERED.length; j++) {
    const c = R_ORDERED[j]!;
    const ok = tryCandidate(c);
    if (ok !== null) return ok;
  }
  return null;
}

function densityRepairMirrorAppendParagraph(sec: ProjectedExplanationSection, cand: string, hadParas: boolean): void {
  if (!sec.meta?.tagged) return;
  const sents = splitSentsForTagged(cand);
  const block = { sentences: sents.map((t) => ({ text: t, provenance: 'padding' as const })) };
  if (!hadParas) {
    sec.meta.tagged = { paragraphs: [block], bulletBlocks: sec.meta.tagged.bulletBlocks };
    return;
  }
  sec.meta.tagged.paragraphs.push(block);
}

function densityRepairMirrorAppendSentence(sec: ProjectedExplanationSection, paraIdx: number, cand: string): void {
  if (!sec.meta?.tagged) return;
  const tp = sec.meta.tagged.paragraphs[paraIdx];
  if (!tp) return;
  for (const t of splitSentsForTagged(cand)) {
    tp.sentences.push({ text: t, provenance: 'padding' });
  }
}

function densityRepair(
  sections: ProjectedExplanationSection[],
  ctx: {
    seed: string;
    surface: ProjectionSurface;
    validateTier: ExpansionTier;
    tierForDensity: ExpansionTier;
    core: SemanticCore;
  }
): boolean {
  const R_ORDERED = repairPoolLiterals(ctx.surface);
  const schema = SURFACE_SCHEMAS[ctx.surface];
  const defaultD = densityForSurfaceBaseline(schema.baselineDensityDefault, ctx.tierForDensity);
  /** Phase 0.1 — report-level pool presence; initial deterministic scan, then incremental after each insert. */
  const P_report = collectInitialPoolReportPresence(sections);
  const audioNormBlob = buildAudioNormBlob(sections);

  const MAX_REPAIR_STEPS = 400;
  for (let step = 0; step < MAX_REPAIR_STEPS; step++) {
    if (reportSectionsOk(sections, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) return true;

    let fixed = false;
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si]!;
      const d =
        sec.meta?.enrichDensity !== undefined ? sec.meta.enrichDensity : densityForSectionId(sec.id, defaultD);
      const claims =
        sec.meta?.claimIdsReferenced && sec.meta.claimIdsReferenced.length > 0
          ? [...sec.meta.claimIdsReferenced]
          : [];
      const minClaimsOverride = claims.length === 0 ? 0 : undefined;
      const v = validateDensity(sec.text, d, claims, { minClaimsOverride });
      if (v.ok) continue;

      const paras = splitParas(sec.text);
      const blocks = paras.length ? paras : [sec.text.trim()].filter(Boolean);
      const minP = d === 'short' ? 1 : d === 'medium' ? 2 : 3;
      const minS = d === 'short' || d === 'medium' ? 3 : 4;

      const paraCount = blocks.length || (sec.text.trim() ? 1 : 0);
      if (paraCount < minP) {
        const cand = pickRepairLiteral(R_ORDERED, ctx, step, '', P_report, sec.id, audioNormBlob);
        if (cand === null) return false;
        sec.text = paras.length ? joinParas([...paras, cand]) : cand;
        densityRepairMirrorAppendParagraph(sec, cand, paras.length > 0);
        P_report.add(projectionNormSentence(cand));
        fixed = true;
        break;
      }

      for (let pi = 0; pi < blocks.length; pi++) {
        if (countSentences(blocks[pi]!) < minS) {
          const cand = pickRepairLiteral(R_ORDERED, ctx, step, blocks[pi]!, P_report, sec.id, audioNormBlob);
          if (cand === null) return false;
          const sents = splitSents(blocks[pi]!);
          const next = [...sents, cand];
          const nextParas = [...blocks];
          nextParas[pi] = joinSents(next);
          sec.text = joinParas(nextParas);
          densityRepairMirrorAppendSentence(sec, pi, cand);
          P_report.add(projectionNormSentence(cand));
          fixed = true;
          break;
        }
      }
      if (fixed) break;
    }

    if (!fixed) return false;
  }

  return reportSectionsOk(sections, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core);
}

function getSentenceBlock(
  sections: ProjectedExplanationSection[],
  addr: SentAddr
): { paras: string[]; sents: string[] } | null {
  const sec = sections[addr.secIdx];
  const body = addr.bulletIdx === null ? sec.text : sec.bullets?.[addr.bulletIdx];
  if (body === undefined) return null;
  const paras = splitParas(body);
  const para = paras[addr.paraIdx];
  if (para === undefined) return null;
  return { paras, sents: splitSents(para) };
}

function removeTaggedSentenceMirror(sec: ProjectedExplanationSection, addr: SentAddr): void {
  const m = sec.meta;
  if (!m?.tagged) return;
  const tb = m.tagged;
  if (addr.bulletIdx === null) {
    const tp = tb.paragraphs[addr.paraIdx];
    if (!tp || addr.sentIdx >= tp.sentences.length) return;
    tp.sentences.splice(addr.sentIdx, 1);
  } else {
    const bb = tb.bulletBlocks?.[addr.bulletIdx!];
    if (!bb) return;
    const tp = bb.paragraphs[addr.paraIdx];
    if (!tp || addr.sentIdx >= tp.sentences.length) return;
    tp.sentences.splice(addr.sentIdx, 1);
  }
}

function removeSentenceAt(sections: ProjectedExplanationSection[], addr: SentAddr): void {
  const sec = sections[addr.secIdx];
  const isText = addr.bulletIdx === null;
  const body = isText ? sec.text : sec.bullets![addr.bulletIdx!];
  const paras = splitParas(body);
  const sents = splitSents(paras[addr.paraIdx]);
  if (sents.length <= 1) return;
  const nextSents = sents.filter((_, i) => i !== addr.sentIdx);
  paras[addr.paraIdx] = joinSents(nextSents);
  const newBody = joinParas(paras);
  if (isText) sec.text = newBody;
  else {
    const bs = [...(sec.bullets ?? [])];
    bs[addr.bulletIdx!] = newBody;
    sec.bullets = bs;
  }
  removeTaggedSentenceMirror(sec, addr);
}

/**
 * Phase 0.1 — remove all listed addresses in one trial (descending sentIdx per paragraph block) so indices stay valid.
 * Returns false if any block would drop below one sentence.
 */
function batchRemoveSentenceAddresses(sections: ProjectedExplanationSection[], addrs: SentAddr[]): boolean {
  if (addrs.length === 0) return false;
  const byBlock = new Map<string, SentAddr[]>();
  for (const a of addrs) {
    const k = `${a.secIdx}|${a.bulletIdx ?? 't'}|${a.paraIdx}`;
    const arr = byBlock.get(k) ?? [];
    arr.push(a);
    byBlock.set(k, arr);
  }
  const blockKeys = [...byBlock.keys()].sort((a, b) => a.localeCompare(b));
  for (const k of blockKeys) {
    const arr = byBlock.get(k)!;
    const first = arr[0]!;
    const got = getSentenceBlock(sections, first);
    if (!got) return false;
    const uniq = new Set(arr.map((x) => x.sentIdx));
    if (got.sents.length - uniq.size < 1) return false;
  }
  for (const k of blockKeys) {
    const arr = byBlock.get(k)!;
    arr.sort((x, y) => y.sentIdx - x.sentIdx);
    for (const addr of arr) {
      removeSentenceAt(sections, addr);
    }
  }
  return true;
}

/**
 * Phase 0.1 — drop a whole paragraph when it is a single sentence whose norm is a duplicate pool literal
 * (removeSet) and the body still has at least one other paragraph. `removeSentenceAt` cannot remove sole sentences.
 */
function removeParagraphIfSolePoolDuplicate(
  sections: ProjectedExplanationSection[],
  addr: SentAddr,
  removeSet: ReadonlySet<string>
): boolean {
  if (!removeSet.has(addrKey(addr))) return false;
  const sec = sections[addr.secIdx];
  const isText = addr.bulletIdx === null;
  const body = isText ? sec.text : sec.bullets![addr.bulletIdx!];
  const paras = splitParas(body);
  if (addr.paraIdx < 0 || addr.paraIdx >= paras.length || paras.length <= 1) return false;
  const para = paras[addr.paraIdx]!;
  const sents = splitSents(para);
  if (sents.length !== 1) return false;
  const n = projectionNormSentence(sents[0]!);
  if (!PoolNormSet.has(n)) return false;
  const nextParas = paras.filter((_, i) => i !== addr.paraIdx);
  const newBody = joinParas(nextParas);
  if (isText) sec.text = newBody;
  else {
    const bs = [...(sec.bullets ?? [])];
    bs[addr.bulletIdx!] = newBody;
    sec.bullets = bs;
  }
  if (sec.meta?.tagged) {
    if (addr.bulletIdx === null) {
      sec.meta.tagged.paragraphs.splice(addr.paraIdx, 1);
    } else {
      const bb = sec.meta.tagged.bulletBlocks?.[addr.bulletIdx!];
      if (bb) bb.paragraphs.splice(addr.paraIdx, 1);
    }
  }
  return true;
}

function removalSortKey(addr: SentAddr, cls: RemovableClass, secId: string): [number, number, number, number, number, number] {
  const ret = RETENTION[cls];
  const rank = sectionRank(secId);
  const fieldOrder = addr.bulletIdx === null ? 0 : 1;
  return [ret, -rank, -addr.secIdx, -addr.paraIdx, -addr.sentIdx, fieldOrder];
}

function cmpRemovalTuple(a: [number, number, number, number, number, number], b: [number, number, number, number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export type CollapsePhase0Ctx = {
  readonly core: SemanticCore;
  readonly seed: string;
  readonly surface: ProjectionSurface;
  /** Third argument to `validateReportSections` (matches `apply-unified-projection`). */
  readonly validateTier: ExpansionTier;
  readonly tierForDensity: ExpansionTier;
};

export function collapseRepetitionPhase0(
  sections: ProjectedExplanationSection[],
  ctx: CollapsePhase0Ctx
): ProjectedExplanationSection[] {
  const backup = cloneSections(sections);
  let working = cloneSections(sections);

  for (let si = 0; si < working.length; si++) {
    const s = working[si];
    s.text = applyLintStripToBody(s.text);
    if (s.meta?.tagged) {
      s.meta = { ...s.meta, tagged: stripTaggedLintFromSectionBody(s.meta.tagged) };
    }
    if (s.bullets) {
      s.bullets = s.bullets.map((b) => applyLintStripToBody(b));
      if (s.meta?.tagged?.bulletBlocks) {
        s.meta.tagged.bulletBlocks = s.meta.tagged.bulletBlocks.map((bb) => stripTaggedLintFromSectionBody(bb));
      }
    }
  }

  if (!reportSectionsOk(working, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
    return backup;
  }

  function buildRemovePlan(classifiedIn: Classified[], secIdsIn: string[]): Set<string> {
    const rs = new Set<string>();
    const byN = new Map<string, Classified[]>();
    for (const c of classifiedIn) {
      if (c.cls === 'OTHER') continue;
      const list = byN.get(c.norm) ?? [];
      list.push(c);
      byN.set(c.norm, list);
    }
    for (const [, group] of byN) {
      if (group.length < 2) continue;
      let survivor = group[0];
      for (let i = 1; i < group.length; i++) {
        if (survivorPreferB(survivor, group[i], secIdsIn)) survivor = group[i];
      }
      for (const g of group) {
        if (
          g.secIdx === survivor.secIdx &&
          g.bulletIdx === survivor.bulletIdx &&
          g.paraIdx === survivor.paraIdx &&
          g.sentIdx === survivor.sentIdx
        ) {
          continue;
        }
        rs.add(addrKey(g));
      }
    }
    for (const c of classifiedIn) {
      if (c.cls !== 'AUDIO_CATALOG_REDUNDANT') continue;
      const g = byN.get(c.norm) ?? [];
      if (g.length === 1) rs.add(addrKey(c));
    }
    return rs;
  }

  type Cand = Classified & { key: [number, number, number, number, number, number] };

  /** Upper bound on single-pass removals (prevents pathological repair/remove cycles). */
  const MAX_REMOVAL_ROUNDS = 200;
  for (let round = 0; round < MAX_REMOVAL_ROUNDS; round++) {
    const classifiedNow = collectClassified(working);
    const removableNow = classifiedNow.filter((c) => c.cls !== 'OTHER');
    const secIdsNow = working.map((s) => s.id);
    const removeSet = buildRemovePlan(removableNow, secIdsNow);
    const candidates: Cand[] = [];
    for (const c of removableNow) {
      if (!removeSet.has(addrKey(c))) continue;
      const secId = working[c.secIdx].id;
      candidates.push({
        ...c,
        key: removalSortKey(c, c.cls as RemovableClass, secId),
      });
    }
    candidates.sort((a, b) => cmpRemovalTuple(a.key, b.key));
    let progressed = false;
    const byNormDup = new Map<string, Classified[]>();
    for (const x of classifiedNow) {
      if (x.cls === 'OTHER') continue;
      const list = byNormDup.get(x.norm) ?? [];
      list.push(x);
      byNormDup.set(x.norm, list);
    }
    for (const c of candidates) {
      const gn = byNormDup.get(c.norm) ?? [];
      const dupRemovableGroup = gn.length >= 2 && c.cls !== 'AUDIO_CATALOG_REDUNDANT';
      const batchAddrs: SentAddr[] = dupRemovableGroup
        ? gn
            .filter((g) => removeSet.has(addrKey(g)))
            .map((g) => ({
              secIdx: g.secIdx,
              bulletIdx: g.bulletIdx,
              paraIdx: g.paraIdx,
              sentIdx: g.sentIdx,
            }))
        : [];
      const trial = cloneSections(working);
      let batchOk = false;
      if (batchAddrs.length > 1) {
        batchOk = batchRemoveSentenceAddresses(trial, batchAddrs);
      }
      if (batchOk) {
        if (reportSectionsOk(trial, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
          working = trial;
          progressed = true;
          break;
        }
        const repaired = cloneSections(trial);
        const repairOk = densityRepair(repaired, {
          seed: ctx.seed,
          surface: ctx.surface,
          validateTier: ctx.validateTier,
          tierForDensity: ctx.tierForDensity,
          core: ctx.core,
        });
        if (repairOk && reportSectionsOk(repaired, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
          working = repaired;
          progressed = true;
          break;
        }
      }
      const addr: SentAddr = {
        secIdx: c.secIdx,
        bulletIdx: c.bulletIdx,
        paraIdx: c.paraIdx,
        sentIdx: c.sentIdx,
      };
      const got = getSentenceBlock(working, addr);
      if (!got) continue;

      if (got.sents.length > 1) {
        const trialOne = cloneSections(working);
        removeSentenceAt(trialOne, addr);
        if (reportSectionsOk(trialOne, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
          working = trialOne;
          progressed = true;
          break;
        }
        const repairedOne = cloneSections(trialOne);
        const repairOkOne = densityRepair(repairedOne, {
          seed: ctx.seed,
          surface: ctx.surface,
          validateTier: ctx.validateTier,
          tierForDensity: ctx.tierForDensity,
          core: ctx.core,
        });
        if (repairOkOne && reportSectionsOk(repairedOne, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
          working = repairedOne;
          progressed = true;
          break;
        }
      }

      if (got.sents.length === 1 && removeSet.has(addrKey(c))) {
        const soleNorm = projectionNormSentence(got.sents[0]!);
        const gSole = byNormDup.get(soleNorm) ?? [];
        if (gSole.length >= 2 && PoolNormSet.has(soleNorm)) {
          const trialDrop = cloneSections(working);
          if (removeParagraphIfSolePoolDuplicate(trialDrop, addr, removeSet)) {
            if (reportSectionsOk(trialDrop, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
              working = trialDrop;
              progressed = true;
              break;
            }
            const repairedDrop = cloneSections(trialDrop);
            const repairOkDrop = densityRepair(repairedDrop, {
              seed: ctx.seed,
              surface: ctx.surface,
              validateTier: ctx.validateTier,
              tierForDensity: ctx.tierForDensity,
              core: ctx.core,
            });
            if (repairOkDrop && reportSectionsOk(repairedDrop, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
              working = repairedDrop;
              progressed = true;
              break;
            }
          }
        }
      }
    }
    if (!progressed) break;
  }

  if (!reportSectionsOk(working, ctx.surface, ctx.validateTier, ctx.tierForDensity, ctx.core)) {
    return backup;
  }
  return working;
}

/**
 * Phase 0.1 — deterministic counts: how often each PoolNormSet member appears on the full report.
 * For validation: each count must be ≤ 1 after collapse + repair.
 */
export function poolNormOccurrenceCountsOnReport(
  sections: ProjectedExplanationSection[]
): ReadonlyMap<string, number> {
  const m = new Map<string, number>();
  for (const n of PoolNormSet) m.set(n, 0);
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]!;
    const walk = (body: string) => {
      for (const para of splitParas(body)) {
        for (const raw of splitSents(para)) {
          const n = projectionNormSentence(raw);
          if (PoolNormSet.has(n)) m.set(n, (m.get(n) ?? 0) + 1);
        }
      }
    };
    walk(sec.text);
    for (const b of sec.bullets ?? []) walk(b);
  }
  return m;
}

/** Phase 0.1 — test hook for repair exhaustion / selection (same logic as densityRepair). */
export function phase01PickRepairLiteral(
  surface: ProjectionSurface,
  ctx: { seed: string; tierForDensity: ExpansionTier },
  step: number,
  paraText: string,
  P_report: ReadonlySet<string>,
  targetSecId: string,
  sectionsForAudio: ProjectedExplanationSection[]
): string | null {
  const R_ORDERED = repairPoolLiterals(surface);
  const audioNormBlob = buildAudioNormBlob(sectionsForAudio);
  return pickRepairLiteral(
    R_ORDERED,
    { seed: ctx.seed, surface, tierForDensity: ctx.tierForDensity },
    step,
    paraText,
    P_report,
    targetSecId,
    audioNormBlob
  );
}
