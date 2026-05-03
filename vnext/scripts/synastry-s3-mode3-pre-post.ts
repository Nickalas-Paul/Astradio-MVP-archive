/**
 * S3 Mode 3 — group aggregate (three or more natals): pre vs post wiring for
 * `pair_interaction_aspects` via `computeSynastryAspects({ mode: 'group_matrix' })`.
 *
 * Run: npm run fixture:synastry-s3-mode3-pre-post
 */

import * as crypto from 'crypto';

import { buildAspectKey } from '../projection/insight-library/insight-library-index';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { aggregateFeatureVectors } from '../community/group-profile';
import type { CrossAspectHitV1, RelationalWeatherStateV1 } from '../relational/weather/types';
import type { EphemerisSnapshot, FeatureVec, SnapshotAspect } from '../contracts';
import { buildCanonicalReportForAggregate } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { buildArchitectureForAggregate } from '../api/aggregate-architecture';
import { vectorToControlPayload } from '../relational/composition/vector-to-controls';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { GROUP_COMPOSE_ALGORITHM_VERSION } from '../relational/resolve-relational-connection-context';
import { hashVector64 } from '../relational/compatibility/score';
import {
  MODE1_COMPARISON_FIXTURES,
  projectComparisonAsync,
  snapshotFromLongitudes,
} from './synastry-fixture-pre-post';
import {
  MODE2_FIXTURES,
  mkPairWeather,
  projectGroupFeedExpandedAsync,
} from './synastry-s3-mode2-pre-post';

function buildGroupSeed(chartIds: string[], vectorHashes: Record<string, string>, bindingKey: string): string {
  const sortedChartIds = [...chartIds].sort((a, b) => a.localeCompare(b, 'en'));
  const sortedHashes = sortedChartIds.map((id) => vectorHashes[id] || '').sort();
  const payload = `${GROUP_COMPOSE_ALGORITHM_VERSION}|${bindingKey}|${sortedChartIds.join(',')}|${sortedHashes.join(',')}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function crossHit(p: Omit<CrossAspectHitV1, never>): CrossAspectHitV1 {
  return { ...p };
}

/** Relational weather for multi-chart groups (`connection.kind: 'group'`). */
export function mkGroupWeather(
  chartIdsOrdered: string[],
  fixtureKey: string,
  transitDay: string
): RelationalWeatherStateV1 {
  const top: CrossAspectHitV1[] = chartIdsOrdered.slice(0, Math.min(3, chartIdsOrdered.length)).map((memberChartId, i) =>
    crossHit({
      transitBody: ['Sun', 'Mercury', 'Venus'][i]!,
      natalBody: ['Moon', 'Venus', 'Mars'][i]!,
      memberChartId,
      type: i === 0 ? 'trine' : 'sextile',
      orbDeg: 1.0 + i * 0.15,
      exactness: 0.83 - i * 0.03,
      dynamics: 'flowing',
      weight: 7 - i,
    })
  );
  return {
    version: 'relational_weather_v1',
    stateHash: `${fixtureKey}_rw_${transitDay.replace(/-/g, '')}`,
    connection: {
      kind: 'group',
      bindingId: `binding_${fixtureKey}`,
      chartIdsOrdered,
    },
    transit: {
      ts: `${transitDay}T12:00:00Z`,
      tz: 'UTC',
      lat: 40.7,
      lon: -74.0,
      houseSystem: 'placidus',
    },
    activation: {
      harmony: 0.35,
      friction: 0.22,
      intensity: 0.48,
      emotional_activation: 0.31,
      communication_emphasis: 0.44,
      volatility: 0.18,
      growth_pressure: 0.27,
    },
    score: { raw: 0.42, significance: 0.51 },
    aspects: {
      topCrossAspects: top,
      counts: { supportive: 2, tense: 0, amplifying: 0, polarizing: 0, flowing: 1 },
    },
    themes: { dominantThemes: [`fixture_theme_${fixtureKey}`, 'coordination'] },
  };
}

function firstNAspectKeys(aspects: readonly SnapshotAspect[], n: number): string[] {
  return aspects.slice(0, n).map((a) => buildAspectKey(a.bodyA, a.bodyB, a.type));
}

type GroupMember = { id: string; lon: Record<string, number> };

export async function projectGroupMatrixAsync(
  members: GroupMember[],
  withSynastry: boolean,
  weather: RelationalWeatherStateV1
): Promise<{
  signaturesText: string;
  relationalFieldText: string;
  relationalWeatherText: string;
  first3Keys: string[];
  aspectKeysSource: 'synastry' | 'anchor_natal';
  synastry_context?: 'pair_comparison' | 'group_aggregate' | 'sandbox_override';
  totalSynastryHits: number;
}> {
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const chartIdsOrdered = sorted.map((m) => m.id);
  const snapshotsOrdered = sorted.map((m) => snapshotFromLongitudes(m.lon));

  const archs = await Promise.all(snapshotsOrdered.map((s) => generateArchitectureFromSnapshot(s)));
  const vecs = archs.map((a) => a.features as FeatureVec);
  const vectorHashes: Record<string, string> = {};
  for (let i = 0; i < sorted.length; i++) {
    vectorHashes[sorted[i]!.id] = hashVector64(vecs[i]!);
  }
  const seed = buildGroupSeed(chartIdsOrdered, vectorHashes, 's3_mode3_fixture');
  const composite = aggregateFeatureVectors(vecs, 'mean_normalized') as FeatureVec;
  const payload = vectorToControlPayload(composite, seed);
  const architecture = buildArchitectureForAggregate(snapshotsOrdered[0]!, composite, payload.hash);

  const synEdges = withSynastry
    ? computeSynastryAspects({ snapshotsOrdered, mode: 'group_matrix' })
    : undefined;

  const canonical = buildCanonicalReportForAggregate({
    kind: 'group',
    subject_ids: [payload.hash],
    participants: snapshotsOrdered.map((sn, i) => ({
      snapshot: sn,
      featureVec: vecs[i]!,
      role: (i === 0 ? 'primary' : 'member_i') as 'primary' | 'member_i',
    })),
    composite,
    anchorIndex: 0,
    control_surface_hash: payload.hash,
    compose_seed: payload.hash,
    guidance: architecture.guidance,
    relationalWeather: weather,
    ...(withSynastry && synEdges != null ? { pair_interaction_aspects: synEdges } : {}),
  });

  const core = interpretCanonicalReportObject(canonical);
  const insightOpts = insightProjectionOptionsFromCanonical(canonical);
  const anchorAspects =
    canonical.participants[canonical.anchor_slot_index ?? 0]?.natal_snapshot?.aspects ?? [];

  let aspectKeysSource: 'synastry' | 'anchor_natal';
  let first3Keys: string[];
  if (
    withSynastry &&
    (canonical.pair_interaction_aspects?.length ?? 0) > 0 &&
    insightOpts.pairInteractionAspects != null &&
    insightOpts.pairInteractionAspects.length > 0
  ) {
    aspectKeysSource = 'synastry';
    first3Keys = firstNAspectKeys(canonical.pair_interaction_aspects!, 3);
  } else {
    aspectKeysSource = 'anchor_natal';
    first3Keys = firstNAspectKeys(anchorAspects, 3);
  }

  const sections = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'group',
    tier: 'baseline',
    narrativePlan: null,
    aggregateKind: 'group',
    connectionMode: 'group',
    participantCount: snapshotsOrdered.length,
    aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
    ...insightOpts,
  });

  const sig = sections.find((s) => s.id === 'signatures');
  const rel = sections.find((s) => s.id === 'relational_field');
  const rw = sections.find((s) => s.id === 'relational_weather_v1');
  return {
    signaturesText: sig?.text ?? '',
    relationalFieldText: rel?.text ?? '',
    relationalWeatherText: rw?.text ?? '',
    first3Keys,
    aspectKeysSource,
    synastry_context: insightOpts.synastry_context,
    totalSynastryHits: canonical.pair_interaction_aspects?.length ?? 0,
  };
}

/** Longitudes copied from `MODE1_COMPARISON_FIXTURES` for materially distinct natals. */
const LON_FIX1_A: Record<string, number> = {
  sun: 0,
  moon: 120,
  mercury: 50,
  venus: 51,
  mars: 95,
  jupiter: 140,
  saturn: 175,
  uranus: 220,
  neptune: 260,
  pluto: 310,
};
const LON_FIX1_B: Record<string, number> = {
  sun: 14,
  moon: 0.5,
  mercury: 180,
  venus: 200,
  mars: 15,
  jupiter: 45,
  saturn: 300,
  uranus: 100,
  neptune: 140,
  pluto: 280,
};
const LON_FIX2_A: Record<string, number> = {
  sun: 100,
  moon: 115,
  mercury: 105,
  venus: 108,
  mars: 190,
  jupiter: 250,
  saturn: 265,
  uranus: 270,
  neptune: 275,
  pluto: 280,
};
const LON_FIX2_B: Record<string, number> = {
  sun: 280,
  moon: 100,
  mercury: 200,
  venus: 205,
  mars: 102,
  jupiter: 50,
  saturn: 60,
  uranus: 70,
  neptune: 80,
  pluto: 90,
};
const LON_FIX3_A: Record<string, number> = {
  sun: 45,
  moon: 78,
  mercury: 52,
  venus: 48,
  mars: 90,
  jupiter: 92,
  saturn: 275,
  uranus: 12,
  neptune: 333,
  pluto: 198,
};
const LON_FIX3_B: Record<string, number> = {
  sun: 225,
  moon: 310,
  mercury: 240,
  venus: 235,
  mars: 88,
  jupiter: 180,
  saturn: 185,
  uranus: 190,
  neptune: 195,
  pluto: 200,
};

const MODE3_GROUP_CASES: Array<{
  name: string;
  transitDay: string;
  members: GroupMember[];
}> = [
  {
    name: 'mode3_group_three_charts',
    transitDay: '2026-05-01',
    members: [
      { id: 'mode3_g3_a', lon: LON_FIX1_A },
      { id: 'mode3_g3_b', lon: LON_FIX1_B },
      { id: 'mode3_g3_c', lon: LON_FIX2_A },
    ],
  },
  {
    name: 'mode3_group_four_charts',
    transitDay: '2026-05-02',
    members: [
      { id: 'mode3_g4_a', lon: LON_FIX1_A },
      { id: 'mode3_g4_b', lon: LON_FIX1_B },
      { id: 'mode3_g4_c', lon: LON_FIX2_A },
      { id: 'mode3_g4_d', lon: LON_FIX2_B },
    ],
  },
  {
    name: 'mode3_group_six_charts',
    transitDay: '2026-05-03',
    members: [
      { id: 'mode3_g6_01', lon: LON_FIX1_A },
      { id: 'mode3_g6_02', lon: LON_FIX1_B },
      { id: 'mode3_g6_03', lon: LON_FIX2_A },
      { id: 'mode3_g6_04', lon: LON_FIX2_B },
      { id: 'mode3_g6_05', lon: LON_FIX3_A },
      { id: 'mode3_g6_06', lon: LON_FIX3_B },
    ],
  },
];

function singleChartProjectionJson(): unknown {
  const n: EphemerisSnapshot = {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'mode3-gate');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['mode3-single-chart'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  return projectTextFromSemanticCore(core, 'det-seed', {
    phaseD: true,
    surface: 'profile',
    tier: 'baseline',
    narrativePlan: null,
    ...insightProjectionOptionsFromCanonical(canonical),
  });
}

async function main(): Promise<void> {
  const fixtures: Record<string, unknown>[] = [];

  const singleA = singleChartProjectionJson();
  const singleB = singleChartProjectionJson();
  const singleChartDiffEmpty = JSON.stringify(singleA) === JSON.stringify(singleB);

  const mode1Sanity: Record<string, unknown>[] = [];
  for (const fx of MODE1_COMPARISON_FIXTURES) {
    const snapA = snapshotFromLongitudes(fx.lonA);
    const snapB = snapshotFromLongitudes(fx.lonB);
    const post = await projectComparisonAsync(fx.chartIdA, fx.chartIdB, snapA, snapB, true);
    mode1Sanity.push({
      fixture: fx.name,
      postSynastry: {
        aspectLibraryKeysFirst3: post.first3Keys,
        aspectSource: post.aspectKeysSource,
        synastry_context: post.synastry_context ?? null,
        signaturesText: post.signaturesText,
        relationalFieldText: post.relationalFieldText,
      },
    });
  }

  const mode2Fx = MODE2_FIXTURES[0]!;
  const snap2A = snapshotFromLongitudes(mode2Fx.lonA);
  const snap2B = snapshotFromLongitudes(mode2Fx.lonB);
  const sortedMode2Ids = [mode2Fx.chartIdA, mode2Fx.chartIdB].sort((a, b) => a.localeCompare(b, 'en'));
  const mode2Weather = mkPairWeather(sortedMode2Ids, mode2Fx.name, mode2Fx.transitDay);
  const mode2Post = await projectGroupFeedExpandedAsync(
    mode2Fx.chartIdA,
    mode2Fx.chartIdB,
    snap2A,
    snap2B,
    true,
    mode2Weather
  );

  for (const fx of MODE3_GROUP_CASES) {
    const chartIdsSorted = fx.members.map((m) => m.id).sort((a, b) => a.localeCompare(b, 'en'));
    const weather = mkGroupWeather(chartIdsSorted, fx.name, fx.transitDay);
    const sortedSnaps = [...fx.members]
      .sort((a, b) => a.id.localeCompare(b.id, 'en'))
      .map((m) => snapshotFromLongitudes(m.lon));
    const synMatrix = computeSynastryAspects({ snapshotsOrdered: sortedSnaps, mode: 'group_matrix' });

    const pre = await projectGroupMatrixAsync(fx.members, false, weather);
    const post = await projectGroupMatrixAsync(fx.members, true, weather);

    fixtures.push({
      fixture: fx.name,
      chartIdsSorted,
      transitContext: { transitDay: fx.transitDay, weatherStateHash: weather.stateHash },
      synastryMatrixHitCount: synMatrix.length,
      synastryMatrixFirst3Keys: firstNAspectKeys(synMatrix, 3),
      preMode3: {
        aspectLibraryKeysFirst3: pre.first3Keys,
        aspectSource: pre.aspectKeysSource,
        synastry_context: pre.synastry_context ?? null,
        totalSynastryHitsInCanonical: pre.totalSynastryHits,
        signaturesText: pre.signaturesText,
        relationalFieldText: pre.relationalFieldText,
        relationalWeatherText: pre.relationalWeatherText,
      },
      postMode3: {
        aspectLibraryKeysFirst3: post.first3Keys,
        aspectSource: post.aspectKeysSource,
        synastry_context: post.synastry_context ?? null,
        totalSynastryHitsInCanonical: post.totalSynastryHits,
        signaturesText: post.signaturesText,
        relationalFieldText: post.relationalFieldText,
        relationalWeatherText: post.relationalWeatherText,
      },
      diffFlags: {
        signaturesChanged: pre.signaturesText !== post.signaturesText,
        relationalFieldChanged: pre.relationalFieldText !== post.relationalFieldText,
        relationalWeatherChanged: pre.relationalWeatherText !== post.relationalWeatherText,
      },
      capBindingNote: post.totalSynastryHits <= 32 ? 'at_or_below_cap_32' : 'EXCEEDS_CAP',
    });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        singleChartProjectionRepeatedIdentical: singleChartDiffEmpty,
        mode1ComparisonPostSynastryControl: mode1Sanity,
        mode2GroupTwoChartsPostSynastryControl: {
          fixture: mode2Fx.name,
          chartIdsSorted: sortedMode2Ids,
          postSynastry: {
            aspectLibraryKeysFirst3: mode2Post.first3Keys,
            aspectSource: mode2Post.aspectKeysSource,
            synastry_context: mode2Post.synastry_context ?? null,
            signaturesText: mode2Post.signaturesText,
            relationalFieldText: mode2Post.relationalFieldText,
            relationalWeatherText: mode2Post.relationalWeatherText,
          },
        },
        fixtures,
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
