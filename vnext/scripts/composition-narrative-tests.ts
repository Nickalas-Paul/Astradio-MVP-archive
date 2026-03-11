import { encodeFeatures } from "../feature-encode";
import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import type { ControlSurfacePayload } from "../explainer/contracts";
import { guidanceFromFeatures } from "../astro/guidance";
import { buildCompositionNarrativePlan } from "../audio/composition-narrative";
import { buildLyriaPrompt } from "../render";

function makeSnapshot(
  dominant: { fire: number; earth: number; air: number; water: number },
  moonPhase: number,
  tensionClass: "low" | "high"
): EphemerisSnapshot {
  const planets = [
    { name: "sun", lon: 0 },
    { name: "moon", lon: 90 },
    { name: "mercury", lon: 45 },
    { name: "venus", lon: 135 },
    { name: "mars", lon: 210 },
    { name: "jupiter", lon: 300 },
    { name: "saturn", lon: 330 },
    { name: "uranus", lon: 15 },
    { name: "neptune", lon: 60 },
    { name: "pluto", lon: 120 },
  ];
  const houses: EphemerisSnapshot["houses"] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];
  const aspects =
    tensionClass === "high"
      ? [
          { bodyA: "sun", bodyB: "mars", type: "square" as const, orb: 2 },
          { bodyA: "moon", bodyB: "saturn", type: "square" as const, orb: 1 },
          { bodyA: "venus", bodyB: "pluto", type: "opposition" as const, orb: 3 },
        ]
      : [{ bodyA: "sun", bodyB: "jupiter", type: "trine" as const, orb: 3 }];
  return {
    ts: "2000-01-01T12:00:00Z",
    tz: "UTC",
    lat: 0,
    lon: 0,
    houseSystem: "placidus",
    planets,
    houses,
    aspects,
    moonPhase,
    dominantElements: dominant,
  };
}

function makePayload(
  element: string,
  tension: number,
  modality: string,
  hash: string
): ControlSurfacePayload {
  return {
    arc_shape: 0.5,
    density_level: 0.6,
    tempo_norm: 0.7,
    step_bias: 0.7,
    leap_cap: 4,
    rhythm_template_id: 3,
    syncopation_bias: 0.3,
    motif_rate: 0.6,
    element_dominance: element,
    aspect_tension: tension,
    modality,
    genre: "house",
    hash,
  };
}

function stubPlan(id: string, bpm: number): Plan {
  return {
    id,
    featureHash: "v6",
    durationSec: 30,
    bpm,
    key: "A minor",
    events: [],
  };
}

function narrativeFor(
  snapshot: EphemerisSnapshot,
  payload: ControlSurfacePayload,
  plan: Plan
) {
  const featureVec = encodeFeatures(snapshot) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, snapshot, payload.hash);
  const architectureLike = {
    snapshot,
    features: featureVec,
    personality: guidance.personality,
    astroProfile: { snapshot } as any,
    guidance,
    relationalContext: {} as any,
    seed: payload.hash,
  };
  const narrative = buildCompositionNarrativePlan(
    architectureLike,
    featureVec,
    payload,
    plan
  );
  const prompt = buildLyriaPrompt(payload, plan, narrative);
  return { narrative, prompt };
}

function assertEqual(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function runTests() {
  // 1) Determinism: same inputs => identical narrative and prompt
  const snapDet = makeSnapshot(
    { fire: 0.5, earth: 0.2, air: 0.2, water: 0.1 },
    0.4,
    "low"
  );
  const payloadDet = makePayload("fire", 0.6, "cardinal", "det_seed");
  const planDet = stubPlan("plan_det", 120);
  const r1 = narrativeFor(snapDet, payloadDet, planDet);
  const r2 = narrativeFor(snapDet, payloadDet, planDet);
  assertEqual(r1.narrative, r2.narrative, "determinism: narrative mismatch");
  assertEqual(r1.prompt, r2.prompt, "determinism: prompt mismatch");

  // 2) Elemental dominance shifts primaryElement and tonal behavior
  const snapFire = makeSnapshot(
    { fire: 0.7, earth: 0.1, air: 0.1, water: 0.1 },
    0.3,
    "low"
  );
  const snapEarth = makeSnapshot(
    { fire: 0.1, earth: 0.7, air: 0.1, water: 0.1 },
    0.3,
    "low"
  );
  const payloadFire = makePayload("fire", 0.6, "cardinal", "fire_seed");
  const payloadEarth = makePayload("earth", 0.45, "fixed", "earth_seed");
  const planShared = stubPlan("plan_elem", 118);
  const nf = narrativeFor(snapFire, payloadFire, planShared).narrative;
  const ne = narrativeFor(snapEarth, payloadEarth, planShared).narrative;
  assert(
    nf.primaryElement === "fire" && ne.primaryElement === "earth",
    "elemental: primaryElement not reflecting dominant element"
  );
  assert(
    nf.densityProfile !== ne.densityProfile ||
      nf.rhythmicDrive !== ne.rhythmicDrive ||
      nf.arcShape !== ne.arcShape,
    "elemental: narratives too similar across fire/earth"
  );

  // 3) Ending style stability: high water + deep pluto => non-trivial endingStyle
  const snapWater = makeSnapshot(
    { fire: 0.1, earth: 0.1, air: 0.1, water: 0.7 },
    0.7,
    "low"
  );
  const payloadWater = makePayload("water", 0.5, "mutable", "water_seed");
  const planWater = stubPlan("plan_water", 100);
  const nw = narrativeFor(snapWater, payloadWater, planWater).narrative;
  assert(
    nw.endingStyle === "suspended" ||
      nw.endingStyle === "dissipating" ||
      nw.endingStyle === "open",
    "endingStyle: unexpected value for water-dominant scenario"
  );

  // 4) Tonal polarity: balanced chart should not collapse to dark
  const snapBalanced = makeSnapshot(
    { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
    0.4,
    "low"
  );
  const payloadBalanced = makePayload(
    "air",
    0.4,
    "mutable",
    "balanced_seed"
  );
  const planBalanced = stubPlan("plan_bal", 112);
  const nb = narrativeFor(snapBalanced, payloadBalanced, planBalanced).narrative;
  assert(
    nb.tonalPolarity === "balanced" || nb.tonalPolarity === "bright",
    "tonalPolarity: balanced chart collapsed to dark unexpectedly"
  );

  // 5) Prompt explicitly guards against abrupt endings when narrative present
  const promptCheck = narrativeFor(
    snapFire,
    payloadFire,
    planShared
  ).prompt.toLowerCase();
  assert(
    promptCheck.includes("no abrupt cutoff") ||
      promptCheck.includes("no hard stop"),
    "prompt: missing explicit no-abrupt-ending language"
  );

  // eslint-disable-next-line no-console
  console.log("[composition-narrative-tests] all checks passed");
}

if (require.main === module) {
  runTests();
}

