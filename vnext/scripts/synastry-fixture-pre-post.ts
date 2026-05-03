/**
 * S3 Mode 1 — pre vs post synastry projection for three comparison fixtures (local, no DB).
 *
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/synastry-fixture-pre-post.js
 */

import { computeAspects, toSnapshotAspects } from '../aspect-engine';
import { buildAspectKey } from '../projection/insight-library/insight-library-index';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { mergeFeatureVectors } from '../compat/fusion';
import { controlPayloadFromSeed, comparisonSeed } from '../compat/payload-from-seed';
import { FUSION_METHOD_BLEND_V1 } from '../compat/types';
import type { EphemerisSnapshot, FeatureVec, SnapshotAspect } from '../contracts';
import { buildCanonicalReportForAggregate } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { buildArchitectureForAggregate } from '../api/aggregate-architecture';

const REL_MODE = 'lovers' as const;

export function snapshotFromLongitudes(lonByBody: Record<string, number>): EphemerisSnapshot {
  const planets = Object.entries(lonByBody).map(([name, lon]) => ({
    name: name.toLowerCase(),
    lon,
  }));
  const positions: Record<string, number> = {};
  for (const p of planets) positions[p.name] = p.lon;
  const aspects = toSnapshotAspects(computeAspects(positions));
  return {
    ts: '2001-06-15T12:00:00Z',
    tz: 'UTC',
    lat: 40.7,
    lon: -74.0,
    houseSystem: 'placidus',
    planets,
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as EphemerisSnapshot['houses'],
    aspects,
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function firstNAspectKeys(aspects: readonly SnapshotAspect[], n: number): string[] {
  return aspects.slice(0, n).map((a) => buildAspectKey(a.bodyA, a.bodyB, a.type));
}

export async function projectComparisonAsync(
  chartIdA: string,
  chartIdB: string,
  snapA: EphemerisSnapshot,
  snapB: EphemerisSnapshot,
  withSynastry: boolean,
  opts?: { compatClassCode?: string }
): Promise<{
  signaturesText: string;
  relationalFieldText: string;
  sectionIds: string[];
  first3Keys: string[];
  aspectKeysSource: 'synastry' | 'anchor_natal';
  synastry_context?: 'pair_comparison' | 'group_aggregate' | 'sandbox_override';
}> {
  const idLow = chartIdA.localeCompare(chartIdB, 'en') <= 0 ? chartIdA : chartIdB;
  const snapLow = idLow === chartIdA ? snapA : snapB;
  const snapHigh = idLow === chartIdA ? snapB : snapA;

  const [archLow, archHigh] = await Promise.all([
    generateArchitectureFromSnapshot(snapLow),
    generateArchitectureFromSnapshot(snapHigh),
  ]);
  const vecLow = archLow.features as FeatureVec;
  const vecHigh = archHigh.features as FeatureVec;
  const merged = mergeFeatureVectors(vecLow, vecHigh, { relationshipMode: REL_MODE, wA: 0.5, wB: 0.5 });
  const seed = comparisonSeed(chartIdA, chartIdB, REL_MODE, FUSION_METHOD_BLEND_V1, 0.5, 0.5);
  const payload = controlPayloadFromSeed(seed);
  const architecture = buildArchitectureForAggregate(snapLow, merged as FeatureVec, payload.hash);

  const synEdges = computeSynastryAspects({ snapshotsOrdered: [snapLow, snapHigh], mode: 'pair' });

  const canonical = buildCanonicalReportForAggregate({
    kind: 'comparison',
    subject_ids: [payload.hash],
    participants: [
      { snapshot: snapLow, featureVec: vecLow, role: 'primary' },
      { snapshot: snapHigh, featureVec: vecHigh, role: 'member_i' },
    ],
    composite: merged as FeatureVec,
    anchorIndex: 0,
    control_surface_hash: payload.hash,
    compose_seed: payload.hash,
    guidance: architecture.guidance,
    relationalWeather: null,
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
    surface: 'compat_pair',
    tier: 'baseline',
    narrativePlan: null,
    aggregateKind: 'comparison',
    connectionMode: REL_MODE,
    participantCount: 2,
    aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
    ...insightOpts,
    ...(opts?.compatClassCode != null && opts.compatClassCode !== ''
      ? { compatClassCode: opts.compatClassCode }
      : {}),
  });

  const sig = sections.find((s) => s.id === 'signatures');
  const rel = sections.find((s) => s.id === 'relational_field');
  return {
    signaturesText: sig?.text ?? '',
    relationalFieldText: rel?.text ?? '',
    sectionIds: sections.map((s) => s.id),
    first3Keys,
    aspectKeysSource,
    ...(insightOpts.synastry_context != null ? { synastry_context: insightOpts.synastry_context } : {}),
  };
}

/** Mode 1 comparison-path synthetic pairs (re-used by S3 Mode 2 sanity checks). */
export const MODE1_COMPARISON_FIXTURES: Array<{
  name: string;
  chartIdA: string;
  chartIdB: string;
  lonA: Record<string, number>;
  lonB: Record<string, number>;
}> = [
  {
    name: 'fixture_1_spread_cross_emphasis',
    chartIdA: 'fixture_alpha',
    chartIdB: 'fixture_omega',
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
    name: 'fixture_2_tight_personal_cross',
    chartIdA: 'natal_person_a',
    chartIdB: 'natal_person_b',
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
    name: 'fixture_3_outer_vs_inner',
    chartIdA: 'seeker_chart',
    chartIdB: 'partner_chart',
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

async function main(): Promise<void> {
  const fixtures: Record<string, unknown>[] = [];

  for (const fx of MODE1_COMPARISON_FIXTURES) {
    const snapA = snapshotFromLongitudes(fx.lonA);
    const snapB = snapshotFromLongitudes(fx.lonB);
    const idLow = fx.chartIdA.localeCompare(fx.chartIdB, 'en') <= 0 ? fx.chartIdA : fx.chartIdB;
    const snapLow = idLow === fx.chartIdA ? snapA : snapB;
    const snapHigh = idLow === fx.chartIdA ? snapB : snapA;
    const syn = computeSynastryAspects({ snapshotsOrdered: [snapLow, snapHigh], mode: 'pair' });

    const anchorSnap = snapLow;
    const pre = await projectComparisonAsync(fx.chartIdA, fx.chartIdB, snapA, snapB, false);
    const post = await projectComparisonAsync(fx.chartIdA, fx.chartIdB, snapA, snapB, true);

    fixtures.push({
      fixture: fx.name,
      chartIdsSorted: [fx.chartIdA, fx.chartIdB].sort((a, b) => a.localeCompare(b, 'en')),
      synastryDirectedHitCount: syn.length,
      synastryFirst3Keys: firstNAspectKeys(syn, 3),
      anchorNatalFirst3Keys: firstNAspectKeys(anchorSnap.aspects ?? [], 3),
      keysDifferFromAnchor:
        JSON.stringify(firstNAspectKeys(syn, 3)) !==
        JSON.stringify(firstNAspectKeys(anchorSnap.aspects ?? [], 3)),
      preSynastry: {
        aspectLibraryKeysFirst3: pre.first3Keys,
        aspectSource: pre.aspectKeysSource,
        signaturesText: pre.signaturesText,
        relationalFieldText: pre.relationalFieldText,
      },
      postSynastry: {
        aspectLibraryKeysFirst3: post.first3Keys,
        aspectSource: post.aspectKeysSource,
        signaturesText: post.signaturesText,
        relationalFieldText: post.relationalFieldText,
      },
      textDiff: {
        signaturesChanged: pre.signaturesText !== post.signaturesText,
        relationalFieldChanged: pre.relationalFieldText !== post.relationalFieldText,
      },
    });
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), fixtures }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
