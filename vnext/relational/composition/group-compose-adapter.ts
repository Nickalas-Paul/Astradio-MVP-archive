/**
 * Phase 5 — Group composition adapter.
 * Mandatory natal snapshot refetch per member chart (deterministic chart_id order) +
 * vector aggregation from stored vectors + unified aggregate compose runner.
 */

import { composeAPI } from '../../api/compose';
import {
  resolveRelationalConnectionFromChartIds,
  GROUP_COMPOSE_ALGORITHM_VERSION,
} from '../resolve-relational-connection-context';
import type { RelationalWeatherStateV1 } from '../weather/types';

export { GROUP_COMPOSE_ALGORITHM_VERSION };

export interface GroupComposeProvenance {
  chart_ids: string[];
  vector_hashes: Record<string, string>;
  seed: string;
  algorithm_version: string;
}

export interface GroupComposeResult {
  provenance: GroupComposeProvenance;
  planHash: string;
  compositionId: string;
  audioBase64?: string;
  text?: unknown;
  /** Set when generateComposition=false — no runner, no Stage-4 artifact semantics */
  compose_skipped?: boolean;
}

export async function composeGroupFromChartIds(
  chartIdsInput: string[],
  opts?: { groupId?: string; generateComposition?: boolean; relationalWeather?: RelationalWeatherStateV1 }
): Promise<GroupComposeResult> {
  const ctx = await resolveRelationalConnectionFromChartIds(chartIdsInput, opts?.groupId);
  const { chartIdsOrdered: chart_ids, natalSnapshotsOrdered: snapshotsOrdered, composite, payload, provenance } = ctx;
  const { vector_hashes: vectorHashes, seed } = provenance;

  if (opts?.generateComposition === false) {
    return {
      provenance: {
        chart_ids,
        vector_hashes: vectorHashes,
        seed,
        algorithm_version: GROUP_COMPOSE_ALGORITHM_VERSION,
      },
      planHash: '',
      compositionId: '',
      compose_skipped: true,
    };
  }

  const anchorSnapshot = snapshotsOrdered[0];
  const result = await composeAPI.runAggregateComposition({
    kind: 'group',
    anchorSnapshot,
    snapshotsOrdered,
    composite: composite as import('../../contracts').FeatureVec,
    payload,
    relationalWeather: opts?.relationalWeather,
  });

  return {
    provenance: {
      chart_ids,
      vector_hashes: vectorHashes,
      seed,
      algorithm_version: GROUP_COMPOSE_ALGORITHM_VERSION,
    },
    planHash: result.planHash,
    compositionId: result.planHash,
    audioBase64: (result.audio as any)?.base64 || undefined,
    text: result.text,
  };
}
