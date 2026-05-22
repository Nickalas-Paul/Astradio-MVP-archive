/**
 * S3 Mode 2 — Community Feed expanded reading (group compose, two natals + relational weather):
 * pre vs post wiring for `pair_interaction_aspects` on `kind: 'group'` with two snapshots.
 *
 * Run: npm run fixture:synastry-s3-mode2-pre-post
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

function buildGroupSeed(chartIds: string[], vectorHashes: Record<string, string>, bindingKey: string): string {
  const sortedChartIds = [...chartIds].sort((a, b) => a.localeCompare(b, 'en'));
  const sortedHashes = sortedChartIds.map((id) => vectorHashes[id] || '').sort();
  const payload = `${GROUP_COMPOSE_ALGORITHM_VERSION}|${bindingKey}|${sortedChartIds.join(',')}|${sortedHashes.join(',')}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function crossHit(p: Omit<CrossAspectHitV1, never>): CrossAspectHitV1 {
  return { ...p };
}

/** Deterministic relational weather per fixture (transit context); identical for pre/post synastry toggle. */
export function mkPairWeather(
  chartIdsOrdered: string[],
  fixtureKey: string,
  transitDay: string
): RelationalWeatherStateV1 {
  const top: CrossAspectHitV1[] = [
    crossHit({
      transitBody: 'Sun',
      natalBody: 'Moon',
      memberChartId: chartIdsOrdered[0],
      type: 'trine',
      orbDeg: 1.2,
      exactness: 0.85,
      dynamics: 'flowing',
      weight: 7,
    }),
    crossHit({
      transitBody: 'Mercury',
      natalBody: 'Venus',
      memberChartId: chartIdsOrdered[1] ?? chartIdsOrdered[0],
      type: 'sextile',
      orbDeg: 0.9,
      exactness: 0.78,
      dynamics: 'supportive',
      weight: 5,
    }),
  ];
  return {
    version: 'relational_weather_v1',
    stateHash: `${fixtureKey}_rw_${transitDay.replace(/-/g, '')}`,
    connection: {
      kind: 'pair',
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
      feedCandidateAspects: top,
      counts: { supportive: 2, tense: 0, amplifying: 0, polarizing: 0, flowing: 1 },
    },
    themes: { dominantThemes: [`fixture_theme_${fixtureKey}`, 'coordination'] },
  };
}

function firstNAspectKeys(aspects: readonly SnapshotAspect[], n: number): string[] {
  return aspects.slice(0, n).map((a) => buildAspectKey(a.bodyA, a.bodyB, a.type));
}

export async function projectGroupFeedExpandedAsync(
  chartIdA: string,
  chartIdB: string,
  snapA: EphemerisSnapshot,
  snapB: EphemerisSnapshot,
  withSynastry: boolean,
  weather: RelationalWeatherStateV1
): Promise<{
  signaturesText: string;
  relationalFieldText: string;
  relationalWeatherText: string;
  first3Keys: string[];
  aspectKeysSource: 'synastry' | 'anchor_natal';
  synastry_context?: 'pair_comparison' | 'group_aggregate' | 'sandbox_override';
}> {
  const pairs = [
    { id: chartIdA, snap: snapA },
    { id: chartIdB, snap: snapB },
  ].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const chartIdsOrdered = pairs.map((p) => p.id);
  const snapshotsOrdered = pairs.map((p) => p.snap);

  const archs = await Promise.all(snapshotsOrdered.map((s) => generateArchitectureFromSnapshot(s)));
  const vecs = archs.map((a) => a.features as FeatureVec);
  const vectorHashes: Record<string, string> = {};
  for (let i = 0; i < pairs.length; i++) {
    vectorHashes[pairs[i].id] = hashVector64(vecs[i]);
  }
  const seed = buildGroupSeed(chartIdsOrdered, vectorHashes, 's3_mode2_fixture');
  const composite = aggregateFeatureVectors(vecs, 'mean_normalized') as FeatureVec;
  const payload = vectorToControlPayload(composite, seed);
  const architecture = buildArchitectureForAggregate(snapshotsOrdered[0], composite, payload.hash);

  const synEdges = computeSynastryAspects({ snapshotsOrdered, mode: 'pair' });

  const canonical = buildCanonicalReportForAggregate({
    kind: 'group',
    subject_ids: [payload.hash],
    participants: snapshotsOrdered.map((sn, i) => ({
      snapshot: sn,
      featureVec: vecs[i],
      role: (i === 0 ? 'primary' : 'member_i') as 'primary' | 'member_i',
    })),
    composite,
    anchorIndex: 0,
    control_surface_hash: payload.hash,
    compose_seed: payload.hash,
    guidance: architecture.guidance,
    relationalWeather: weather,
    ...(withSynastry ? { pair_interaction_aspects: synEdges } : {}),
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
    participantCount: 2,
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
    ...(insightOpts.synastry_context != null ? { synastry_context: insightOpts.synastry_context } : {}),
  };
}

export const MODE2_FIXTURES: Array<{
  name: string;
  chartIdA: string;
  chartIdB: string;
  transitDay: string;
  lonA: Record<string, number>;
  lonB: Record<string, number>;
}> = [
  {
    name: 'mode2_feed_expanded_1',
    chartIdA: 'feed_member_alpha',
    chartIdB: 'feed_member_omega',
    transitDay: '2026-04-01',
    lonA: {
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
    },
    lonB: {
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
    },
  },
  {
    name: 'mode2_feed_expanded_2',
    chartIdA: 'community_chart_a',
    chartIdB: 'community_chart_b',
    transitDay: '2026-04-02',
    lonA: {
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
    },
    lonB: {
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
    },
  },
  {
    name: 'mode2_feed_expanded_3',
    chartIdA: 'expanded_reader_x',
    chartIdB: 'expanded_reader_y',
    transitDay: '2026-04-03',
    lonA: {
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
    },
    lonB: {
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
    },
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
  const g = guidanceFromFeatures(fv, n, 'mode2-gate');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['mode2-single-chart'],
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
        signaturesText: post.signaturesText,
        relationalFieldText: post.relationalFieldText,
      },
    });
  }

  for (const fx of MODE2_FIXTURES) {
    const snapA = snapshotFromLongitudes(fx.lonA);
    const snapB = snapshotFromLongitudes(fx.lonB);
    const sortedIds = [fx.chartIdA, fx.chartIdB].sort((a, b) => a.localeCompare(b, 'en'));
    const weather = mkPairWeather(sortedIds, fx.name, fx.transitDay);
    const syn = computeSynastryAspects({
      snapshotsOrdered: [
        { id: fx.chartIdA, snap: snapA },
        { id: fx.chartIdB, snap: snapB },
      ]
        .sort((a, b) => a.id.localeCompare(b.id, 'en'))
        .map((p) => p.snap),
      mode: 'pair',
    });

    const pre = await projectGroupFeedExpandedAsync(
      fx.chartIdA,
      fx.chartIdB,
      snapA,
      snapB,
      false,
      weather
    );
    const post = await projectGroupFeedExpandedAsync(fx.chartIdA, fx.chartIdB, snapA, snapB, true, weather);

    fixtures.push({
      fixture: fx.name,
      chartIdsSorted: sortedIds,
      transitContext: { transitDay: fx.transitDay, weatherStateHash: weather.stateHash },
      synastryDirectedHitCount: syn.length,
      synastryFirst3Keys: firstNAspectKeys(syn, 3),
      preMode2: {
        aspectLibraryKeysFirst3: pre.first3Keys,
        aspectSource: pre.aspectKeysSource,
        synastry_context: pre.synastry_context ?? null,
        signaturesText: pre.signaturesText,
        relationalFieldText: pre.relationalFieldText,
        relationalWeatherText: pre.relationalWeatherText,
      },
      postMode2: {
        aspectLibraryKeysFirst3: post.first3Keys,
        aspectSource: post.aspectKeysSource,
        synastry_context: post.synastry_context ?? null,
        signaturesText: post.signaturesText,
        relationalFieldText: post.relationalFieldText,
        relationalWeatherText: post.relationalWeatherText,
      },
      diffFlags: {
        signaturesChanged: pre.signaturesText !== post.signaturesText,
        relationalFieldChanged: pre.relationalFieldText !== post.relationalFieldText,
        relationalWeatherChanged: pre.relationalWeatherText !== post.relationalWeatherText,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        singleChartProjectionRepeatedIdentical: singleChartDiffEmpty,
        mode1ComparisonPostSynastryControl: mode1Sanity,
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
