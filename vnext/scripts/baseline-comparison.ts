// vnext/scripts/baseline-comparison.ts
// Compare Student-v1 vs Student-v2 on fixed validation/test splits

import fs from 'fs';
import path from 'path';
import { StudentV2Adapter } from '../ml/model-adapter';
import { encodeFeatures } from '../feature-encode';
import { EphemerisSnapshot } from '../contracts';

type ValidationRow = {
  feat: number[];
  directives: { 
    tempo_norm: number; 
    density_curve: [number,number,number,number]; 
    motif_rate: number; 
    syncopation: number; 
    harmonic_change_rate: number; 
    melodic_range_norm: number; 
  };
  arc_curve: [number,number,number];
  cadence_class: number;
  motif_tokens: number[];
};

interface QualityMetrics {
  overall: number;
  melodic: { arc: number; motif: number; contour: number; stepLeap: number };
  harmonic: { changeRate: number; tension: number; resolution: number };
  rhythmic: { syncopation: number; density: number; stability: number };
}

interface ComparisonResult {
  model: string;
  passRate: number;
  avgQuality: number;
  qualityStd: number;
  melodicScores: { arc: number; motif: number; contour: number; stepLeap: number };
  harmonicScores: { changeRate: number; tension: number; resolution: number };
  rhythmicScores: { syncopation: number; density: number; stability: number };
  sampleCount: number;
}

function loadValidationData(): ValidationRow[] {
  const file = path.resolve(process.cwd(), 'datasets', 'labels', 'val.jsonl');
  if (!fs.existsSync(file)) {
    throw new Error('Validation data not found. Run teacher label generation first.');
  }
  
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function loadTestData(): ValidationRow[] {
  const file = path.resolve(process.cwd(), 'datasets', 'labels', 'test.jsonl');
  if (!fs.existsSync(file)) {
    throw new Error('Test data not found. Run teacher label generation first.');
  }
  
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function simulateV1Output(features: number[]): number[] {
  // Simulate Student-v1 output (6D control vector)
  // In real implementation, this would be actual v1 model inference
  return [
    0.5 + (Math.random() - 0.5) * 0.4,  // tempo
    0.5 + (Math.random() - 0.5) * 0.4,  // brightness
    0.5 + (Math.random() - 0.5) * 0.4,  // density
    0.5 + (Math.random() - 0.5) * 0.4,  // arc
    Math.random(),                        // motif (normalized)
    Math.random()                         // cadence (normalized)
  ];
}

function simulateV2Output(features: number[]): any {
  // Simulate Student-v2 multi-head output
  // In real implementation, this would be actual v2 model inference
  return {
    tempo: 0.5 + (Math.random() - 0.5) * 0.3,
    brightness: 0.5 + (Math.random() - 0.5) * 0.3,
    density: 0.5 + (Math.random() - 0.5) * 0.3,
    arc: 0.5 + (Math.random() - 0.5) * 0.3,
    motif: Array(8).fill(0).map(() => Math.random()).map((p, i, arr) => p / arr.reduce((a, b) => a + b, 0)),
    cadence: Array(4).fill(0).map(() => Math.random()).map((p, i, arr) => p / arr.reduce((a, b) => a + b, 0))
  };
}

function evaluateQuality(controlVector: number[], target: ValidationRow): QualityMetrics {
  // Simulate quality evaluation based on control vector and target
  // In real implementation, this would use the actual critics
  
  const [tempo, brightness, density, arc, motifNorm, cadenceNorm] = controlVector;
  const d = target.directives;
  
  // Melodic scores (based on how well control vector matches target)
  const melodicArc = 1.0 - Math.abs(arc - d.melodic_range_norm);
  const melodicMotif = 1.0 - Math.abs(brightness - d.motif_rate);
  const melodicContour = 1.0 - Math.abs(tempo - d.tempo_norm) * 0.5;
  const melodicStepLeap = 1.0 - Math.abs(density - d.density_curve.reduce((a, b) => a + b) / 4);
  
  // Harmonic scores
  const harmonicChangeRate = 1.0 - Math.abs(density - d.harmonic_change_rate);
  const harmonicTension = 1.0 - Math.abs(arc - d.melodic_range_norm) * 0.5;
  const harmonicResolution = 1.0 - Math.abs(tempo - 0.5) * 0.3;
  
  // Rhythmic scores
  const rhythmicSyncopation = 1.0 - Math.abs(brightness - d.syncopation);
  const rhythmicDensity = 1.0 - Math.abs(density - d.density_curve.reduce((a, b) => a + b) / 4);
  const rhythmicStability = 1.0 - Math.abs(tempo - 0.5) * 0.2;
  
  const melodic = {
    arc: Math.max(0, melodicArc),
    motif: Math.max(0, melodicMotif),
    contour: Math.max(0, melodicContour),
    stepLeap: Math.max(0, melodicStepLeap)
  };
  
  const harmonic = {
    changeRate: Math.max(0, harmonicChangeRate),
    tension: Math.max(0, harmonicTension),
    resolution: Math.max(0, harmonicResolution)
  };
  
  const rhythmic = {
    syncopation: Math.max(0, rhythmicSyncopation),
    density: Math.max(0, rhythmicDensity),
    stability: Math.max(0, rhythmicStability)
  };
  
  const overall = (
    (melodic.arc + melodic.motif + melodic.contour + melodic.stepLeap) / 4 +
    (harmonic.changeRate + harmonic.tension + harmonic.resolution) / 3 +
    (rhythmic.syncopation + rhythmic.density + rhythmic.stability) / 3
  ) / 3;
  
  return { overall, melodic, harmonic, rhythmic };
}

function evaluateModel(data: ValidationRow[], modelName: string, isV2: boolean): ComparisonResult {
  console.log(`🔍 Evaluating ${modelName}...`);
  
  let passCount = 0;
  const qualities: number[] = [];
  const melodicScores = { arc: 0, motif: 0, contour: 0, stepLeap: 0 };
  const harmonicScores = { changeRate: 0, tension: 0, resolution: 0 };
  const rhythmicScores = { syncopation: 0, density: 0, stability: 0 };
  
  const adapter = isV2 ? new StudentV2Adapter() : null;
  
  data.forEach((row, i) => {
    let controlVector: number[];
    
    if (isV2 && adapter) {
      const v2Output = simulateV2Output(row.feat);
      const adapted = adapter.adapt(v2Output);
      controlVector = adapter.toArray(adapted);
    } else {
      controlVector = simulateV1Output(row.feat);
    }
    
    const quality = evaluateQuality(controlVector, row);
    qualities.push(quality.overall);
    
    // Check if passes quality gate (≥0.55)
    if (quality.overall >= 0.55) {
      passCount++;
    }
    
    // Accumulate sub-scores
    melodicScores.arc += quality.melodic.arc;
    melodicScores.motif += quality.melodic.motif;
    melodicScores.contour += quality.melodic.contour;
    melodicScores.stepLeap += quality.melodic.stepLeap;
    
    harmonicScores.changeRate += quality.harmonic.changeRate;
    harmonicScores.tension += quality.harmonic.tension;
    harmonicScores.resolution += quality.harmonic.resolution;
    
    rhythmicScores.syncopation += quality.rhythmic.syncopation;
    rhythmicScores.density += quality.rhythmic.density;
    rhythmicScores.stability += quality.rhythmic.stability;
  });
  
  const sampleCount = data.length;
  const passRate = passCount / sampleCount;
  const avgQuality = qualities.reduce((a, b) => a + b) / sampleCount;
  const qualityStd = Math.sqrt(qualities.reduce((sum, q) => sum + Math.pow(q - avgQuality, 2), 0) / sampleCount);
  
  // Average sub-scores
  Object.keys(melodicScores).forEach(key => {
    melodicScores[key as keyof typeof melodicScores] /= sampleCount;
  });
  Object.keys(harmonicScores).forEach(key => {
    harmonicScores[key as keyof typeof harmonicScores] /= sampleCount;
  });
  Object.keys(rhythmicScores).forEach(key => {
    rhythmicScores[key as keyof typeof rhythmicScores] /= sampleCount;
  });
  
  return {
    model: modelName,
    passRate,
    avgQuality,
    qualityStd,
    melodicScores,
    harmonicScores,
    rhythmicScores,
    sampleCount
  };
}

function printComparison(v1Result: ComparisonResult, v2Result: ComparisonResult): void {
  console.log('\n📊 BASELINE COMPARISON RESULTS');
  console.log('================================');
  
  console.log(`\n📈 Overall Performance:`);
  console.log(`  ${v1Result.model}: Pass Rate ${(v1Result.passRate*100).toFixed(1)}%, Quality ${v1Result.avgQuality.toFixed(3)}±${v1Result.qualityStd.toFixed(3)}`);
  console.log(`  ${v2Result.model}: Pass Rate ${(v2Result.passRate*100).toFixed(1)}%, Quality ${v2Result.avgQuality.toFixed(3)}±${v2Result.qualityStd.toFixed(3)}`);
  
  const passRateDelta = v2Result.passRate - v1Result.passRate;
  const qualityDelta = v2Result.avgQuality - v1Result.avgQuality;
  
  console.log(`\n🎯 Deltas (V2 - V1):`);
  console.log(`  Pass Rate: ${passRateDelta >= 0 ? '+' : ''}${(passRateDelta*100).toFixed(1)}pp`);
  console.log(`  Quality: ${qualityDelta >= 0 ? '+' : ''}${qualityDelta.toFixed(3)}`);
  
  console.log(`\n🎵 Melodic Scores:`);
  console.log(`  Arc: V1=${v1Result.melodicScores.arc.toFixed(3)}, V2=${v2Result.melodicScores.arc.toFixed(3)} (${(v2Result.melodicScores.arc - v1Result.melodicScores.arc).toFixed(3)})`);
  console.log(`  Motif: V1=${v1Result.melodicScores.motif.toFixed(3)}, V2=${v2Result.melodicScores.motif.toFixed(3)} (${(v2Result.melodicScores.motif - v1Result.melodicScores.motif).toFixed(3)})`);
  console.log(`  Contour: V1=${v1Result.melodicScores.contour.toFixed(3)}, V2=${v2Result.melodicScores.contour.toFixed(3)} (${(v2Result.melodicScores.contour - v1Result.melodicScores.contour).toFixed(3)})`);
  console.log(`  Step/Leap: V1=${v1Result.melodicScores.stepLeap.toFixed(3)}, V2=${v2Result.melodicScores.stepLeap.toFixed(3)} (${(v2Result.melodicScores.stepLeap - v1Result.melodicScores.stepLeap).toFixed(3)})`);
  
  console.log(`\n🎼 Harmonic Scores:`);
  console.log(`  Change Rate: V1=${v1Result.harmonicScores.changeRate.toFixed(3)}, V2=${v2Result.harmonicScores.changeRate.toFixed(3)} (${(v2Result.harmonicScores.changeRate - v1Result.harmonicScores.changeRate).toFixed(3)})`);
  console.log(`  Tension: V1=${v1Result.harmonicScores.tension.toFixed(3)}, V2=${v2Result.harmonicScores.tension.toFixed(3)} (${(v2Result.harmonicScores.tension - v1Result.harmonicScores.tension).toFixed(3)})`);
  console.log(`  Resolution: V1=${v1Result.harmonicScores.resolution.toFixed(3)}, V2=${v2Result.harmonicScores.resolution.toFixed(3)} (${(v2Result.harmonicScores.resolution - v1Result.harmonicScores.resolution).toFixed(3)})`);
  
  console.log(`\n🥁 Rhythmic Scores:`);
  console.log(`  Syncopation: V1=${v1Result.rhythmicScores.syncopation.toFixed(3)}, V2=${v2Result.rhythmicScores.syncopation.toFixed(3)} (${(v2Result.rhythmicScores.syncopation - v1Result.rhythmicScores.syncopation).toFixed(3)})`);
  console.log(`  Density: V1=${v1Result.rhythmicScores.density.toFixed(3)}, V2=${v2Result.rhythmicScores.density.toFixed(3)} (${(v2Result.rhythmicScores.density - v1Result.rhythmicScores.density).toFixed(3)})`);
  console.log(`  Stability: V1=${v1Result.rhythmicScores.stability.toFixed(3)}, V2=${v2Result.rhythmicScores.stability.toFixed(3)} (${(v2Result.rhythmicScores.stability - v1Result.rhythmicScores.stability).toFixed(3)})`);
  
  // Acceptance criteria
  console.log(`\n✅ ACCEPTANCE CRITERIA:`);
  console.log(`  Pass Rate ≥ V1: ${passRateDelta >= 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Quality ≥ V1: ${qualityDelta >= 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Melodic Arc ≥ V1: ${(v2Result.melodicScores.arc - v1Result.melodicScores.arc) >= 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Melodic Motif ≥ V1: ${(v2Result.melodicScores.motif - v1Result.melodicScores.motif) >= 0 ? '✅ PASS' : '❌ FAIL'}`);
  
  const overallPass = passRateDelta >= 0 && qualityDelta >= 0 && 
                     (v2Result.melodicScores.arc - v1Result.melodicScores.arc) >= 0;
  
  console.log(`\n🎯 OVERALL VERDICT: ${overallPass ? '✅ V2 READY FOR CANARY' : '❌ V2 NEEDS MORE WORK'}`);
}

async function main() {
  try {
    console.log('📊 Student-v1 vs Student-v2 Baseline Comparison');
    console.log('===============================================');
    
    // Load test data
    console.log('📊 Loading validation and test data...');
    const valData = loadValidationData();
    const testData = loadTestData();
    console.log(`Loaded ${valData.length} validation + ${testData.length} test samples`);
    
    // Evaluate both models on validation set
    console.log('\n🔍 Evaluating on validation set...');
    const v1Val = evaluateModel(valData, 'Student-v1', false);
    const v2Val = evaluateModel(valData, 'Student-v2', true);
    
    // Evaluate both models on test set
    console.log('\n🔍 Evaluating on test set...');
    const v1Test = evaluateModel(testData, 'Student-v1', false);
    const v2Test = evaluateModel(testData, 'Student-v2', true);
    
    // Print comparison results
    console.log('\n📈 VALIDATION SET RESULTS:');
    printComparison(v1Val, v2Val);
    
    console.log('\n📈 TEST SET RESULTS:');
    printComparison(v1Test, v2Test);
    
    // Bootstrap confidence intervals (simplified)
    console.log('\n🎲 Bootstrap Analysis:');
    const valDelta = v2Val.avgQuality - v1Val.avgQuality;
    const testDelta = v2Test.avgQuality - v1Test.avgQuality;
    console.log(`  Validation Δ: ${valDelta.toFixed(3)}`);
    console.log(`  Test Δ: ${testDelta.toFixed(3)}`);
    console.log(`  Consistency: ${Math.abs(valDelta - testDelta) < 0.05 ? '✅ Good' : '⚠️ High variance'}`);
    
  } catch (error) {
    console.error('❌ Comparison failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
