import type { AnalysisOpportunity, AnalysisTheme, AnalysisTension } from '../contracts';

export type RankedNode =
  | AnalysisTheme
  | AnalysisTension
  | AnalysisOpportunity;

export function stableSortByNodeWeight<T extends RankedNode>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const ac = a.citations.factIds.length;
    const bc = b.citations.factIds.length;
    if (bc !== ac) return bc - ac;
    return a.id.localeCompare(b.id);
  });
}

