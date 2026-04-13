/**
 * **Proj:** Phase 5A — deterministic surface expression filters (projection only; legacy module name `phase5a-*`).
 * After composition + tone + collapse; before validation. No shared execution with Phase 5B (see `phase5b-*` in RPG).
 */
import type {
  ConnectionMode,
  ProjectedExplanationSection,
  ProjectionOptions,
  ProjectionSurface,
  ProvenanceType,
  TaggedParagraph,
  TaggedSectionBody,
  TaggedSentence,
} from '../projection-types';
import {
  assertSectionTaggedInvariant,
  cloneTaggedParagraph,
  cloneTaggedSectionBody,
  reconstructTaggedSectionBody,
  splitSentsForTagged,
} from '../tagged-text';
import { countSentenceLoads, totalLoadScore } from './phase2-sentence-load';
import type { Phase5ARule, Phase5ATemplateAllowlistEntry } from './phase5a-tables';
import { PHASE5A_RULES, PHASE5A_TEMPLATE_ALLOWLIST } from './phase5a-tables';

export type Phase5AEngineTables = {
  rules: readonly Phase5ARule[];
  templateAllowlist: readonly Phase5ATemplateAllowlistEntry[];
};

function validateShippedPhase5ARules(rules: readonly Phase5ARule[]): void {
  for (const r of rules) {
    if (r.provenances.includes('template')) {
      throw new Error(`[Phase5A] rule ${r.rule_id} must not target template (use phase5a-template-allowlist)`);
    }
    if (r.provenances.includes('claim_body')) {
      throw new Error(`[Phase5A] rule ${r.rule_id} must not target claim_body`);
    }
    if (r.provenances.includes('padding') || r.provenances.includes('audio_staging') || r.provenances.includes('audio_thread')) {
      throw new Error(`[Phase5A] rule ${r.rule_id} targets immutable provenance`);
    }
  }
}

function effectiveProvenance(row: TaggedSentence): ProvenanceType {
  return row.provenance;
}

function isRowImmutable(row: TaggedSentence): boolean {
  const p = effectiveProvenance(row);
  if (p === 'padding') return true;
  if (p === 'claim_body') return true;
  if (p === 'audio_staging' || p === 'audio_thread') return true;
  return false;
}

function surfaceMatches(ruleSurfaces: readonly (ProjectionSurface | '*')[], surf: ProjectionSurface): boolean {
  return ruleSurfaces.includes('*') || ruleSurfaces.includes(surf);
}

function connectionGate(rule: Phase5ARule, mode: ConnectionMode | undefined): boolean {
  const cm = rule.connection_modes;
  if (!cm || cm.length === 0) return true;
  return mode !== undefined && (cm as readonly ConnectionMode[]).includes(mode);
}

function loadTotal(sentence: string): number {
  return totalLoadScore(countSentenceLoads(sentence, 'template'));
}

function assertSingleSentenceSlot(text: string, where: string): void {
  const n = splitSentsForTagged(text).length;
  if (n !== 1) {
    throw new Error(`[Phase5A] expected single sentence in tagged row @ ${where}, got ${n}: ${JSON.stringify(text)}`);
  }
}

function feedNonExpanding(surf: ProjectionSurface, before: string, after: string): boolean {
  if (surf !== 'feed') return true;
  return after.length <= before.length;
}

function tryApplyNonTemplateRule(
  row: TaggedSentence,
  eff: ProvenanceType,
  surf: ProjectionSurface,
  mode: ConnectionMode | undefined,
  glueConsumed: { value: boolean },
  sortedRules: Phase5ARule[]
): boolean {
  const text = row.text;
  if (eff === 'template') return false;

  for (const rule of sortedRules) {
    if (!surfaceMatches(rule.surfaces, surf)) continue;
    if (!connectionGate(rule, mode)) continue;
    if (!rule.provenances.includes(eff)) continue;

    if (rule.match.kind === 'whole_sentence') {
      if (rule.match.before !== text) continue;
      const rep = rule.replacement;
      if (!feedNonExpanding(surf, text, rep)) continue;
      if (splitSentsForTagged(rep).length !== 1) continue;
      row.text = rep;
      return true;
    }

    if (rule.match.kind === 'prefix') {
      if (eff !== 'assembler_glue') continue;
      if (glueConsumed.value) continue;
      const { before_prefix, after_prefix } = rule.match;
      if (!text.startsWith(before_prefix)) continue;
      const next = after_prefix + text.slice(before_prefix.length);
      if (!feedNonExpanding(surf, text, next)) continue;
      if (loadTotal(text) !== loadTotal(next)) continue;
      assertSingleSentenceSlot(next, 'phase5a:prefix-result');
      row.text = next;
      glueConsumed.value = true;
      return true;
    }
  }
  return false;
}

function tryApplyTemplateAllowlist(
  row: TaggedSentence,
  eff: ProvenanceType,
  surf: ProjectionSurface,
  sectionId: string,
  sortedTpl: Phase5ATemplateAllowlistEntry[]
): boolean {
  if (eff !== 'template') return false;
  let text = row.text;

  for (const ex of sortedTpl) {
    if (ex.surface !== '*' && ex.surface !== surf) continue;
    if (ex.section_ids?.length && !ex.section_ids.includes(sectionId)) continue;

    if (ex.match.kind === 'whole_sentence') {
      if (ex.match.value !== text) continue;
      const rep = ex.replacement;
      if (!feedNonExpanding(surf, text, rep)) continue;
      if (splitSentsForTagged(rep).length !== 1) continue;
      row.text = rep;
      return true;
    }

    if (ex.match.kind === 'exact_substring') {
      const needle = ex.match.value;
      const idx = text.indexOf(needle);
      if (idx < 0) continue;
      const rep = ex.replacement;
      const next = text.slice(0, idx) + rep + text.slice(idx + needle.length);
      if (!feedNonExpanding(surf, text, next)) continue;
      if (splitSentsForTagged(next).length !== 1) continue;
      text = next;
      row.text = text;
      return true;
    }
  }
  return false;
}

function paragraphSentenceCounts(tp: TaggedParagraph): number[] {
  return tp.sentences.map((s) => splitSentsForTagged(s.text).length);
}

function assertParagraphInvariant(before: TaggedParagraph, after: TaggedParagraph, where: string): void {
  if (before.sentences.length !== after.sentences.length) {
    throw new Error(`[Phase5A] sentence row count changed @ ${where}`);
  }
  const cb = paragraphSentenceCounts(before);
  const ca = paragraphSentenceCounts(after);
  for (let i = 0; i < cb.length; i++) {
    if (cb[i] !== ca[i]) {
      throw new Error(`[Phase5A] linguistic sentence count per row changed @ ${where} idx ${i}`);
    }
  }
}

function transformParagraph(
  para: TaggedParagraph,
  surf: ProjectionSurface,
  mode: ConnectionMode | undefined,
  sectionId: string,
  sortedRules: Phase5ARule[],
  sortedTpl: Phase5ATemplateAllowlistEntry[],
  glueConsumed: { value: boolean },
  where: string
): TaggedParagraph {
  const before = cloneTaggedParagraph(para);
  const out = cloneTaggedParagraph(para);
  for (const row of out.sentences) {
    if (isRowImmutable(row)) continue;
    const eff = effectiveProvenance(row);
    tryApplyNonTemplateRule(row, eff, surf, mode, glueConsumed, sortedRules);
    const eff2 = effectiveProvenance(row);
    if (eff2 === 'template') {
      tryApplyTemplateAllowlist(row, 'template', surf, sectionId, sortedTpl);
    }
  }
  assertParagraphInvariant(before, out, where);
  return out;
}

function transformTaggedSectionBody(
  body: TaggedSectionBody,
  surf: ProjectionSurface,
  mode: ConnectionMode | undefined,
  sectionId: string,
  sortedRules: Phase5ARule[],
  sortedTpl: Phase5ATemplateAllowlistEntry[],
  where: string
): TaggedSectionBody {
  const glueConsumed = { value: false };
  const paragraphs = body.paragraphs.map((p, i) =>
    transformParagraph(p, surf, mode, sectionId, sortedRules, sortedTpl, glueConsumed, `${where}:p${i}`)
  );
  const bulletBlocks = body.bulletBlocks?.map((bb, bi) =>
    transformTaggedSectionBody(bb, surf, mode, sectionId, sortedRules, sortedTpl, `${where}:bb${bi}`)
  );
  return { paragraphs, ...(bulletBlocks ? { bulletBlocks } : {}) };
}

export function applyPhase5AExpressionWithTables(
  sections: ProjectedExplanationSection[],
  options: ProjectionOptions,
  tables: Phase5AEngineTables
): ProjectedExplanationSection[] {
  const sortedRules = [...tables.rules].sort((a, b) => a.rule_id.localeCompare(b.rule_id));
  const sortedTpl = [...tables.templateAllowlist].sort((a, b) => a.exception_id.localeCompare(b.exception_id));
  const surf = options.surface;

  return sections.map((sec) => {
    const taggedIn = sec.meta?.tagged;
    if (!taggedIn) return sec;

    const tagged = transformTaggedSectionBody(
      cloneTaggedSectionBody(taggedIn),
      surf,
      options.connectionMode,
      sec.id,
      sortedRules,
      sortedTpl,
      `phase5a:${sec.id}`
    );

    const text = reconstructTaggedSectionBody(tagged);
    let bullets = sec.bullets;
    const bulletBlocks = tagged.bulletBlocks;
    if (sec.bullets?.length && bulletBlocks?.length) {
      if (bulletBlocks.length !== sec.bullets.length) {
        throw new Error(`[Phase5A] bullet block count mismatch ${sec.id}`);
      }
      bullets = sec.bullets.map((_, i) => reconstructTaggedSectionBody(bulletBlocks[i]!));
    }

    const next: ProjectedExplanationSection = {
      ...sec,
      text,
      bullets: bullets?.length ? bullets : undefined,
      meta: sec.meta ? { ...sec.meta, tagged } : undefined,
    };
    assertSectionTaggedInvariant(next, 'phase5a');
    return next;
  });
}

export function applyPhase5AExpression(
  sections: ProjectedExplanationSection[],
  options: ProjectionOptions
): ProjectedExplanationSection[] {
  validateShippedPhase5ARules(PHASE5A_RULES);
  return applyPhase5AExpressionWithTables(sections, options, {
    rules: PHASE5A_RULES,
    templateAllowlist: PHASE5A_TEMPLATE_ALLOWLIST,
  });
}
