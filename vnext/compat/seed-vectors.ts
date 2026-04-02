import * as storage from './storage';
import { populateChartVector, CHART_VECTOR_ENCODER_VERSION, CHART_VECTOR_VERSION } from './vector-cache';

// Path from compiled dist/vnext/vnext/compat/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../lib/vector-store');

type ChartVectorRow = {
  chartId: string;
  vector64: number[];
  version: string;
  encoderVersion: string;
  snapshotHash?: string;
};

export type SeedCandidateVectorStatus = 'present' | 'regenerated';

export interface SeedCandidateVectorResult {
  chartId: string;
  userId: string;
  displayName?: string;
  status: SeedCandidateVectorStatus;
  version: string;
  encoderVersion: string;
}

function isValidStoredVector(row: ChartVectorRow | undefined): row is ChartVectorRow {
  if (!row) return false;
  if (row.version !== CHART_VECTOR_VERSION) return false;
  if (row.encoderVersion !== CHART_VECTOR_ENCODER_VERSION) return false;
  if (!Array.isArray(row.vector64) || row.vector64.length !== 64) return false;
  return row.vector64.every((value) => typeof value === 'number' && Number.isFinite(value));
}

/**
 * Ensure every seeded compatibility candidate has a persisted canonical feature vector.
 * This is a boot/backfill operation only and must never be invoked from request-time ranking paths.
 */
export async function ensureSeedCandidateVectors(): Promise<SeedCandidateVectorResult[]> {
  if (!process.env.POSTGRES_URL) {
    return [];
  }

  const candidates = await storage.ensureMatchCandidateCharts();
  const results: SeedCandidateVectorResult[] = [];

  for (const candidate of candidates) {
    const existing = (await vectorStore.getChartVector(candidate.chartId)) as ChartVectorRow | undefined;
    let status: SeedCandidateVectorStatus = 'present';

    if (!isValidStoredVector(existing)) {
      await populateChartVector(candidate.chartId);
      status = 'regenerated';
    }

    const persisted = (await vectorStore.getChartVector(candidate.chartId)) as ChartVectorRow | undefined;
    if (!isValidStoredVector(persisted)) {
      throw new Error(`Candidate vector backfill failed for ${candidate.chartId}`);
    }

    results.push({
      chartId: candidate.chartId,
      userId: candidate.userId,
      displayName: candidate.displayName,
      status,
      version: persisted.version,
      encoderVersion: persisted.encoderVersion,
    });
  }

  return results;
}
