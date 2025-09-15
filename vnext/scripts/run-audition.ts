// vnext/scripts/run-audition.ts
import fs from 'fs';
import path from 'path';
import { generatePlanMLOnly } from '../plan-generator';
import { audition } from '../audition-gate';
import type { FeatureVec } from '../contracts';

interface SnapshotRecord {
  id: string;
  snap: any;
  feat: number[];
}

async function runAudition() {
  try {
    console.log('🔄 Loading snapshot records...');
    
    // Read snapshot records
    const recordsPath = path.join(__dirname, '../../../datasets/snapshots.jsonl');
    const content = fs.readFileSync(recordsPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const records: SnapshotRecord[] = lines.map(line => JSON.parse(line));
    console.log(`📊 Loaded ${records.length} snapshot records`);
    
    if (records.length === 0) {
      console.log('❌ No records found. Run materialize first.');
      process.exit(1);
    }
    
    // Test subset (first 5 or all if less)
    const testCount = Math.min(5, records.length);
    console.log(`🧪 Testing ${testCount} records...`);
    
    let passed = 0;
    let failed = 0;
    const results: any[] = [];
    
    for (let i = 0; i < testCount; i++) {
      const record = records[i];
      console.log(`\n📝 Testing record ${i + 1}/${testCount}: ${record.id}`);
      
      try {
        // Convert to FeatureVec
        const feat = new Float32Array(record.feat) as FeatureVec;
        
        // Generate plan using ML cascade
        const { plan, source } = await generatePlanMLOnly(feat);
        
        // Run audition
        const auditionResult = audition(plan);
        
        const result = {
          id: record.id,
          source,
          passed: auditionResult.passed,
          score: auditionResult.score,
          issues: auditionResult.issues,
          repairs: auditionResult.repairs,
          eventCount: plan.events.length,
          durationSec: plan.durationSec
        };
        
        results.push(result);
        
        if (auditionResult.passed) {
          passed++;
          console.log(`✅ PASSED (${auditionResult.score}/100) - ${source} - ${plan.events.length} events`);
        } else {
          failed++;
          console.log(`❌ FAILED (${auditionResult.score}/100) - Issues: ${auditionResult.issues.join(', ')}`);
        }
        
      } catch (error: any) {
        failed++;
        console.log(`💥 ERROR: ${error.message}`);
        results.push({
          id: record.id,
          error: error.message,
          passed: false
        });
      }
    }
    
    // Summary
    const passRate = (passed / testCount) * 100;
    console.log(`\n📊 AUDITION RESULTS:`);
    console.log(`✅ Passed: ${passed}/${testCount} (${passRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed}/${testCount}`);
    
    if (passRate >= 90) {
      console.log(`🎉 PASS RATE ${passRate.toFixed(1)}% - MEETS 90% THRESHOLD`);
      process.exit(0);
    } else {
      console.log(`⚠️  PASS RATE ${passRate.toFixed(1)}% - BELOW 90% THRESHOLD`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Audition failed:', error);
    process.exit(1);
  }
}

runAudition();
