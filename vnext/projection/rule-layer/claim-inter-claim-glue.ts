/**
 * Inter-claim glue literals and split pattern (single source of truth).
 * Used by claim synthesis and mep body splitting.
 */
import { hash32 } from './claim-expression-bundles';

/** Fixed K = 6 (approved range 4–6). */
export const INTER_CLAIM_GLUE_LITERALS = [
  'In the same picture,',
  'Alongside that signal,',
  'Taken together with the prior emphasis,',
  'Read together with the clause above,',
  'In parallel with that emphasis,',
  'Weaving that thread next,',
] as const;

function escapeRegexLit(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split on whitespace + glue + whitespace (same family as prior three-glue split). */
export const INTER_CLAIM_GLUE_SPLIT_REGEX = new RegExp(
  `\\s+(?:${INTER_CLAIM_GLUE_LITERALS.map((g) => escapeRegexLit(g)).join('|')})\\s+`
);

export function pickInterClaimGlue(prevId: string, nextId: string, seed: string, glueGapIndex: number): string {
  const literals = INTER_CLAIM_GLUE_LITERALS as readonly string[];
  const h = hash32(`${seed}|glue|${prevId}|${nextId}|${glueGapIndex}`);
  return literals[h % literals.length]!;
}
