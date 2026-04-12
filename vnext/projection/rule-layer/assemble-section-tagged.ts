/**
 * Phase 3 — mirrors enrichSectionText / expandSentencesToMin on TaggedSectionBody (source propagation).
 */
import type { TaggedParagraph, TaggedSectionBody } from '../projection-types';
import {
  cloneTaggedSectionBody,
  mergeTaggedSectionBodiesVertical,
  reconstructTaggedSectionBody,
  splitSentsForTagged,
} from '../tagged-text';

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
  const list = pool.length ? pool : [];
  if (list.length === 0) return '';
  const start = hashSeed(seed) % list.length;
  for (let i = 0; i < list.length; i++) {
    const candidate = list[(start + i) % list.length];
    if (!used || !used.has(candidate)) {
      used?.add(candidate);
      return candidate;
    }
  }
  const fallback = list[start]!;
  used?.add(fallback);
  return fallback;
}

function expandSentencesToMin(
  text: string,
  minSentences: number,
  seed: string,
  fallbackPool: string[],
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

function expandTaggedBodySentencesToMin(
  tagged: TaggedSectionBody,
  minSentences: number,
  seed: string,
  fallbackPool: string[],
  usedFallback: Set<string> | undefined,
  maxPadIterations: number
): TaggedSectionBody {
  const before = reconstructTaggedSectionBody(tagged);
  const after = expandSentencesToMin(before, minSentences, seed, fallbackPool, usedFallback, maxPadIterations);
  if (after === before) return cloneTaggedSectionBody(tagged);
  const out = cloneTaggedSectionBody(tagged);
  const beforeSents = splitSentsForTagged(before);
  const afterSents = splitSentsForTagged(after);
  for (let i = 0; i < beforeSents.length; i++) {
    if (beforeSents[i] !== afterSents[i]) {
      throw new Error('[Phase3] expandTagged prefix drift');
    }
  }
  const pads = afterSents.slice(beforeSents.length);
  if (pads.length === 0) return out;
  const lastPara = out.paragraphs[out.paragraphs.length - 1]!;
  for (const p of pads) {
    lastPara.sentences.push({ text: p, provenance: 'padding' });
  }
  if (reconstructTaggedSectionBody(out) !== after) {
    throw new Error('[Phase3] expandTaggedBodySentencesToMin reconstruction drift');
  }
  return out;
}

function cloneParagraph(p: TaggedParagraph): TaggedParagraph {
  return { sentences: p.sentences.map((s) => ({ ...s })) };
}

export function enrichSectionTextWithTagged(
  baseText: string,
  baseTagged: TaggedSectionBody,
  extraParagraphs: string[],
  extraTaggedBlocks: TaggedSectionBody[],
  density: 'short' | 'medium' | 'long',
  seed: string,
  claimIds: string[],
  usedFallback: Set<string> | undefined,
  fallbackPool: string[],
  enrichOpts?: { feed?: boolean; campaignExtendedFill?: boolean }
): { text: string; claimIds: string[]; tagged: TaggedSectionBody } {
  if (extraParagraphs.length !== extraTaggedBlocks.length) {
    throw new Error('[Phase3] extraParagraphs / extraTaggedBlocks length mismatch');
  }
  const rules =
    density === 'short'
      ? { minP: 1, minS: 1 }
      : density === 'medium'
        ? { minP: 1, minS: 2 }
        : { minP: 2, minS: 2 };

  const maxPad = enrichOpts?.feed ? 0 : 1;
  const t1Tagged = expandTaggedBodySentencesToMin(
    baseTagged,
    rules.minS,
    `${seed}:p1`,
    fallbackPool,
    usedFallback,
    maxPad
  );
  const p1 = reconstructTaggedSectionBody(t1Tagged);

  const blocksTagged: TaggedSectionBody[] = [t1Tagged];
  const blocks: string[] = [p1];
  for (let e = 0; e < extraParagraphs.length; e++) {
    const exT = expandTaggedBodySentencesToMin(
      extraTaggedBlocks[e]!,
      rules.minS,
      `${seed}:ex:${e}`,
      fallbackPool,
      usedFallback,
      maxPad
    );
    const ex = reconstructTaggedSectionBody(exT);
    blocksTagged.push(exT);
    blocks.push(ex);
  }

  let merged = blocks.join('\n\n');
  let mergedTagged = blocksTagged.reduce((a, b) => mergeTaggedSectionBodiesVertical(a, b));
  if (reconstructTaggedSectionBody(mergedTagged) !== merged) {
    throw new Error('[Phase3] enrich merge mismatch');
  }

  let paras = splitIntoParagraphs(merged);
  if (paras.length < rules.minP && enrichOpts?.campaignExtendedFill) {
    const rawFill = nextFallbackSentence(`${seed}:fill:0`, fallbackPool, usedFallback);
    const fillTaggedExp = expandTaggedBodySentencesToMin(
      singleParaBodyFromString(rawFill, 'padding'),
      rules.minS,
      `${seed}:fillS:0`,
      fallbackPool,
      usedFallback,
      1
    );
    const fillStr = reconstructTaggedSectionBody(fillTaggedExp);
    paras.push(fillStr);
    mergedTagged = mergeTaggedSectionBodiesVertical(mergedTagged, fillTaggedExp);
    merged = paras.join('\n\n');
    if (reconstructTaggedSectionBody(mergedTagged) !== merged) {
      throw new Error('[Phase3] enrich campaign fill mismatch');
    }
  }

  const nextParas: string[] = [];
  const nextTaggedParas: TaggedParagraph[] = [];
  for (let pi = 0; pi < paras.length; pi++) {
    const para = paras[pi]!;
    const need = rules.minS;
    const n = countSentences(para);
    const srcParaTagged = mergedTagged.paragraphs[pi] ?? { sentences: [] };
    if (reconstructTaggedSectionBody({ paragraphs: [cloneParagraph(srcParaTagged)] }) !== para) {
      throw new Error(`[Phase3] enrich para ${pi} pre-expand tagged/text mismatch`);
    }
    if (n >= need) {
      nextParas.push(para);
      nextTaggedParas.push(cloneParagraph(srcParaTagged));
      continue;
    }
    const paraPadCap = enrichOpts?.feed ? 0 : Math.min(2, Math.max(1, need));
    const nextTagged = expandTaggedBodySentencesToMin(
      { paragraphs: [cloneParagraph(srcParaTagged)] },
      need,
      `${seed}:para:${pi}`,
      fallbackPool,
      usedFallback,
      paraPadCap
    ).paragraphs[0]!;
    const nextStr = reconstructTaggedSectionBody({ paragraphs: [nextTagged] });
    nextParas.push(nextStr);
    nextTaggedParas.push(nextTagged);
  }

  merged = nextParas.join('\n\n');
  const preservedBulletBlocks = mergedTagged.bulletBlocks;
  mergedTagged = {
    paragraphs: nextTaggedParas,
    ...(preservedBulletBlocks?.length ? { bulletBlocks: preservedBulletBlocks } : {}),
  };
  if (reconstructTaggedSectionBody(mergedTagged) !== merged) {
    throw new Error('[Phase3] enrich final mismatch');
  }

  return { text: merged, claimIds, tagged: mergedTagged };
}

function singleParaBodyFromString(para: string, provenance: import('../projection-types').ProvenanceType): TaggedSectionBody {
  const sents = splitSentsForTagged(para);
  return {
    paragraphs: [{ sentences: sents.map((text) => ({ text, provenance })) }],
  };
}
