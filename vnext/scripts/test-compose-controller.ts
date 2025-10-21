/**
 * Test Compose Controller - Spec v1.1 Compliance
 * Phase-6 Step 2: /api/compose controller wiring verification
 */

import { ComposeAPI } from '../api/compose';
import * as fs from 'fs';
import * as path from 'path';

interface TestChart {
  id: string;
  name: string;
  control_surface: any;
  expected_length_sec: number;
}

async function testComposeController() {
  console.log('🧪 Testing Compose Controller - Spec v1.1 Compliance...\n');
  
  const composeAPI = new ComposeAPI();
  const results: any[] = [];
  
  // Generate 20 test charts with different configurations
  const testCharts = generateTestCharts(20);
  
  try {
    // Test each chart 5 times for determinism
    for (const chart of testCharts) {
      console.log(`Testing chart: ${chart.name}`);
      const chartResults: any[] = [];
      
      for (let run = 1; run <= 5; run++) {
        const request = {
          mode: 'sandbox' as const,
          controls: chart.control_surface,
          seed: 424242 // Fixed seed for determinism
        };
        
        const startTime = Date.now();
        const response = await composeAPI.compose(request);
        const latency = Date.now() - startTime;
        
        // Validate response structure
        const validation = validateResponse(response, chart);
        
        chartResults.push({
          run,
          latency_ms: latency,
          validation,
          audio_url: response.audio?.url,
          explanation_sections: (response as any)?.explanation?.sections?.length || 0,
          control_hash: response.controls?.hash,
          audio_hash: response.audio?.url?.split('/').pop()?.split('.')[0] || 'unknown'
        });
      }
      
      // Check determinism (all runs should be identical)
      const isDeterministic = checkDeterminism(chartResults);
      const avgLatency = chartResults.reduce((sum, r) => sum + r.latency_ms, 0) / chartResults.length;
      
      results.push({
        chart_id: chart.id,
        chart_name: chart.name,
        runs: chartResults,
        deterministic: isDeterministic,
        avg_latency_ms: Math.round(avgLatency),
        all_validations_pass: chartResults.every(r => r.validation.passes),
        schema_compliant: chartResults.every(r => r.validation.schema_compliant)
      });
      
      console.log(`  ✅ Deterministic: ${isDeterministic}, Avg Latency: ${Math.round(avgLatency)}ms`);
    }
    
    // Generate summary
    const summary = {
      total_charts: results.length,
      deterministic_charts: results.filter(r => r.deterministic).length,
      schema_compliant_charts: results.filter(r => r.schema_compliant).length,
      validation_pass_charts: results.filter(r => r.all_validations_pass).length,
      avg_latency_ms: Math.round(results.reduce((sum, r) => sum + r.avg_latency_ms, 0) / results.length),
      p95_latency_ms: calculateP95(results.map(r => r.avg_latency_ms))
    };
    
    // Write results
    const resultsPath = 'proofs/runtime/compose-controller.txt';
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'phase-6-step-2',
      test_type: 'compose_controller_spec_v1_1',
      summary,
      charts: results
    };
    
    fs.writeFileSync(resultsPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Results written to: ${resultsPath}`);
    
    // Check if all gates pass
    const allPass = summary.deterministic_charts === summary.total_charts &&
                   summary.schema_compliant_charts === summary.total_charts &&
                   summary.validation_pass_charts === summary.total_charts &&
                   summary.p95_latency_ms <= 1800;
    
    console.log(`\n📊 Summary:`);
    console.log(`  Charts: ${summary.total_charts}`);
    console.log(`  Deterministic: ${summary.deterministic_charts}/${summary.total_charts}`);
    console.log(`  Schema Compliant: ${summary.schema_compliant_charts}/${summary.total_charts}`);
    console.log(`  Validation Pass: ${summary.validation_pass_charts}/${summary.total_charts}`);
    console.log(`  P95 Latency: ${summary.p95_latency_ms}ms (≤1800ms)`);
    console.log(`\n${allPass ? '🎉 Compose Controller Tests PASSED' : '❌ Compose Controller Tests FAILED'}`);
    
    return allPass;
    
  } catch (error) {
    console.error('❌ Compose Controller Tests FAILED:', error);
    return false;
  }
}

function generateTestCharts(count: number): TestChart[] {
  const charts: TestChart[] = [];
  const elements = ['fire', 'earth', 'air', 'water'];
  const modalities = ['cardinal', 'fixed', 'mutable'];
  const genres = ['classical', 'jazz', 'electronic', 'ambient'];
  
  for (let i = 0; i < count; i++) {
    const element = elements[i % elements.length];
    const modality = modalities[i % modalities.length];
    const genre = genres[i % genres.length];
    
    charts.push({
      id: `chart_${i + 1}`,
      name: `${element}_${modality}_${genre}`,
      control_surface: {
        arc_shape: 0.4 + (i * 0.02),
        density_level: 0.5 + (i * 0.015),
        tempo_norm: 0.6 + (i * 0.01),
        step_bias: 0.6 + (i * 0.02),
        leap_cap: 3 + (i % 4),
        rhythm_template_id: i % 8,
        syncopation_bias: (i * 0.05) % 1,
        motif_rate: 0.4 + (i * 0.02),
        element_dominance: element,
        aspect_tension: 0.2 + (i * 0.03),
        modality
      },
      expected_length_sec: 60
    });
  }
  
  return charts;
}

function validateResponse(response: any, chart: TestChart): { passes: boolean; schema_compliant: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check required fields
  if (!response.controls) issues.push('Missing controls field');
  if (!response.audio) issues.push('Missing audio field');
  if (!response.explanation) issues.push('Missing explanation field');
  if (!response.gate_report) issues.push('Missing gate_report field');
  
  // Check control surface integrity (same payload in/out)
  if (response.controls) {
    const controlKeys = Object.keys(chart.control_surface);
    for (const key of controlKeys) {
      if (response.controls[key] !== chart.control_surface[key]) {
        issues.push(`Control surface mismatch for ${key}`);
      }
    }
  }
  
  // Check audio structure
  if (response.audio && !response.audio.url) {
    issues.push('Audio missing URL');
  }
  
  // Check explanation structure (Unified Spec v1.1)
  if (response.explanation) {
    if (!response.explanation.spec || response.explanation.spec !== 'UnifiedSpecV1.1') {
      issues.push('Explanation missing or invalid spec version');
    }
    if (!response.explanation.sections || !Array.isArray(response.explanation.sections)) {
      issues.push('Explanation missing sections array');
    }
  }
  
  // Check gate report structure
  if (response.gate_report) {
    if (!response.gate_report.calibrated || !response.gate_report.strict) {
      issues.push('Gate report missing calibrated/strict fields');
    }
  }
  
  const schema_compliant = issues.length === 0;
  const passes = schema_compliant && response.audio?.url && response.explanation?.sections?.length > 0;
  
  return { passes, schema_compliant, issues };
}

function checkDeterminism(runs: any[]): boolean {
  if (runs.length < 2) return true;
  
  const firstRun = runs[0];
  return runs.every(run => 
    run.audio_hash === firstRun.audio_hash &&
    run.control_hash === firstRun.control_hash &&
    run.explanation_sections === firstRun.explanation_sections
  );
}

function calculateP95(values: number[]): number {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index];
}

// Run if called directly
if (require.main === module) {
  testComposeController().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testComposeController };
