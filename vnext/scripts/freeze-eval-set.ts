// vnext/scripts/freeze-eval-set.ts
// Create and manage frozen evaluation sets with checksums for consistent baseline comparisons

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encodeFeatures } from '../feature-encode';
import { studentVector } from '../ml/student';
import { audition } from '../audition-gate';
import { planFromVector } from '../planner/narrative';
import type { EphemerisSnapshot } from '../contracts';

const DATASETS_DIR = path.resolve(process.cwd(), 'datasets');
const FROZEN_EVAL_FILE = path.join(DATASETS_DIR, 'frozen-eval-set.json');
const SNAPSHOTS_FILE = path.join(DATASETS_DIR, 'snapshots.jsonl');

export interface FrozenEvalSet {
  version: string;
  createdAt: string;
  description: string;
  checksum: string;
  charts: Array<{
    id: string;
    snapshot: EphemerisSnapshot;
    features: number[];
    chartHash: string;
    metadata: {
      sunSign: string;
      moonSign: string;
      dominantElement: string;
      tensionLevel: number;
      complexity: number;
    };
  }>;
  statistics: {
    totalCharts: number;
    elementDistribution: { fire: number; earth: number; air: number; water: number };
    signDistribution: Record<string, number>;
    tensionLevels: { low: number; medium: number; high: number };
  };
}

interface EvalResult {
  chartId: string;
  modelVersion: string;
  controlVector: number[];
  qualityScore: number;
  passed: boolean;
  breakdown: any;
  latency: number;
}

// Generate deterministic chart hash
function generateChartHash(snapshot: EphemerisSnapshot): string {
  const hashInput = `${snapshot.lat}_${snapshot.lon}_${snapshot.ts}_${snapshot.tz}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 12);
}

// Calculate checksum of entire evaluation set
function calculateSetChecksum(charts: FrozenEvalSet['charts']): string {
  const content = JSON.stringify(charts.map(c => ({
    id: c.id,
    features: c.features,
    chartHash: c.chartHash
  })));
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// Load snapshots from file
function loadSnapshots(): EphemerisSnapshot[] {
  if (!fs.existsSync(SNAPSHOTS_FILE)) {
    throw new Error(`Snapshots file not found: ${SNAPSHOTS_FILE}`);
  }
  
  const snapshots: EphemerisSnapshot[] = [];
  const lines = fs.readFileSync(SNAPSHOTS_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      // Handle nested structure from snapshots.jsonl
      const snapshot = parsed.snap || parsed;
      snapshots.push(snapshot);
    } catch (error) {
      console.warn(`Skipping malformed snapshot line: ${error.message}`);
    }
  }
  
  return snapshots;
}

// Select diverse charts for evaluation set
function selectDiverseCharts(snapshots: EphemerisSnapshot[], targetCount = 200): EphemerisSnapshot[] {
  console.log(`Selecting ${targetCount} diverse charts from ${snapshots.length} available...`);
  
  // Group by characteristics for balanced selection
  const groups = {
    elements: { fire: [], earth: [], air: [], water: [] },
    signs: {} as Record<string, EphemerisSnapshot[]>,
    tension: { low: [], medium: [], high: [] }
  };
  
  snapshots.forEach(snap => {
    // Dominant element
    const elements = snap.dominantElements;
    const dominantElement = Object.entries(elements)
      .reduce((a, b) => elements[a[0] as keyof typeof elements] > elements[b[0] as keyof typeof elements] ? a : b)[0];
    
    if (groups.elements[dominantElement as keyof typeof groups.elements]) {
      groups.elements[dominantElement as keyof typeof groups.elements].push(snap);
    }
    
    // Sun sign
    const sun = snap.planets.find(p => p.name === 'sun');
    if (sun) {
      const sunSign = Math.floor(sun.lon / 30);
      const signName = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                       'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'][sunSign];
      if (!groups.signs[signName]) groups.signs[signName] = [];
      groups.signs[signName].push(snap);
    }
    
    // Tension level
    const squares = snap.aspects.filter(a => a.type === 'square').length;
    const oppositions = snap.aspects.filter(a => a.type === 'opposition').length;
    const tension = squares * 0.6 + oppositions * 1.0;
    
    if (tension < 2) groups.tension.low.push(snap);
    else if (tension < 5) groups.tension.medium.push(snap);
    else groups.tension.high.push(snap);
  });
  
  // Balanced selection
  const selected: EphemerisSnapshot[] = [];
  const chartsPerElement = Math.floor(targetCount / 4);
  
  // Select from each element group
  Object.entries(groups.elements).forEach(([element, charts]) => {
    const shuffled = charts.sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, Math.min(chartsPerElement, charts.length)));
  });
  
  // Fill remaining slots with diverse tension levels
  const remaining = targetCount - selected.length;
  const tensionCharts = [
    ...groups.tension.low.slice(0, Math.floor(remaining / 3)),
    ...groups.tension.medium.slice(0, Math.floor(remaining / 3)),
    ...groups.tension.high.slice(0, remaining - 2 * Math.floor(remaining / 3))
  ];
  
  selected.push(...tensionCharts.filter(chart => !selected.includes(chart)));
  
  return selected.slice(0, targetCount);
}

// Create metadata for a chart
function createChartMetadata(snapshot: EphemerisSnapshot) {
  const sun = snapshot.planets.find(p => p.name === 'sun');
  const moon = snapshot.planets.find(p => p.name === 'moon');
  
  const sunSign = sun ? Math.floor(sun.lon / 30) : 0;
  const moonSign = moon ? Math.floor(moon.lon / 30) : 0;
  
  const signNames = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  
  const elements = snapshot.dominantElements;
  const dominantElement = Object.entries(elements)
    .reduce((a, b) => elements[a[0] as keyof typeof elements] > elements[b[0] as keyof typeof elements] ? a : b)[0];
  
  const squares = snapshot.aspects.filter(a => a.type === 'square').length;
  const oppositions = snapshot.aspects.filter(a => a.type === 'opposition').length;
  const tensionLevel = (squares * 0.6 + oppositions * 1.0) / 10; // Normalize
  
  const complexity = (
    snapshot.aspects.length / 10 + 
    Object.values(elements).reduce((a, b) => a + Math.abs(b - 0.25), 0) + 
    tensionLevel
  ) / 3;
  
  return {
    sunSign: signNames[sunSign],
    moonSign: signNames[moonSign],
    dominantElement,
    tensionLevel,
    complexity
  };
}

// Calculate statistics for the evaluation set
function calculateStatistics(charts: FrozenEvalSet['charts']) {
  const stats = {
    totalCharts: charts.length,
    elementDistribution: { fire: 0, earth: 0, air: 0, water: 0 },
    signDistribution: {} as Record<string, number>,
    tensionLevels: { low: 0, medium: 0, high: 0 }
  };
  
  charts.forEach(chart => {
    // Element distribution
    stats.elementDistribution[chart.metadata.dominantElement as keyof typeof stats.elementDistribution]++;
    
    // Sign distribution
    stats.signDistribution[chart.metadata.sunSign] = (stats.signDistribution[chart.metadata.sunSign] || 0) + 1;
    
    // Tension levels
    if (chart.metadata.tensionLevel < 0.3) stats.tensionLevels.low++;
    else if (chart.metadata.tensionLevel < 0.7) stats.tensionLevels.medium++;
    else stats.tensionLevels.high++;
  });
  
  return stats;
}

// Create frozen evaluation set
export async function createFrozenEvalSet(targetCount = 200, version = '1.0'): Promise<FrozenEvalSet> {
  console.log(`🧊 Creating frozen evaluation set v${version} with ${targetCount} charts`);
  
  // Load and select diverse charts
  const allSnapshots = loadSnapshots();
  const selectedSnapshots = selectDiverseCharts(allSnapshots, targetCount);
  
  console.log(`Selected ${selectedSnapshots.length} diverse charts`);
  
  // Create chart entries with features and metadata
  const charts: FrozenEvalSet['charts'] = [];
  
  for (let i = 0; i < selectedSnapshots.length; i++) {
    const snapshot = selectedSnapshots[i];
    const features = Array.from(encodeFeatures(snapshot));
    const chartHash = generateChartHash(snapshot);
    const metadata = createChartMetadata(snapshot);
    
    charts.push({
      id: `eval_${chartHash}`,
      snapshot,
      features,
      chartHash,
      metadata
    });
    
    if ((i + 1) % 50 === 0) {
      console.log(`Processed ${i + 1}/${selectedSnapshots.length} charts`);
    }
  }
  
  // Calculate statistics and checksum
  const statistics = calculateStatistics(charts);
  const checksum = calculateSetChecksum(charts);
  
  const frozenSet: FrozenEvalSet = {
    version,
    createdAt: new Date().toISOString(),
    description: `Frozen evaluation set v${version} with ${targetCount} diverse astrological charts`,
    checksum,
    charts,
    statistics
  };
  
  console.log(`✅ Created frozen evaluation set:`);
  console.log(`   Version: ${version}`);
  console.log(`   Charts: ${charts.length}`);
  console.log(`   Checksum: ${checksum}`);
  console.log(`   Elements: Fire=${statistics.elementDistribution.fire}, Earth=${statistics.elementDistribution.earth}, Air=${statistics.elementDistribution.air}, Water=${statistics.elementDistribution.water}`);
  console.log(`   Tension: Low=${statistics.tensionLevels.low}, Med=${statistics.tensionLevels.medium}, High=${statistics.tensionLevels.high}`);
  
  return frozenSet;
}

// Save frozen evaluation set
export function saveFrozenEvalSet(frozenSet: FrozenEvalSet): void {
  if (!fs.existsSync(DATASETS_DIR)) {
    fs.mkdirSync(DATASETS_DIR, { recursive: true });
  }
  
  fs.writeFileSync(FROZEN_EVAL_FILE, JSON.stringify(frozenSet, null, 2));
  console.log(`💾 Saved frozen evaluation set to: ${FROZEN_EVAL_FILE}`);
}

// Load frozen evaluation set
export function loadFrozenEvalSet(): FrozenEvalSet | null {
  if (!fs.existsSync(FROZEN_EVAL_FILE)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(FROZEN_EVAL_FILE, 'utf8');
    const frozenSet = JSON.parse(data) as FrozenEvalSet;
    
    // Verify checksum
    const expectedChecksum = calculateSetChecksum(frozenSet.charts);
    if (expectedChecksum !== frozenSet.checksum) {
      throw new Error(`Checksum mismatch! Expected: ${expectedChecksum}, Got: ${frozenSet.checksum}`);
    }
    
    console.log(`📋 Loaded frozen evaluation set v${frozenSet.version} (${frozenSet.charts.length} charts)`);
    return frozenSet;
  } catch (error) {
    console.error(`Failed to load frozen evaluation set: ${error.message}`);
    return null;
  }
}

// Run evaluation on frozen set
export async function runEvaluation(modelVersion?: string): Promise<EvalResult[]> {
  const frozenSet = loadFrozenEvalSet();
  if (!frozenSet) {
    throw new Error('No frozen evaluation set found. Run freeze-eval-set first.');
  }
  
  console.log(`🧪 Running evaluation on frozen set v${frozenSet.version}`);
  console.log(`   Model: ${modelVersion || 'current'}`);
  
  const results: EvalResult[] = [];
  
  for (let i = 0; i < frozenSet.charts.length; i++) {
    const chart = frozenSet.charts[i];
    const startTime = Date.now();
    
    try {
      // Get model prediction
      const features = new Float32Array(chart.features);
      const studentResult = await studentVector(features, chart.snapshot);
      
      // Generate plan
      const plan = planFromVector(studentResult.vector, chart.id);
      
      // Run audition
      const auditionResult = audition(plan);
      
      const latency = Date.now() - startTime;
      
      results.push({
        chartId: chart.id,
        modelVersion: studentResult.modelVersion,
        controlVector: studentResult.vector,
        qualityScore: auditionResult.score / 100, // Normalize to 0-1
        passed: auditionResult.passed,
        breakdown: auditionResult.ruleQuality?.breakdown || {},
        latency
      });
      
      if ((i + 1) % 25 === 0) {
        console.log(`   Evaluated ${i + 1}/${frozenSet.charts.length} charts`);
      }
      
    } catch (error) {
      console.warn(`   Failed to evaluate chart ${chart.id}: ${error.message}`);
      results.push({
        chartId: chart.id,
        modelVersion: 'error',
        controlVector: [0, 0, 0, 0, 0, 0],
        qualityScore: 0,
        passed: false,
        breakdown: {},
        latency: Date.now() - startTime
      });
    }
  }
  
  // Calculate summary statistics
  const passRate = results.filter(r => r.passed).length / results.length;
  const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  
  console.log(`📊 Evaluation Results:`);
  console.log(`   Pass Rate: ${(passRate * 100).toFixed(1)}%`);
  console.log(`   Avg Quality: ${avgQuality.toFixed(3)}`);
  console.log(`   Avg Latency: ${avgLatency.toFixed(0)}ms`);
  
  return results;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'create') {
    const targetCount = parseInt(process.argv[3]) || 200;
    const version = process.argv[4] || '1.0';
    
    createFrozenEvalSet(targetCount, version)
      .then(frozenSet => {
        saveFrozenEvalSet(frozenSet);
        console.log('✅ Frozen evaluation set created successfully');
      })
      .catch(error => {
        console.error('❌ Failed to create frozen evaluation set:', error);
        process.exit(1);
      });
      
  } else if (command === 'eval') {
    const modelVersion = process.argv[3];
    
    runEvaluation(modelVersion)
      .then(results => {
        console.log('✅ Evaluation completed successfully');
      })
      .catch(error => {
        console.error('❌ Evaluation failed:', error);
        process.exit(1);
      });
      
  } else {
    console.log('Usage:');
    console.log('  npm run freeze-eval-set create [count] [version]  - Create frozen evaluation set');
    console.log('  npm run freeze-eval-set eval [model]             - Run evaluation');
  }
}