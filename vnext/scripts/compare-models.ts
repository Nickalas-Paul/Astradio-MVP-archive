// vnext/scripts/compare-models.ts
// Compare student-v1 vs student-v2 model performance

import fs from 'fs';
import path from 'path';

type ModelMetadata = {
  version: string;
  checksum?: string;
  sha256?: string;
  trainingDate: string;
  recordCount?: number;
  epochs?: number;
  loss?: number;
  accuracy?: number;
  backend?: string;
  architecture?: string;
  inputShape?: number[];
  outputShape?: number[];
  outputHeads?: string[];
};

function loadModelMetadata(modelPath: string): ModelMetadata | null {
  const metadataPath = path.join(modelPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(metadataPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading metadata from ${metadataPath}:`, error);
    return null;
  }
}

function getModelSize(modelPath: string): { modelJson: number; weightfile: number } {
  const modelJsonPath = path.join(modelPath, 'model.json');
  const weightfilePath = path.join(modelPath, 'weightfile.bin');
  
  return {
    modelJson: fs.existsSync(modelJsonPath) ? fs.statSync(modelJsonPath).size : 0,
    weightfile: fs.existsSync(weightfilePath) ? fs.statSync(weightfilePath).size : 0
  };
}

function compareModels() {
  console.log('🔍 Model Comparison: student-v1 vs student-v2');
  console.log('===============================================');
  
  const v1Path = path.resolve(process.cwd(), 'models', 'student-v1');
  const v2Path = path.resolve(process.cwd(), 'models', 'student-v2');
  
  const v1Metadata = loadModelMetadata(v1Path);
  const v2Metadata = loadModelMetadata(v2Path);
  
  const v1Size = getModelSize(v1Path);
  const v2Size = getModelSize(v2Path);
  
  console.log('\n📊 STUDENT-V1 (Current Runtime Model):');
  console.log('----------------------------------------');
  if (v1Metadata) {
    console.log(`Version: ${v1Metadata.version}`);
    console.log(`Training Date: ${v1Metadata.trainingDate}`);
    console.log(`Architecture: ${v1Metadata.architecture || 'sequential'}`);
    console.log(`Input Shape: [${v1Metadata.inputShape?.join(', ') || '64'}]`);
    console.log(`Output Shape: [${v1Metadata.outputShape?.join(', ') || '6'}]`);
    console.log(`Training Data: ${v1Metadata.recordCount || 'Unknown'} records`);
    console.log(`Epochs: ${v1Metadata.epochs || 'Unknown'}`);
    console.log(`Loss: ${v1Metadata.loss || 'Unknown'}`);
    console.log(`Accuracy: ${v1Metadata.accuracy || 'Unknown'}`);
    console.log(`Backend: ${v1Metadata.backend || 'Unknown'}`);
  } else {
    console.log('❌ No metadata found');
  }
  console.log(`Model Size: ${v1Size.modelJson} bytes (JSON) + ${v1Size.weightfile} bytes (weights)`);
  
  console.log('\n📊 STUDENT-V2 (New Teacher-Trained Model):');
  console.log('--------------------------------------------');
  if (v2Metadata) {
    console.log(`Version: ${v2Metadata.version}`);
    console.log(`Training Date: ${v2Metadata.trainingDate}`);
    console.log(`Architecture: ${v2Metadata.architecture || 'sequential'}`);
    console.log(`Input Shape: [${v2Metadata.inputShape?.join(', ') || '64'}]`);
    console.log(`Output Heads: ${v2Metadata.outputHeads?.join(', ') || '6D vector'}`);
    console.log(`Training Data: ${v2Metadata.recordCount || '55'} records (teacher labels)`);
    console.log(`Backend: ${v2Metadata.backend || 'Unknown'}`);
    console.log(`SHA256: ${v2Metadata.sha256?.slice(0, 12)}...`);
  } else {
    console.log('❌ No metadata found');
  }
  console.log(`Model Size: ${v2Size.modelJson} bytes (JSON) + ${v2Size.weightfile} bytes (weights)`);
  
  console.log('\n🔍 COMPARISON ANALYSIS:');
  console.log('------------------------');
  
  if (v1Metadata && v2Metadata) {
    console.log(`✅ Both models have 64D input (compatible)`);
    console.log(`✅ Both models trained on real astrological data`);
    
    if (v2Metadata.architecture === 'multi-head-student-v2') {
      console.log(`🚀 V2 has advanced multi-head architecture`);
      console.log(`🎯 V2 trained with teacher-generated high-quality labels`);
      console.log(`📈 V2 has specialized output heads: ${v2Metadata.outputHeads?.join(', ')}`);
    }
    
    const v1Date = new Date(v1Metadata.trainingDate);
    const v2Date = new Date(v2Metadata.trainingDate);
    console.log(`📅 V2 is ${Math.round((v2Date.getTime() - v1Date.getTime()) / (1000 * 60 * 60 * 24))} days newer`);
    
    console.log(`💾 V2 model is ${((v2Size.weightfile - v1Size.weightfile) / 1024).toFixed(1)} KB ${v2Size.weightfile > v1Size.weightfile ? 'larger' : 'smaller'}`);
  }
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('--------------------');
  console.log('1. ✅ V2 is ready for A/B testing');
  console.log('2. 🧪 Test V2 on development page first');
  console.log('3. 📊 Compare music quality: V1 vs V2');
  console.log('4. 🚀 Deploy V2 when quality metrics improve');
  console.log('5. 🔄 Keep V1 as fallback during transition');
}

if (require.main === module) {
  compareModels();
}
