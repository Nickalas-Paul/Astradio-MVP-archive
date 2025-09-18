// vnext/scripts/train-student-v2-fallback.ts
// Multi-head student training script with TensorFlow.js fallback support
// Uses browser backend when tfjs-node fails (Windows compatibility)

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// TypeScript types for TensorFlow.js
type TensorFlow = any;
type LayersModel = any;
type Tensor2D = any;
type SymbolicTensor = any;

type Row = {
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
  cadence_class: number; // 0..3
  motif_tokens: number[]; // up to 8 ids
};

let tf: TensorFlow;
let backend: string;

async function ensureTF() {
  if (!tf) {
    try {
      // Try tfjs-node first (preferred for training)
      console.log('🧠 Attempting TensorFlow.js Node backend...');
      tf = await import("@tensorflow/tfjs-node");
      await tf.setBackend("tensorflow");
      backend = "node";
      console.log('✅ Using TensorFlow.js Node backend');
    } catch (error) {
      // Fallback to browser backend (CPU-only)
      console.log('⚠️ Node backend failed, falling back to browser backend...');
      console.log('⚠️ Training will be slower but functional');
      tf = await import("@tensorflow/tfjs");
      backend = "cpu";
      console.log('✅ Using TensorFlow.js browser backend (CPU)');
    }
    await tf.ready();
  }
}

function loadLabels(max = Infinity): Row[] {
  const file = path.resolve(process.cwd(), 'datasets', 'labels', 'train.jsonl');
  if (!fs.existsSync(file)) throw new Error('Missing labels. Run vnext:label first.');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows: Row[] = [];
  for (const line of lines) { 
    if (rows.length >= max) break; 
    rows.push(JSON.parse(line)); 
  }
  console.log(`📊 Loaded ${rows.length} training samples`);
  return rows;
}

function buildModel() {
  console.log('🏗️ Building student-v2 model architecture...');
  
  const input = tf.input({ shape: [64] });
  const h1 = tf.layers.dense({ units: 256, activation: 'relu' }).apply(input) as SymbolicTensor;
  const h2 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(h1) as SymbolicTensor;
  const h3 = tf.layers.dropout({ rate: 0.2 }).apply(h2) as SymbolicTensor;

  // Multi-head outputs for different musical dimensions
  const tempoHead = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'tempo' }).apply(h3) as SymbolicTensor;
  const brightnessHead = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'brightness' }).apply(h3) as SymbolicTensor;
  const densityHead = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'density' }).apply(h3) as SymbolicTensor;
  const arcHead = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'arc' }).apply(h3) as SymbolicTensor;
  const motifHead = tf.layers.dense({ units: 8, activation: 'softmax', name: 'motif' }).apply(h3) as SymbolicTensor;
  const cadenceHead = tf.layers.dense({ units: 4, activation: 'softmax', name: 'cadence' }).apply(h3) as SymbolicTensor;

  const model = tf.model({ inputs: input, outputs: [tempoHead, brightnessHead, densityHead, arcHead, motifHead, cadenceHead] });
  
  model.compile({
    optimizer: 'adam',
    loss: ['meanSquaredError', 'meanSquaredError', 'meanSquaredError', 'meanSquaredError', 'categoricalCrossentropy', 'categoricalCrossentropy'],
    lossWeights: [1.0, 1.0, 1.0, 1.0, 0.5, 0.5] // Lower weight for classification heads
  });

  console.log('✅ Model architecture built');
  model.summary();
  return model;
}

function prepareData(rows: Row[]) {
  console.log('🔄 Preparing training data...');
  
  const features = rows.map(r => r.feat);
  const targets = rows.map(r => {
    const d = r.directives;
    const arc = r.arc_curve;
    
    // Convert to multi-head targets
    return [
      d.tempo_norm,                    // tempo head
      (d.motif_rate + d.syncopation) / 2, // brightness head (combination)
      d.density_curve.reduce((a, b) => a + b) / 4, // density head (average)
      arc.reduce((a, b) => a + b) / 3, // arc head (average)
      ...Array(8).fill(0).map((_, i) => r.motif_tokens.includes(i) ? 1 : 0), // motif head (one-hot)
      ...Array(4).fill(0).map((_, i) => i === r.cadence_class ? 1 : 0) // cadence head (one-hot)
    ];
  });

  const featuresTensor = tf.tensor2d(features);
  const targetsTensor = tf.tensor2d(targets);
  
  console.log(`📊 Features shape: [${featuresTensor.shape.join(', ')}]`);
  console.log(`📊 Targets shape: [${targetsTensor.shape.join(', ')}]`);
  
  return { features: featuresTensor, targets: targetsTensor };
}

async function trainModel(model: LayersModel, features: Tensor2D, targets: Tensor2D) {
  console.log('🚀 Starting Phase 2B training...');
  console.log(`🧠 Backend: ${backend}`);
  
  // Split targets into individual heads
  const tempoTargets = targets.slice([0, 0], [-1, 1]);
  const brightnessTargets = targets.slice([0, 1], [-1, 1]);
  const densityTargets = targets.slice([0, 2], [-1, 1]);
  const arcTargets = targets.slice([0, 3], [-1, 1]);
  const motifTargets = targets.slice([0, 4], [-1, 8]);
  const cadenceTargets = targets.slice([0, 12], [-1, 4]);
  
  const targetsArray = [tempoTargets, brightnessTargets, densityTargets, arcTargets, motifTargets, cadenceTargets];
  
  const epochs = backend === "node" ? 100 : 50; // Fewer epochs for CPU backend
  console.log(`📈 Training for ${epochs} epochs (${backend === "node" ? "GPU" : "CPU"} backend)`);
  
  const history = await model.fit(features, targetsArray, {
    epochs,
    batchSize: 32,
    validationSplit: 0.2,
    verbose: 1,
    callbacks: {
      onEpochEnd: (epoch: number, logs: any) => {
        if (epoch % 10 === 0) {
          console.log(`📊 Epoch ${epoch}: Loss=${logs.loss?.toFixed(4)}, Val Loss=${logs.val_loss?.toFixed(4)}`);
        }
      }
    }
  });
  
  console.log('✅ Training completed!');
  return history;
}

async function saveModel(model: LayersModel) {
  console.log('💾 Saving student-v2 model...');
  
  const dir = path.resolve(process.cwd(), 'models', 'student-v2');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const modelPath = path.join(dir, 'model.json');
  
  // Browser backend can't save to file:// URLs, so we'll save manually
  if (backend === 'cpu') {
    console.log('💾 Saving model manually for browser backend...');
    
    // Get model topology and weights
    const topology = model.toJSON();
    const weights = model.getWeights();
    
    // Convert weights to binary format
    const weightData = new Uint8Array(weights.length * 4 * weights[0].size);
    let offset = 0;
    for (const weight of weights) {
      const data = weight.dataSync();
      for (let i = 0; i < data.length; i++) {
        const view = new Float32Array(weightData.buffer, offset, 1);
        view[0] = data[i];
        offset += 4;
      }
    }
    
    // Save model.json
    fs.writeFileSync(modelPath, JSON.stringify(topology, null, 2));
    
    // Save weightfile.bin
    const weightsPath = path.join(dir, 'weightfile.bin');
    fs.writeFileSync(weightsPath, weightData);
    
    console.log('✅ Model saved manually to:', modelPath);
  } else {
    // Node backend can save normally
    await model.save('file://' + modelPath.replace(/\\/g,'/'));
  }
  
  // Generate metadata
  const metadata = {
    version: '2.0.0',
    backend,
    trainingDate: new Date().toISOString(),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex'),
    architecture: 'multi-head-student-v2',
    inputShape: [64],
    outputHeads: ['tempo', 'brightness', 'density', 'arc', 'motif', 'cadence']
  };
  
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  
  console.log('✅ Saved student-v2 to', dir);
  console.log('📊 Model metadata:', metadata);
}

async function main() {
  try {
    console.log('🎵 Phase 2B: Student Model Training');
    console.log('=====================================');
    
    await ensureTF();
    
    const rows = loadLabels();
    if (rows.length === 0) {
      throw new Error('No training data found');
    }
    
    const model = buildModel();
    const { features, targets } = prepareData(rows);
    
    const history = await trainModel(model, features, targets);
    
    await saveModel(model);
    
    console.log('🎯 Phase 2B Training Complete!');
    console.log('📁 Model saved to: models/student-v2/');
    console.log('🚀 Ready for deployment testing');
    
  } catch (error) {
    console.error('❌ Training failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
