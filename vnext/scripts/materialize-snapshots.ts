// vnext/scripts/materialize-snapshots.ts
import fs from 'fs';
import path from 'path';
import { encodeFeatures } from '../feature-encode';
import type { EphemerisSnapshot } from '../contracts';

interface SnapshotRecord {
  id: string;
  snap: EphemerisSnapshot;
  feat: number[];
}

async function materializeSnapshots() {
  try {
    console.log('🔄 Loading input snapshots...');
    
    // Read input snapshots
    const inputPath = path.join(__dirname, '../../../datasets/input-snapshots.json');
    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const snapshots: EphemerisSnapshot[] = Array.isArray(inputData) ? inputData : [inputData];
    
    console.log(`📊 Processing ${snapshots.length} snapshots...`);
    
    const records: SnapshotRecord[] = [];
    
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      
      // Generate unique ID
      const id = `snap_${snap.ts}_${snap.lat}_${snap.lon}`;
      
      // Encode features using real encoder
      const feat = Array.from(encodeFeatures(snap));
      
      records.push({ id, snap, feat });
      console.log(`✅ Processed ${i + 1}/${snapshots.length}: ${id}`);
    }
    
    // Write to JSONL
    const outputPath = path.join(__dirname, '../../../datasets/snapshots.jsonl');
    const outputLines = records.map(r => JSON.stringify(r));
    fs.writeFileSync(outputPath, outputLines.join('\n'));
    
    console.log(`🎯 Materialization complete! Wrote ${records.length} records to datasets/snapshots.jsonl`);
    
  } catch (error) {
    console.error('❌ Materialization failed:', error);
    process.exit(1);
  }
}

materializeSnapshots();
