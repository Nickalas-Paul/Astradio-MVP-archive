// vnext/scripts/train-student.ts - Train TF.js Student model
import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encodeFeatures } from '../feature-encode';
import type { FeatureVec, Plan } from '../contracts';

interface TrainingRecord {
  id: string;
  snap: any;
  feat: number[];
  plan?: Plan;
}

interface ModelMetadata {
  version: string;
  checksum: string;
  trainingDate: string;
  recordCount: number;
  epochs: number;
  loss: number;
  accuracy: number;
}

/**
 * Generate training data from successful plans
 */
function generateTrainingData(records: TrainingRecord[]): { features: tf.Tensor2D; targets: tf.Tensor2D } {
  const features: number[][] = [];
  const targets: number[][] = [];
  
  for (const record of records) {
    if (!record.plan || !record.plan.events.length) continue;
    
    // Use the feature vector as input
    features.push(record.feat);
    
    // Generate target vector from the plan
    const target = planToTargetVector(record.plan);
    targets.push(target);
  }
  
  return {
    features: tf.tensor2d(features),
    targets: tf.tensor2d(targets)
  };
}

/**
 * Convert a plan to a target vector for training
 */
function planToTargetVector(plan: Plan): number[] {
  const target = new Array(128); // Fixed size target vector
  
  // Extract key musical features from the plan
  const events = plan.events;
  
  // BPM (normalized 0-1)
  target[0] = Math.min(plan.bpm / 200, 1);
  
  // Key signature (simplified to 0-1)
  target[1] = keyToNumber(plan.key) / 12;
  
  // Event density
  target[2] = Math.min(events.length / 300, 1);
  
  // Channel distribution
  const channels = events.reduce((acc, e) => {
    acc[e.channel] = (acc[e.channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  target[3] = (channels.melody || 0) / events.length;
  target[4] = (channels.harmony || 0) / events.length;
  target[5] = (channels.rhythm || 0) / events.length;
  target[6] = (channels.bass || 0) / events.length;
  
  // Pitch statistics
  const pitches = events.map(e => e.pitch);
  target[7] = Math.min(Math.min(...pitches) / 127, 1);
  target[8] = Math.min(Math.max(...pitches) / 127, 1);
  target[9] = pitches.reduce((a, b) => a + b, 0) / (pitches.length * 127);
  
  // Velocity statistics
  const velocities = events.map(e => e.velocity);
  target[10] = Math.min(Math.min(...velocities), 1);
  target[11] = Math.min(Math.max(...velocities), 1);
  target[12] = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  
  // Fill remaining slots with 0
  for (let i = 13; i < 128; i++) {
    target[i] = 0;
  }
  
  return target;
}

/**
 * Convert key string to number (0-11)
 */
function keyToNumber(key: string): number {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = key.match(/^([A-G]#?)/);
  return match ? keys.indexOf(match[1]) : 0;
}

/**
 * Create and train the student model
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
      
      // Output layer (128 targets)
      tf.layers.dense({ units: 128, activation: 'sigmoid' })
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
 * Generate synthetic training plans for the current snapshot store
 */
function generateSyntheticPlans(records: TrainingRecord[]): TrainingRecord[] {
  const enhanced = [...records];
  
  for (const record of records) {
    // Generate 2-3 synthetic plans per real record
    for (let i = 0; i < 3; i++) {
      const syntheticPlan = generateSyntheticPlan(record.feat);
      enhanced.push({
        id: `${record.id}_synthetic_${i}`,
        snap: record.snap,
        feat: record.feat,
        plan: syntheticPlan
      });
    }
  }
  
  return enhanced;
}

/**
 * Generate a synthetic plan from features
 */
function generateSyntheticPlan(feat: number[]): Plan {
  const durationSec = 60;
  const bpm = Math.round(80 + feat[0] * 60);
  const key = 'A minor';
  const events = [];
  
  // Generate events based on features
  const eventCount = Math.round(120 + feat[1] * 200);
  const step = durationSec / eventCount;
  
  for (let i = 0; i < eventCount; i++) {
    const t0 = i * step;
    const t1 = t0 + step * (0.8 + feat[2] * 0.4);
    
    // Generate pitch based on features
    const basePitch = 60 + Math.sin(i * feat[3]) * 12;
    const pitch = Math.round(Math.max(36, Math.min(84, basePitch)));
    
    // Generate velocity based on features
    const velocity = 0.4 + feat[4] * 0.4;
    
    // Assign channel based on features
    const channels = ['melody', 'harmony', 'rhythm', 'bass'];
    const channelIndex = Math.floor(i * feat[5]) % channels.length;
    const channel = channels[channelIndex] as any;
    
    events.push({
      t0,
      t1,
      pitch,
      velocity,
      channel
    });
  }
  
  return {
    id: `synthetic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    featureHash: feat.slice(0, 2).join(':'),
    durationSec,
    bpm,
    key,
    events
  };
}

/**
 * Main training function
 */
async function trainStudentModel() {
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
    console.log('🎵 Generating synthetic training plans...');
    records = generateSyntheticPlans(records);
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
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 1
    });
    
    // Get final metrics
    const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
    const finalAccuracy = 1 - finalLoss; // Approximate accuracy
    
    // Save model
    const modelDir = path.join(__dirname, '../../../models');
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    const modelPath = path.join(modelDir, 'student-model');
    await model.save(`file://${modelPath}`);
    
    // Generate model metadata
    const modelJsonPath = path.join(modelPath, 'model.json');
    const modelData = fs.readFileSync(modelJsonPath);
    const checksum = crypto.createHash('sha256').update(modelData).digest('hex');
    
    const metadata: ModelMetadata = {
      version: '1.0.0',
      checksum,
      trainingDate: new Date().toISOString(),
      recordCount: records.length,
      epochs: 50,
      loss: finalLoss,
      accuracy: finalAccuracy
    };
    
    const metadataPath = path.join(modelDir, 'student-model-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log('✅ Training complete!');
    console.log(`📊 Final loss: ${finalLoss.toFixed(4)}`);
    console.log(`📊 Approximate accuracy: ${(finalAccuracy * 100).toFixed(2)}%`);
    console.log(`💾 Model saved to: ${modelPath}`);
    console.log(`📋 Metadata: ${metadataPath}`);
    console.log(`🔐 Checksum: ${checksum}`);
    
    // Clean up tensors
    features.dispose();
    targets.dispose();
    model.dispose();
    
  } catch (error) {
    console.error('❌ Training failed:', error);
    process.exit(1);
  }
}

trainStudentModel();
