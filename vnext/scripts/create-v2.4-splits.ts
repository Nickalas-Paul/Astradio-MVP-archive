#!/usr/bin/env node
/**
 * Create v2.4 data splits with hash-by-chart to prevent leakage
 * Phase 1 of D-series v2.4 engine upgrade
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface LabeledSample {
  chart_hash: string;
  chart_data: any;
  labels: {
    melodic: number;
    rhythm: number;
    polyphony: number;
  };
  metadata: {
    mode: string;
    genre: string;
    source: string;
  };
}

interface SplitMetadata {
  counts: {
    train: number;
    val: number;
    test: number;
    total: number;
  };
  class_histogram: {
    melodic: { [key: string]: number };
    rhythm: { [key: string]: number };
    polyphony: { [key: string]: number };
  };
  hash_salt: string;
  created_at: string;
}

import { generateChartHashSync } from '../../lib/hash/chartHash';

function generateChartHash(chartData: any): string {
  return generateChartHashSync(chartData);
}

function createHashBasedSplits(samples: LabeledSample[]): {
  train: LabeledSample[];
  val: LabeledSample[];
  test: LabeledSample[];
} {
  // Group by chart hash to prevent leakage
  const hashGroups = new Map<string, LabeledSample[]>();
  
  for (const sample of samples) {
    const hash = sample.chart_hash;
    if (!hashGroups.has(hash)) {
      hashGroups.set(hash, []);
    }
    hashGroups.get(hash)!.push(sample);
  }

  // Sort hashes deterministically
  const sortedHashes = Array.from(hashGroups.keys()).sort();
  
  // Split by hash (70/15/15)
  const totalHashes = sortedHashes.length;
  const trainEnd = Math.floor(totalHashes * 0.7);
  const valEnd = Math.floor(totalHashes * 0.85);
  
  const trainHashes = sortedHashes.slice(0, trainEnd);
  const valHashes = sortedHashes.slice(trainEnd, valEnd);
  const testHashes = sortedHashes.slice(valEnd);
  
  // Flatten samples back
  const train: LabeledSample[] = [];
  const val: LabeledSample[] = [];
  const test: LabeledSample[] = [];
  
  for (const hash of trainHashes) {
    train.push(...hashGroups.get(hash)!);
  }
  for (const hash of valHashes) {
    val.push(...hashGroups.get(hash)!);
  }
  for (const hash of testHashes) {
    test.push(...hashGroups.get(hash)!);
  }
  
  return { train, val, test };
}

function generateClassHistogram(samples: LabeledSample[]) {
  const histogram = {
    melodic: {} as { [key: string]: number },
    rhythm: {} as { [key: string]: number },
    polyphony: {} as { [key: string]: number }
  };
  
  for (const sample of samples) {
    const mel = sample.labels.melodic.toString();
    const rhy = sample.labels.rhythm.toString();
    const poly = sample.labels.polyphony.toString();
    
    histogram.melodic[mel] = (histogram.melodic[mel] || 0) + 1;
    histogram.rhythm[rhy] = (histogram.rhythm[rhy] || 0) + 1;
    histogram.polyphony[poly] = (histogram.polyphony[poly] || 0) + 1;
  }
  
  return histogram;
}

async function createV24Splits() {
  console.log('🚀 Creating v2.4 data splits...');
  
  // Load teacher labels (assuming they exist from previous training)
  const teacherLabelsPath = 'datasets/labels/train.jsonl';
  if (!fs.existsSync(teacherLabelsPath)) {
    console.error('❌ Teacher labels not found at:', teacherLabelsPath);
    process.exit(1);
  }
  
  // Read and parse labeled samples
  const samples: LabeledSample[] = [];
  const content = fs.readFileSync(teacherLabelsPath, 'utf8');
  const lines = content.trim().split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      const sample = JSON.parse(line);
      // Ensure chart_hash exists
      if (!sample.chart_hash) {
        sample.chart_hash = generateChartHash(sample.chart_data);
      }
      samples.push(sample);
    }
  }
  
  console.log(`📊 Loaded ${samples.length} labeled samples`);
  
  // Create hash-based splits
  const { train, val, test } = createHashBasedSplits(samples);
  
  console.log(`📈 Split sizes: train=${train.length}, val=${val.length}, test=${test.length}`);
  
  // Create output directories
  const splitsDir = 'splits/v2.4';
  fs.mkdirSync(splitsDir, { recursive: true });
  
  // Write split files
  fs.writeFileSync(
    path.join(splitsDir, 'train.jsonl'),
    train.map(s => JSON.stringify(s)).join('\n')
  );
  
  fs.writeFileSync(
    path.join(splitsDir, 'val.jsonl'),
    val.map(s => JSON.stringify(s)).join('\n')
  );
  
  fs.writeFileSync(
    path.join(splitsDir, 'test.jsonl'),
    test.map(s => JSON.stringify(s)).join('\n')
  );
  
  // Generate metadata
  const metadata: SplitMetadata = {
    counts: {
      train: train.length,
      val: val.length,
      test: test.length,
      total: samples.length
    },
    class_histogram: {
      melodic: generateClassHistogram(samples).melodic,
      rhythm: generateClassHistogram(samples).rhythm,
      polyphony: generateClassHistogram(samples).polyphony
    },
    hash_salt: crypto.randomBytes(16).toString('hex'),
    created_at: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(splitsDir, 'meta.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Generate checksums
  const hashesDir = 'hashes';
  fs.mkdirSync(hashesDir, { recursive: true });
  
  const trainHash = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(splitsDir, 'train.jsonl')))
    .digest('hex');
  
  const valHash = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(splitsDir, 'val.jsonl')))
    .digest('hex');
  
  const testHash = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(splitsDir, 'test.jsonl')))
    .digest('hex');
  
  const metaHash = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(splitsDir, 'meta.json')))
    .digest('hex');
  
  const checksums = {
    train: trainHash,
    val: valHash,
    test: testHash,
    meta: metaHash,
    created_at: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(hashesDir, 'splits.meta.hash'),
    JSON.stringify(checksums, null, 2)
  );
  
  console.log('✅ v2.4 splits created successfully');
  console.log(`📁 Output: ${splitsDir}/`);
  console.log(`🔐 Checksums: ${hashesDir}/splits.meta.hash`);
}

// Run if called directly
if (require.main === module) {
  createV24Splits().catch(console.error);
}

export { createV24Splits, createHashBasedSplits, generateClassHistogram };
