/**
 * Step 9 — centralized tone pass (language-lint + forbidden_tone_flags + cross-section discipline).
 * Only invoked from apply-unified-projection after section assembly.
 * Phase 3 — mirrors all text transforms on `meta.tagged` (no string inference).
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type {
  ProvenanceType,
  ProjectedExplanationSection,
  TaggedParagraph,
  TaggedSectionBody,
  TaggedSentence,
} from '../projection-types';
import { lintParagraph, lintSectionBody } from '../language-lint';
import { cloneTaggedSectionBody, reconstructTaggedSectionBody, splitSentsForTagged } from '../tagged-text';

/** Lower wins duplicate sentences (section collapse). */
const SECTION_RANK: Record<string, number> = {
  connection_structure: 5,
  ensemble_framing: 5,
  group_key_interactions_v1: 6,
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

function normalizeSentence(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[""''`]/g, '');
}

function splitSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type Winner = { sectionId: string; rank: number; sectionIndex: number };

function paddingLikeProvenance(p: ProvenanceType): boolean {
  return p === 'padding' || p === 'neutral_pad' || p === 'contextual_pad';
}

function winnerKeyFor(
  sectionIndex: number,
  norm: string,
  prov: ProvenanceType | 'legacy_text'
): string {
  if (prov === 'legacy_text') {
    return norm;
  }
  if (paddingLikeProvenance(prov)) {
    return norm;
  }
  return `${sectionIndex}|${norm}`;
}

function walkTaggedForWinnerKeys(
  body: TaggedSectionBody,
  sectionId: string,
  sectionIndex: number,
  rank: number,
  winners: Map<string, Winner>
): void {
  const bump = (norm: string, prov: ProvenanceType) => {
    if (norm.length < 12) return;
    const key = winnerKeyFor(sectionIndex, norm, prov);
    const cur = winners.get(key);
    if (!cur || rank < cur.rank || (rank === cur.rank && sectionIndex < cur.sectionIndex)) {
      winners.set(key, { sectionId, rank, sectionIndex });
    }
  };
  for (const tp of body.paragraphs) {
    for (const row of tp.sentences) {
      const p = (row.contentProvenance ?? row.provenance) as ProvenanceType;
      bump(normalizeSentence(row.text), p);
    }
  }
  for (const bb of body.bulletBlocks ?? []) {
    walkTaggedForWinnerKeys(bb, sectionId, sectionIndex, rank, winners);
  }
}

function computeSentenceWinners(sections: ProjectedExplanationSection[]): Map<string, Winner> {
  const winners = new Map<string, Winner>();
  sections.forEach((sec, sectionIndex) => {
    const rank = sectionRank(sec.id);
    if (sec.meta?.tagged) {
      walkTaggedForWinnerKeys(sec.meta.tagged, sec.id, sectionIndex, rank, winners);
      return;
    }
    for (const para of sec.text.split(/\n\n+/)) {
      for (const sent of splitSentences(para)) {
        const norm = normalizeSentence(sent);
        if (norm.length < 12) continue;
        const key = winnerKeyFor(sectionIndex, norm, 'legacy_text');
        const cur = winners.get(key);
        if (!cur || rank < cur.rank || (rank === cur.rank && sectionIndex < cur.sectionIndex)) {
          winners.set(key, { sectionId: sec.id, rank, sectionIndex });
        }
      }
    }
  });
  return winners;
}

/** Text-only path (no per-sentence provenance): legacy global-norm key. */
function filterParagraphsByWinners(
  text: string,
  sectionId: string,
  sectionIndex: number,
  winners: Map<string, Winner>
): string {
  const paras = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const para of paras) {
    const sents = splitSentences(para);
    const keptSents = sents.filter((sent) => {
      const norm = normalizeSentence(sent);
      if (norm.length < 12) return true;
      const key = winnerKeyFor(sectionIndex, norm, 'legacy_text');
      const w = winners.get(key);
      return !w || w.sectionId === sectionId;
    });
    // Keep the whole paragraph if any sentence would be removed — partial removal breaks density validation.
    if (keptSents.length !== sents.length && sents.length > 0) {
      kept.push(sents.join(' '));
    } else if (keptSents.length > 0) {
      kept.push(keptSents.join(' '));
    }
  }
  return kept.join('\n\n');
}

function cloneSent(s: TaggedSentence): TaggedSentence {
  return {
    text: s.text,
    provenance: s.provenance,
    ...(s.contentProvenance !== undefined ? { contentProvenance: s.contentProvenance } : {}),
  };
}

function filterTaggedParagraphByWinners(
  tp: TaggedParagraph,
  sectionId: string,
  sectionIndex: number,
  winners: Map<string, Winner>
): TaggedParagraph {
  const sents = tp.sentences.map((r) => r.text);
  const keptRows = tp.sentences.filter((row, idx) => {
    const norm = normalizeSentence(sents[idx]!);
    if (norm.length < 12) return true;
    const p = (row.contentProvenance ?? row.provenance) as ProvenanceType;
    const key = winnerKeyFor(sectionIndex, norm, p);
    const w = winners.get(key);
    return !w || w.sectionId === sectionId;
  });
  const keptSents = keptRows.map((r) => r.text);
  if (keptSents.length !== sents.length && sents.length > 0) {
    return { sentences: tp.sentences.map(cloneSent) };
  }
  if (keptSents.length > 0) {
    return { sentences: keptRows.map(cloneSent) };
  }
  return { sentences: [] };
}

function filterTaggedSectionBodyByWinners(
  tagged: TaggedSectionBody,
  sectionId: string,
  sectionIndex: number,
  winners: Map<string, Winner>
): TaggedSectionBody {
  return {
    paragraphs: tagged.paragraphs.map((tp) => filterTaggedParagraphByWinners(tp, sectionId, sectionIndex, winners)),
    bulletBlocks: tagged.bulletBlocks?.map((bb) => filterTaggedSectionBodyByWinners(bb, sectionId, sectionIndex, winners)),
  };
}

function applyCrossSectionDiscipline(sections: ProjectedExplanationSection[]): ProjectedExplanationSection[] {
  if (sections.length === 0) return sections;
  const winners = computeSentenceWinners(sections);
  return sections.map((sec, sectionIndex) => {
    if (sec.meta?.tagged) {
      let tagged = filterTaggedSectionBodyByWinners(sec.meta.tagged, sec.id, sectionIndex, winners);
      const bbin = sec.meta.tagged.bulletBlocks;
      if (bbin?.length) {
        tagged = {
          ...tagged,
          bulletBlocks: bbin.map((bb) => filterTaggedSectionBodyByWinners(bb, sec.id, sectionIndex, winners)),
        };
      }
      const text = reconstructTaggedSectionBody(tagged);
      const bullets = tagged.bulletBlocks?.map((bb) => reconstructTaggedSectionBody(bb));
      return {
        ...sec,
        text,
        bullets: bullets?.length ? bullets : undefined,
        meta: {
          ...sec.meta!,
          tagged,
        },
      };
    }
    const text = filterParagraphsByWinners(sec.text, sec.id, sectionIndex, winners);
    const bullets = sec.bullets
      ?.map((b) => filterParagraphsByWinners(b, sec.id, sectionIndex, winners))
      .filter((b) => b.trim().length > 0);
    return {
      ...sec,
      text,
      bullets: bullets?.length ? bullets : undefined,
      meta: sec.meta ? { ...sec.meta } : undefined,
    };
  });
}

function applyForbiddenToneFlags(text: string, core: SemanticCore): string {
  let t = text;
  const flags = core.text.forbidden_tone_flags;
  if (flags.includes('TONE_AVOID_SHADOW')) {
    t = t.replace(/\bshadow\b/gi, 'quieter register');
  }
  return t;
}

function mirrorForbiddenTaggedParagraph(tp: TaggedParagraph, core: SemanticCore): TaggedParagraph {
  const joined = tp.sentences.map((s) => s.text).join(' ');
  const after = applyForbiddenToneFlags(joined, core);
  if (after === joined) {
    return { sentences: tp.sentences.map(cloneSent) };
  }
  const newSents = splitSentences(after);
  const oldSents = splitSentences(joined);
  if (newSents.length === oldSents.length) {
    return { sentences: newSents.map((t, i) => ({ ...tp.sentences[i]!, text: t })) };
  }
  return {
    sentences: newSents.map((t, i) => {
      const src = tp.sentences[Math.min(i, tp.sentences.length - 1)]!;
      return {
        text: t,
        provenance: src.provenance,
        ...(src.contentProvenance !== undefined ? { contentProvenance: src.contentProvenance } : {}),
      };
    }),
  };
}

function mirrorLintTaggedParagraph(tp: TaggedParagraph): TaggedParagraph {
  const joined = tp.sentences.map((s) => s.text).join(' ');
  const r = lintParagraph(joined.trim());
  const newSents = splitSentences(r.text);
  const oldSents = splitSentences(joined.trim());
  if (r.violations.includes('missing_hedge')) {
    return {
      sentences: newSents.map((t, idx) => {
        if (idx === 0) {
          return {
            text: t,
            provenance: 'padding',
            contentProvenance: tp.sentences[0]?.provenance ?? 'template',
          };
        }
        return {
          text: t,
          provenance: tp.sentences[idx]?.provenance ?? tp.sentences[tp.sentences.length - 1]!.provenance,
        };
      }),
    };
  }
  if (newSents.length === oldSents.length) {
    return { sentences: newSents.map((t, i) => ({ ...tp.sentences[i]!, text: t })) };
  }
  return {
    sentences: newSents.map((t, i) => ({
      text: t,
      provenance: tp.sentences[Math.min(i, tp.sentences.length - 1)]!.provenance,
    })),
  };
}

function mirrorToneTaggedBody(
  tagged: TaggedSectionBody,
  secTextBefore: string,
  secTextAfterLint: string,
  core: SemanticCore
): TaggedSectionBody {
  const parasBefore = secTextBefore.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const parasAfterLint = secTextAfterLint.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (parasBefore.length !== parasAfterLint.length || parasBefore.length !== tagged.paragraphs.length) {
    throw new Error('[Phase3] tone pass paragraph count mismatch');
  }
  const paragraphs: TaggedParagraph[] = tagged.paragraphs.map((tp, i) => {
    const beforeP = parasBefore[i]!;
    const joined = tp.sentences.map((s) => s.text).join(' ');
    if (joined.trim() !== beforeP) {
      throw new Error(`[Phase3] tone tagged para ${i} join mismatch`);
    }
    const fp = mirrorForbiddenTaggedParagraph(tp, core);
    const joinedF = fp.sentences.map((s) => s.text).join(' ');
    const midExpected = applyForbiddenToneFlags(beforeP, core);
    if (joinedF.trim() !== midExpected.trim()) {
      throw new Error(`[Phase3] tone forbidden para ${i} mismatch`);
    }
    const litP = mirrorLintTaggedParagraph(fp);
    const got = litP.sentences.map((s) => s.text).join(' ');
    if (got !== parasAfterLint[i]) {
      throw new Error(`[Phase3] tone lint para ${i} mismatch`);
    }
    return litP;
  });
  const out: TaggedSectionBody = { paragraphs };
  if (reconstructTaggedSectionBody(out) !== secTextAfterLint) {
    throw new Error('[Phase3] tone tagged body reconstruct mismatch');
  }
  return out;
}

function mirrorToneTaggedBullets(
  bulletBlocks: TaggedSectionBody[],
  bulletsBefore: string[],
  bulletsAfter: string[],
  core: SemanticCore
): TaggedSectionBody[] {
  return bulletBlocks.map((bb, i) => mirrorToneTaggedBody(bb, bulletsBefore[i]!, bulletsAfter[i]!, core));
}

export function runTonePassOnSections(sections: ProjectedExplanationSection[], core: SemanticCore): ProjectedExplanationSection[] {
  const linted = sections.map((sec) => {
    const afterFlag = applyForbiddenToneFlags(sec.text, core);
    const body = lintSectionBody(afterFlag);
    const bulletsBefore = sec.bullets ?? [];
    const bulletsAfter = bulletsBefore.map((b) => lintSectionBody(applyForbiddenToneFlags(b, core)).text);
    let tagged: TaggedSectionBody | undefined;
    if (sec.meta?.tagged) {
      tagged = mirrorToneTaggedBody(cloneTaggedSectionBody(sec.meta.tagged), sec.text, body.text, core);
      if (sec.meta.tagged.bulletBlocks?.length) {
        tagged = {
          ...tagged,
          bulletBlocks: mirrorToneTaggedBullets(sec.meta.tagged.bulletBlocks, bulletsBefore, bulletsAfter, core),
        };
      }
      if (reconstructTaggedSectionBody(tagged) !== body.text) {
        throw new Error(`[Phase3] tone section ${sec.id} text/tagged mismatch`);
      }
      if (bulletsAfter.length && tagged.bulletBlocks) {
        for (let i = 0; i < bulletsAfter.length; i++) {
          if (reconstructTaggedSectionBody(tagged.bulletBlocks[i]!) !== bulletsAfter[i]) {
            throw new Error(`[Phase3] tone bullet ${sec.id}[${i}]`);
          }
        }
      }
    }
    return {
      ...sec,
      text: body.text,
      bullets: bulletsAfter.length ? bulletsAfter : undefined,
      meta: sec.meta
        ? {
            ...sec.meta,
            ...(tagged ? { tagged } : {}),
          }
        : undefined,
    };
  });
  return applyCrossSectionDiscipline(linted);
}
