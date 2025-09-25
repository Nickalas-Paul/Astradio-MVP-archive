// vnext/scripts/freeze-snapshot-set.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface SnapshotRecord {
  id: number;
  snap: {
    ts: string;
    lat: number;
    lon: number;
    tz?: number;
    dominantElements: Record<string, number>;
    // Add other fields as needed
  };
  feat: number[];
}

interface FrozenSnapshotMetadata {
  version: string;
  created: string;
  totalSnapshots: number;
  uniquenessKey: string;
  checksum: string;
  distribution: {
    elements: Record<string, number>;
    signs: Record<string, number>;
    locations: number;
    dateRange: { start: string; end: string };
  };
}

function calculateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function analyzeSnapshots(snapshots: SnapshotRecord[]): FrozenSnapshotMetadata['distribution'] {
  // Element distribution
  const elements: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  
  // Location uniqueness (by lat/lon combination)
  const locations = new Set<string>();
  
  // Date range
  const dates: string[] = [];
  
  snapshots.forEach(record => {
    // Count elements (using dominant element)
    const dominantElements = record.snap.dominantElements;
    let maxElement = '';
    let maxValue = -1;
    
    for (const element in dominantElements) {
      if (dominantElements[element as keyof typeof dominantElements] > maxValue) {
        maxValue = dominantElements[element as keyof typeof dominantElements];
        maxElement = element;
      }
    }
    if (maxElement) {
      elements[maxElement] = (elements[maxElement] || 0) + 1;
    }
    
    // Track locations
    locations.add(`${record.snap.lat},${record.snap.lon}`);
    
    // Track dates
    dates.push(record.snap.ts);
  });
  
  // Sort dates to get range
  dates.sort();
  
  return {
    elements,
    signs: {}, // Would need to derive from planet positions
    locations: locations.size,
    dateRange: {
      start: dates[0],
      end: dates[dates.length - 1]
    }
  };
}

function freezeSnapshotSet() {
  console.log("🔒 FREEZING SNAPSHOT SET FOR PHASE-2C");
  console.log("=====================================");
  
  const sourcePath = path.resolve(process.cwd(), 'datasets', 'snapshots.jsonl');
  const frozenDir = path.resolve(process.cwd(), 'eval', 'frozen');
  const frozenPath = path.join(frozenDir, 'snapshots_phase2c.jsonl');
  const metadataPath = path.join(frozenDir, 'snapshots_metadata.json');
  
  // Ensure frozen directory exists
  if (!fs.existsSync(frozenDir)) {
    fs.mkdirSync(frozenDir, { recursive: true });
  }
  
  // Load and validate snapshots
  console.log(`📂 Loading snapshots from: ${sourcePath}`);
  const content = fs.readFileSync(sourcePath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  
  if (lines.length !== 1000) {
    throw new Error(`Expected 1000 snapshots, found ${lines.length}`);
  }
  
  const snapshots: SnapshotRecord[] = lines.map(line => JSON.parse(line));
  
  // Calculate checksum
  console.log("🔍 Calculating checksum...");
  const checksum = calculateChecksum(sourcePath);
  
  // Analyze distribution
  console.log("📊 Analyzing snapshot distribution...");
  const distribution = analyzeSnapshots(snapshots);
  
  // Create metadata
  const metadata: FrozenSnapshotMetadata = {
    version: 'phase2c_frozen_v1',
    created: new Date().toISOString(),
    totalSnapshots: snapshots.length,
    uniquenessKey: 'ts_lat_lon_composite', // Documented key
    checksum,
    distribution
  };
  
  // Copy to frozen location
  console.log(`💾 Copying to frozen location: ${frozenPath}`);
  fs.copyFileSync(sourcePath, frozenPath);
  
  // Write metadata
  console.log(`📋 Writing metadata: ${metadataPath}`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  // Verify frozen copy
  const frozenChecksum = calculateChecksum(frozenPath);
  if (frozenChecksum !== checksum) {
    throw new Error('Frozen copy checksum mismatch!');
  }
  
  console.log("\n✅ SNAPSHOT SET FROZEN SUCCESSFULLY");
  console.log("====================================");
  console.log(`📁 Frozen path: ${frozenPath}`);
  console.log(`🔑 Checksum: ${checksum.substring(0, 16)}...`);
  console.log(`📊 Total snapshots: ${metadata.totalSnapshots}`);
  console.log(`🌍 Unique locations: ${distribution.locations}`);
  console.log(`📅 Date range: ${distribution.dateRange.start} to ${distribution.dateRange.end}`);
  console.log(`🔥 Element distribution:`);
  for (const [element, count] of Object.entries(distribution.elements)) {
    console.log(`   ${element}: ${count}`);
  }
  console.log(`\n🎯 Uniqueness key: ${metadata.uniquenessKey}`);
  console.log(`📋 Metadata: ${metadataPath}`);
  
  return {
    frozenPath,
    metadataPath,
    checksum,
    metadata
  };
}

if (require.main === module) {
  freezeSnapshotSet();
}

export { freezeSnapshotSet };
