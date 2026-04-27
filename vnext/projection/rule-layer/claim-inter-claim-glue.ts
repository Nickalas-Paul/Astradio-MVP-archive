/**
 * Inter-claim glue literals — **single source of truth** (Phase 4).
 * `repetition-collapse-phase0` and `phase2-sentence-load` import this module only; no duplicate literal arrays.
 */
import { hash32 } from './claim-expression-bundles';

/**
 * Master list (all glue uses this array). Fixed literals; deterministic pick via `pickInterClaimGlue`.
 */
export const ALL_INTER_CLAIM_GLUE_LITERALS = [
  'In the same picture,',
  'Alongside that signal,',
  'Taken together with the prior emphasis,',
  'Read together with the clause above,',
  'In parallel with that emphasis,',
  'Weaving that thread next,',
  'Holding the prior clause steady,',
  'Turning the lens slightly,',
  'On the same structural line,',
  'Without breaking the prior read,',
  'Carrying that thread forward,',
  'Setting it beside the line above,',
  'Narrowing from the last emphasis,',
  'Broadening the frame,',
] as const;

/** Back-compat export name */
export const INTER_CLAIM_GLUE_LITERALS = ALL_INTER_CLAIM_GLUE_LITERALS;

function escapeRegexLit(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSplitRegex(literals: readonly string[]): RegExp {
  return new RegExp(
    `\\s+(?:${literals.map((g) => escapeRegexLit(g)).join('|')})\\s+`
  );
}

/** Split on whitespace + glue + whitespace (generated from `ALL_INTER_CLAIM_GLUE_LITERALS`). */
export const INTER_CLAIM_GLUE_SPLIT_REGEX = buildSplitRegex(ALL_INTER_CLAIM_GLUE_LITERALS);

/**
 * Phrase-anchored pattern for load / Phase 2 glue detection — **derived from the same array**.
 * Leading `\\b` (start of the glue phrase). No trailing `\\b`: most literals end with `,` where `\\b` is invalid
 * at end-of-string; a lookahead accepts end or a non-identifier (whitespace, punctuation) instead.
 */
export const CLAIM_GLUE_RE = new RegExp(
  `\\b(${ALL_INTER_CLAIM_GLUE_LITERALS.map(escapeRegexLit).join('|')})(?=$|[^A-Za-z0-9_])`
);

export function pickInterClaimGlue(prevId: string, nextId: string, seed: string, glueGapIndex: number): string {
  const literals = ALL_INTER_CLAIM_GLUE_LITERALS;
  const h = hash32(`${seed}|glue|${prevId}|${nextId}|${glueGapIndex}`);
  return literals[h % literals.length]!;
}
