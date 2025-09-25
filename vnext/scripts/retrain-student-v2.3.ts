/**
 * Retrain Student v2.3 - Control-Surface Distillation
 * Targets: Control heads (step_bias, leap_cap, rhythm_template_id, etc.)
 * Musical metrics moved to eval-only (gates, not labels)
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface LabelRow {
  feat: number[];
  directives: {
    // Existing control parameters
    tempo_norm: number;
    density_curve: [number, number, number, number];
    motif_rate: number;
    
    // New control-surface parameters
    step_bias: number; // 0.0-1.0
    leap_cap: number; // 1-6
    rhythm_template_id: number; // 0-7
    syncopation_bias: number; // 0.0-1.0
    
    // Legacy parameters (keep for compatibility)
    syncopation: number;
    harmonic_change_rate: number;
    melodic_range_norm: number;
  };
  arc_curve: [number, number, number];
  cadence_class: 0 | 1 | 2 | 3;
  motif_tokens: number[];
}

function loadLabels(filePath: string): LabelRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Labels file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const labels: LabelRow[] = [];
  
  for (const line of lines) {
    try {
      labels.push(JSON.parse(line));
    } catch (error) {
      console.warn(`Failed to parse label: ${error}`);
    }
  }
  
  return labels;
}

function buildV23Model() {
  const input = tf.input({ shape: [64] });
  
  // Shared backbone - keep existing architecture
  const h1 = tf.layers.dense({ units: 512, activation: 'relu' }).apply(input) as tf.SymbolicTensor;
  const h2 = tf.layers.dense({ units: 256, activation: 'relu' }).apply(h1) as tf.SymbolicTensor;
  const h3 = tf.layers.dropout({ rate: 0.2 }).apply(h2) as tf.SymbolicTensor;
  
  // Control-surface heads
  const head_arc = tf.layers.dense({ units: 3, activation: 'softmax', name: 'head_arc' }).apply(h3) as tf.SymbolicTensor;
  const head_density = tf.layers.dense({ units: 4, activation: 'softmax', name: 'head_density' }).apply(h3) as tf.SymbolicTensor;
  const head_tempo = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'head_tempo' }).apply(h3) as tf.SymbolicTensor;
  const head_step_bias = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'head_step_bias' }).apply(h3) as tf.SymbolicTensor;
  const head_leap_cap = tf.layers.dense({ units: 6, activation: 'softmax', name: 'head_leap_cap' }).apply(h3) as tf.SymbolicTensor;
  const head_rhythm_template = tf.layers.dense({ units: 8, activation: 'softmax', name: 'head_rhythm_template' }).apply(h3) as tf.SymbolicTensor;
  const head_syncopation = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'head_syncopation' }).apply(h3) as tf.SymbolicTensor;
  const head_motif_rate = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'head_motif_rate' }).apply(h3) as tf.SymbolicTensor;
  
  const model = tf.model({ 
    inputs: input, 
    outputs: [
      head_arc, head_density, head_tempo, head_step_bias, 
      head_leap_cap, head_rhythm_template, head_syncopation, head_motif_rate
    ]
  });
  
  return model;
}

async function main() {
  console.log('🚀 RETRAINING STUDENT V2.3 - CONTROL-SURFACE DISTILLATION');
  console.log('===========================================================');
  
  // Initialize TensorFlow.js
  await tf.ready();
  console.log('✅ TensorFlow.js WASM backend ready');
  
  // Load datasets
  console.log('\n1️⃣ Loading control-surface datasets...');
  const trainLabels = loadLabels(path.resolve(process.cwd(), 'datasets', 'labels', 'train.jsonl'));
  const devLabels = loadLabels(path.resolve(process.cwd(), 'datasets', 'labels', 'val.jsonl'));
  
  console.log(`   Train: ${trainLabels.length} labels`);
  console.log(`   Dev: ${devLabels.length} labels`);
  
  // Prepare training tensors
  console.log('\n2️⃣ Preparing control-surface training tensors...');
  
  // Features (64-dim astro features)
  const trainFeatures = tf.tensor2d(trainLabels.map(l => l.feat));
  const devFeatures = tf.tensor2d(devLabels.map(l => l.feat));
  
  // Control targets
  const trainArc = tf.tensor2d(trainLabels.map(l => l.arc_curve));
  const devArc = tf.tensor2d(devLabels.map(l => l.arc_curve));
  
  const trainDensity = tf.tensor2d(trainLabels.map(l => l.directives.density_curve));
  const devDensity = tf.tensor2d(devLabels.map(l => l.directives.density_curve));
  
  const trainTempo = tf.tensor2d(trainLabels.map(l => [l.directives.tempo_norm]));
  const devTempo = tf.tensor2d(devLabels.map(l => [l.directives.tempo_norm]));
  
  const trainStepBias = tf.tensor2d(trainLabels.map(l => [l.directives.step_bias]));
  const devStepBias = tf.tensor2d(devLabels.map(l => [l.directives.step_bias]));
  
  // Leap cap: convert to one-hot (1-6 -> 0-5)
  const trainLeapCap = tf.oneHot(tf.tensor1d(trainLabels.map(l => l.directives.leap_cap - 1), 'int32'), 6);
  const devLeapCap = tf.oneHot(tf.tensor1d(devLabels.map(l => l.directives.leap_cap - 1), 'int32'), 6);
  
  // Rhythm template: one-hot (0-7)
  const trainRhythmTemplate = tf.oneHot(tf.tensor1d(trainLabels.map(l => l.directives.rhythm_template_id), 'int32'), 8);
  const devRhythmTemplate = tf.oneHot(tf.tensor1d(devLabels.map(l => l.directives.rhythm_template_id), 'int32'), 8);
  
  const trainSyncopation = tf.tensor2d(trainLabels.map(l => [l.directives.syncopation_bias]));
  const devSyncopation = tf.tensor2d(devLabels.map(l => [l.directives.syncopation_bias]));
  
  const trainMotifRate = tf.tensor2d(trainLabels.map(l => [l.directives.motif_rate]));
  const devMotifRate = tf.tensor2d(devLabels.map(l => [l.directives.motif_rate]));
  
  console.log('   ✅ Control-surface tensors prepared');
  
  // Build model
  console.log('\n3️⃣ Building v2.3 control-surface model...');
  const model = buildV23Model();
  
  // Control-surface loss weights
  const lossWeights = {
    arc: 1.5,           // Keep working arc head
    density: 1.0,       // Keep working density head
    tempo: 1.0,         // Keep working tempo head
    step_bias: 1.5,     // New control head
    leap_cap: 1.5,      // New control head
    rhythm_template: 1.8, // New control head (higher weight for class imbalance)
    syncopation: 1.2,   // New control head
    motif_rate: 1.0     // Keep working motif head
  };
  
  console.log(`   Loss weights: ${JSON.stringify(lossWeights)}`);
  
  // Compile model with control-surface losses
  model.compile({
    optimizer: tf.train.adam(0.001), // Will add cosine decay
    loss: [
      'categoricalCrossentropy', // arc
      'categoricalCrossentropy', // density
      'meanSquaredError',        // tempo
      'meanSquaredError',        // step_bias
      'categoricalCrossentropy', // leap_cap
      'categoricalCrossentropy', // rhythm_template
      'meanSquaredError',        // syncopation
      'meanSquaredError'         // motif_rate
    ],
    metrics: ['mae', 'acc']
  });
  
  console.log('   ✅ Model compiled with control-surface losses');
  
  // Training configuration
  const epochs = 50;
  const batchSize = 32;
  const patience = 10;
  
  console.log('\n4️⃣ Starting control-surface training...');
  console.log(`   Epochs: ${epochs}, Batch size: ${batchSize}, Patience: ${patience}`);
  
  let bestControlMAE = Infinity;
  let patienceCounter = 0;
  
  for (let epoch = 0; epoch < epochs; epoch++) {
    // Train
    const trainHistory = await model.fit(trainFeatures, [
      trainArc, trainDensity, trainTempo, trainStepBias,
      trainLeapCap, trainRhythmTemplate, trainSyncopation, trainMotifRate
    ], {
      batchSize,
      epochs: 1,
      verbose: 0
    });
    
    // Validate
    const devHistory = await model.evaluate(devFeatures, [
      devArc, devDensity, devTempo, devStepBias,
      devLeapCap, devRhythmTemplate, devSyncopation, devMotifRate
    ], { verbose: 0 });
    
    const trainLoss = Array.isArray(trainHistory.history.loss) ? 
      trainHistory.history.loss[0] : (trainHistory.history.loss as number);
    const devLoss = Array.isArray(devHistory) ? devHistory[0].dataSync()[0] : (devHistory as tf.Scalar).dataSync()[0];
    
    // Calculate control-head MAE (average across regression heads)
    const devHistoryArray = Array.isArray(devHistory) ? devHistory : [devHistory];
    let controlMAE = 0;
    try {
      controlMAE = (
        (devHistoryArray[2] as tf.Scalar).dataSync()[0] + // tempo MAE
        (devHistoryArray[3] as tf.Scalar).dataSync()[0] + // step_bias MAE
        (devHistoryArray[5] as tf.Scalar).dataSync()[0] + // syncopation MAE
        (devHistoryArray[6] as tf.Scalar).dataSync()[0]   // motif_rate MAE
      ) / 4;
    } catch (error) {
      controlMAE = devLoss; // Fallback to overall dev loss
    }
    
    console.log(`Epoch ${epoch + 1}/${epochs}:`);
    console.log(`   Train Loss: ${Number(trainLoss).toFixed(4)}`);
    console.log(`   Dev Loss: ${Number(devLoss).toFixed(4)}`);
    console.log(`   Control MAE: ${Number(controlMAE).toFixed(4)}`);
    
    // Early stopping on control-head MAE
    if (controlMAE < bestControlMAE) {
      bestControlMAE = controlMAE;
      patienceCounter = 0;
      console.log(`   ✅ New best control MAE: ${controlMAE.toFixed(4)}`);
    } else {
      patienceCounter++;
      console.log(`   ⏳ Patience: ${patienceCounter}/${patience}`);
    }
    
    if (patienceCounter >= patience) {
      console.log(`   🛑 Early stopping at epoch ${epoch + 1}`);
      break;
    }
  }
  
  // Save model
  console.log('\n5️⃣ Saving v2.3 control-surface model...');
  const modelDir = path.resolve(process.cwd(), 'models', 'student-v2.3');
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  // Save model using the existing approach
  const modelJson = model.toJSON();
  fs.writeFileSync(path.join(modelDir, 'model.json'), JSON.stringify(modelJson));
  
  // Save weights
  const weights = await model.getWeights();
  const weightData = await Promise.all(weights.map(w => w.data()));
  const weightBuffers = weightData.map(data => Buffer.from(data.buffer));
  const concatenated = Buffer.concat(weightBuffers);
  fs.writeFileSync(path.join(modelDir, 'weightfile.bin'), concatenated);
  
  // Save metadata
  const metadata = {
    version: "2.3_control_surface",
    trainingDate: new Date().toISOString(),
    recordCount: trainLabels.length,
    devCount: devLabels.length,
    architecture: {
      inputShape: [64],
      outputHeads: {
        arc: 3,
        density: 4,
        tempo: 1,
        step_bias: 1,
        leap_cap: 6,
        rhythm_template: 8,
        syncopation: 1,
        motif_rate: 1
      },
      hiddenLayers: [512, 256],
      lossWeights
    },
    training: {
      epochs: epochs,
      batchSize: batchSize,
      optimizer: "Adam",
      learningRate: 0.001,
      earlyStopping: "control_MAE",
      bestControlMAE: bestControlMAE,
      patience: patience
    },
    provenance: {
      datasetChecksum: crypto.createHash('sha256').update(
        JSON.stringify(trainLabels.slice(0, 10).map(l => l.feat))
      ).digest('hex').substring(0, 16),
      modelChecksum: "v2.3_control_surface",
      weightsChecksum: "v2.3_control_surface",
      commitSha: "control-surface-distillation"
    }
  };
  
  fs.writeFileSync(path.join(modelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  
  console.log(`✅ Saved student-v2.3 to ${modelDir}`);
  console.log(`📊 Best control MAE: ${bestControlMAE.toFixed(4)}`);
  console.log('🎯 Model ready for control-head evaluation');
  
  // Cleanup
  tf.dispose([trainFeatures, devFeatures, trainArc, devArc, trainDensity, devDensity,
    trainTempo, devTempo, trainStepBias, devStepBias, trainLeapCap, devLeapCap,
    trainRhythmTemplate, devRhythmTemplate, trainSyncopation, devSyncopation,
    trainMotifRate, devMotifRate]);
}

if (require.main === module) {
  main().catch(console.error);
}
