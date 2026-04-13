/**
 * **Product:Phase-8** — **Verify:P8-Slice-03** signatures inspection (legacy script name `phase8-compose-signatures-inspection`).
 *
 * One-off diagnostic script to inspect the ExplainSpec/signatures pipeline
 * for the fixed sandbox + overriddenSnapshot fixture used in Verify:P8-Slice-03 compose tests.
 *
 * No verification logic or fixes; prints internal values step by step.
 */

import { ComposeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { generatePlanMLOnly } from '../plan-generator';
import { guidanceSummaryFromFeatureVec } from '../explainer/guidance-atoms';
import { buildPlanSummary } from '../explainer/plan-summary';
import { buildExplainSpecSingle } from '../explainer/text-generation-engine';
import { renderExplainSpecToSections } from '../explainer/renderers/deterministic';

// Same snapshot fixture as other **Product:Phase-8** / Verify scripts
const SNAPSHOT_FIXTURE: EphemerisSnapshot = {
  ts: '2036-03-15T12:00:00Z',
  tz: 'UTC',
  lat: 40.7128,
  lon: -74.006,
  houseSystem: 'placidus',
  planets: [
    { name: 'sun', lon: 15 },
    { name: 'moon', lon: 195 },
    { name: 'mercury', lon: 30 },
    { name: 'venus', lon: 210 },
    { name: 'mars', lon: 90 },
    { name: 'jupiter', lon: 105 },
    { name: 'saturn', lon: 300 },
    { name: 'uranus', lon: 120 },
    { name: 'neptune', lon: 330 },
    { name: 'pluto', lon: 270 },
  ],
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  aspects: [
    { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
    { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
    { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
  ],
  moonPhase: 0.7,
  dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
};

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

async function main() {
  const api = new ComposeAPI();

  const request: ComposeRequest & { overriddenSnapshot?: EphemerisSnapshot } = {
    mode: 'sandbox',
    controls: {},
    overriddenSnapshot: deepClone(SNAPSHOT_FIXTURE) as any,
  } as any;

  // Reconstruct compose inputs as closely as possible without using composition cache.
  const payload = await (api as any).generateControlPayload(request);
  const overriddenSnapshot = (api as any).validateOverriddenSnapshot(request.overriddenSnapshot);
  const architecture = await generateArchitectureFromSnapshot(overriddenSnapshot, payload.hash);

  const snapshot = architecture.snapshot;
  const featureVec = architecture.features as FeatureVec;

  const chartContext = {
    ...payload,
    ts: snapshot.ts,
    tz: snapshot.tz,
    lat: snapshot.lat,
    lon: snapshot.lon,
    houseSystem: snapshot.houseSystem,
    planets: snapshot.planets,
    houses: snapshot.houses,
    aspects: snapshot.aspects,
    moonPhase: snapshot.moonPhase,
    dominantElements: snapshot.dominantElements,
  };

  const { plan, diag } = await generatePlanMLOnly(featureVec, chartContext);
  const gateReport = await (api as any).runAuditionGates(plan, payload.hash);

  const guidanceSummary = guidanceSummaryFromFeatureVec(featureVec);
  const planSummary = buildPlanSummary(plan);

  const spec = buildExplainSpecSingle({
    seed: payload.hash,
    snapshot,
    featureVec,
    guidanceSummary,
    plan,
    planSummary,
    gateReport,
  });

  const signatures = spec.single?.signatures;

  const rendered = renderExplainSpecToSections(spec);
  const signaturesSection = rendered.sections.find((s) => s.id === 'signatures');
  const significanceSection = rendered.sections.find((s) => s.id === 'significance');
  const musicalSection = rendered.sections.find((s) => s.id === 'musical');

  console.log('--- Compose Signatures Inspection (Sandbox + overriddenSnapshot) ---');
  console.log('Seed (payload.hash):', payload.hash);
  console.log('FeatureVec[27..33]:', Array.from(featureVec.slice(27, 34)));
  console.log('GuidanceSummary:', guidanceSummary);
  console.log('PlanSummary (keys):', Object.keys(planSummary));
  console.log('GateReport.calibrated.overall:', gateReport.calibrated?.overall);

  console.log('\nSpec.single.signatures:', JSON.stringify(signatures, null, 2));

  console.log('\nRendered sections:');
  for (const s of rendered.sections) {
    console.log(`- id=${s.id}, title=${s.title}, text.length=${s.text.length}, bullets=${s.bullets?.length ?? 0}`);
    if (s.id === 'signatures') {
      console.log('  signatures text:', JSON.stringify(s.text));
    }
  }

  console.log('\nDerived compose.text.short would be:');
  console.log('short =', JSON.stringify(signaturesSection?.text || ''));

  console.log('\nDerived compose.text.long would be:');
  const sigText = significanceSection?.text || '';
  const musicalText = musicalSection?.text || '';
  const long = sigText + (musicalText ? '\n\n' + musicalText : '');
  console.log('long =', JSON.stringify(long));

  console.log('\n--- End inspection ---');
}

main().catch((err) => {
  console.error('phase8-compose-signatures-inspection error:', err);
  process.exit(1);
});

