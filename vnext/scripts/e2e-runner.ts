// vnext/scripts/e2e-runner.ts
// Comprehensive E2E test runner for Phase-3 hardening

import { runDeterminismTest, testFailClosed, testOverlayThresholds } from './e2e-determinism';
import fs from 'fs';
import path from 'path';

export interface E2ETestResult {
  schema: boolean;
  determinism: boolean;
  failClosed: boolean;
  overlayThresholds: boolean;
  latency: { p50: number; p95: number; pass: boolean };
  routeProof: boolean;
  artifacts: string[];
}

/**
 * Run comprehensive E2E test suite
 */
export async function runE2ETests(
  baseUrl: string = 'http://localhost:3000',
  artifactDir?: string
): Promise<E2ETestResult> {
  const composeEndpoint = `${baseUrl}/api/compose`;
  const results: E2ETestResult = {
    schema: false,
    determinism: false,
    failClosed: false,
    overlayThresholds: false,
    latency: { p50: 0, p95: 0, pass: false },
    routeProof: false,
    artifacts: []
  };
  
  console.log('🧪 Starting E2E test suite...');
  
  // 1. Schema validation
  console.log('📋 Testing schema compliance...');
  try {
    const response = await fetch(composeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const data = await response.json();
      const requiredKeys = ['controls', 'astro', 'gate_report', 'audio', 'text', 'artifacts'];
      results.schema = requiredKeys.every(key => key in data);
      
      if (results.schema) {
        console.log('✅ Schema validation passed');
      } else {
        console.log('❌ Schema validation failed - missing required keys');
      }
    } else {
      console.log(`❌ Schema test failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Schema test error: ${error}`);
  }
  
  // 2. Route proof (410 deprecation)
  console.log('🛡️ Testing route gating...');
  try {
    const renderResponse = await fetch(`${baseUrl}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    results.routeProof = renderResponse.status === 410;
    
    if (results.routeProof) {
      console.log('✅ Route gating working (410 Gone)');
    } else {
      console.log(`❌ Route gating failed: HTTP ${renderResponse.status}`);
    }
  } catch (error) {
    console.log(`❌ Route proof error: ${error}`);
  }
  
  // 3. Determinism test
  console.log('🎯 Testing determinism...');
  try {
    const testPayload = {
      mode: 'sandbox',
      controls: {
        hash: 'e2e-test-determinism',
        arc_shape_id: 'rise_peak_release',
        density_level: 0.5,
        tempo_norm: 0.5,
        step_bias: 0.62,
        leap_cap: 3,
        rhythm_template_id: 4,
        syncopation_bias: 0.28,
        motif_rate: 0.4
      }
    };
    
    const determinismResult = await runDeterminismTest(
      composeEndpoint,
      testPayload,
      5,
      artifactDir
    );
    
    results.determinism = determinismResult.success;
    
    if (results.determinism) {
      console.log('✅ Determinism test passed (5× identical)');
    } else {
      console.log(`❌ Determinism test failed (${determinismResult.uniqueHashes.length} unique hashes)`);
    }
    
    if (artifactDir) {
      results.artifacts.push('determinism/');
    }
  } catch (error) {
    console.log(`❌ Determinism test error: ${error}`);
  }
  
  // 4. Fail-closed test
  console.log('🚫 Testing fail-closed behavior...');
  try {
    const failPayload = {
      mode: 'sandbox',
      controls: {
        hash: 'e2e-test-fail-closed',
        arc_shape_id: 'plateau_hold',
        density_level: 0.99,
        tempo_norm: 0.99,
        step_bias: 0.01,
        leap_cap: 10,
        rhythm_template_id: 1,
        syncopation_bias: 0.99,
        motif_rate: 0.01
      }
    };
    
    const failResult = await testFailClosed(composeEndpoint, failPayload);
    results.failClosed = failResult.success;
    
    if (results.failClosed) {
      console.log('✅ Fail-closed test passed (knob hints only)');
    } else {
      console.log(`❌ Fail-closed test failed: "${failResult.text}"`);
    }
  } catch (error) {
    console.log(`❌ Fail-closed test error: ${error}`);
  }
  
  // 5. Overlay Δ thresholds
  console.log('📊 Testing overlay Δ thresholds...');
  try {
    const basePayload = {
      mode: 'sandbox',
      controls: {
        hash: 'e2e-test-overlay',
        arc_shape_id: 'rise_peak_release',
        density_level: 0.5,
        tempo_norm: 0.5,
        step_bias: 0.62,
        leap_cap: 3,
        rhythm_template_id: 4,
        syncopation_bias: 0.28,
        motif_rate: 0.4
      }
    };
    
    const overlayResult = await testOverlayThresholds(composeEndpoint, basePayload);
    results.overlayThresholds = overlayResult.aboveThreshold && overlayResult.belowThreshold;
    
    if (results.overlayThresholds) {
      console.log('✅ Overlay Δ thresholds working');
    } else {
      console.log(`❌ Overlay Δ thresholds failed (above: ${overlayResult.aboveThreshold}, below: ${overlayResult.belowThreshold})`);
    }
  } catch (error) {
    console.log(`❌ Overlay Δ test error: ${error}`);
  }
  
  // 6. Latency test
  console.log('⏱️ Testing latency...');
  try {
    const latencies: number[] = [];
    const testPayload = { mode: 'sandbox' };
    
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      const response = await fetch(composeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      const end = Date.now();
      
      if (response.ok) {
        latencies.push(end - start);
      }
    }
    
    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b);
      results.latency.p50 = latencies[Math.floor(latencies.length * 0.5)];
      results.latency.p95 = latencies[Math.floor(latencies.length * 0.95)];
      results.latency.pass = results.latency.p95 < 150;
      
      if (results.latency.pass) {
        console.log(`✅ Latency test passed (p95: ${results.latency.p95}ms)`);
      } else {
        console.log(`❌ Latency test failed (p95: ${results.latency.p95}ms > 150ms)`);
      }
    } else {
      console.log('❌ Latency test failed - no successful requests');
    }
  } catch (error) {
    console.log(`❌ Latency test error: ${error}`);
  }
  
  // Generate summary
  const passed = Object.values(results).filter(v => typeof v === 'boolean' ? v : v.pass).length;
  const total = 6; // schema, determinism, failClosed, overlayThresholds, latency, routeProof
  
  console.log(`\n📊 E2E Test Summary: ${passed}/${total} passed`);
  console.log(`Schema: ${results.schema ? '✅' : '❌'}`);
  console.log(`Determinism: ${results.determinism ? '✅' : '❌'}`);
  console.log(`Fail-closed: ${results.failClosed ? '✅' : '❌'}`);
  console.log(`Overlay Δ: ${results.overlayThresholds ? '✅' : '❌'}`);
  console.log(`Latency: ${results.latency.pass ? '✅' : '❌'} (p95: ${results.latency.p95}ms)`);
  console.log(`Route proof: ${results.routeProof ? '✅' : '❌'}`);
  
  return results;
}

// CLI runner
if (require.main === module) {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const artifactDir = process.env.ARTIFACT_DIR;
  
  runE2ETests(baseUrl, artifactDir)
    .then(results => {
      const exitCode = results.schema && results.determinism && results.failClosed && 
                      results.overlayThresholds && results.latency.pass && results.routeProof ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('E2E test suite failed:', error);
      process.exit(1);
    });
}
