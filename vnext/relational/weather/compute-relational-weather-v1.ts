/**
 * Stage 7 v1 — Pure relational weather orchestration (no I/O).
 */

import type { EphemerisSnapshot } from '../../contracts';
import type { RelationalWeatherStateV1, CrossAspectHitV1 } from './types';
import { RW_V1_BUCKET_CAP } from './constants-v1';
import { computeCrossAspectsForMember, type CrossAspectHitInternal } from './cross-aspects-v1';
import { sumBucketsForHits, normalizeMemberBuckets } from './bucket-mapping-v1';
import { foldMeanMemberBuckets } from './fold-mean-v1';
import { computeRawScore, computeSignificance } from './scoring-v1';
import { deriveDominantThemesV1 } from './themes-v1';
import { computeRelationalWeatherStateHashV1 } from './state-hash-v1';

function sortTopCrossAspects(hits: CrossAspectHitInternal[], limit: number): CrossAspectHitV1[] {
  const sorted = [...hits].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const c1 = a.transitBody.localeCompare(b.transitBody, 'en');
    if (c1 !== 0) return c1;
    const c2 = a.natalBody.localeCompare(b.natalBody, 'en');
    if (c2 !== 0) return c2;
    return a.memberChartId.localeCompare(b.memberChartId, 'en');
  });
  return sorted.slice(0, limit).map((h) => ({
    transitBody: h.transitBody,
    natalBody: h.natalBody,
    memberChartId: h.memberChartId,
    type: h.type,
    orbDeg: h.orbDeg,
    exactness: h.exactness,
    dynamics: h.dynamics,
    weight: h.weight,
  }));
}

function countDynamics(hits: CrossAspectHitInternal[]): RelationalWeatherStateV1['aspects']['counts'] {
  let supportive = 0;
  let flowing = 0;
  let tense = 0;
  let polarizing = 0;
  let amplifying = 0;
  for (const h of hits) {
    if (h.dynamics === 'supportive') supportive++;
    else if (h.dynamics === 'flowing') flowing++;
    else if (h.dynamics === 'tense') tense++;
    else if (h.dynamics === 'polarizing') polarizing++;
    else if (h.dynamics === 'amplifying') amplifying++;
  }
  return { supportive, tense, amplifying, polarizing, flowing };
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export function computeRelationalWeatherV1(input: {
  connection: RelationalWeatherStateV1['connection'];
  transit: EphemerisSnapshot;
  memberSnapshotsOrdered: EphemerisSnapshot[];
  vectorHashes: Record<string, string>;
}): RelationalWeatherStateV1 {
  const { connection, transit, memberSnapshotsOrdered, vectorHashes } = input;

  const hitsByMember: CrossAspectHitInternal[][] = [];
  const allHits: CrossAspectHitInternal[] = [];

  for (let i = 0; i < memberSnapshotsOrdered.length; i++) {
    const chartId = connection.chartIdsOrdered[i];
    const natal = memberSnapshotsOrdered[i];
    const hits = computeCrossAspectsForMember(transit, natal, chartId);
    hitsByMember.push(hits);
    allHits.push(...hits);
  }

  const normalizedMembers = hitsByMember.map((hits) =>
    normalizeMemberBuckets(sumBucketsForHits(hits), RW_V1_BUCKET_CAP)
  );
  const activationRaw = foldMeanMemberBuckets(normalizedMembers);
  const activation = {
    harmony: round6(activationRaw.harmony),
    friction: round6(activationRaw.friction),
    intensity: round6(activationRaw.intensity),
    emotional_activation: round6(activationRaw.emotional_activation),
    communication_emphasis: round6(activationRaw.communication_emphasis),
    volatility: round6(activationRaw.volatility),
    growth_pressure: round6(activationRaw.growth_pressure),
  };

  const raw = round6(computeRawScore(activationRaw));
  const significance = computeSignificance(raw, hitsByMember);

  const stateHash = computeRelationalWeatherStateHashV1({
    version: 'relational_weather_v1',
    chartIdsOrdered: connection.chartIdsOrdered,
    vectorHashes,
    transit,
  });

  return {
    version: 'relational_weather_v1',
    stateHash,
    connection,
    transit: {
      ts: transit.ts,
      tz: transit.tz,
      lat: transit.lat,
      lon: transit.lon,
      houseSystem: transit.houseSystem,
    },
    activation,
    score: { raw, significance },
    aspects: {
      topCrossAspects: sortTopCrossAspects(allHits, 14),
      feedCandidateAspects: sortTopCrossAspects(allHits, 50),
      counts: countDynamics(allHits),
    },
    themes: {
      dominantThemes: deriveDominantThemesV1(activationRaw, allHits),
    },
  };
}
