// vnext/scripts/create-mock-model.ts - Create a mock trained model for Phase 8
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ModelMetadata {
  version: string;
  checksum: string;
  trainingDate: string;
  recordCount: number;
  epochs: number;
  loss: number;
  accuracy: number;
  type: string;
}

/**
 * Create a mock model for Phase 8 testing
 * This simulates a trained model without actual TensorFlow.js training
 */
async function createMockModel() {
  try {
    console.log('🎭 Creating mock student model for Phase 8...');
    
    // Create models directory
    const modelDir = path.join(__dirname, '../../../models');
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Create mock model structure
    const modelPath = path.join(modelDir, 'student-model');
    if (!fs.existsSync(modelPath)) {
      fs.mkdirSync(modelPath, { recursive: true });
    }
    
    // Mock model.json (simplified structure)
    const mockModelJson = {
      format: "layers-model",
      generatedBy: "vNext Phase 8 Mock Model",
      convertedBy: null,
      modelTopology: {
        class_name: "Sequential",
        config: {
          name: "sequential",
          layers: [
            {
              class_name: "Dense",
              config: {
                name: "dense_Dense1",
                trainable: true,
                batch_input_shape: [null, 64],
                units: 128,
                activation: "relu",
                kernel_initializer: {
                  class_name: "GlorotUniform",
                  config: { seed: null }
                }
              }
            },
            {
              class_name: "Dense", 
              config: {
                name: "dense_Dense2",
                trainable: true,
                units: 128,
                activation: "sigmoid",
                kernel_initializer: {
                  class_name: "GlorotUniform",
                  config: { seed: null }
                }
              }
            }
          ]
        }
      },
      weightsManifest: [
        {
          paths: ["weightfile.bin"],
          weights: [
            { name: "dense_Dense1/kernel", shape: [64, 128], dtype: "float32" },
            { name: "dense_Dense1/bias", shape: [128], dtype: "float32" },
            { name: "dense_Dense2/kernel", shape: [128, 128], dtype: "float32" },
            { name: "dense_Dense2/bias", shape: [128], dtype: "float32" }
          ]
        }
      ]
    };
    
    // Write model.json
    const modelJsonPath = path.join(modelPath, 'model.json');
    fs.writeFileSync(modelJsonPath, JSON.stringify(mockModelJson, null, 2));
    
    // Create mock weights file (just random data for now)
    const weightsData = Buffer.alloc(1024 * 1024); // 1MB of random data
    for (let i = 0; i < weightsData.length; i++) {
      weightsData[i] = Math.floor(Math.random() * 256);
    }
    
    const weightsPath = path.join(modelPath, 'weightfile.bin');
    fs.writeFileSync(weightsPath, weightsData);
    
    // Generate metadata
    const modelData = fs.readFileSync(modelJsonPath);
    const checksum = crypto.createHash('sha256').update(modelData).digest('hex');
    
    const metadata: ModelMetadata = {
      version: '1.0.0-mock',
      checksum,
      trainingDate: new Date().toISOString(),
      recordCount: 12, // From our synthetic data
      epochs: 50,
      loss: 0.1234,
      accuracy: 0.8766,
      type: 'mock-model-for-phase8'
    };
    
    const metadataPath = path.join(modelDir, 'student-model-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log('✅ Mock model created!');
    console.log(`📊 Version: ${metadata.version}`);
    console.log(`📊 Accuracy: ${(metadata.accuracy * 100).toFixed(2)}%`);
    console.log(`📊 Training records: ${metadata.recordCount}`);
    console.log(`💾 Model path: ${modelPath}`);
    console.log(`📋 Metadata: ${metadataPath}`);
    console.log(`🔐 Checksum: ${checksum}`);
    console.log('');
    console.log('🎯 This mock model will use deterministic fallback generation');
    console.log('   until real TensorFlow.js training is implemented.');
    
  } catch (error) {
    console.error('❌ Mock model creation failed:', error);
    process.exit(1);
  }
}

createMockModel();
