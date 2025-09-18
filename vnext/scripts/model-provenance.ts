// vnext/scripts/model-provenance.ts
// Model artifact provenance tracking for complete deployment history

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

interface ModelProvenance {
  version: string;
  createdAt: string;
  commitSha: string;
  branch: string;
  author: string;
  trainingData: {
    datasetChecksum: string;
    labelCount: number;
    trainSplit: number;
    valSplit: number;
    testSplit: number;
    qualityThreshold: number;
  };
  calibration: {
    calibrationMethod: string;
    calibrationData: string;
    perBucketMetrics?: Record<string, any>;
  };
  evaluation: {
    frozenSetVersion: string;
    frozenSetChecksum: string;
    passRate: number;
    avgQuality: number;
    avgLatency: number;
    comparedToBaseline: string;
    improvement: {
      passRate: number;
      quality: number;
      latency: number;
    };
  };
  architecture: {
    inputDim: number;
    outputDim: number;
    hiddenLayers: number[];
    activation: string;
    optimizer: string;
    lossFunction: string;
  };
  training: {
    epochs: number;
    batchSize: number;
    learningRate: number;
    validationLoss: number;
    trainingLoss: number;
    earlyStopping: boolean;
    regularization: string;
  };
  files: {
    modelJson: { path: string; checksum: string; size: number };
    weights: { path: string; checksum: string; size: number };
    metadata: { path: string; checksum: string; size: number };
    calibration?: { path: string; checksum: string; size: number };
  };
  deployment: {
    environment: string;
    canaryPercent?: number;
    rollbackCriteria: any;
    healthChecks: string[];
  };
}

// Calculate file checksum
function calculateFileChecksum(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Get git information
function getGitInfo(): { commitSha: string; branch: string; author: string } {
  try {
    const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const author = execSync('git log -1 --pretty=format:"%an <%ae>"', { encoding: 'utf8' }).trim();
    
    return { commitSha, branch, author };
  } catch (error) {
    console.warn('Failed to get git info:', error.message);
    return { commitSha: 'unknown', branch: 'unknown', author: 'unknown' };
  }
}

// Calculate dataset checksum from training files
function calculateDatasetChecksum(labelsDir: string): string {
  const files = ['train.jsonl', 'val.jsonl', 'test.jsonl'];
  const checksums: string[] = [];
  
  for (const file of files) {
    const filePath = path.join(labelsDir, file);
    if (fs.existsSync(filePath)) {
      checksums.push(calculateFileChecksum(filePath));
    }
  }
  
  return crypto.createHash('sha256').update(checksums.join('')).digest('hex').slice(0, 16);
}

// Count labels in training files
function countLabels(labelsDir: string): { train: number; val: number; test: number; total: number } {
  const counts = { train: 0, val: 0, test: 0, total: 0 };
  
  ['train', 'val', 'test'].forEach(split => {
    const filePath = path.join(labelsDir, `${split}.jsonl`);
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(line => line.trim());
      counts[split as keyof typeof counts] = lines.length;
      counts.total += lines.length;
    }
  });
  
  return counts;
}

// Load frozen evaluation set info
function getFrozenEvalInfo(): { version: string; checksum: string } {
  const frozenSetPath = path.resolve(process.cwd(), 'datasets', 'frozen-eval-set.json');
  
  if (!fs.existsSync(frozenSetPath)) {
    return { version: 'unknown', checksum: 'unknown' };
  }
  
  try {
    const frozenSet = JSON.parse(fs.readFileSync(frozenSetPath, 'utf8'));
    return { version: frozenSet.version, checksum: frozenSet.checksum };
  } catch (error) {
    return { version: 'unknown', checksum: 'unknown' };
  }
}

// Create model provenance record
export function createModelProvenance(
  modelVersion: string,
  modelDir: string,
  evaluationResults?: any,
  trainingMetrics?: any
): ModelProvenance {
  console.log(`📋 Creating provenance record for ${modelVersion}`);
  
  const gitInfo = getGitInfo();
  const labelsDir = path.resolve(process.cwd(), 'datasets', 'labels');
  const datasetChecksum = calculateDatasetChecksum(labelsDir);
  const labelCounts = countLabels(labelsDir);
  const frozenEvalInfo = getFrozenEvalInfo();
  
  // File checksums and metadata
  const modelJsonPath = path.join(modelDir, 'model.json');
  const weightsPath = path.join(modelDir, 'weightfile.bin');
  const metadataPath = path.join(modelDir, 'metadata.json');
  const calibrationPath = path.join(modelDir, 'per-bucket-calibration.json');
  
  const files: ModelProvenance['files'] = {
    modelJson: {
      path: modelJsonPath,
      checksum: calculateFileChecksum(modelJsonPath),
      size: fs.statSync(modelJsonPath).size
    },
    weights: {
      path: weightsPath,
      checksum: calculateFileChecksum(weightsPath),
      size: fs.statSync(weightsPath).size
    },
    metadata: {
      path: metadataPath,
      checksum: calculateFileChecksum(metadataPath),
      size: fs.statSync(metadataPath).size
    }
  };
  
  if (fs.existsSync(calibrationPath)) {
    files.calibration = {
      path: calibrationPath,
      checksum: calculateFileChecksum(calibrationPath),
      size: fs.statSync(calibrationPath).size
    };
  }
  
  // Load existing metadata for architecture info
  let existingMetadata: any = {};
  try {
    existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    console.warn('Could not load existing metadata:', error.message);
  }
  
  const provenance: ModelProvenance = {
    version: modelVersion,
    createdAt: new Date().toISOString(),
    commitSha: gitInfo.commitSha,
    branch: gitInfo.branch,
    author: gitInfo.author,
    
    trainingData: {
      datasetChecksum,
      labelCount: labelCounts.total,
      trainSplit: labelCounts.train,
      valSplit: labelCounts.val,
      testSplit: labelCounts.test,
      qualityThreshold: process.env.MIN_QUALITY_THRESHOLD ? parseFloat(process.env.MIN_QUALITY_THRESHOLD) : 0.55
    },
    
    calibration: {
      calibrationMethod: existingMetadata.calibration?.method || 'platt_scaling',
      calibrationData: existingMetadata.calibration?.data || 'validation_set',
      perBucketMetrics: existingMetadata.calibration?.perBucketMetrics
    },
    
    evaluation: {
      frozenSetVersion: frozenEvalInfo.version,
      frozenSetChecksum: frozenEvalInfo.checksum,
      passRate: evaluationResults?.passRate || 0,
      avgQuality: evaluationResults?.avgQuality || 0,
      avgLatency: evaluationResults?.avgLatency || 0,
      comparedToBaseline: evaluationResults?.baseline || 'v1',
      improvement: {
        passRate: evaluationResults?.improvement?.passRate || 0,
        quality: evaluationResults?.improvement?.quality || 0,
        latency: evaluationResults?.improvement?.latency || 0
      }
    },
    
    architecture: {
      inputDim: existingMetadata.inputShape?.[1] || 64,
      outputDim: existingMetadata.outputShape?.[1] || 6,
      hiddenLayers: existingMetadata.architecture?.hiddenLayers || [128, 64, 32],
      activation: existingMetadata.architecture?.activation || 'relu',
      optimizer: existingMetadata.training?.optimizer || 'adam',
      lossFunction: existingMetadata.training?.loss || 'mse'
    },
    
    training: {
      epochs: trainingMetrics?.epochs || existingMetadata.training?.epochs || 0,
      batchSize: trainingMetrics?.batchSize || existingMetadata.training?.batchSize || 32,
      learningRate: trainingMetrics?.learningRate || existingMetadata.training?.learningRate || 0.001,
      validationLoss: trainingMetrics?.validationLoss || existingMetadata.training?.validationLoss || 0,
      trainingLoss: trainingMetrics?.trainingLoss || existingMetadata.training?.trainingLoss || 0,
      earlyStopping: trainingMetrics?.earlyStopping || existingMetadata.training?.earlyStopping || false,
      regularization: existingMetadata.training?.regularization || 'dropout'
    },
    
    files,
    
    deployment: {
      environment: process.env.NODE_ENV || 'development',
      canaryPercent: process.env.CANARY_PERCENT ? parseInt(process.env.CANARY_PERCENT) : undefined,
      rollbackCriteria: {
        passRateDrop: 0.05,
        qualityDrop: 0.03,
        errorRateIncrease: 0.02,
        latencyIncrease: 100
      },
      healthChecks: ['model_load', 'inference_test', 'quality_gate']
    }
  };
  
  return provenance;
}

// Save provenance record
export function saveModelProvenance(provenance: ModelProvenance, modelDir: string): void {
  const provenancePath = path.join(modelDir, 'provenance.json');
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2));
  
  console.log(`✅ Saved provenance record to: ${provenancePath}`);
  console.log(`   Version: ${provenance.version}`);
  console.log(`   Commit: ${provenance.commitSha.slice(0, 8)}`);
  console.log(`   Training Data: ${provenance.trainingData.labelCount} labels`);
  console.log(`   Dataset Checksum: ${provenance.trainingData.datasetChecksum}`);
  console.log(`   Evaluation: ${(provenance.evaluation.passRate * 100).toFixed(1)}% pass rate`);
}

// Load and validate provenance
export function loadModelProvenance(modelDir: string): ModelProvenance | null {
  const provenancePath = path.join(modelDir, 'provenance.json');
  
  if (!fs.existsSync(provenancePath)) {
    console.warn(`No provenance record found at: ${provenancePath}`);
    return null;
  }
  
  try {
    const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8')) as ModelProvenance;
    
    // Validate file checksums
    let checksumValid = true;
    Object.entries(provenance.files).forEach(([fileType, fileInfo]) => {
      if (fileInfo && fs.existsSync(fileInfo.path)) {
        const currentChecksum = calculateFileChecksum(fileInfo.path);
        if (currentChecksum !== fileInfo.checksum) {
          console.warn(`⚠️  Checksum mismatch for ${fileType}: expected ${fileInfo.checksum}, got ${currentChecksum}`);
          checksumValid = false;
        }
      }
    });
    
    if (!checksumValid) {
      console.warn('⚠️  Model files have been modified since provenance was created');
    }
    
    console.log(`📋 Loaded provenance for ${provenance.version}`);
    return provenance;
    
  } catch (error) {
    console.error(`Failed to load provenance: ${error.message}`);
    return null;
  }
}

// Compare two provenance records
export function compareProvenance(v1: ModelProvenance, v2: ModelProvenance): void {
  console.log(`🔍 Comparing ${v1.version} vs ${v2.version}`);
  console.log('=' .repeat(50));
  
  // Training data comparison
  console.log('📊 Training Data:');
  console.log(`   Labels: ${v1.trainingData.labelCount} → ${v2.trainingData.labelCount} (${v2.trainingData.labelCount - v1.trainingData.labelCount > 0 ? '+' : ''}${v2.trainingData.labelCount - v1.trainingData.labelCount})`);
  console.log(`   Quality Threshold: ${v1.trainingData.qualityThreshold} → ${v2.trainingData.qualityThreshold}`);
  console.log(`   Dataset Changed: ${v1.trainingData.datasetChecksum !== v2.trainingData.datasetChecksum ? 'Yes' : 'No'}`);
  
  // Evaluation comparison
  console.log('\n🎯 Evaluation:');
  console.log(`   Pass Rate: ${(v1.evaluation.passRate * 100).toFixed(1)}% → ${(v2.evaluation.passRate * 100).toFixed(1)}% (${((v2.evaluation.passRate - v1.evaluation.passRate) * 100).toFixed(1)}pp)`);
  console.log(`   Quality: ${v1.evaluation.avgQuality.toFixed(3)} → ${v2.evaluation.avgQuality.toFixed(3)} (${(v2.evaluation.avgQuality - v1.evaluation.avgQuality).toFixed(3)})`);
  console.log(`   Latency: ${v1.evaluation.avgLatency.toFixed(0)}ms → ${v2.evaluation.avgLatency.toFixed(0)}ms (${(v2.evaluation.avgLatency - v1.evaluation.avgLatency).toFixed(0)}ms)`);
  
  // Architecture comparison
  console.log('\n🏗️  Architecture:');
  console.log(`   Output Dim: ${v1.architecture.outputDim} → ${v2.architecture.outputDim}`);
  console.log(`   Hidden Layers: [${v1.architecture.hiddenLayers.join(', ')}] → [${v2.architecture.hiddenLayers.join(', ')}]`);
  
  // Training comparison
  console.log('\n🚂 Training:');
  console.log(`   Epochs: ${v1.training.epochs} → ${v2.training.epochs}`);
  console.log(`   Val Loss: ${v1.training.validationLoss.toFixed(4)} → ${v2.training.validationLoss.toFixed(4)}`);
  console.log(`   Learning Rate: ${v1.training.learningRate} → ${v2.training.learningRate}`);
  
  // Deployment readiness
  const v2Ready = v2.evaluation.passRate > v1.evaluation.passRate && 
                  v2.evaluation.avgQuality > v1.evaluation.avgQuality &&
                  v2.evaluation.avgLatency < v1.evaluation.avgLatency * 1.2;
  
  console.log(`\n${v2Ready ? '✅' : '⚠️ '} ${v2.version} ${v2Ready ? 'ready for deployment' : 'needs improvement'}`);
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'create') {
    const modelVersion = process.argv[3];
    const modelDir = process.argv[4];
    
    if (!modelVersion || !modelDir) {
      console.error('Usage: npm run model-provenance create <version> <model-dir>');
      process.exit(1);
    }
    
    const provenance = createModelProvenance(modelVersion, modelDir);
    saveModelProvenance(provenance, modelDir);
    
  } else if (command === 'load') {
    const modelDir = process.argv[3];
    
    if (!modelDir) {
      console.error('Usage: npm run model-provenance load <model-dir>');
      process.exit(1);
    }
    
    const provenance = loadModelProvenance(modelDir);
    if (provenance) {
      console.log(JSON.stringify(provenance, null, 2));
    }
    
  } else if (command === 'compare') {
    const dir1 = process.argv[3];
    const dir2 = process.argv[4];
    
    if (!dir1 || !dir2) {
      console.error('Usage: npm run model-provenance compare <model-dir-1> <model-dir-2>');
      process.exit(1);
    }
    
    const prov1 = loadModelProvenance(dir1);
    const prov2 = loadModelProvenance(dir2);
    
    if (prov1 && prov2) {
      compareProvenance(prov1, prov2);
    } else {
      console.error('Failed to load provenance records for comparison');
      process.exit(1);
    }
    
  } else {
    console.log('Usage:');
    console.log('  npm run model-provenance create <version> <model-dir>  - Create provenance record');
    console.log('  npm run model-provenance load <model-dir>              - Load and display provenance');
    console.log('  npm run model-provenance compare <dir1> <dir2>         - Compare two models');
  }
}
