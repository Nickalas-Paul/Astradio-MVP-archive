/**
 * Phase 3 — deterministic provenance tagging (reconstruction + hash helpers).
 * No string-inference of provenance; callers assign at source and propagate.
 */
import type {
  ProvenanceType,
  TaggedParagraph,
  TaggedSectionBody,
  TaggedSentence,
  ProjectedExplanationSection,
} from './projection-types';
import { stripLintHedgeFromParagraph } from './language-lint';

/** Paragraph split aligned with repetition-collapse / tone-pass body handling. */
export function splitParasForTagged(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Sentence split aligned with repetition-collapse `splitSents`. */
export function splitSentsForTagged(para: string): string[] {
  const t = para.trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function joinSentsForTagged(sents: TaggedSentence[]): string {
  return sents.map((s) => s.text).join(' ');
}

export function joinParasForTagged(paras: TaggedParagraph[]): string {
  return paras.map((p) => joinSentsForTagged(p.sentences)).join('\n\n');
}

/** Byte-level section body from tagged paragraphs (main `text` field). */
export function reconstructTaggedSectionBody(tagged: TaggedSectionBody): string {
  return joinParasForTagged(tagged.paragraphs);
}


/** One paragraph, every sentence same provenance (source-assigned). */
export function taggedParagraphFromParaString(para: string, provenance: ProvenanceType): TaggedParagraph {
  const sents = splitSentsForTagged(para);
  return {
    sentences: sents.map((text) => ({ text, provenance })),
  };
}

/** Full body: split by `\n\n+`, trim paragraphs; each sentence same provenance. */
export function taggedSectionBodyFromText(text: string, provenance: ProvenanceType): TaggedSectionBody {
  const paras = splitParasForTagged(text);
  return {
    paragraphs: paras.map((p) => taggedParagraphFromParaString(p, provenance)),
  };
}

/** Multiple vertical blocks joined with `\n\n`; each block has its own provenance for all its sentences. */
export function taggedSectionBodyFromBlocks(blocks: { text: string; provenance: ProvenanceType }[]): TaggedSectionBody {
  const paragraphs: TaggedParagraph[] = [];
  for (const b of blocks) {
    const ps = splitParasForTagged(b.text);
    for (const p of ps) {
      paragraphs.push(taggedParagraphFromParaString(p, b.provenance));
    }
  }
  return { paragraphs };
}

/** Template `lineForTemplate` body + optional bullets (all `template` provenance). */
export function taggedSectionFromTemplateLine(text: string, bullets?: string[]): TaggedSectionBody {
  const body = taggedSectionBodyFromText(text, 'template');
  if (bullets?.length) {
    body.bulletBlocks = bullets.map((b) => taggedSectionBodyFromText(b, 'template'));
  }
  return body;
}

export function mergeTaggedSectionBodiesVertical(a: TaggedSectionBody, b: TaggedSectionBody): TaggedSectionBody {
  const bulletBlocks =
    a.bulletBlocks?.length ? a.bulletBlocks : b.bulletBlocks?.length ? b.bulletBlocks : undefined;
  return {
    paragraphs: [...a.paragraphs, ...b.paragraphs],
    ...(bulletBlocks?.length ? { bulletBlocks } : {}),
  };
}

export function cloneTaggedSentence(s: TaggedSentence): TaggedSentence {
  return {
    text: s.text,
    provenance: s.provenance,
    ...(s.contentProvenance !== undefined ? { contentProvenance: s.contentProvenance } : {}),
  };
}

export function cloneTaggedParagraph(p: TaggedParagraph): TaggedParagraph {
  return { sentences: p.sentences.map(cloneTaggedSentence) };
}

export function cloneTaggedSectionBody(t: TaggedSectionBody): TaggedSectionBody {
  return {
    paragraphs: t.paragraphs.map(cloneTaggedParagraph),
    bulletBlocks: t.bulletBlocks?.map((bb) => cloneTaggedSectionBody(bb)),
  };
}

export function assertReconstructsToText(tagged: TaggedSectionBody | undefined, text: string, where: string): void {
  if (tagged === undefined) throw new Error(`[Phase3] missing tagged: ${where}`);
  const r = reconstructTaggedSectionBody(tagged);
  if (r !== text) {
    throw new Error(
      `[Phase3] reconstruction mismatch ${where}:\n---expected---\n${JSON.stringify(text)}\n---got---\n${JSON.stringify(r)}`
    );
  }
}

export function assertSectionTaggedInvariant(sec: ProjectedExplanationSection, where: string): void {
  const tagged = sec.meta?.tagged;
  if (tagged === undefined) throw new Error(`[Phase3] section ${sec.id} missing meta.tagged @ ${where}`);
  assertReconstructsToText(tagged, sec.text, `${where}:${sec.id}`);
  if (sec.bullets?.length) {
    const blocks = tagged.bulletBlocks;
    if (!blocks || blocks.length !== sec.bullets.length) {
      throw new Error(`[Phase3] bulletBlocks mismatch ${where}:${sec.id}`);
    }
    for (let i = 0; i < sec.bullets.length; i++) {
      const rb = reconstructTaggedSectionBody(blocks[i]!);
      if (rb !== sec.bullets[i]) {
        throw new Error(`[Phase3] bullet reconstruct ${where}:${sec.id}[${i}]`);
      }
    }
  }
}

export function assertAllSectionsTagged(sections: ProjectedExplanationSection[], where: string): void {
  for (const s of sections) assertSectionTaggedInvariant(s, where);
}

/** Deep strip `meta.tagged` for JSON hashing (explanation hash stability). */
export function stripTaggedFromMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const { tagged: _t, phase4_composition: _p4, phase4_source_path: _p4s, enrichDensity: _ed, ...rest } = meta;
  return Object.keys(rest).length ? rest : undefined;
}

/** Mirror repetition-collapse `stripLintParagraph` / `applyLintStripToBody` on tagged trees. */
export function stripTaggedLintParagraph(tp: TaggedParagraph): TaggedParagraph {
  const joined = tp.sentences.map((s) => s.text).join(' ');
  const stripped = stripLintHedgeFromParagraph(joined);
  if (stripped === joined) {
    return { sentences: tp.sentences.map((s) => ({ ...s })) };
  }
  const newSents = splitSentsForTagged(stripped);
  return {
    sentences: newSents.map((t, idx) => {
      const first = tp.sentences[0];
      if (idx === 0 && first?.contentProvenance !== undefined) {
        return { text: t, provenance: first.contentProvenance };
      }
      if (idx === 0) {
        return { text: t, provenance: first?.provenance ?? 'padding' };
      }
      return {
        text: t,
        provenance: tp.sentences[idx]?.provenance ?? tp.sentences[tp.sentences.length - 1]!.provenance,
      };
    }),
  };
}

export function stripTaggedLintFromSectionBody(tagged: TaggedSectionBody): TaggedSectionBody {
  return {
    paragraphs: tagged.paragraphs.map(stripTaggedLintParagraph),
    bulletBlocks: tagged.bulletBlocks?.map(stripTaggedLintFromSectionBody),
  };
}

export function stripTaggedFromExplanationForHash(explanation: Record<string, unknown>): Record<string, unknown> {
  const sections = explanation.sections;
  if (!Array.isArray(sections)) return explanation;
  const nextSections = sections.map((sec: Record<string, unknown>) => {
    const meta = sec.meta as Record<string, unknown> | undefined;
    const stripped = stripTaggedFromMeta(meta);
    const out = { ...sec };
    if (stripped) out.meta = stripped;
    else delete out.meta;
    return out;
  });
  return { ...explanation, sections: nextSections };
}
