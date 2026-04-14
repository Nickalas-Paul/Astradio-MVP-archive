/**
 * Section claim ownership — deterministic helpers for assembly and validation.
 * No delivery-order naming; projection-local only.
 */

/** Same glue literals as `claim-synthesize` `pickGlue` (mechanism / panel synthesis). */
const MEP_GLUE_SPLIT =
  /\s+(?:In the same picture,|Alongside that signal,|Taken together with the prior emphasis,)\s+/;

/**
 * Split `mep.text` into one tagged paragraph per claim when glue matches `mep.claimIds.length`.
 * Keeps per-paragraph `claim_body` runs within composition-phase4 limits for long mechanism text.
 */
export function splitMepBodyForTaggedParagraphs(
  mepText: string,
  claimIds: readonly string[]
): Array<{ text: string; claimIds: string[] }> {
  const t = mepText.trim();
  if (!t) return [];
  if (claimIds.length === 0) {
    return [{ text: t, claimIds: [] }];
  }
  const parts = t.split(MEP_GLUE_SPLIT).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === claimIds.length) {
    return parts.map((text, i) => ({ text, claimIds: [claimIds[i]!] }));
  }
  return [{ text: t, claimIds: [...claimIds] }];
}

/** Lexicographic sort of unique claim ids (stable projection ordering). */
export function sortUniqueClaimIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
