/**
 * Phase-2C Evaluation with Student-v2.2
 * 1,000-chart evaluation with complete contract
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';

// Import evaluation components
import { encodeFeatures } from '../feature-encode';
import { studentVector } from '../ml';
import { planFromVector } from '../planner/narrative';
import { audition } from '../audition-gate';
import { EphemerisSnapshot, FeatureVec } from '../contracts';

type V6 = [number, number, number, number, number, number];

interface SnapshotRecord {
  id: number;
  snap: EphemerisSnapshot;
  feat: number[];
}

interface EvalResult {
  chartId: number;
  passed: boolean;
  qualityScore: number;
  latencyMs: number;
  breakdown: any;
}

interface EvalSummary {
  totalCharts: number;
  passedCharts: number;
  passRate: number;
  avgQuality: number;
  p50Latency: number;
  p95Latency: number;
  top5FailReasons: Array<[string, number]>;
  completeFailHistogram: Record<string, number>;
  perHeadStats: Record<string, { min: number; mean: number; p95: number; count: number }>;
  featureEncoder: { signature: string; dimensions: number; scalerInfo: string };
  headMapping: Record<string, string>;
  sliceStability: { fire: number; earth: number; air: number; water: number };
  slicePassRateFirst100: number;
  slicePassRateLast100: number;
  determinism_20_random?: boolean;
  manifestPath: string;
  realized_N: number;
  modelJsonHash: string;
  shardHash: string;
  shardBytes: number;
  commitHash: string;
}

function setSeed(seed: number) {
  Math.random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

async function loadSnapshots(): Promise<SnapshotRecord[]> {
  const snapshotsFile = path.resolve(process.cwd(), 'datasets', 'snapshots.jsonl');
  const content = fs.readFileSync(snapshotsFile, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function calculateGateFailHistogram(results: EvalResult[]): Record<string, number> {
  const failHistogram: Record<string, number> = {};
  
  results.forEach(result => {
    const breakdown = result.breakdown;
    
    // Melody gates
    if (breakdown.melody) {
      if (breakdown.melody.arc < 0.40) failHistogram['melody_arc'] = (failHistogram['melody_arc'] || 0) + 1;
      if (breakdown.melody.motif_recurrence < 0.35) failHistogram['melody_motif'] = (failHistogram['melody_motif'] || 0) + 1;
      if (breakdown.melody.contour_entropy < 0.35) failHistogram['melody_contour'] = (failHistogram['melody_contour'] || 0) + 1;
      if (breakdown.melody.step_leap_ratio < 0.35) failHistogram['melody_stepLeap'] = (failHistogram['melody_stepLeap'] || 0) + 1;
      if (breakdown.melody.range_ok < 0.5) failHistogram['melody_range'] = (failHistogram['melody_range'] || 0) + 1;
      if (breakdown.melody.narrative_flow < 0.4) failHistogram['melody_narrative'] = (failHistogram['melody_narrative'] || 0) + 1;
      if (breakdown.melody.gaming_penalty > 0.1) failHistogram['melody_gaming'] = (failHistogram['melody_gaming'] || 0) + 1;
    }
    
    // Harmony gates
    if (breakdown.harmony) {
      if (breakdown.harmony.progression_legality < 0.4) failHistogram['harmony_progression'] = (failHistogram['harmony_progression'] || 0) + 1;
      if (breakdown.harmony.complexity < 0.3) failHistogram['harmony_complexity'] = (failHistogram['harmony_complexity'] || 0) + 1;
      if (breakdown.harmony.voice_leading < 0.35) failHistogram['harmony_voiceLeading'] = (failHistogram['harmony_voiceLeading'] || 0) + 1;
      if (breakdown.harmony.tension < 0.25) failHistogram['harmony_tension'] = (failHistogram['harmony_tension'] || 0) + 1;
    }
    
    // Rhythm gates
    if (breakdown.rhythm) {
      if (breakdown.rhythm.syncopation < 0.4) failHistogram['rhythm_syncopation'] = (failHistogram['rhythm_syncopation'] || 0) + 1;
      if (breakdown.rhythm.tempo < 0.3) failHistogram['rhythm_tempo'] = (failHistogram['rhythm_tempo'] || 0) + 1;
      if (breakdown.rhythm.groove < 0.35) failHistogram['rhythm_groove'] = (failHistogram['rhythm_groove'] || 0) + 1;
      if (breakdown.rhythm.diversity < 0.3) failHistogram['rhythm_diversity'] = (failHistogram['rhythm_diversity'] || 0) + 1;
    }
  });
  
  return failHistogram;
}

function getTop5FailReasons(histogram: Record<string, number>): Array<[string, number]> {
  return Object.entries(histogram)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
}

function calculatePerHeadStats(results: EvalResult[]): Record<string, { min: number; mean: number; p95: number; count: number }> {
  const stats: Record<string, { min: number; mean: number; p95: number; count: number }> = {};
  
  // Collect all values for each metric
  const values: Record<string, number[]> = {};
  
  results.forEach(result => {
    const breakdown = result.breakdown;
    
    if (breakdown.melody) {
      Object.entries(breakdown.melody).forEach(([key, value]) => {
        if (typeof value === 'number') {
          const metricKey = `melody_${key}`;
          if (!values[metricKey]) values[metricKey] = [];
          values[metricKey].push(value);
        }
      });
    }
    
    if (breakdown.harmony) {
      Object.entries(breakdown.harmony).forEach(([key, value]) => {
        if (typeof value === 'number') {
          const metricKey = `harmony_${key}`;
          if (!values[metricKey]) values[metricKey] = [];
          values[metricKey].push(value);
        }
      });
    }
    
    if (breakdown.rhythm) {
      Object.entries(breakdown.rhythm).forEach(([key, value]) => {
        if (typeof value === 'number') {
          const metricKey = `rhythm_${key}`;
          if (!values[metricKey]) values[metricKey] = [];
          values[metricKey].push(value);
        }
      });
    }
  });
  
  // Calculate stats for each metric
  Object.entries(values).forEach(([metric, vals]) => {
    if (vals.length > 0) {
      const sorted = vals.sort((a, b) => a - b);
      const min = sorted[0];
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      
      stats[metric] = { min, mean, p95, count: vals.length };
    }
  });
  
  return stats;
}

function calculateSliceStability(snapshots: SnapshotRecord[]): { fire: number; earth: number; air: number; water: number } {
  const elements = { fire: 0, earth: 0, air: 0, water: 0 };
  
  snapshots.forEach(record => {
    const dominantElements = record.snap.dominantElements;
    
    // Find the element with the highest value
    let maxElement = 'fire';
    let maxValue = dominantElements.fire;
    
    if (dominantElements.earth > maxValue) { maxElement = 'earth'; maxValue = dominantElements.earth; }
    if (dominantElements.air > maxValue) { maxElement = 'air'; maxValue = dominantElements.air; }
    if (dominantElements.water > maxValue) { maxElement = 'water'; maxValue = dominantElements.water; }
    
    elements[maxElement as keyof typeof elements]++;
  });
  
  return elements;
}

async function testDeterminism(snapshots: SnapshotRecord[]): Promise<boolean> {
  // Re-evaluate 20 random samples
  const sampleSize = Math.min(20, snapshots.length);
  const sampleIndices = Array.from({length: sampleSize}, (_, i) => i);
  
  // First run
  setSeed(1337);
  const results1: boolean[] = [];
  
  for (let i = 0; i < sampleSize; i++) {
    const record = snapshots[sampleIndices[i]];
    const featArray = new Float32Array(record.feat) as FeatureVec;
    const vector = await studentVector(featArray);
    const plan = planFromVector(vector.vector as V6);
    const auditionResult = audition(plan);
    results1.push(auditionResult.ruleQuality?.ok || false);
  }
  
  // Second run
  setSeed(1337);
  const results2: boolean[] = [];
  
  for (let i = 0; i < sampleSize; i++) {
    const record = snapshots[sampleIndices[i]];
    const featArray = new Float32Array(record.feat) as FeatureVec;
    const vector = await studentVector(featArray);
    const plan = planFromVector(vector.vector as V6);
    const auditionResult = audition(plan);
    results2.push(auditionResult.ruleQuality?.ok || false);
  }
  
  // Compare results
  const identical = results1.every((result, i) => result === results2[i]);
  return identical;
}

async function evaluateChart(record: SnapshotRecord): Promise<EvalResult> {
  const startTime = Date.now();
  
  try {
    // Get model prediction
    const featArray = new Float32Array(record.feat) as FeatureVec;
    const vector = await studentVector(featArray);
    
    // Generate plan
    const plan = planFromVector(vector.vector as V6);
    
    // Evaluate plan
    const auditionResult = audition(plan);
    
    const endTime = Date.now();
    const latencyMs = endTime - startTime;
    
    return {
      chartId: record.id,
      passed: auditionResult.ruleQuality?.ok || false,
      qualityScore: auditionResult.ruleQuality?.score || 0,
      latencyMs,
      breakdown: auditionResult.ruleQuality?.breakdown || {}
    };
  } catch (error) {
    const endTime = Date.now();
    const latencyMs = endTime - startTime;
    
    console.error(`Error evaluating chart ${record.id}:`, error);
    return {
      chartId: record.id,
      passed: false,
      qualityScore: 0,
      latencyMs,
      breakdown: {}
    };
  }
}

async function generateSummary(results: EvalResult[], snapshots: SnapshotRecord[]): Promise<EvalSummary> {
  const totalCharts = results.length;
  const passedCharts = results.filter(r => r.passed).length;
  const passRate = passedCharts / totalCharts;
  
  const qualityScores = results.map(r => r.qualityScore);
  const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
  
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  
  const failHistogram = calculateGateFailHistogram(results);
  const top5FailReasons = getTop5FailReasons(failHistogram);
  const perHeadStats = calculatePerHeadStats(results);
  const sliceStability = calculateSliceStability(snapshots);
  
  // Calculate slice pass rates
  const first100Results = results.slice(0, 100);
  const last100Results = results.slice(-100);
  const slicePassRateFirst100 = first100Results.filter(r => r.passed).length / first100Results.length;
  const slicePassRateLast100 = last100Results.filter(r => r.passed).length / last100Results.length;
  
  // Test determinism
  const determinism_20_random = await testDeterminism(snapshots);
  
  // Model identity
  const modelDir = path.resolve(process.cwd(), 'models', 'student-v2.2');
  const modelFile = path.join(modelDir, 'model.json');
  const weightsFile = path.join(modelDir, 'group1-shard1of1.bin');
  
  let modelJsonHash = 'unknown';
  let shardHash = 'unknown';
  let shardBytes = 0;
  
  if (fs.existsSync(modelFile)) {
    const modelContent = fs.readFileSync(modelFile);
    modelJsonHash = crypto.createHash('sha256').update(modelContent).digest('hex').slice(0, 16).toUpperCase();
  }
  
  if (fs.existsSync(weightsFile)) {
    const weightsContent = fs.readFileSync(weightsFile);
    shardBytes = weightsContent.length;
    shardHash = crypto.createHash('sha256').update(weightsContent).digest('hex').slice(0, 16).toUpperCase();
  }
  
  // Git commit hash
  let commitHash = 'unknown';
  try {
    const { execSync } = require('child_process');
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 8);
  } catch (error) {
    console.warn('Could not get git commit hash:', error);
  }
  
  return {
    totalCharts,
    passedCharts,
    passRate,
    avgQuality,
    p50Latency,
    p95Latency,
    top5FailReasons,
    completeFailHistogram: failHistogram,
    perHeadStats,
    featureEncoder: {
      signature: '64-dim',
      dimensions: 64,
      scalerInfo: 'No scalers persisted at train time - using raw feature values'
    },
    headMapping: {
      melody_arc: 'Derived from plan events (not direct model output)',
      melody_motif: 'Derived from plan events (not direct model output)',
      melody_contour: 'Derived from plan events (not direct model output)',
      melody_stepLeap: 'Derived from plan events (not direct model output)',
      melody_range: 'Derived from plan events (not direct model output)',
      melody_narrative: 'Derived from plan events (not direct model output)',
      melody_gaming: 'Derived from plan events (not direct model output)',
      harmony_progression: 'Derived from plan events (not direct model output)',
      harmony_complexity: 'Derived from plan events (not direct model output)',
      harmony_voiceLeading: 'Derived from plan events (not direct model output)',
      harmony_tension: 'Derived from plan events (not direct model output)',
      rhythm_syncopation: 'Derived from plan events (not direct model output)',
      rhythm_tempo: 'Derived from plan events (not direct model output)',
      rhythm_groove: 'Derived from plan events (not direct model output)',
      rhythm_diversity: 'Derived from plan events (not direct model output)'
    },
    sliceStability,
    slicePassRateFirst100,
    slicePassRateLast100,
    determinism_20_random,
    manifestPath: path.resolve(process.cwd(), 'datasets', 'snapshots.jsonl'),
    realized_N: totalCharts,
    modelJsonHash,
    shardHash,
    shardBytes,
    commitHash
  };
}

async function main(): Promise<void> {
  console.log("🚀 PHASE-2C EVALUATION (Student-v2.2)");
  console.log("=====================================");
  
  // Set deterministic seed
  setSeed(1337);
  
  // Load snapshots
  console.log("\n📊 Loading snapshots...");
  const snapshots = await loadSnapshots();
  console.log(`   Loaded ${snapshots.length} snapshots`);
  
  if (snapshots.length !== 1000) {
    throw new Error(`Expected 1000 snapshots, got ${snapshots.length}`);
  }
  
  // Initialize TensorFlow
  console.log("\n🧠 Initializing TensorFlow...");
  await tf.setBackend('wasm');
  await tf.ready();
  
  // Run evaluation
  console.log("\n⚡ Running evaluation...");
  const results: EvalResult[] = [];
  const batchSize = 50;
  
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(snapshots.length / batchSize)} (${batch.length} charts)`);
    
    const batchResults = await Promise.all(batch.map(record => evaluateChart(record)));
    results.push(...batchResults);
  }
  
  console.log(`\n✅ Evaluation complete: ${results.length} charts processed`);
  
  // Generate summary
  console.log("\n📈 Generating summary...");
  const summary = await generateSummary(results, snapshots);
  
  // Save artifacts
  const evalDir = path.resolve(process.cwd(), 'eval', 'v2c_1000');
  if (!fs.existsSync(evalDir)) {
    fs.mkdirSync(evalDir, { recursive: true });
  }
  
  // Save metrics.csv
  const metricsCsv = results.map(r => `${r.chartId},${r.passed},${r.qualityScore},${r.latencyMs}`).join('\n');
  const csvHeader = 'chart_id,passed,quality_score,latency_ms\n';
  fs.writeFileSync(path.join(evalDir, 'metrics.csv'), csvHeader + metricsCsv);
  
  // Save summary.json
  fs.writeFileSync(path.join(evalDir, 'summary.json'), JSON.stringify(summary, null, 2));
  
  // Save snapshots.jsonl
  const snapshotsJsonl = snapshots.map(s => JSON.stringify(s)).join('\n');
  fs.writeFileSync(path.join(evalDir, 'snapshots.jsonl'), snapshotsJsonl);
  
  console.log(`\n💾 Artifacts saved to: ${evalDir}`);
  
  // Print RESULTS block
  console.log("\n🎯 RESULTS v2.2 (1000):");
  console.log(`pass_rate=${summary.passRate.toFixed(3)}`);
  console.log(`avg_quality=${summary.avgQuality.toFixed(3)}`);
  console.log(`p50_latency_ms=${summary.p50Latency}`);
  console.log(`p95_latency_ms=${summary.p95Latency}`);
  console.log(`top5_fail_hist=[${summary.top5FailReasons.map(([k,v]) => `(${k},${v})`).join(',')}]`);
  console.log(`slice_pass_rate_first100=${summary.slicePassRateFirst100.toFixed(3)}`);
  console.log(`slice_pass_rate_last100=${summary.slicePassRateLast100.toFixed(3)}`);
  console.log(`determinism_20_random=${summary.determinism_20_random}`);
  console.log(`artifacts_dir=${evalDir}`);
  console.log(`manifest_path=${summary.manifestPath}`);
  console.log(`realized_N=${summary.realized_N}`);
  console.log(`model_json_sha256=${summary.modelJsonHash}`);
  console.log(`shard_sha256=${summary.shardHash}`);
  console.log(`model_shard_bytes=${summary.shardBytes}`);
  console.log(`commit=${summary.commitHash}`);
  
  console.log("\n🎉 Phase-2C evaluation complete!");
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
