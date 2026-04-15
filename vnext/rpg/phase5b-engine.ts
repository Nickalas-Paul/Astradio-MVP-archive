/**
 * **Proj:** Phase 5B — deterministic RPG expression filters (campaign copy only; legacy module name `phase5b-*`).
 * No imports from projection `surface-expression-engine`; no shared execution path with that pass.
 */
import { splitSentsForTagged } from '../projection/tagged-text';
import type { Phase5BRule } from './phase5b-tables';
import { PHASE5B_RULES } from './phase5b-tables';

export type Phase5BEngineTables = {
  rules: readonly Phase5BRule[];
};

function sortedRulesForEmission(tables: Phase5BEngineTables, emissionId: string): Phase5BRule[] {
  return [...tables.rules].filter((r) => r.emission_id === emissionId).sort((a, b) => a.rule_id.localeCompare(b.rule_id));
}

function assertSameSentenceCount(before: string, after: string, where: string): void {
  const nb = splitSentsForTagged(before).length;
  const na = splitSentsForTagged(after).length;
  if (nb !== na) {
    throw new Error(`[Phase5B] sentence count mismatch @ ${where}: ${nb} -> ${na}`);
  }
}

/**
 * Whole-text emission: first matching rule wins (lexicographic rule_id); no cascading.
 */
export function applyPhase5BWholeTextWithTables(
  emissionId: string,
  text: string,
  tables: Phase5BEngineTables
): string {
  for (const rule of sortedRulesForEmission(tables, emissionId)) {
    if (rule.match.kind === 'whole_text' && rule.match.before === text) {
      assertSameSentenceCount(text, rule.replacement, `${emissionId}:${rule.rule_id}`);
      return rule.replacement;
    }
  }
  return text;
}

export function applyPhase5BWholeText(emissionId: string, text: string): string {
  return applyPhase5BWholeTextWithTables(emissionId, text, { rules: PHASE5B_RULES });
}

/**
 * Line array emission: same length; each line transformed independently (first match wins per line).
 */
export function applyPhase5BLineArrayWithTables(
  emissionId: string,
  lines: readonly string[],
  tables: Phase5BEngineTables
): string[] {
  return lines.map((line) => applyPhase5BWholeTextWithTables(emissionId, line, tables));
}

export function applyPhase5BLineArray(emissionId: string, lines: readonly string[]): string[] {
  return applyPhase5BLineArrayWithTables(emissionId, lines, { rules: PHASE5B_RULES });
}
