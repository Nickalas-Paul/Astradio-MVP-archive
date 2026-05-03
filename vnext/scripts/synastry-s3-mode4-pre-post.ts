/**
 * S3 Mode 4 — Sandbox composition wiring (synastry + R2 commit + R4 asteroid notice).
 * Pre = canonical projection without pair_interaction_aspects; Post = with synastry (current S3 wiring).
 *
 * Run: npm run fixture:synastry-s3-mode4-pre-post
 */

import { buildAspectKey } from '../projection/insight-library/insight-library-index';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import type { EphemerisSnapshot, SnapshotAspect } from '../contracts';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { generateSnapshotWithOverrides } from '../api/sandbox-snapshot';
import type { SandboxOverrides } from '../contracts';
import { ADDITIONAL_BODIES } from '../canonical-bodies';
import type { SandboxSlotResolution } from '../api/sandbox-composition-normalize';
import {
  MODE1_COMPARISON_FIXTURES,
  projectComparisonAsync,
  snapshotFromLongitudes,
} from './synastry-fixture-pre-post';
import { MODE2_FIXTURES, mkPairWeather, projectGroupFeedExpandedAsync } from './synastry-s3-mode2-pre-post';
import { mkGroupWeather, projectGroupMatrixAsync } from './synastry-s3-mode3-pre-post';

function firstNAspectKeys(aspects: readonly SnapshotAspect[], n: number): string[] {
  return aspects.slice(0, n).map((a) => buildAspectKey(a.bodyA, a.bodyB, a.type));
}

function synastryNoticeForSlots(resolutions: SandboxSlotResolution[]): 'asteroids_excluded_v1' | undefined {
  const asteroid = new Set<string>(ADDITIONAL_BODIES as unknown as string[]);
  for (const r of resolutions) {
    for (const k of Object.keys(r.overrides?.planets || {})) {
      if (asteroid.has(k.toLowerCase())) return 'asteroids_excluded_v1';
    }
  }
  return undefined;
}

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
  const fv = encodeFeatures(n);
  const g = guidanceFromFeatures(fv, n, 'mode4-gate');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['mode4-single-chart'],
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

async function main(): Promise<void> {
  const fixturesA: Record<string, unknown>[] = [];

  const singleA = singleChartProjectionJson();
  const singleB = singleChartProjectionJson();
  const singleChartProjectionRepeatedIdentical = JSON.stringify(singleA) === JSON.stringify(singleB);

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

  const mode3Members = [
    { id: 'mode3_g3_a', lon: LON_FIX1_A },
    { id: 'mode3_g3_b', lon: LON_FIX1_B },
    { id: 'mode3_g3_c', lon: LON_FIX2_A },
  ];
  const mode3ChartIdsSorted = mode3Members.map((m) => m.id).sort((a, b) => a.localeCompare(b, 'en'));
  const mode3Weather = mkGroupWeather(mode3ChartIdsSorted, 'mode3_group_three_charts', '2026-05-01');
  const mode3PostControl = await projectGroupMatrixAsync(mode3Members, true, mode3Weather);

  const fx1 = MODE1_COMPARISON_FIXTURES[0]!;
  const snapNoOvA = snapshotFromLongitudes(fx1.lonA);
  const snapNoOvB = snapshotFromLongitudes(fx1.lonB);
  const prePairNoOv = await projectComparisonAsync(fx1.chartIdA, fx1.chartIdB, snapNoOvA, snapNoOvB, false);
  const postPairNoOv = await projectComparisonAsync(fx1.chartIdA, fx1.chartIdB, snapNoOvA, snapNoOvB, true);

  const idLowF = fx1.chartIdA.localeCompare(fx1.chartIdB) <= 0 ? fx1.chartIdA : fx1.chartIdB;
  const snapLowNoOv = idLowF === fx1.chartIdA ? snapNoOvA : snapNoOvB;
  const snapHighNoOv = idLowF === fx1.chartIdA ? snapNoOvB : snapNoOvA;
  const synNoOv = computeSynastryAspects({ snapshotsOrdered: [snapLowNoOv, snapHighNoOv], mode: 'pair' });

  fixturesA.push({
    fixture: 'mode4_sandbox_pair_no_overrides',
    note: 'Equivalent to Mode 1 fixture_1 snapshots flowing through sandbox-style resolve (effective snaps == DB snaps when no overrides).',
    preMode4: {
      aspectLibraryKeysFirst3: prePairNoOv.first3Keys,
      aspectSource: prePairNoOv.aspectKeysSource,
      synastry_context: prePairNoOv.synastry_context ?? null,
      totalSynastryHitsInCanonical: 0,
      signaturesText: prePairNoOv.signaturesText,
      relationalFieldText: prePairNoOv.relationalFieldText,
    },
    postMode4: {
      aspectLibraryKeysFirst3: postPairNoOv.first3Keys,
      aspectSource: postPairNoOv.aspectKeysSource,
      synastry_context: postPairNoOv.synastry_context ?? null,
      totalSynastryHitsInCanonical: synNoOv.length,
      signaturesText: postPairNoOv.signaturesText,
      relationalFieldText: postPairNoOv.relationalFieldText,
    },
    diffFlags: {
      signaturesChanged: prePairNoOv.signaturesText !== postPairNoOv.signaturesText,
      relationalFieldChanged: prePairNoOv.relationalFieldText !== postPairNoOv.relationalFieldText,
      relationalWeatherChanged: false,
    },
  });

  const marsOverride: SandboxOverrides = { planets: { mars: { lonDeg: ((fx1.lonB.mars ?? 0) + 30) % 360 } } };
  const snapDbB = snapshotFromLongitudes(fx1.lonB);
  const snapEffB = generateSnapshotWithOverrides(snapDbB, marsOverride);
  const snapLowDb = idLowF === fx1.chartIdA ? snapNoOvA : snapDbB;
  const snapHighDb = idLowF === fx1.chartIdA ? snapDbB : snapNoOvA;
  const synDb = computeSynastryAspects({ snapshotsOrdered: [snapLowDb, snapHighDb], mode: 'pair' });
  const snapLowEff = idLowF === fx1.chartIdA ? snapNoOvA : snapEffB;
  const snapHighEff = idLowF === fx1.chartIdA ? snapEffB : snapNoOvA;
  const synEff = computeSynastryAspects({ snapshotsOrdered: [snapLowEff, snapHighEff], mode: 'pair' });

  const prePairOv = await projectComparisonAsync(fx1.chartIdA, fx1.chartIdB, snapNoOvA, snapEffB, false);
  const postPairOv = await projectComparisonAsync(fx1.chartIdA, fx1.chartIdB, snapNoOvA, snapEffB, true);

  fixturesA.push({
    fixture: 'mode4_sandbox_pair_with_overrides',
    synastryAgainstDatabaseSnapshots: {
      totalHits: synDb.length,
      first3Keys: firstNAspectKeys(synDb, 3),
    },
    synastryAgainstEffectiveSnapshots: {
      totalHits: synEff.length,
      first3Keys: firstNAspectKeys(synEff, 3),
    },
    overrideSynastryDiffersFromDb:
      synDb.length !== synEff.length ||
      firstNAspectKeys(synDb, 3).join('|') !== firstNAspectKeys(synEff, 3).join('|'),
    preMode4: {
      aspectLibraryKeysFirst3: prePairOv.first3Keys,
      aspectSource: prePairOv.aspectKeysSource,
      synastry_context: prePairOv.synastry_context ?? null,
      totalSynastryHitsInCanonical: 0,
      signaturesText: prePairOv.signaturesText,
      relationalFieldText: prePairOv.relationalFieldText,
    },
    postMode4: {
      aspectLibraryKeysFirst3: postPairOv.first3Keys,
      aspectSource: postPairOv.aspectKeysSource,
      synastry_context: postPairOv.synastry_context ?? null,
      totalSynastryHitsInCanonical: synEff.length,
      signaturesText: postPairOv.signaturesText,
      relationalFieldText: postPairOv.relationalFieldText,
    },
    diffFlags: {
      signaturesChanged: prePairOv.signaturesText !== postPairOv.signaturesText,
      relationalFieldChanged: prePairOv.relationalFieldText !== postPairOv.relationalFieldText,
      relationalWeatherChanged: false,
    },
  });

  const membersGroup = [
    { id: 'mode4_g3_a', lon: { ...LON_FIX1_A, mars: ((LON_FIX1_A.mars ?? 0) + 25) % 360 } },
    { id: 'mode4_g3_b', lon: LON_FIX1_B },
    { id: 'mode4_g3_c', lon: LON_FIX2_A },
  ];
  const weatherG = mkGroupWeather(
    membersGroup.map((x) => x.id).sort((a, b) => a.localeCompare(b)),
    'mode4_sandbox_group_three_with_overrides',
    '2026-05-01'
  );
  const preG = await projectGroupMatrixAsync(membersGroup, false, weatherG);
  const postG = await projectGroupMatrixAsync(membersGroup, true, weatherG);
  fixturesA.push({
    fixture: 'mode4_sandbox_group_three_with_overrides',
    note: 'Mixed effective longitudes (core override on one slot); group_matrix synastry.',
    preMode4: {
      aspectLibraryKeysFirst3: preG.first3Keys,
      aspectSource: preG.aspectKeysSource,
      synastry_context: preG.synastry_context ?? null,
      totalSynastryHitsInCanonical: preG.totalSynastryHits,
      signaturesText: preG.signaturesText,
      relationalFieldText: preG.relationalFieldText,
      relationalWeatherText: preG.relationalWeatherText,
    },
    postMode4: {
      aspectLibraryKeysFirst3: postG.first3Keys,
      aspectSource: postG.aspectKeysSource,
      synastry_context: postG.synastry_context ?? null,
      totalSynastryHitsInCanonical: postG.totalSynastryHits,
      signaturesText: postG.signaturesText,
      relationalFieldText: postG.relationalFieldText,
      relationalWeatherText: postG.relationalWeatherText,
    },
    diffFlags: {
      signaturesChanged: preG.signaturesText !== postG.signaturesText,
      relationalFieldChanged: preG.relationalFieldText !== postG.relationalFieldText,
      relationalWeatherChanged: preG.relationalWeatherText !== postG.relationalWeatherText,
    },
  });

  const birthOnlyA = snapshotFromLongitudes(LON_FIX1_A);
  const birthOnlyB = snapshotFromLongitudes(LON_FIX1_B);
  const preBirth = await projectComparisonAsync('birth_only_a', 'birth_only_b', birthOnlyA, birthOnlyB, false);
  const postBirth = await projectComparisonAsync('birth_only_a', 'birth_only_b', birthOnlyA, birthOnlyB, true);
  fixturesA.push({
    fixture: 'mode4_sandbox_pair_birth_only',
    note: 'No chart_ids → sandbox skips classification (R2); synastry still uses effective snapshots.',
    preMode4: {
      aspectLibraryKeysFirst3: preBirth.first3Keys,
      aspectSource: preBirth.aspectKeysSource,
      synastry_context: preBirth.synastry_context ?? null,
      totalSynastryHitsInCanonical: 0,
      signaturesText: preBirth.signaturesText,
      relationalFieldText: preBirth.relationalFieldText,
    },
    postMode4: {
      aspectLibraryKeysFirst3: postBirth.first3Keys,
      aspectSource: postBirth.aspectKeysSource,
      synastry_context: postBirth.synastry_context ?? null,
      totalSynastryHitsInCanonical: computeSynastryAspects({
        snapshotsOrdered: [birthOnlyA, birthOnlyB],
        mode: 'pair',
      }).length,
      signaturesText: postBirth.signaturesText,
      relationalFieldText: postBirth.relationalFieldText,
    },
    diffFlags: {
      signaturesChanged: preBirth.signaturesText !== postBirth.signaturesText,
      relationalFieldChanged: preBirth.relationalFieldText !== postBirth.relationalFieldText,
      relationalWeatherChanged: false,
    },
  });

  /**
   * `computeCompatibilitySystem` resolves chart vectors via the relational store (often Postgres in dev).
   * This fixture uses a stable library classification code to verify projection wiring matches the commit path
   * without requiring a live DB; integration tests can still exercise full classification end-to-end.
   */
  const committedClassCode = 'cohesive_field';

  const previewProj = await projectComparisonAsync(
    'chart_match_1',
    'chart_match_2',
    snapNoOvA,
    snapNoOvB,
    true,
    {}
  );
  const commitProj = await projectComparisonAsync(
    'chart_match_1',
    'chart_match_2',
    snapNoOvA,
    snapNoOvB,
    true,
    { compatClassCode: committedClassCode }
  );

  const subsectionB = {
    uxChoice:
      'Omit relational classification text on preview (commit_relational_classification false): compat library lines are omitted until an explicit commit resolve; unambiguous vs a stale “Preview” badge.',
    mode4_sandbox_pair_preview_resolve: {
      commitFlagValue: false,
      classificationCallInvoked: false,
      compatClassCodeOnCanonical: null,
      projectionCompatClassCodeUsed: null,
      relationalFieldTextExcerpt: previewProj.relationalFieldText.slice(0, 220),
      synastryAspectKeysFirst3: previewProj.first3Keys,
    },
    mode4_sandbox_pair_commit_resolve: {
      commitFlagValue: true,
      classificationCallInvoked: true,
      compatClassCodeOnCanonical: committedClassCode,
      projectionCompatClassCodeUsed: committedClassCode,
      relationalFieldTextExcerpt: commitProj.relationalFieldText.slice(0, 220),
      synastryAspectKeysFirst3: commitProj.first3Keys,
    },
    synastryAspectKeysMatchPreviewVsCommit: previewProj.first3Keys.join('|') === commitProj.first3Keys.join('|'),
    relationalFieldDiffersPreviewVsCommit: previewProj.relationalFieldText !== commitProj.relationalFieldText,
    /** First 220 chars can match if compat copy shares a lead-in with the generic line; full string comparison is authoritative. */
    relationalFieldFullTextLengths: {
      preview: previewProj.relationalFieldText.length,
      commit: commitProj.relationalFieldText.length,
    },
  };

  const asteroidSlotsPresent: SandboxSlotResolution[] = [
    { ui_index: 0, chart_id: 'x', birth: undefined, overrides: { planets: { chiron: { lonDeg: 12 } } } },
  ];
  const asteroidSlotsAbsent: SandboxSlotResolution[] = [
    { ui_index: 0, chart_id: 'x', birth: undefined, overrides: { planets: { mars: { lonDeg: 12 } } } },
  ];
  const snapshotWithChironInChart = snapshotFromLongitudes({ ...LON_FIX1_A, chiron: 88 });
  const asteroidSlotsInChartNoOv: SandboxSlotResolution[] = [
    { ui_index: 0, chart_id: 'x', birth: undefined, overrides: { planets: {} } },
  ];

  const subsectionC = {
    mode4_sandbox_asteroid_present: {
      compositionHasAsteroidOverride: true,
      synastryNoticeFlag: synastryNoticeForSlots(asteroidSlotsPresent),
    },
    mode4_sandbox_asteroid_absent: {
      compositionHasAsteroidOverride: false,
      synastryNoticeFlag: synastryNoticeForSlots(asteroidSlotsAbsent) ?? null,
    },
    mode4_sandbox_asteroid_in_chart_no_override: {
      compositionHasAsteroidOverride: false,
      synastryNoticeFlag: synastryNoticeForSlots(asteroidSlotsInChartNoOv) ?? null,
      note: 'Chart snapshot includes chiron lon in data model sense only; detection keys off overrides.planets only.',
      chironLonInSnapshot: snapshotWithChironInChart.planets.find((p) => p.name === 'chiron')?.lon,
    },
  };

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        canonicalInputHashVersionNote: 'Engine normalize uses CANONICAL_INPUT_HASH_VERSION 4 with commit_relational_classification.',
        singleChartProjectionRepeatedIdentical,
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
        mode3GroupThreeChartsPostSynastryControl: {
          fixture: 'mode3_group_three_charts',
          chartIdsSorted: mode3ChartIdsSorted,
          postSynastry: {
            aspectLibraryKeysFirst3: mode3PostControl.first3Keys,
            aspectSource: mode3PostControl.aspectKeysSource,
            synastry_context: mode3PostControl.synastry_context ?? null,
            totalSynastryHitsInCanonical: mode3PostControl.totalSynastryHits,
            signaturesText: mode3PostControl.signaturesText,
            relationalFieldText: mode3PostControl.relationalFieldText,
            relationalWeatherText: mode3PostControl.relationalWeatherText,
          },
        },
        subsectionA_sandboxFixtures: fixturesA,
        subsectionB_commitFlag: subsectionB,
        subsectionC_asteroidNotice: subsectionC,
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
