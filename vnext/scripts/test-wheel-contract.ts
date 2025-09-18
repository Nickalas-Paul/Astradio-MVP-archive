// vnext/scripts/test-wheel-contract.ts
// Contract tests to ensure astro-debug API always returns fields the wheel expects
// Prevents silent front-end breakage during backend refactors

import { astroDebugHandler, type AstroDebugResponse } from "../api/astro-debug";
import type { EphemerisSnapshot } from "../contracts";

interface WheelContract {
  chartContext: {
    planets: Array<{ name: string; lon: number }>;
    houses: number[];
    aspects?: Array<{ p1: string; p2: string; type: string; orb: number }>;
    moonPhase?: number;
    dominantElements?: { fire: number; earth: number; air: number; water: number };
  };
  featureVec: number[];
  astroGuidance: {
    tempoBias: number;
    arcBias: number;
    densityBias: number;
    motifIdx: number;
    cadenceIdx: number;
  };
  studentV6: number[];
  planPreviewMeta: {
    bpm: number;
    arcLift: number;
    motifIdx: number;
    cadenceIdx: number;
    density: number;
  };
}

// Test cases for wheel contract validation
const TEST_CHARTS = [
  {
    name: "Basic Chart",
    chartContext: {
      ts: "2024-01-15T12:00:00Z",
      tz: "UTC",
      lat: 40.7128,
      lon: -74.0060,
      planets: [
        { name: "sun", lon: 295 },
        { name: "moon", lon: 120 },
        { name: "mercury", lon: 280 },
        { name: "venus", lon: 310 },
        { name: "mars", lon: 45 }
      ],
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
      aspects: [
        { p1: "sun", p2: "moon", type: "trine", orb: 2.5 }
      ],
      moonPhase: 0.3,
      dominantElements: { fire: 0.4, earth: 0.2, air: 0.3, water: 0.1 }
    }
  },
  
  {
    name: "Minimal Chart",
    chartContext: {
      planets: [
        { name: "sun", lon: 0 },
        { name: "moon", lon: 90 }
      ],
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    }
  },
  
  {
    name: "Complex Chart",
    chartContext: {
      ts: "2024-06-21T18:30:00Z",
      tz: "America/New_York",
      lat: 37.7749,
      lon: -122.4194,
      planets: [
        { name: "sun", lon: 90 },
        { name: "moon", lon: 180 },
        { name: "mercury", lon: 85 },
        { name: "venus", lon: 105 },
        { name: "mars", lon: 200 },
        { name: "jupiter", lon: 60 },
        { name: "saturn", lon: 350 },
        { name: "uranus", lon: 65 },
        { name: "neptune", lon: 355 },
        { name: "pluto", lon: 300 }
      ],
      houses: [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345],
      aspects: [
        { p1: "sun", p2: "moon", type: "square", orb: 1.5 },
        { p1: "venus", p2: "mars", type: "opposition", orb: 3.2 },
        { p1: "jupiter", p2: "saturn", type: "trine", orb: 2.8 }
      ],
      moonPhase: 0.75,
      dominantElements: { fire: 0.3, earth: 0.1, air: 0.4, water: 0.2 }
    }
  }
];

// Validation functions
function validateChartContext(chartContext: any): string[] {
  const issues: string[] = [];
  
  if (!chartContext) {
    issues.push("chartContext is missing");
    return issues;
  }
  
  // Validate planets array
  if (!Array.isArray(chartContext.planets)) {
    issues.push("chartContext.planets must be an array");
  } else {
    chartContext.planets.forEach((planet: any, index: number) => {
      if (typeof planet.name !== 'string') {
        issues.push(`planet[${index}].name must be a string`);
      }
      if (typeof planet.lon !== 'number' || !Number.isFinite(planet.lon)) {
        issues.push(`planet[${index}].lon must be a finite number`);
      }
    });
  }
  
  // Validate houses array
  if (!Array.isArray(chartContext.houses)) {
    issues.push("chartContext.houses must be an array");
  } else if (chartContext.houses.length !== 12) {
    issues.push("chartContext.houses must have exactly 12 elements");
  } else {
    chartContext.houses.forEach((house: any, index: number) => {
      if (typeof house !== 'number' || !Number.isFinite(house)) {
        issues.push(`house[${index}] must be a finite number`);
      }
    });
  }
  
  return issues;
}

function validateFeatureVec(featureVec: any): string[] {
  const issues: string[] = [];
  
  if (!Array.isArray(featureVec)) {
    issues.push("featureVec must be an array");
    return issues;
  }
  
  if (featureVec.length !== 64) {
    issues.push(`featureVec must have 64 elements, got ${featureVec.length}`);
  }
  
  featureVec.forEach((value: any, index: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(`featureVec[${index}] must be a finite number`);
    }
    if (value < 0 || value > 1) {
      issues.push(`featureVec[${index}] should be in range [0,1], got ${value}`);
    }
  });
  
  return issues;
}

function validateAstroGuidance(astroGuidance: any): string[] {
  const issues: string[] = [];
  
  if (!astroGuidance || typeof astroGuidance !== 'object') {
    issues.push("astroGuidance must be an object");
    return issues;
  }
  
  const required = ['tempoBias', 'arcBias', 'densityBias', 'motifIdx', 'cadenceIdx'];
  required.forEach(field => {
    if (typeof astroGuidance[field] !== 'number' || !Number.isFinite(astroGuidance[field])) {
      issues.push(`astroGuidance.${field} must be a finite number`);
    }
  });
  
  // Check bias ranges
  ['tempoBias', 'arcBias', 'densityBias'].forEach(field => {
    const value = astroGuidance[field];
    if (typeof value === 'number' && (value < -1 || value > 1)) {
      issues.push(`astroGuidance.${field} should be in range [-1,1], got ${value}`);
    }
  });
  
  return issues;
}

function validateStudentV6(studentV6: any): string[] {
  const issues: string[] = [];
  
  if (!Array.isArray(studentV6)) {
    issues.push("studentV6 must be an array");
    return issues;
  }
  
  if (studentV6.length !== 6) {
    issues.push(`studentV6 must have 6 elements, got ${studentV6.length}`);
  }
  
  studentV6.forEach((value: any, index: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(`studentV6[${index}] must be a finite number`);
    }
    if (value < 0 || value > 1) {
      issues.push(`studentV6[${index}] should be in range [0,1], got ${value}`);
    }
  });
  
  return issues;
}

function validatePlanPreviewMeta(planPreviewMeta: any): string[] {
  const issues: string[] = [];
  
  if (!planPreviewMeta || typeof planPreviewMeta !== 'object') {
    issues.push("planPreviewMeta must be an object");
    return issues;
  }
  
  const required = ['bpm', 'arcLift', 'motifIdx', 'cadenceIdx', 'density'];
  required.forEach(field => {
    if (typeof planPreviewMeta[field] !== 'number' || !Number.isFinite(planPreviewMeta[field])) {
      issues.push(`planPreviewMeta.${field} must be a finite number`);
    }
  });
  
  // Check reasonable ranges
  if (typeof planPreviewMeta.bpm === 'number') {
    if (planPreviewMeta.bpm < 60 || planPreviewMeta.bpm > 200) {
      issues.push(`planPreviewMeta.bpm should be reasonable (60-200), got ${planPreviewMeta.bpm}`);
    }
  }
  
  if (typeof planPreviewMeta.density === 'number') {
    if (planPreviewMeta.density < 0 || planPreviewMeta.density > 1) {
      issues.push(`planPreviewMeta.density should be in range [0,1], got ${planPreviewMeta.density}`);
    }
  }
  
  return issues;
}

// Mock request/response for testing
class MockResponse {
  private statusCode = 200;
  private responseData: any = null;
  
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  
  json(data: any) {
    this.responseData = data;
    return this;
  }
  
  getStatus() { return this.statusCode; }
  getData() { return this.responseData; }
}

// Main test runner
export async function runWheelContractTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{
    test: string;
    passed: boolean;
    details: string;
    issues: string[];
  }>;
}> {
  console.log("🔧 Running Wheel Contract Tests");
  console.log("=" .repeat(50));
  
  const results: Array<{
    test: string;
    passed: boolean;
    details: string;
    issues: string[];
  }> = [];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of TEST_CHARTS) {
    console.log(`\n📋 ${testCase.name}`);
    
    try {
      // Create mock request/response
      const req = { body: { chartContext: testCase.chartContext } };
      const res = new MockResponse();
      
      // Call astro-debug handler
      await astroDebugHandler(req, res);
      
      const status = res.getStatus();
      const data = res.getData();
      
      if (status !== 200) {
        console.log(`   ❌ FAILED: HTTP ${status}`);
        results.push({
          test: testCase.name,
          passed: false,
          details: `HTTP error ${status}: ${data?.error || 'Unknown error'}`,
          issues: [data?.error || 'Unknown HTTP error']
        });
        failed++;
        continue;
      }
      
      // Validate response structure
      const allIssues: string[] = [];
      
      allIssues.push(...validateChartContext(data.chartContext));
      allIssues.push(...validateFeatureVec(data.featureVec));
      allIssues.push(...validateAstroGuidance(data.astroGuidance));
      allIssues.push(...validateStudentV6(data.studentV6));
      allIssues.push(...validatePlanPreviewMeta(data.planPreviewMeta));
      
      if (allIssues.length === 0) {
        console.log(`   ✅ PASSED`);
        console.log(`   Model: ${data.modelVersion || 'unknown'} (${data.modelSource || 'unknown'})`);
        console.log(`   BPM: ${data.planPreviewMeta?.bpm}, Density: ${data.planPreviewMeta?.density?.toFixed(2)}`);
        
        results.push({
          test: testCase.name,
          passed: true,
          details: `All contract fields validated successfully`,
          issues: []
        });
        passed++;
      } else {
        console.log(`   ❌ FAILED: ${allIssues.length} contract violations`);
        allIssues.slice(0, 3).forEach(issue => console.log(`      • ${issue}`));
        if (allIssues.length > 3) {
          console.log(`      • ... and ${allIssues.length - 3} more issues`);
        }
        
        results.push({
          test: testCase.name,
          passed: false,
          details: `${allIssues.length} contract violations`,
          issues: allIssues
        });
        failed++;
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({
        test: testCase.name,
        passed: false,
        details: `Test error: ${error.message}`,
        issues: [error.message]
      });
      failed++;
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`🎯 Wheel Contract Results: ${passed}/${passed + failed} passed`);
  
  if (failed > 0) {
    console.log("⚠️  Contract violations detected - wheel may break on backend changes");
    console.log("   Fix the API response structure before deploying");
  } else {
    console.log("✅ All wheel contracts validated - API is wheel-compatible");
  }
  
  return { passed, failed, results };
}

// CLI runner
if (require.main === module) {
  runWheelContractTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error("Fatal error running wheel contract tests:", error);
      process.exit(1);
    });
}
