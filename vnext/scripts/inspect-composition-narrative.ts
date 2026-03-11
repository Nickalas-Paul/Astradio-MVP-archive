import { encodeFeatures } from "../feature-encode";
import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import type { ControlSurfacePayload } from "../explainer/contracts";
import { guidanceFromFeatures } from "../astro/guidance";
import { buildCompositionNarrativePlan } from "../audio/composition-narrative";
import { buildLyriaPrompt } from "../render";

type ScenarioId =
  | "fire_dominant"
  | "earth_dominant"
  | "air_dominant"
  | "water_dominant"
  | "high_tension"
  | "low_tension";

interface Scenario {
  id: ScenarioId;
  description: string;
  snapshot: EphemerisSnapshot;
  payload: ControlSurfacePayload;
  plan: Plan;
}

function baseSnapshot(
  dominant: { fire: number; earth: number; air: number; water: number },
  moonPhase: number,
  aspectType: "low" | "high"
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
    aspectType === "high"
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

function basePayload(element: string, tension: number, modality: string, hash: string): ControlSurfacePayload {
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
    debug: {},
  };
}

function makeScenarios(): Scenario[] {
  const fireSnapshot = baseSnapshot(
    { fire: 0.7, earth: 0.1, air: 0.1, water: 0.1 },
    0.2,
    "low"
  );
  const earthSnapshot = baseSnapshot(
    { fire: 0.1, earth: 0.7, air: 0.1, water: 0.1 },
    0.4,
    "low"
  );
  const airSnapshot = baseSnapshot(
    { fire: 0.15, earth: 0.1, air: 0.65, water: 0.1 },
    0.3,
    "low"
  );
  const waterSnapshot = baseSnapshot(
    { fire: 0.1, earth: 0.1, air: 0.1, water: 0.7 },
    0.6,
    "low"
  );
  const highTensionSnapshot = baseSnapshot(
    { fire: 0.4, earth: 0.2, air: 0.2, water: 0.2 },
    0.75,
    "high"
  );
  const lowTensionSnapshot = baseSnapshot(
    { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
    0.1,
    "low"
  );

  const encode = (s: EphemerisSnapshot): FeatureVec => encodeFeatures(s) as FeatureVec;

  const scenarios: Scenario[] = [
    {
      id: "fire_dominant",
      description: "Fire-dominant, dynamic chart",
      snapshot: fireSnapshot,
      payload: basePayload("fire", 0.6, "cardinal", "fire_hash"),
      plan: stubPlan("plan_fire", 128),
    },
    {
      id: "earth_dominant",
      description: "Earth-dominant, grounded chart",
      snapshot: earthSnapshot,
      payload: basePayload("earth", 0.45, "fixed", "earth_hash"),
      plan: stubPlan("plan_earth", 108),
    },
    {
      id: "air_dominant",
      description: "Air-dominant, agile chart",
      snapshot: airSnapshot,
      payload: basePayload("air", 0.5, "mutable", "air_hash"),
      plan: stubPlan("plan_air", 122),
    },
    {
      id: "water_dominant",
      description: "Water-dominant, flowing chart",
      snapshot: waterSnapshot,
      payload: basePayload("water", 0.55, "mutable", "water_hash"),
      plan: stubPlan("plan_water", 96),
    },
    {
      id: "high_tension",
      description: "High-tension chart with strong squares/oppositions",
      snapshot: highTensionSnapshot,
      payload: basePayload("fire", 0.85, "cardinal", "high_tension_hash"),
      plan: stubPlan("plan_high_tension", 132),
    },
    {
      id: "low_tension",
      description: "Low-tension, balanced elements chart",
      snapshot: lowTensionSnapshot,
      payload: basePayload("air", 0.2, "mutable", "low_tension_hash"),
      plan: stubPlan("plan_low_tension", 104),
    },
  ];

  // Attach feature vectors and guidance-derived fields via buildCompositionNarrativePlan call.
  for (const s of scenarios) {
    const featureVec = encode(s.snapshot);
    const guidance = guidanceFromFeatures(featureVec, s.snapshot, s.payload.hash);
    const architectureLike = {
      snapshot: s.snapshot,
      features: featureVec,
      personality: guidance.personality,
      astroProfile: { snapshot: s.snapshot } as any,
      guidance,
      relationalContext: {} as any,
      seed: s.payload.hash,
    };
    const narrative = buildCompositionNarrativePlan(architectureLike, featureVec, s.payload, s.plan);
    const prompt = buildLyriaPrompt(s.payload, s.plan, narrative);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          scenario: s.id,
          description: s.description,
          narrative,
          prompt,
        },
        null,
        2
      )
    );
  }

  return scenarios;
}

if (require.main === module) {
  makeScenarios();
}

