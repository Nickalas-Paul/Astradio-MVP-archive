/**
 * **Product:Phase-8** — **Verify:P8-Slice-03** compose path inspection (legacy script name `phase8-compose-path-inspection`).
 *
 * One-off diagnostic script to trace the real ComposeAPI.compose() path
 * for the fixed sandbox + overriddenSnapshot request and compare it to
 * the reconstructed ExplainSpec/render path.
 */

import { ComposeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import type { EphemerisSnapshot } from '../contracts';

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
  // Ensure we don't reuse a stale cached composition.
  (api as any).compositionCache?.clear?.();

  const request: ComposeRequest & { overriddenSnapshot?: EphemerisSnapshot } = {
    mode: 'sandbox',
    controls: {},
    overriddenSnapshot: deepClone(SNAPSHOT_FIXTURE),
  } as any;

  console.log('--- Compose Path Inspection (sandbox + overriddenSnapshot) ---');

  const payload = await (api as any).generateControlPayload(request);
  console.log('payload.hash:', payload.hash);

  const reqAny = request as any;
  const overriddenSnapshot = (api as any).validateOverriddenSnapshot(reqAny.overriddenSnapshot);

  const { generateArchitectureFromSnapshot } = await import('../core/architecture-engine');
  const architecture = await generateArchitectureFromSnapshot(overriddenSnapshot, payload.hash);
  const featureVec = architecture.features as any;

  console.log('Architecture snapshot ts:', architecture.snapshot.ts);
  console.log('FeatureVec[27..33]:', Array.from((featureVec as Float32Array).slice(27, 34)));

  const { generatePlanMLOnly } = await import('../plan-generator');
  const { plan, diag } = await generatePlanMLOnly(featureVec, {
    ...payload,
    ts: architecture.snapshot.ts,
    tz: architecture.snapshot.tz,
    lat: architecture.snapshot.lat,
    lon: architecture.snapshot.lon,
    houseSystem: architecture.snapshot.houseSystem,
    planets: architecture.snapshot.planets,
    houses: architecture.snapshot.houses,
    aspects: architecture.snapshot.aspects,
    moonPhase: architecture.snapshot.moonPhase,
    dominantElements: architecture.snapshot.dominantElements,
  });
  console.log('Plan bpm/key/duration:', plan.bpm, plan.key, plan.durationSec);

  const gateReport = await (api as any).runAuditionGates(plan, payload.hash);
  console.log('GateReport.calibrated.overall in compose path:', gateReport.calibrated?.overall);

  const guidanceSummary = (await import('../explainer/guidance-atoms')).guidanceSummaryFromFeatureVec(featureVec);
  const planSummary = (await import('../explainer/plan-summary')).buildPlanSummary(plan);

  const { buildExplainSpecSingle } = await import('../explainer/text-generation-engine');
  const spec = buildExplainSpecSingle({
    seed: payload.hash,
    snapshot: architecture.snapshot,
    featureVec,
    guidanceSummary,
    plan,
    planSummary,
    gateReport,
  });

  console.log('\nSpec.single.signatures used in compose path:', JSON.stringify(spec.single?.signatures, null, 2));

  const { renderExplainSpecToSections } = await import('../explainer/renderers/deterministic');
  const rendered = renderExplainSpecToSections(spec);
  const signaturesSection = rendered.sections.find((s) => s.id === 'signatures');

  console.log('\nRendered sections in compose path:');
  for (const s of rendered.sections) {
    console.log(`- id=${s.id}, title=${s.title}, text.length=${s.text.length}, bullets=${s.bullets?.length ?? 0}`);
  }
  console.log('\nsignatures section text (compose path):', JSON.stringify(signaturesSection?.text || ''));

  const response = await api.compose(request);
  const anyRes: any = response;
  console.log('\nFinal compose.text block:');
  console.log('template_id:', anyRes.text?.template_id);
  console.log('short.length:', anyRes.text?.short?.length ?? 0);
  console.log('short:', JSON.stringify(anyRes.text?.short ?? ''));
  console.log('long.length:', anyRes.text?.long?.length ?? 0);
  console.log('signatures field:', JSON.stringify(anyRes.text?.signatures ?? ''));

  console.log('--- End compose path inspection ---');
}

main().catch((err) => {
  console.error('phase8-compose-path-inspection error:', err);
  process.exit(1);
});

