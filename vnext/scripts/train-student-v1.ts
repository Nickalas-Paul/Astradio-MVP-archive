// vnext/scripts/train-student-v1.ts - Train real Student v1 model
import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encodeFeatures } from '../feature-encode';
import type { FeatureVec } from '../contracts';

interface TrainingRecord {
  id: string;
  snap: any;
  feat: number[];
}

interface ModelMetadata {
  version: string;
  checksum: string;
  trainingDate: string;
  recordCount: number;
  epochs: number;
  loss: number;
  accuracy: number;
  outputShape: number[];
}

/**
 * Generate training data for 6D control vector output
 */
function generateTrainingData(records: TrainingRecord[]): { features: tf.Tensor2D; targets: tf.Tensor2D } {
  const features: number[][] = [];
  const targets: number[][] = [];
  
  for (const record of records) {
    // Use the feature vector as input
    features.push(record.feat);
    
    // Generate 6D control vector target
    const target = generateControlVector(record.feat);
    targets.push(target);
  }
  
  return {
    features: tf.tensor2d(features),
    targets: tf.tensor2d(targets)
  };
}

/**
 * Generate 6D control vector from features
 */
function generateControlVector(feat: number[]): number[] {
  // Map astrological features to musical control parameters
  const control = [
    feat[0], // BPM control (0-1)
    feat[1], // Key control (0-1) 
    feat[2], // Event density (0-1)
    feat[3], // Melody weight (0-1)
    feat[4], // Harmony weight (0-1)
    feat[5]  // Rhythm weight (0-1)
  ];
  
  // Ensure values are in [0,1] range
  return control.map(c => Math.max(0, Math.min(1, c)));
}

/**
 * Create and train the student model (6D output)
 */
async function createStudentModel(): Promise<tf.LayersModel> {
  const model = tf.sequential({
    layers: [
      // Input layer (64 features)
      tf.layers.dense({
        inputShape: [64],
        units: 128,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
      }),
      
      // Hidden layers
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 64, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.1 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      
      // Output layer (6D control vector)
      tf.layers.dense({ units: 6, activation: 'sigmoid' })
    ]
  });
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae']
  });
  
  return model;
}

/**
 * Generate synthetic training data for the current snapshot store
 */
function generateSyntheticTrainingData(records: TrainingRecord[]): TrainingRecord[] {
  const enhanced = [...records];
  
  for (const record of records) {
    // Generate 5-10 synthetic variations per real record
    for (let i = 0; i < 8; i++) {
      const variation = record.feat.map((val, idx) => {
        // Add controlled noise to create variations
        const noise = (Math.random() - 0.5) * 0.1;
        return Math.max(0, Math.min(1, val + noise));
      });
      
      enhanced.push({
        id: `${record.id}_synthetic_${i}`,
        snap: record.snap,
        feat: variation
      });
    }
  }
  
  return enhanced;
}

/**
 * Main training function
 */
async function trainStudentV1() {
  try {
    console.log('🔄 Loading training data...');
    
    // Load snapshot records
    const recordsPath = path.join(__dirname, '../../../datasets/snapshots.jsonl');
    const content = fs.readFileSync(recordsPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let records: TrainingRecord[] = lines.map(line => JSON.parse(line));
    console.log(`📊 Loaded ${records.length} snapshot records`);
    
    if (records.length === 0) {
      throw new Error('No training data found. Run materialize first.');
    }
    
    // Generate synthetic training data
    console.log('🎵 Generating synthetic training variations...');
    records = generateSyntheticTrainingData(records);
    console.log(`📈 Enhanced to ${records.length} training records`);
    
    // Generate training data
    console.log('🔧 Preparing training data...');
    const { features, targets } = generateTrainingData(records);
    
    console.log(`📊 Training data: ${features.shape[0]} samples, ${features.shape[1]} features → ${targets.shape[1]} targets`);
    
    // Create and train model
    console.log('🧠 Creating student model...');
    const model = await createStudentModel();
    
    console.log('🏋️ Training model...');
    const history = await model.fit(features, targets, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 1
    });
    
    // Get final metrics
    const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
    const finalAccuracy = 1 - finalLoss; // Approximate accuracy
    
    // Save model
    const modelDir = path.join(__dirname, '../../../models/student-v1');
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    const modelPath = path.join(modelDir, 'model.json');
    await model.save(`file://${modelPath}`);
    
    // Generate model metadata
    const modelJsonPath = path.join(modelPath);
    const modelData = fs.readFileSync(modelJsonPath);
    const checksum = crypto.createHash('sha256').update(modelData).digest('hex');
    
    const metadata: ModelMetadata = {
      version: '1.0.0',
      checksum,
      trainingDate: new Date().toISOString(),
      recordCount: records.length,
      epochs: 100,
      loss: finalLoss,
      accuracy: finalAccuracy,
      outputShape: [6] // 6D control vector
    };
    
    const metadataPath = path.join(modelDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log('✅ Training complete!');
    console.log(`📊 Final loss: ${finalLoss.toFixed(4)}`);
    console.log(`📊 Approximate accuracy: ${(finalAccuracy * 100).toFixed(2)}%`);
    console.log(`💾 Model saved to: ${modelPath}`);
    console.log(`📋 Metadata: ${metadataPath}`);
    console.log(`🔐 Checksum: ${checksum}`);
    console.log(`🎯 Output shape: [6] control vector`);
    
    // Clean up tensors
    features.dispose();
    targets.dispose();
    model.dispose();
    
  } catch (error) {
    console.error('❌ Training failed:', error);
    process.exit(1);
  }
}

trainStudentV1();
