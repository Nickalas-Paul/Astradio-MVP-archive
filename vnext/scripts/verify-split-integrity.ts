// vnext/scripts/verify-split-integrity.ts
import fs from 'fs';
import path from 'path';

interface LabelRecord {
  base_id: string;
  // Add other fields as needed
}

function loadLabels(filePath: string): LabelRecord[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function verifySplitIntegrity() {
  console.log("🔍 VERIFYING SPLIT INTEGRITY");
  console.log("=============================");
  
  const trainPath = path.resolve(process.cwd(), 'datasets', 'labels', 'train_scaled.jsonl');
  const devPath = path.resolve(process.cwd(), 'datasets', 'labels', 'dev_scaled.jsonl');
  const testPath = path.resolve(process.cwd(), 'datasets', 'labels', 'test_scaled.jsonl');
  
  console.log("📂 Loading label files...");
  const trainLabels = loadLabels(trainPath);
  const devLabels = loadLabels(devPath);
  const testLabels = loadLabels(testPath);
  
  console.log(`📊 Train: ${trainLabels.length} labels`);
  console.log(`📊 Dev: ${devLabels.length} labels`);
  console.log(`📊 Test: ${testLabels.length} labels`);
  
  // Extract base_ids
  const trainBaseIds = new Set(trainLabels.map(l => l.base_id));
  const devBaseIds = new Set(devLabels.map(l => l.base_id));
  const testBaseIds = new Set(testLabels.map(l => l.base_id));
  
  console.log(`🔑 Unique train base_ids: ${trainBaseIds.size}`);
  console.log(`🔑 Unique dev base_ids: ${devBaseIds.size}`);
  console.log(`🔑 Unique test base_ids: ${testBaseIds.size}`);
  
  // Check for leakage
  let hasLeakage = false;
  const leaks: string[] = [];
  
  // Train vs Dev
  for (const id of trainBaseIds) {
    if (devBaseIds.has(id)) {
      hasLeakage = true;
      leaks.push(`train->dev: ${id}`);
    }
  }
  
  // Train vs Test
  for (const id of trainBaseIds) {
    if (testBaseIds.has(id)) {
      hasLeakage = true;
      leaks.push(`train->test: ${id}`);
    }
  }
  
  // Dev vs Test
  for (const id of devBaseIds) {
    if (testBaseIds.has(id)) {
      hasLeakage = true;
      leaks.push(`dev->test: ${id}`);
    }
  }
  
  console.log("\n🚨 SPLIT INTEGRITY RESULTS");
  console.log("==========================");
  
  if (hasLeakage) {
    console.log("❌ LEAKAGE DETECTED!");
    console.log("Leaked base_ids:");
    leaks.forEach(leak => console.log(`   ${leak}`));
    console.log(`\n⚠️  Total leaks: ${leaks.length}`);
    console.log("🚫 Cannot proceed with Phase-2C until leakage is fixed");
    return false;
  } else {
    console.log("✅ NO LEAKAGE DETECTED");
    console.log("✅ All splits are properly isolated by base_id");
    console.log("✅ Ready for Phase-2C evaluation");
    return true;
  }
}

if (require.main === module) {
  const isValid = verifySplitIntegrity();
  process.exit(isValid ? 0 : 1);
}

export { verifySplitIntegrity };
