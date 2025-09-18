// vnext/scripts/calibrate-v2.ts
// Calibrate Student-v2 multi-head outputs to target ranges using validation set

import fs from 'fs';
import path from 'path';
import { StudentV2Adapter, StudentV2Outputs, CalibrationParams } from '../ml/model-adapter';

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

interface CalibrationStats {
  tempo: { min: number; max: number; mean: number; std: number };
  brightness: { min: number; max: number; mean: number; std: number };
  density: { min: number; max: number; mean: number; std: number };
  arc: { min: number; max: number; mean: number; std: number };
  motif: { entropy: number; diversity: number };
  cadence: { entropy: number; diversity: number };
}

function loadValidationData(): ValidationRow[] {
  const file = path.resolve(process.cwd(), 'datasets', 'labels', 'val.jsonl');
  if (!fs.existsSync(file)) {
    throw new Error('Validation data not found. Run teacher label generation first.');
  }
  
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function simulateV2Outputs(rows: ValidationRow[]): StudentV2Outputs[] {
  // Simulate Student-v2 outputs based on validation targets
  // In real implementation, this would be actual model predictions
  return rows.map(row => {
    const d = row.directives;
    const arc = row.arc_curve;
    
    // Simulate realistic multi-head outputs
    return {
      tempo: d.tempo_norm + (Math.random() - 0.5) * 0.1, // Add some noise
      brightness: (d.motif_rate + d.syncopation) / 2 + (Math.random() - 0.5) * 0.1,
      density: d.density_curve.reduce((a, b) => a + b) / 4 + (Math.random() - 0.5) * 0.1,
      arc: arc.reduce((a, b) => a + b) / 3 + (Math.random() - 0.5) * 0.1,
      
      // Simulate softmax outputs with some noise
      motif: Array(8).fill(0).map((_, i) => {
        const base = row.motif_tokens.includes(i) ? 0.8 : 0.025;
        return base + (Math.random() - 0.5) * 0.05;
      }).map(p => Math.max(0, p)),
      
      cadence: Array(4).fill(0).map((_, i) => {
        const base = i === row.cadence_class ? 0.8 : 0.067;
        return base + (Math.random() - 0.5) * 0.05;
      }).map(p => Math.max(0, p))
    };
  });
}

function calculateStats(outputs: StudentV2Outputs[]): CalibrationStats {
  const tempo = outputs.map(o => o.tempo);
  const brightness = outputs.map(o => o.brightness);
  const density = outputs.map(o => o.density);
  const arc = outputs.map(o => o.arc);
  
  const motifEntropies = outputs.map(o => {
    const probs = o.motif.filter(p => p > 0);
    return -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  });
  
  const cadenceEntropies = outputs.map(o => {
    const probs = o.cadence.filter(p => p > 0);
    return -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  });
  
  return {
    tempo: calculateBasicStats(tempo),
    brightness: calculateBasicStats(brightness),
    density: calculateBasicStats(density),
    arc: calculateBasicStats(arc),
    motif: {
      entropy: motifEntropies.reduce((a, b) => a + b) / motifEntropies.length,
      diversity: new Set(outputs.flatMap(o => o.motif.map((p, i) => p > 0.1 ? i : -1))).size
    },
    cadence: {
      entropy: cadenceEntropies.reduce((a, b) => a + b) / cadenceEntropies.length,
      diversity: new Set(outputs.flatMap(o => o.cadence.map((p, i) => p > 0.1 ? i : -1))).size
    }
  };
}

function calculateBasicStats(values: number[]): { min: number; max: number; mean: number; std: number } {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean,
    std: Math.sqrt(variance)
  };
}

function computeCalibration(stats: CalibrationStats): CalibrationParams {
  console.log('🎯 Computing calibration parameters...');
  
  // Target ranges (based on v1 model behavior and musical constraints)
  const targets = {
    tempo: { min: 0.2, max: 0.8 },      // Avoid extreme tempos
    brightness: { min: 0.1, max: 0.9 }, // Good brightness range
    density: { min: 0.3, max: 0.7 },    // Moderate density range
    arc: { min: 0.2, max: 0.8 }         // Good arc range
  };
  
  // Compute linear scaling and offset for each head
  const calibration: CalibrationParams = {
    tempo: computeLinearCalibration(stats.tempo, targets.tempo),
    brightness: computeLinearCalibration(stats.brightness, targets.brightness),
    density: computeLinearCalibration(stats.density, targets.density),
    arc: computeLinearCalibration(stats.arc, targets.arc),
    
    // Temperature scaling for categorical outputs
    motif: { temperature: Math.max(0.5, Math.min(2.0, 2.0 - stats.motif.entropy)) },
    cadence: { temperature: Math.max(0.5, Math.min(2.0, 2.0 - stats.cadence.entropy)) }
  };
  
  console.log('📊 Calibration computed:');
  console.log(`  Tempo: scale=${calibration.tempo.scale.toFixed(3)}, offset=${calibration.tempo.offset.toFixed(3)}`);
  console.log(`  Brightness: scale=${calibration.brightness.scale.toFixed(3)}, offset=${calibration.brightness.offset.toFixed(3)}`);
  console.log(`  Density: scale=${calibration.density.scale.toFixed(3)}, offset=${calibration.density.offset.toFixed(3)}`);
  console.log(`  Arc: scale=${calibration.arc.scale.toFixed(3)}, offset=${calibration.arc.offset.toFixed(3)}`);
  console.log(`  Motif temp: ${calibration.motif.temperature.toFixed(3)}`);
  console.log(`  Cadence temp: ${calibration.cadence.temperature.toFixed(3)}`);
  
  return calibration;
}

function computeLinearCalibration(
  current: { min: number; max: number; mean: number },
  target: { min: number; max: number }
): { scale: number; offset: number } {
  // Map [current.min, current.max] to [target.min, target.max]
  const scale = (target.max - target.min) / (current.max - current.min);
  const offset = target.min - scale * current.min;
  
  return { scale, offset };
}

function validateCalibration(
  outputs: StudentV2Outputs[],
  calibration: CalibrationParams,
  targets: ValidationRow[]
): void {
  console.log('🧪 Validating calibration...');
  
  const adapter = new StudentV2Adapter(calibration);
  
  let tempoInRange = 0;
  let brightnessInRange = 0;
  let densityInRange = 0;
  let arcInRange = 0;
  let motifCorrect = 0;
  let cadenceCorrect = 0;
  
  outputs.forEach((output, i) => {
    const controlVector = adapter.adapt(output);
    const target = targets[i];
    
    // Check continuous outputs are in reasonable ranges
    if (controlVector.tempo >= 0.2 && controlVector.tempo <= 0.8) tempoInRange++;
    if (controlVector.brightness >= 0.1 && controlVector.brightness <= 0.9) brightnessInRange++;
    if (controlVector.density >= 0.3 && controlVector.density <= 0.7) densityInRange++;
    if (controlVector.arc >= 0.2 && controlVector.arc <= 0.8) arcInRange++;
    
    // Check categorical outputs match targets (with some tolerance)
    if (target.motif_tokens.includes(controlVector.motifSelection)) motifCorrect++;
    if (controlVector.cadenceSelection === target.cadence_class) cadenceCorrect++;
  });
  
  const total = outputs.length;
  console.log(`📈 Calibration validation results (${total} samples):`);
  console.log(`  Tempo in range: ${tempoInRange}/${total} (${(tempoInRange/total*100).toFixed(1)}%)`);
  console.log(`  Brightness in range: ${brightnessInRange}/${total} (${(brightnessInRange/total*100).toFixed(1)}%)`);
  console.log(`  Density in range: ${densityInRange}/${total} (${(densityInRange/total*100).toFixed(1)}%)`);
  console.log(`  Arc in range: ${arcInRange}/${total} (${(arcInRange/total*100).toFixed(1)}%)`);
  console.log(`  Motif correct: ${motifCorrect}/${total} (${(motifCorrect/total*100).toFixed(1)}%)`);
  console.log(`  Cadence correct: ${cadenceCorrect}/${total} (${(cadenceCorrect/total*100).toFixed(1)}%)`);
}

function saveCalibration(calibration: CalibrationParams): void {
  const modelDir = path.resolve(process.cwd(), 'models', 'student-v2');
  const metadataPath = path.join(modelDir, 'metadata.json');
  
  // Load existing metadata
  let metadata: any = {};
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }
  
  // Add calibration parameters
  metadata.calibration = calibration;
  metadata.calibrationDate = new Date().toISOString();
  
  // Save updated metadata
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`✅ Calibration saved to ${metadataPath}`);
}

async function main() {
  try {
    console.log('🎯 Student-v2 Calibration');
    console.log('=========================');
    
    // Load validation data
    console.log('📊 Loading validation data...');
    const validationData = loadValidationData();
    console.log(`Loaded ${validationData.length} validation samples`);
    
    // Simulate v2 outputs (replace with actual model inference)
    console.log('🤖 Simulating Student-v2 outputs...');
    const v2Outputs = simulateV2Outputs(validationData);
    
    // Calculate statistics
    console.log('📈 Calculating output statistics...');
    const stats = calculateStats(v2Outputs);
    console.log('Raw output statistics:', stats);
    
    // Compute calibration
    const calibration = computeCalibration(stats);
    
    // Validate calibration
    validateCalibration(v2Outputs, calibration, validationData);
    
    // Save calibration to model metadata
    saveCalibration(calibration);
    
    console.log('🎉 Calibration complete!');
    
  } catch (error) {
    console.error('❌ Calibration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
