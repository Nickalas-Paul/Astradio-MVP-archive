/**
 * Text Generation Engine v1.0
 * Builds ExplainSpec from canonical pipeline inputs (snapshot/features/guidance/plan).
 * 
 * Design: ExplainSpec is the stable intermediate representation; rendering is separate.
 * Deterministic: all variation seeded by payload.hash.
 */

import * as crypto from 'crypto';
import type { EphemerisSnapshot, FeatureVec, Plan } from '../contracts';
import type { PlanSummary } from './plan-summary';
import type { GuidanceSummary } from './guidance-atoms';
import type { GateReport } from './contracts';
import {
  ExplainSpec,
  ExplainSpecSingleInputs,
  ExplainSpecComparisonInputs,
  SignatureFacts,
  PsychologyFacts,
  MusicFacts,
  ChartExplainFacts,
  ComparisonFacts,
  ComparisonMusicFacts,
  EvidenceItem,
  ElementBlend,
  BucketValue
} from './spec-contracts';
import { astroSummaryFromSnapshot } from './astro-summary-from-snapshot';
import { guidanceSummaryFromFeatureVec } from './guidance-atoms';
import { buildPlanSummary } from './plan-summary';

/**
 * Build ExplainSpec for a single chart.
 */
export function buildExplainSpecSingle(inputs: ExplainSpecSingleInputs): ExplainSpec {
  const { seed, snapshot, featureVec, guidanceSummary, plan, planSummary, gateReport } = inputs;

  // Compute hashes for evidence
  const snapshotHash = sha256(JSON.stringify(snapshot));
  const featureHash = sha256(JSON.stringify(Array.from(featureVec)));

  // Build element blend from featureVec (indices 27-30)
  const elementBlend: ElementBlend = {
    fire: clamp01(featureVec[27] ?? 0),
    earth: clamp01(featureVec[28] ?? 0),
    air: clamp01(featureVec[29] ?? 0),
    water: clamp01(featureVec[30] ?? 0)
  };
  const sum = elementBlend.fire + elementBlend.earth + elementBlend.air + elementBlend.water || 1;
  const normalizedBlend: ElementBlend = {
    fire: elementBlend.fire / sum,
    earth: elementBlend.earth / sum,
    air: elementBlend.air / sum,
    water: elementBlend.water / sum
  };

  // Get dominant planets from snapshot
  const astroSummary = astroSummaryFromSnapshot(snapshot, featureVec);
  const dominantPlanets = astroSummary.dominant_planets.slice(0, 3);

  // Bucket tension and clustering from featureVec (indices 32-33)
  const tensionBucket = bucketValue(featureVec[32] ?? 0.5);
  const clusteringBucket = bucketValue(featureVec[33] ?? 0.5);
  const moonPhaseBucket = snapshot.moonPhase !== undefined ? bucketValue(snapshot.moonPhase) : undefined;

  // Build signature facts
  const signatures: SignatureFacts = {
    elementBlend: normalizedBlend,
    dominantPlanets,
    tensionBucket,
    clusteringBucket,
    moonPhaseBucket
  };

  // Build psychology facts (deterministic from signatures + guidance + plan)
  const psychology = buildPsychologyFacts(normalizedBlend, dominantPlanets, tensionBucket, guidanceSummary, planSummary, seed);

  // Build music facts
  const music = buildMusicFacts(planSummary, guidanceSummary, seed);

  // Build listening cues (3-6 unique anchors)
  const listeningCues = buildListeningCues(signatures, psychology, music, seed);

  // Build evidence items
  const evidence = buildEvidenceItems(snapshotHash, featureHash, featureVec, planSummary, gateReport);

  // Build warnings if gates failed
  const warnings = gateReport.calibrated?.overall ? undefined : buildWarnings(gateReport);

  return {
    specVersion: "ExplainSpecV1",
    mode: "single",
    seed,
    titles: {
      signatures: "Astrological Signatures",
      significance: "Personal Significance",
      musical: "Musical Identity and Flow"
    },
    single: {
      signatures,
      psychology,
      music
    },
    listeningCues,
    evidence,
    warnings
  };
}

/**
 * Build ExplainSpec for a comparison (A vs B).
 */
export function buildExplainSpecComparison(inputs: ExplainSpecComparisonInputs): ExplainSpec {
  const { seed, a, b, delta, gateReport } = inputs;

  // Build chart facts for A and B
  const aSnapshotHash = sha256(JSON.stringify(a.snapshot));
  const aFeatureHash = sha256(JSON.stringify(Array.from(a.featureVec)));
  const aElementBlend: ElementBlend = {
    fire: clamp01(a.featureVec[27] ?? 0),
    earth: clamp01(a.featureVec[28] ?? 0),
    air: clamp01(a.featureVec[29] ?? 0),
    water: clamp01(a.featureVec[30] ?? 0)
  };
  const aSum = aElementBlend.fire + aElementBlend.earth + aElementBlend.air + aElementBlend.water || 1;
  const aNormalized: ElementBlend = {
    fire: aElementBlend.fire / aSum,
    earth: aElementBlend.earth / aSum,
    air: aElementBlend.air / aSum,
    water: aElementBlend.water / aSum
  };
  const aAstro = astroSummaryFromSnapshot(a.snapshot, a.featureVec);
  const aChart: ChartExplainFacts = {
    snapshotHash: aSnapshotHash,
    featureHash: aFeatureHash,
    elementBlend: aNormalized,
    dominantPlanets: aAstro.dominant_planets.slice(0, 3),
    buckets: {
      tension: bucketValue(a.featureVec[32] ?? 0.5),
      clustering: bucketValue(a.featureVec[33] ?? 0.5),
      density: mapDensityBucket(a.planSummary.densityBucket)
    },
    planSummary: a.planSummary
  };

  const bSnapshotHash = sha256(JSON.stringify(b.snapshot));
  const bFeatureHash = sha256(JSON.stringify(Array.from(b.featureVec)));
  const bElementBlend: ElementBlend = {
    fire: clamp01(b.featureVec[27] ?? 0),
    earth: clamp01(b.featureVec[28] ?? 0),
    air: clamp01(b.featureVec[29] ?? 0),
    water: clamp01(b.featureVec[30] ?? 0)
  };
  const bSum = bElementBlend.fire + bElementBlend.earth + bElementBlend.air + bElementBlend.water || 1;
  const bNormalized: ElementBlend = {
    fire: bElementBlend.fire / bSum,
    earth: bElementBlend.earth / bSum,
    air: bElementBlend.air / bSum,
    water: bElementBlend.water / bSum
  };
  const bAstro = astroSummaryFromSnapshot(b.snapshot, b.featureVec);
  const bChart: ChartExplainFacts = {
    snapshotHash: bSnapshotHash,
    featureHash: bFeatureHash,
    elementBlend: bNormalized,
    dominantPlanets: bAstro.dominant_planets.slice(0, 3),
    buckets: {
      tension: bucketValue(b.featureVec[32] ?? 0.5),
      clustering: bucketValue(b.featureVec[33] ?? 0.5),
      density: mapDensityBucket(b.planSummary.densityBucket)
    },
    planSummary: b.planSummary
  };

  // Build comparison facts
  const comparison: ComparisonFacts = {
    sharedElements: delta.dominantPlanetOverlap,
    contrasts: buildContrasts(aChart, bChart),
    frictionPoints: buildFrictionPoints(delta, aChart, bChart),
    resonance: computeResonance(aNormalized, bNormalized)
  };

  // Build comparison music facts
  const comparisonMusic: ComparisonMusicFacts = {
    tempoBlend: buildTempoBlend(a.planSummary.bpm, b.planSummary.bpm, seed),
    densityBlend: buildDensityBlend(a.planSummary.densityBucket, b.planSummary.densityBucket, seed),
    harmonicRelationship: buildHarmonicRelationship(a.planSummary, b.planSummary, seed),
    arcBlend: buildArcBlend(a.planSummary, b.planSummary, seed)
  };

  // Build listening cues (comparison-specific)
  const listeningCues = buildComparisonListeningCues(aChart, bChart, comparison, seed);

  // Build evidence
  const evidence: EvidenceItem[] = [
    { kind: "feature", key: "a.feature[32]", value: aChart.buckets.tension, note: "Chart A tension bucket" },
    { kind: "feature", key: "b.feature[32]", value: bChart.buckets.tension, note: "Chart B tension bucket" },
    { kind: "plan", key: "a.bpm", value: a.planSummary.bpm, note: "Chart A tempo" },
    { kind: "plan", key: "b.bpm", value: b.planSummary.bpm, note: "Chart B tempo" },
    { kind: "plan", key: "resonance", value: comparison.resonance, note: "Element overlap score" }
  ];

  const warnings = gateReport && !gateReport.calibrated?.overall ? buildWarnings(gateReport) : undefined;

  return {
    specVersion: "ExplainSpecV1",
    mode: "comparison",
    seed,
    titles: {
      signatures: "Shared Signatures",
      significance: "Points of Friction and Growth",
      musical: "Musical Relationship and Blend"
    },
    comparison: {
      a: aChart,
      b: bChart,
      delta: comparison,
      music: comparisonMusic
    },
    listeningCues,
    evidence,
    warnings
  };
}

// ============================================================================
// Helper functions

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function bucketValue(x: number): BucketValue {
  if (x < 0.33) return 'low';
  if (x < 0.67) return 'med';
  return 'high';
}

function mapDensityBucket(density: 'sparse' | 'balanced' | 'dense'): BucketValue {
  if (density === 'sparse') return 'low';
  if (density === 'dense') return 'high';
  return 'med';
}

function buildPsychologyFacts(
  elementBlend: ElementBlend,
  dominantPlanets: string[],
  tensionBucket: BucketValue,
  guidance: GuidanceSummary,
  planSummary: PlanSummary,
  seed: string
): PsychologyFacts {
  // Deterministic temperament words from element blend (seeded variation)
  const rng = createSeededRNG(seed);
  const temperamentWords: string[] = [];
  
  // Top 2 elements contribute adjectives
  const elements = [
    { name: 'fire', value: elementBlend.fire },
    { name: 'earth', value: elementBlend.earth },
    { name: 'air', value: elementBlend.air },
    { name: 'water', value: elementBlend.water }
  ].sort((a, b) => b.value - a.value);
  
  const adjSets: Record<string, string[]> = {
    fire: ['energetic', 'passionate', 'bold', 'impulsive'],
    earth: ['grounded', 'practical', 'steady', 'patient'],
    air: ['curious', 'analytical', 'communicative', 'adaptable'],
    water: ['intuitive', 'empathetic', 'flowing', 'sensitive']
  };
  
  for (let i = 0; i < 2 && i < elements.length; i++) {
    const el = elements[i];
    if (el.value > 0.2) {
      const adjs = adjSets[el.name] || [];
      const idx = Math.floor(rng() * adjs.length);
      temperamentWords.push(adjs[idx]);
    }
  }
  
  // Attention style from motion + tension
  const attentionStyles: string[] = ['focused', 'scattered', 'rhythmic', 'flowing', 'measured'];
  const attentionIdx = Math.floor(rng() * attentionStyles.length);
  const attentionStyle = attentionStyles[attentionIdx];
  
  // Pacing from plan bpm + density
  let pacing = 'measured';
  if (planSummary.bpm > 120) pacing = 'urgent';
  else if (planSummary.bpm < 80) pacing = 'flowing';
  else if (planSummary.densityBucket === 'dense') pacing = 'intense';
  
  // Relating style from planets + elements
  const relatingStyles: string[] = ['direct', 'nuanced', 'expansive', 'intimate'];
  const relatingIdx = Math.floor(rng() * relatingStyles.length);
  const relatingStyle = relatingStyles[relatingIdx];
  
  return {
    temperamentWords: temperamentWords.length >= 2 ? temperamentWords : ['balanced', 'adaptable'],
    attentionStyle,
    pacing,
    relatingStyle
  };
}

function buildMusicFacts(
  planSummary: PlanSummary,
  guidance: GuidanceSummary,
  seed: string
): MusicFacts {
  // Register bias from planSummary registerMin/Max
  let registerBias: 'lower' | 'mid' | 'higher' = 'mid';
  if (planSummary.registerMin !== undefined && planSummary.registerMax !== undefined) {
    const avg = (planSummary.registerMin + planSummary.registerMax) / 2;
    if (avg < 60) registerBias = 'lower';
    else if (avg > 72) registerBias = 'higher';
  }
  
  // Articulation from guidance motion
  const articulationBucket: BucketValue = guidance.motion;
  
  // Motion from guidance flow
  const motionBucket: BucketValue = guidance.flow;
  
  // Harmonic posture from planSummary integrationTonicPull
  const harmonicPosture: 'root-stable' | 'color-shifting' = 
    (planSummary.integrationTonicPull ?? 0.5) > 0.7 ? 'root-stable' : 'color-shifting';
  
  // Arc summary (Encounter/Recognition/Integration)
  const rng = createSeededRNG(seed);
  const arcBegin = planSummary.encounterUniqueRoots 
    ? `Encounter introduces ${planSummary.encounterUniqueRoots} harmonic colors`
    : 'Encounter establishes the foundation';
  const arcMiddle = planSummary.avgMelodicInterval 
    ? `Recognition unfolds with ${planSummary.avgMelodicInterval.toFixed(1)}-semitone motion`
    : 'Recognition develops the theme';
  const arcEnd = planSummary.integrationTonicPull 
    ? `Integration resolves with ${planSummary.integrationTonicPull > 0.7 ? 'tonic' : 'color'} emphasis`
    : 'Integration brings closure';
  
  // Map densityBucket from PlanSummary to BucketValue
  const densityBucket: BucketValue = 
    planSummary.densityBucket === 'sparse' ? 'low' :
    planSummary.densityBucket === 'dense' ? 'high' : 'med';
  
  return {
    bpm: planSummary.bpm,
    key: planSummary.key,
    densityBucket,
    registerBias,
    articulationBucket,
    motionBucket,
    harmonicPosture,
    arcSummary: {
      begin: arcBegin,
      middle: arcMiddle,
      end: arcEnd
    },
    planSummary
  };
}

function buildListeningCues(
  signatures: SignatureFacts,
  psychology: PsychologyFacts,
  music: MusicFacts,
  seed: string
): string[] {
  const cues: string[] = [];
  const rng = createSeededRNG(seed);
  
  // From signatures
  if (signatures.dominantPlanets.length > 0) {
    cues.push(`${signatures.dominantPlanets[0]}'s influence shapes the movement`);
  }
  
  // From element blend
  const topElement = Object.entries(signatures.elementBlend)
    .sort((a, b) => b[1] - a[1])[0];
  if (topElement[1] > 0.3) {
    cues.push(`${topElement[0]} element brings ${topElement[0] === 'fire' ? 'energy' : topElement[0] === 'earth' ? 'grounding' : topElement[0] === 'air' ? 'lightness' : 'flow'}`);
  }
  
  // From music
  cues.push(`Tempo sits at ${music.bpm} BPM`);
  cues.push(`Density is ${music.densityBucket}`);
  cues.push(`Register leans ${music.registerBias}`);
  
  // From psychology
  cues.push(`Attention style: ${psychology.attentionStyle}`);
  
  // Shuffle and take 3-6
  for (let i = cues.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cues[i], cues[j]] = [cues[j], cues[i]];
  }
  
  return cues.slice(0, Math.min(6, Math.max(3, cues.length)));
}

function buildEvidenceItems(
  snapshotHash: string,
  featureHash: string,
  featureVec: FeatureVec,
  planSummary: PlanSummary,
  gateReport: GateReport
): EvidenceItem[] {
  const items: EvidenceItem[] = [
    { kind: "feature", key: "feature[27]", value: featureVec[27] ?? 0, note: "Fire element strength" },
    { kind: "feature", key: "feature[28]", value: featureVec[28] ?? 0, note: "Earth element strength" },
    { kind: "feature", key: "feature[29]", value: featureVec[29] ?? 0, note: "Air element strength" },
    { kind: "feature", key: "feature[30]", value: featureVec[30] ?? 0, note: "Water element strength" },
    { kind: "feature", key: "feature[32]", value: featureVec[32] ?? 0, note: "Tension level" },
    { kind: "feature", key: "feature[33]", value: featureVec[33] ?? 0, note: "Clustering level" },
    { kind: "plan", key: "plan.bpm", value: planSummary.bpm, note: "Tempo" },
    { kind: "plan", key: "plan.key", value: planSummary.key, note: "Key" },
    { kind: "plan", key: "plan.melodyEventCount", value: planSummary.melodyEventCount, note: "Melody events" },
    { kind: "plan", key: "plan.harmonyEventCount", value: planSummary.harmonyEventCount, note: "Harmony events" }
  ];
  
  if (gateReport.calibrated) {
    items.push({ kind: "gate", key: "gate.melody_arc", value: gateReport.calibrated.melody_arc ? 1 : 0, note: "Melody arc gate" });
    items.push({ kind: "gate", key: "gate.overall", value: gateReport.calibrated.overall ? 1 : 0, note: "Overall gate pass" });
  }
  
  return items;
}

function buildWarnings(gateReport: GateReport): string[] {
  const warnings: string[] = [];
  if (!gateReport.calibrated?.melody_arc) warnings.push("Melody arc gate failed");
  if (!gateReport.calibrated?.melody_step_leap) warnings.push("Melody step/leap gate failed");
  if (!gateReport.calibrated?.melody_narrative) warnings.push("Melody narrative gate failed");
  if (!gateReport.calibrated?.rhythm_diversity) warnings.push("Rhythm diversity gate failed");
  return warnings;
}

function buildContrasts(a: ChartExplainFacts, b: ChartExplainFacts): Array<{ aspect: string; a: string; b: string }> {
  const contrasts: Array<{ aspect: string; a: string; b: string }> = [];
  if (a.buckets.tension !== b.buckets.tension) {
    contrasts.push({ aspect: "tension", a: a.buckets.tension, b: b.buckets.tension });
  }
  if (a.buckets.density !== b.buckets.density) {
    contrasts.push({ aspect: "density", a: a.buckets.density, b: b.buckets.density });
  }
  return contrasts;
}

function buildFrictionPoints(
  delta: ExplainSpecComparisonInputs['delta'],
  a: ChartExplainFacts,
  b: ChartExplainFacts
): Array<{ metric: string; delta: number; note: string }> {
  const points: Array<{ metric: string; delta: number; note: string }> = [];
  points.push({ metric: "tension", delta: delta.tensionDiff, note: "Tension difference between charts" });
  points.push({ metric: "clustering", delta: delta.clusteringDiff, note: "Clustering difference" });
  return points;
}

function computeResonance(a: ElementBlend, b: ElementBlend): number {
  // Element overlap score (0-1)
  const overlap = 
    Math.min(a.fire, b.fire) +
    Math.min(a.earth, b.earth) +
    Math.min(a.air, b.air) +
    Math.min(a.water, b.water);
  return clamp01(overlap);
}

function buildTempoBlend(aBpm: number, bBpm: number, seed: string): string {
  const diff = Math.abs(aBpm - bBpm);
  if (diff < 10) return "Both charts share a similar tempo range";
  if (aBpm > bBpm) return `Chart A's faster tempo (${aBpm} BPM) complements Chart B's steadier pulse (${bBpm} BPM)`;
  return `Chart B's faster tempo (${bBpm} BPM) complements Chart A's steadier pulse (${aBpm} BPM)`;
}

function buildDensityBlend(a: PlanSummary['densityBucket'], b: PlanSummary['densityBucket'], seed: string): string {
  if (a === b) return `Both charts share ${a} density`;
  return `Chart A's ${a} density contrasts with Chart B's ${b} density`;
}

function buildHarmonicRelationship(a: PlanSummary, b: PlanSummary, seed: string): string {
  if (a.key === b.key) return `Both charts share the key of ${a.key}, creating harmonic unity`;
  return `Chart A's ${a.key} foundation supports Chart B's ${b.key} melodies`;
}

function buildArcBlend(a: PlanSummary, b: PlanSummary, seed: string): string {
  return `Chart A's arc (${a.melodyEventCount} melody events) blends with Chart B's arc (${b.melodyEventCount} melody events)`;
}

function buildComparisonListeningCues(
  a: ChartExplainFacts,
  b: ChartExplainFacts,
  delta: ComparisonFacts,
  seed: string
): string[] {
  const cues: string[] = [];
  cues.push(`Shared planets: ${delta.sharedElements.join(', ')}`);
  cues.push(`Tension contrast: ${a.buckets.tension} vs ${b.buckets.tension}`);
  cues.push(`Resonance score: ${(delta.resonance * 100).toFixed(0)}%`);
  return cues.slice(0, 6);
}

/**
 * Simple seeded RNG (xorshift32) for deterministic variation.
 */
function createSeededRNG(seed: string): () => number {
  let state = hashToUint32(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

function hashToUint32(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash >>> 0;
}
