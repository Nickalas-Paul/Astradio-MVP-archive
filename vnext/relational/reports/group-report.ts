/**
 * Phase 5 — Group compatibility report from multi-chart output.
 * Deterministic, read-only transform suitable for UI and export.
 */

import type { MultiChartOutput } from '../compatibility/multi-chart';

export interface GroupReport {
  title: string;
  generated_at: string;
  chart_ids: string[];
  intent_profile: {
    id: string;
    version: string;
    hash: string;
    algorithm_version: string;
  };
  provenance: {
    vector_hashes: Record<string, string>;
  };
  summary: {
    mean_resonance: number;
    stability_index: number;
    dominant_elemental_pattern: string;
  };
  highlights: string[];
  cautions: string[];
  matrix_preview: {
    chart_id: string;
    top_matches: Array<{ chart_id: string; score: number }>;
  }[];
}

// Thresholds (documented, deterministic):
// - High mean_resonance: >= 0.75
// - Moderate mean_resonance: >= 0.6
// - Low stability_index: < 0.6
// - High tension_variance: > 0.08
const MEAN_HIGH = 0.75;
const MEAN_MED = 0.6;
const STABILITY_LOW = 0.6;
const TENSION_HIGH = 0.08;

export function buildGroupReport(
  multi: MultiChartOutput,
  opts?: { title?: string }
): GroupReport {
  const now = new Date(0).toISOString();
  const chart_ids = [...multi.chart_ids].sort((a, b) => a.localeCompare(b, 'en'));
  const { mean_resonance, stability_index, dominant_elemental_pattern, tension_variance } =
    multi.aggregate_metrics;

  const summary = {
    mean_resonance,
    stability_index,
    dominant_elemental_pattern,
  };

  const highlights: string[] = [];
  const cautions: string[] = [];

  if (mean_resonance >= MEAN_HIGH) {
    highlights.push('High overall resonance across the group.');
  } else if (mean_resonance >= MEAN_MED) {
    highlights.push('Moderate-to-high overall resonance across the group.');
  }

  if (stability_index < STABILITY_LOW) {
    cautions.push('Compatibility patterns are more volatile (lower stability index).');
  }

  if (tension_variance > TENSION_HIGH) {
    cautions.push('Tension levels vary widely between pairs (higher tension variance).');
  }

  const matrix_preview: GroupReport['matrix_preview'] = [];
  const matrix = multi.compatibility_matrix;
  const n = chart_ids.length;

  for (let i = 0; i < n; i++) {
    const rowId = chart_ids[i];
    const scores: Array<{ chart_id: string; score: number }> = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      scores.push({ chart_id: chart_ids[j], score: matrix[i][j] });
    }
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chart_id.localeCompare(b.chart_id, 'en');
    });
    matrix_preview.push({
      chart_id: rowId,
      top_matches: scores.slice(0, 3),
    });
  }

  const report: GroupReport = {
    title: opts?.title?.trim() || 'Group Compatibility Report',
    generated_at: now,
    chart_ids,
    intent_profile: {
      id: multi.intent_profile_id,
      version: multi.intent_profile_version,
      hash: multi.intent_profile_hash,
      algorithm_version: multi.algorithm_version,
    },
    provenance: {
      vector_hashes: { ...multi.vector_hashes },
    },
    summary,
    highlights,
    cautions,
    matrix_preview,
  };

  return report;
}

