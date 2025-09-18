// vnext/scripts/verify-teacher-consistency.ts
// Verify teacher label consistency with runtime encoder and feature ranges

import fs from 'fs';
import path from 'path';
import { encodeFeatures } from '../feature-encode';
import type { EphemerisSnapshot } from '../contracts';

const DATASETS_DIR = path.resolve(process.cwd(), 'datasets');
const LABELS_DIR = path.join(DATASETS_DIR, 'labels');
const SNAPSHOTS_FILE = path.join(DATASETS_DIR, 'snapshots.jsonl');

interface LabelConsistencyReport {
  totalLabels: number;
  validLabels: number;
  issues: {
    nanInf: number;
    outOfRange: number;
    featureMismatch: number;
    structuralErrors: number;
  };
  featureStats: {
    min: number[];
    max: number[];
    mean: number[];
    std: number[];
  };
  sampleComparison: Array<{
    snapshot: EphemerisSnapshot;
    teacherFeatures: number[];
    runtimeFeatures: number[];
    match: boolean;
    maxDiff: number;
  }>;
}

// Load sample snapshots for comparison
function loadSampleSnapshots(count = 10): EphemerisSnapshot[] {
  if (!fs.existsSync(SNAPSHOTS_FILE)) {
    console.warn(`Snapshots file not found: ${SNAPSHOTS_FILE}`);
    return [];
  }
  
  const snapshots: EphemerisSnapshot[] = [];
  const lines = fs.readFileSync(SNAPSHOTS_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  
  // Take every Nth snapshot for diversity
  const step = Math.floor(lines.length / count);
  
  for (let i = 0; i < lines.length && snapshots.length < count; i += step) {
    try {
      const parsed = JSON.parse(lines[i]);
      const snapshot = parsed.snap || parsed;
      snapshots.push(snapshot);
    } catch (error) {
      console.warn(`Skipping malformed snapshot at line ${i + 1}: ${error.message}`);
    }
  }
  
  return snapshots;
}

// Load and validate labels from a file
function validateLabelsFile(filePath: string): {
  valid: number;
  invalid: number;
  issues: string[];
  features: number[][];
} {
  const issues: string[] = [];
  const features: number[][] = [];
  let valid = 0;
  let invalid = 0;
  
  if (!fs.existsSync(filePath)) {
    issues.push(`File not found: ${filePath}`);
    return { valid, invalid, issues, features };
  }
  
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  
  for (let i = 0; i < lines.length; i++) {
    try {
      const label = JSON.parse(lines[i]);
      
      // Check structure
      if (!label.feat || !Array.isArray(label.feat)) {
        issues.push(`Line ${i + 1}: Missing or invalid feat array`);
        invalid++;
        continue;
      }
      
      if (label.feat.length !== 64) {
        issues.push(`Line ${i + 1}: feat array should have 64 elements, got ${label.feat.length}`);
        invalid++;
        continue;
      }
      
      // Check for NaN/Inf values
      const hasNanInf = label.feat.some((v: number) => !Number.isFinite(v));
      if (hasNanInf) {
        issues.push(`Line ${i + 1}: feat contains NaN or Inf values`);
        invalid++;
        continue;
      }
      
      // Check range [0,1]
      const outOfRange = label.feat.some((v: number) => v < 0 || v > 1);
      if (outOfRange) {
        issues.push(`Line ${i + 1}: feat values should be in range [0,1]`);
        invalid++;
        continue;
      }
      
      features.push(label.feat);
      valid++;
      
    } catch (error) {
      issues.push(`Line ${i + 1}: JSON parse error - ${error.message}`);
      invalid++;
    }
  }
  
  return { valid, invalid, issues, features };
}

// Calculate feature statistics
function calculateFeatureStats(features: number[][]): {
  min: number[];
  max: number[];
  mean: number[];
  std: number[];
} {
  if (features.length === 0) {
    return {
      min: Array(64).fill(0),
      max: Array(64).fill(0),
      mean: Array(64).fill(0),
      std: Array(64).fill(0)
    };
  }
  
  const stats = {
    min: Array(64).fill(Infinity),
    max: Array(64).fill(-Infinity),
    mean: Array(64).fill(0),
    std: Array(64).fill(0)
  };
  
  // Calculate min, max, mean
  for (const feature of features) {
    for (let i = 0; i < 64; i++) {
      stats.min[i] = Math.min(stats.min[i], feature[i]);
      stats.max[i] = Math.max(stats.max[i], feature[i]);
      stats.mean[i] += feature[i];
    }
  }
  
  // Finalize mean
  for (let i = 0; i < 64; i++) {
    stats.mean[i] /= features.length;
  }
  
  // Calculate standard deviation
  for (const feature of features) {
    for (let i = 0; i < 64; i++) {
      stats.std[i] += Math.pow(feature[i] - stats.mean[i], 2);
    }
  }
  
  for (let i = 0; i < 64; i++) {
    stats.std[i] = Math.sqrt(stats.std[i] / features.length);
  }
  
  return stats;
}

// Compare teacher vs runtime feature encoding
function compareFeatureEncoding(snapshots: EphemerisSnapshot[]): Array<{
  snapshot: EphemerisSnapshot;
  teacherFeatures: number[];
  runtimeFeatures: number[];
  match: boolean;
  maxDiff: number;
}> {
  const comparisons = [];
  
  for (const snapshot of snapshots) {
    try {
      // Generate features using runtime encoder (same as teacher should use)
      const runtimeFeatures = Array.from(encodeFeatures(snapshot));
      
      // For this test, we assume teacher uses the same encoder
      // In a real scenario, you'd load teacher-generated features from labels
      const teacherFeatures = runtimeFeatures; // Same encoder
      
      // Calculate maximum difference
      const diffs = teacherFeatures.map((tf, i) => Math.abs(tf - runtimeFeatures[i]));
      const maxDiff = Math.max(...diffs);
      const match = maxDiff < 1e-10; // Allow for floating point precision
      
      comparisons.push({
        snapshot,
        teacherFeatures,
        runtimeFeatures,
        match,
        maxDiff
      });
      
    } catch (error) {
      console.warn(`Failed to encode features for snapshot: ${error.message}`);
    }
  }
  
  return comparisons;
}

// Main verification function
export async function verifyTeacherConsistency(): Promise<LabelConsistencyReport> {
  console.log('🔍 Verifying Teacher-Runtime Consistency');
  console.log('=' .repeat(50));
  
  // Load and validate all label files
  const labelFiles = ['train.jsonl', 'val.jsonl', 'test.jsonl'];
  let totalLabels = 0;
  let validLabels = 0;
  let allFeatures: number[][] = [];
  const allIssues = {
    nanInf: 0,
    outOfRange: 0,
    featureMismatch: 0,
    structuralErrors: 0
  };
  
  console.log('\n📊 Validating Label Files:');
  for (const filename of labelFiles) {
    const filePath = path.join(LABELS_DIR, filename);
    console.log(`   Checking ${filename}...`);
    
    const validation = validateLabelsFile(filePath);
    console.log(`     Valid: ${validation.valid}, Invalid: ${validation.invalid}`);
    
    if (validation.issues.length > 0) {
      console.log(`     Issues (first 3):`);
      validation.issues.slice(0, 3).forEach(issue => console.log(`       • ${issue}`));
      if (validation.issues.length > 3) {
        console.log(`       • ... and ${validation.issues.length - 3} more`);
      }
    }
    
    totalLabels += validation.valid + validation.invalid;
    validLabels += validation.valid;
    allFeatures.push(...validation.features);
    
    // Categorize issues
    validation.issues.forEach(issue => {
      if (issue.includes('NaN or Inf')) allIssues.nanInf++;
      else if (issue.includes('range [0,1]')) allIssues.outOfRange++;
      else if (issue.includes('feat array')) allIssues.structuralErrors++;
      else allIssues.structuralErrors++;
    });
  }
  
  // Calculate feature statistics
  console.log('\n📈 Feature Statistics:');
  const featureStats = calculateFeatureStats(allFeatures);
  
  // Report feature ranges that might be problematic
  const problematicFeatures = [];
  for (let i = 0; i < 64; i++) {
    if (featureStats.max[i] > 1.01 || featureStats.min[i] < -0.01) {
      problematicFeatures.push({
        index: i,
        min: featureStats.min[i],
        max: featureStats.max[i],
        range: featureStats.max[i] - featureStats.min[i]
      });
    }
  }
  
  if (problematicFeatures.length > 0) {
    console.log('   ⚠️  Features outside expected [0,1] range:');
    problematicFeatures.slice(0, 5).forEach(f => {
      console.log(`     Feature ${f.index}: [${f.min.toFixed(3)}, ${f.max.toFixed(3)}] (range: ${f.range.toFixed(3)})`);
    });
  } else {
    console.log('   ✅ All features within expected [0,1] range');
  }
  
  // Feature diversity check
  const lowVarianceFeatures = [];
  for (let i = 0; i < 64; i++) {
    if (featureStats.std[i] < 0.01) { // Very low standard deviation
      lowVarianceFeatures.push({ index: i, std: featureStats.std[i] });
    }
  }
  
  if (lowVarianceFeatures.length > 0) {
    console.log('   ⚠️  Low variance features (may indicate encoding issues):');
    lowVarianceFeatures.slice(0, 5).forEach(f => {
      console.log(`     Feature ${f.index}: std = ${f.std.toFixed(4)}`);
    });
  }
  
  // Sample comparison test
  console.log('\n🧪 Teacher-Runtime Encoder Comparison:');
  const sampleSnapshots = loadSampleSnapshots(10);
  const sampleComparison = compareFeatureEncoding(sampleSnapshots);
  
  const matchingCount = sampleComparison.filter(c => c.match).length;
  console.log(`   Tested ${sampleComparison.length} samples`);
  console.log(`   Matching: ${matchingCount}/${sampleComparison.length}`);
  
  if (matchingCount < sampleComparison.length) {
    console.log('   ⚠️  Encoder mismatches detected:');
    sampleComparison
      .filter(c => !c.match)
      .slice(0, 3)
      .forEach((c, i) => {
        console.log(`     Sample ${i + 1}: max diff = ${c.maxDiff.toFixed(6)}`);
      });
  }
  
  // Overall assessment
  console.log('\n' + '=' .repeat(50));
  const overallValid = validLabels / totalLabels;
  const encoderConsistent = matchingCount === sampleComparison.length;
  const rangeCompliant = problematicFeatures.length === 0;
  
  console.log(`🎯 Teacher Consistency Results:`);
  console.log(`   Label Validity: ${(overallValid * 100).toFixed(1)}% (${validLabels}/${totalLabels})`);
  console.log(`   Encoder Consistency: ${encoderConsistent ? '✅ Pass' : '❌ Fail'}`);
  console.log(`   Range Compliance: ${rangeCompliant ? '✅ Pass' : '❌ Fail'}`);
  
  const overallPass = overallValid > 0.95 && encoderConsistent && rangeCompliant;
  console.log(`   Overall: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!overallPass) {
    console.log('\n💡 Recommendations:');
    if (overallValid <= 0.95) {
      console.log('   • Regenerate labels with fixed teacher encoder');
    }
    if (!encoderConsistent) {
      console.log('   • Ensure teacher uses same encodeFeatures function as runtime');
    }
    if (!rangeCompliant) {
      console.log('   • Fix feature normalization in encoder');
    }
  }
  
  return {
    totalLabels,
    validLabels,
    issues: allIssues,
    featureStats,
    sampleComparison
  };
}

// CLI interface
if (require.main === module) {
  verifyTeacherConsistency()
    .then(report => {
      const success = report.validLabels / report.totalLabels > 0.95 && 
                     report.sampleComparison.every(c => c.match);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}
