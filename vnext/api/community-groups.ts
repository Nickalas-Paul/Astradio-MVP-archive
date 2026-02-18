/**
 * Group profile API: POST /api/community/groups/profile
 * Resolves chartIds via architecture-engine, aggregates via GroupProfile. No music/gates.
 * No synthetic snapshot: when chartIds provided, uses member artifacts (features + personality + guidance).
 */

import { generateArchitecture, type ChartInput } from '../core/architecture-engine';
import {
  computeGroupProfileFromVectors,
  computeGroupProfileFromMemberArtifacts,
  type GroupProfileOutput
} from '../community/group-profile';
import * as storage from '../compat/storage';
import type { Chart } from '../compat/types';

function chartToChartInput(chart: Chart): ChartInput {
  return { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
}

export interface GroupsProfileRequest {
  groupId: string;
  chartIds?: string[];
  featureVecs?: number[][];
  aggregationMode?: 'mean' | 'mean_normalized';
  seed?: string;
}

export async function createGroupProfile(request: GroupsProfileRequest): Promise<GroupProfileOutput> {
  const { groupId, chartIds, featureVecs, aggregationMode, seed } = request;

  if (featureVecs && featureVecs.length > 0) {
    const vectors = featureVecs.map((v) =>
      v.length >= 64 ? v.slice(0, 64) : [...v, ...new Array(64 - v.length).fill(0)]
    );
    return computeGroupProfileFromVectors({
      groupId,
      memberFeatureVecs: vectors,
      aggregationMode: aggregationMode || 'mean_normalized',
      seed
    });
  }

  if (chartIds && chartIds.length > 0) {
    const archResults = await Promise.all(
      chartIds.map((id) => {
        const chart = storage.getChart(id);
        if (!chart) throw new Error(`Chart not found: ${id}`);
        return generateArchitecture(chartToChartInput(chart), `group_${groupId}_${id}`);
      })
    );
    const members = archResults.map((a) => ({
      features: a.features,
      personality: a.personality,
      guidance: a.guidance
    }));
    return computeGroupProfileFromMemberArtifacts({
      groupId,
      members,
      aggregationMode: aggregationMode || 'mean_normalized',
      seed
    });
  }

  throw new Error('Either chartIds or featureVecs must be provided');
}
