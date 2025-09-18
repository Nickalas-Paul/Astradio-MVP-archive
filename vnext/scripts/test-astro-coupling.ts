// vnext/scripts/test-astro-coupling.ts
// Automated tests for astro → music coupling monotonicity
// Ensures astrological features map predictably to musical dimensions

import { encodeFeatures } from "../feature-encode";
import { studentVector } from "../ml/student";
import type { EphemerisSnapshot, FeatureVec } from "../contracts";

interface CouplingTest {
  name: string;
  description: string;
  createVariations: () => EphemerisSnapshot[];
  expectedTrend: (vectors: number[][]) => boolean;
  tolerance: number;
}

// Test suite for astro-music coupling
const COUPLING_TESTS: CouplingTest[] = [
  {
    name: "Fire Dominance → Tempo Increase",
    description: "Increasing fire element should monotonically increase tempo (control[0])",
    createVariations: () => createElementVariations('fire', [0.1, 0.3, 0.5, 0.7, 0.9]),
    expectedTrend: (vectors) => isMonotonicIncreasing(vectors.map(v => v[0])),
    tolerance: 0.05
  },
  
  {
    name: "Aspect Tension → Arc Bias",
    description: "Increasing square/opposition aspects should increase arc dimension (control[3])",
    createVariations: () => createTensionVariations([0, 2, 4, 6, 8]),
    expectedTrend: (vectors) => isMonotonicIncreasing(vectors.map(v => v[3])),
    tolerance: 0.08
  },
  
  {
    name: "Water Dominance → Density Decrease", 
    description: "Increasing water element should decrease density (control[2])",
    createVariations: () => createElementVariations('water', [0.1, 0.3, 0.5, 0.7, 0.9]),
    expectedTrend: (vectors) => isMonotonicDecreasing(vectors.map(v => v[2])),
    tolerance: 0.06
  },
  
  {
    name: "Cardinal Modality → Brightness",
    description: "Increasing cardinal planets should increase brightness (control[1])",
    createVariations: () => createModalityVariations('cardinal', [0.2, 0.4, 0.6, 0.8]),
    expectedTrend: (vectors) => isMonotonicIncreasing(vectors.map(v => v[1])),
    tolerance: 0.07
  },
  
  {
    name: "Moon Phase → Motif Selection",
    description: "Moon phase progression should show clear trend in motif (control[4])",
    createVariations: () => createMoonPhaseVariations([0.0, 0.25, 0.5, 0.75, 1.0]),
    expectedTrend: (vectors) => hasSignificantVariation(vectors.map(v => v[4])),
    tolerance: 0.1
  }
];

// Create base chart for variations
function createBaseChart(): EphemerisSnapshot {
  return {
    ts: "2024-01-01T12:00:00Z",
    tz: "UTC",
    lat: 40.7128,
    lon: -74.0060,
    houseSystem: "placidus",
    planets: [
      { name: "sun", lon: 280 },      // Capricorn
      { name: "moon", lon: 120 },     // Leo
      { name: "mercury", lon: 285 },  // Capricorn
      { name: "venus", lon: 300 },    // Aquarius
      { name: "mars", lon: 45 },      // Taurus
      { name: "jupiter", lon: 80 },   // Gemini
      { name: "saturn", lon: 320 },   // Aquarius
      { name: "uranus", lon: 60 },    // Gemini
      { name: "neptune", lon: 350 },  // Pisces
      { name: "pluto", lon: 290 }     // Capricorn
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as [number, number, number, number, number, number, number, number, number, number, number, number],
    aspects: [
      { p1: "sun", p2: "moon", type: "trine", orb: 2.5 },
      { p1: "venus", p2: "mars", type: "square", orb: 1.8 }
    ],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
  };
}

// Create variations with different element dominance
function createElementVariations(element: 'fire' | 'earth' | 'air' | 'water', values: number[]): EphemerisSnapshot[] {
  return values.map(value => {
    const chart = createBaseChart();
    const remaining = (1 - value) / 3;
    
    chart.dominantElements = { fire: remaining, earth: remaining, air: remaining, water: remaining };
    chart.dominantElements[element] = value;
    
    return chart;
  });
}

// Create variations with different tension levels (square/opposition aspects)
function createTensionVariations(aspectCounts: number[]): EphemerisSnapshot[] {
  return aspectCounts.map(count => {
    const chart = createBaseChart();
    chart.aspects = [];
    
    // Add tension aspects
    const planets = chart.planets.slice(0, Math.min(10, count + 2));
    for (let i = 0; i < count && i < planets.length - 1; i++) {
      chart.aspects.push({
        p1: planets[i].name,
        p2: planets[i + 1].name,
        type: i % 2 === 0 ? 'square' : 'opposition',
        orb: 2.0
      });
    }
    
    return chart;
  });
}

// Create modality variations (simplified)
function createModalityVariations(modality: string, values: number[]): EphemerisSnapshot[] {
  return values.map(value => {
    const chart = createBaseChart();
    
    // Adjust planet positions to emphasize modality
    if (modality === 'cardinal') {
      // Place more planets in cardinal signs (0°, 90°, 180°, 270°)
      chart.planets[0].lon = 0 + value * 30;   // Aries
      chart.planets[1].lon = 90 + value * 30;  // Cancer  
      chart.planets[2].lon = 180 + value * 30; // Libra
      chart.planets[3].lon = 270 + value * 30; // Capricorn
    }
    
    return chart;
  });
}

// Create moon phase variations
function createMoonPhaseVariations(phases: number[]): EphemerisSnapshot[] {
  return phases.map(phase => {
    const chart = createBaseChart();
    chart.moonPhase = phase;
    return chart;
  });
}

// Monotonicity check functions
function isMonotonicIncreasing(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i-1]) return false;
  }
  return true;
}

function isMonotonicDecreasing(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i-1]) return false;
  }
  return true;
}

function hasSignificantVariation(values: number[], minRange = 0.1): boolean {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (max - min) >= minRange;
}

// Calculate correlation coefficient
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b) / n;
  const meanY = y.reduce((a, b) => a + b) / n;
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const deltaX = x[i] - meanX;
    const deltaY = y[i] - meanY;
    numerator += deltaX * deltaY;
    denomX += deltaX * deltaX;
    denomY += deltaY * deltaY;
  }
  
  return numerator / Math.sqrt(denomX * denomY);
}

// Main test runner
export async function runAstroCouplingTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{
    test: string;
    passed: boolean;
    details: string;
    correlation?: number;
  }>;
}> {
  console.log("🧪 Running Astro → Music Coupling Tests");
  console.log("=" .repeat(50));
  
  const results: Array<{
    test: string;
    passed: boolean;
    details: string;
    correlation?: number;
  }> = [];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of COUPLING_TESTS) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   ${test.description}`);
    
    try {
      // Create test variations
      const variations = test.createVariations();
      console.log(`   Testing ${variations.length} variations...`);
      
      // Get model predictions for each variation
      const vectors: number[][] = [];
      for (const variation of variations) {
        const features = encodeFeatures(variation);
        const result = await studentVector(features, variation);
        vectors.push(result.vector);
      }
      
      // Check expected trend
      const trendPassed = test.expectedTrend(vectors);
      
      // Calculate correlation for additional insight
      const indices = variations.map((_, i) => i);
      const targetDimension = vectors.map(v => v[0]); // Default to tempo
      const corr = correlation(indices, targetDimension);
      
      if (trendPassed) {
        console.log(`   ✅ PASSED (correlation: ${corr.toFixed(3)})`);
        results.push({
          test: test.name,
          passed: true,
          details: `Trend validated, correlation: ${corr.toFixed(3)}`,
          correlation: corr
        });
        passed++;
      } else {
        console.log(`   ❌ FAILED (correlation: ${corr.toFixed(3)})`);
        results.push({
          test: test.name,
          passed: false,
          details: `Expected trend not found, correlation: ${corr.toFixed(3)}`,
          correlation: corr
        });
        failed++;
      }
      
      // Log sample values for debugging
      const sampleValues = vectors.slice(0, 3).map(v => `[${v.map(x => x.toFixed(2)).join(', ')}]`);
      console.log(`   Sample vectors: ${sampleValues.join(' → ')}`);
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({
        test: test.name,
        passed: false,
        details: `Test error: ${error.message}`
      });
      failed++;
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`🎯 Coupling Test Results: ${passed}/${passed + failed} passed`);
  
  if (failed > 0) {
    console.log("⚠️  Failed tests indicate model may not be learning astro-music relationships correctly");
    console.log("   Consider retraining with more diverse data or adjusting feature encoding");
  } else {
    console.log("✅ All coupling tests passed - model shows proper astro-music relationships");
  }
  
  return { passed, failed, results };
}

// CLI runner
if (require.main === module) {
  runAstroCouplingTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error("Fatal error running coupling tests:", error);
      process.exit(1);
    });
}
