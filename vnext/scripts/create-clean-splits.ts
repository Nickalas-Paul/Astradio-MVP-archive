// vnext/scripts/create-clean-splits.ts
import fs from 'fs';
import path from 'path';

interface LabelRecord {
  feat: number[];
  directives: any;
  arc_curve: number[];
  cadence_class: number;
  motif_tokens: number[];
  metadata: {
    chartHash: string;
    qualityScore: number;
    split: string;
    timestamp: string;
    version: string;
    variation_id: number;
    original_hash: string;
    noise_level: number;
    scaled_version: string;
  };
}

function createCleanSplits() {
  console.log("🧹 CREATING CLEAN SPLITS (NO DATA LEAKAGE)");
  console.log("===========================================");
  
  const sourcePath = path.resolve(process.cwd(), 'datasets', 'labels', 'train_scaled.jsonl');
  const outputDir = path.resolve(process.cwd(), 'datasets', 'labels', 'clean');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`📂 Loading labels from: ${sourcePath}`);
  const content = fs.readFileSync(sourcePath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  
  console.log(`📊 Total labels: ${lines.length}`);
  
  // Group by chartHash, keeping only the first variation (variation_id = 0)
  const chartMap = new Map<string, LabelRecord>();
  
  lines.forEach(line => {
    const record: LabelRecord = JSON.parse(line);
    const chartHash = record.metadata.chartHash;
    
    // Only keep the first variation (variation_id = 0)
    if (record.metadata.variation_id === 0) {
      if (!chartMap.has(chartHash)) {
        chartMap.set(chartHash, record);
      }
    }
  });
  
  console.log(`🔑 Unique charts found: ${chartMap.size}`);
  
  // Convert to array and shuffle
  const uniqueCharts = Array.from(chartMap.values());
  const shuffled = uniqueCharts.sort(() => Math.random() - 0.5);
  
  // Split: 60% train, 20% dev, 20% test
  const trainSize = Math.floor(shuffled.length * 0.6);
  const devSize = Math.floor(shuffled.length * 0.2);
  
  const trainCharts = shuffled.slice(0, trainSize);
  const devCharts = shuffled.slice(trainSize, trainSize + devSize);
  const testCharts = shuffled.slice(trainSize + devSize);
  
  console.log(`📊 Train: ${trainCharts.length} charts`);
  console.log(`📊 Dev: ${devCharts.length} charts`);
  console.log(`📊 Test: ${testCharts.length} charts`);
  
  // Add base_id field to prevent future leakage
  const addBaseId = (charts: LabelRecord[], split: string) => {
    return charts.map((chart, index) => ({
      ...chart,
      base_id: `${split}_${chart.metadata.chartHash}_${index}`
    }));
  };
  
  const trainWithBaseId = addBaseId(trainCharts, 'train');
  const devWithBaseId = addBaseId(devCharts, 'dev');
  const testWithBaseId = addBaseId(testCharts, 'test');
  
  // Write clean splits
  const writeSplit = (charts: any[], filename: string) => {
    const filePath = path.join(outputDir, filename);
    const content = charts.map(chart => JSON.stringify(chart)).join('\n');
    fs.writeFileSync(filePath, content);
    console.log(`💾 Written: ${filename} (${charts.length} charts)`);
  };
  
  writeSplit(trainWithBaseId, 'train_clean.jsonl');
  writeSplit(devWithBaseId, 'dev_clean.jsonl');
  writeSplit(testWithBaseId, 'test_clean.jsonl');
  
  // Verify no leakage
  const trainBaseIds = new Set(trainWithBaseId.map(c => c.base_id));
  const devBaseIds = new Set(devWithBaseId.map(c => c.base_id));
  const testBaseIds = new Set(testWithBaseId.map(c => c.base_id));
  
  let hasLeakage = false;
  for (const id of trainBaseIds) {
    if (devBaseIds.has(id) || testBaseIds.has(id)) {
      hasLeakage = true;
      break;
    }
  }
  
  if (!hasLeakage) {
    for (const id of devBaseIds) {
      if (testBaseIds.has(id)) {
        hasLeakage = true;
        break;
      }
    }
  }
  
  console.log("\n✅ CLEAN SPLITS CREATED");
  console.log("========================");
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`🔍 Data leakage: ${hasLeakage ? '❌ DETECTED' : '✅ NONE'}`);
  console.log(`🎯 Total unique charts: ${chartMap.size}`);
  console.log(`📊 Train/Dev/Test: ${trainCharts.length}/${devCharts.length}/${testCharts.length}`);
  
  if (hasLeakage) {
    console.log("🚫 CRITICAL: Still has data leakage - cannot proceed");
    return false;
  } else {
    console.log("✅ Ready for Phase-2C with clean data");
    return true;
  }
}

if (require.main === module) {
  const success = createCleanSplits();
  process.exit(success ? 0 : 1);
}

export { createCleanSplits };
