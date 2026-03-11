/**
 * Factor map shape test: factors within budget, each has astro/psych/music,
 * determinism (same inputs → same ordering/text), no "•" or em dash in factor strings.
 */

import { buildExplainSpecSingle } from '../explainer/text-generation-engine';
import { guidanceSummaryFromFeatureVec } from '../explainer/guidance-atoms';
import { buildPlanSummary } from '../explainer/plan-summary';
import type { EphemerisSnapshot, FeatureVec, Plan } from '../contracts';

const SEED = 'test-factor-map-seed';

function makeSnapshot(): EphemerisSnapshot {
  return {
    ts: '2026-02-08T12:00:00Z',
    tz: 'UTC',
    lat: 38.9,
    lon: -77,
    houseSystem: 'placidus',
    planets: [
      { name: 'sun', lon: 45 },
      { name: 'moon', lon: 120 },
      { name: 'mercury', lon: 60 }
    ],
    houses: [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 0],
    aspects: [
      { bodyA: 'sun', bodyB: 'mercury', type: 'conjunction', orb: 3 }
    ],
    moonPhase: 0.5,
    dominantElements: { fire: 0.4, earth: 0.2, air: 0.3, water: 0.1 }
  };
}

function makeFeatureVec(): FeatureVec {
  const arr = new Float32Array(64);
  arr[27] = 0.4;
  arr[28] = 0.2;
  arr[29] = 0.3;
  arr[30] = 0.1;
  arr[32] = 0.5;
  arr[33] = 0.5;
  return arr as FeatureVec;
}

function makePlan(): Plan {
  return {
    id: 'test-plan',
    featureHash: 'test-hash',
    durationSec: 60,
    bpm: 100,
    key: 'C',
    events: []
  };
}

function main(): void {
  const snapshot = makeSnapshot();
  const featureVec = makeFeatureVec();
  const plan = makePlan();
  const planSummary = buildPlanSummary(plan);
  const guidanceSummary = guidanceSummaryFromFeatureVec(featureVec);
  const gateReport = {
    calibrated: { melody_arc: true, melody_step_leap: true, melody_narrative: true, rhythm_diversity: true, overall: true },
    strict: { melody_arc: true, melody_step_leap: true, melody_narrative: true, rhythm_diversity: true, overall: true },
    scores: { melody_arc: 1, melody_step_leap: 1, melody_narrative: 1, rhythm_diversity: 1 },
    latency_ms: { predict: 0, plan: 0, total: 0 }
  };

  const spec1 = buildExplainSpecSingle({
    seed: SEED,
    snapshot,
    featureVec,
    guidanceSummary,
    plan,
    planSummary,
    gateReport
  });

  const spec2 = buildExplainSpecSingle({
    seed: SEED,
    snapshot,
    featureVec,
    guidanceSummary,
    plan,
    planSummary,
    gateReport
  });

  const factors = spec1.single?.factorMap?.factors ?? [];
  const maxFactors = 3 + 4 + 2; // planets + aspects + angles
  if (factors.length > maxFactors) {
    console.error(`❌ FAIL: Factor count ${factors.length} exceeds budget ${maxFactors}`);
    process.exit(1);
  }

  for (const f of factors) {
    if (!f.id || !f.astro || !f.psych || !f.music) {
      console.error('❌ FAIL: Every factor must have id, astro, psych, music');
      process.exit(1);
    }
    if (f.astro.includes('•') || f.astro.includes('—') || f.astro.includes('–')) {
      console.error('❌ FAIL: Factor astro contains bullet or em dash:', f.astro);
      process.exit(1);
    }
    if (f.psych.includes('•') || f.psych.includes('—') || f.psych.includes('–')) {
      console.error('❌ FAIL: Factor psych contains bullet or em dash:', f.psych);
      process.exit(1);
    }
    if (f.music.includes('•') || f.music.includes('—') || f.music.includes('–')) {
      console.error('❌ FAIL: Factor music contains bullet or em dash:', f.music);
      process.exit(1);
    }
  }

  const factors2 = spec2.single?.factorMap?.factors ?? [];
  if (factors.length !== factors2.length) {
    console.error('❌ FAIL: Determinism broken: factor count differs between runs');
    process.exit(1);
  }
  for (let i = 0; i < factors.length; i++) {
    if (factors[i].id !== factors2[i].id || factors[i].astro !== factors2[i].astro ||
        factors[i].psych !== factors2[i].psych || factors[i].music !== factors2[i].music) {
      console.error('❌ FAIL: Determinism broken: factor content or order differs');
      process.exit(1);
    }
  }

  console.log('✅ PASS: Factor map shape and determinism');
  console.log(`  Factors: ${factors.length}`);
  console.log(`  IDs: ${factors.map((f) => f.id).join(', ')}`);
}

main();
