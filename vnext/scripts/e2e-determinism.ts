// vnext/scripts/e2e-determinism.ts
// E2E determinism testing with proper normalization

import { normalizeResponse, hashNormalizedResponse, DEFAULT_EXCLUSIONS } from './determinism-normalizer';
import fs from 'fs';
import path from 'path';

export interface DeterminismTestResult {
  success: boolean;
  hashCount: number;
  uniqueHashes: string[];
  exclusions: string[];
  artifacts?: {
    responses: any[];
    hashes: string[];
    exclusionsFile: string;
  };
}

/**
 * Run determinism test with N identical requests
 */
export async function runDeterminismTest(
  composeEndpoint: string,
  payload: any,
  iterations: number = 5,
  artifactDir?: string
): Promise<DeterminismTestResult> {
  const responses: any[] = [];
  const hashes: string[] = [];
  
  // Make N identical requests
  for (let i = 0; i < iterations; i++) {
    try {
      const response = await fetch(composeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      responses.push(data);
      
      // Normalize and hash
      const hash = hashNormalizedResponse(data, DEFAULT_EXCLUSIONS);
      hashes.push(hash);
      
    } catch (error) {
      throw new Error(`Determinism test failed on iteration ${i + 1}: ${error}`);
    }
  }
  
  // Check if all hashes are identical
  const uniqueHashes = [...new Set(hashes)];
  const success = uniqueHashes.length === 1;
  
  // Generate artifacts if requested
  let artifacts: DeterminismTestResult['artifacts'] | undefined;
  if (artifactDir) {
    const artifactsPath = path.join(artifactDir, 'determinism');
    fs.mkdirSync(artifactsPath, { recursive: true });
    
    // Save responses
    fs.writeFileSync(
      path.join(artifactsPath, 'responses.json'),
      JSON.stringify(responses, null, 2)
    );
    
    // Save hashes
    fs.writeFileSync(
      path.join(artifactsPath, 'hashes.txt'),
      hashes.join('\n')
    );
    
    // Save exclusions
    const exclusionsFile = path.join(artifactsPath, 'exclusions.txt');
    fs.writeFileSync(exclusionsFile, [
      'Determinism test exclusions:',
      `- artifacts.timestamp: ${DEFAULT_EXCLUSIONS.timestamp}`,
      `- audio.latency_ms: ${DEFAULT_EXCLUSIONS.latency}`,
      `- audio.url query params: ${DEFAULT_EXCLUSIONS.audioUrl}`,
      '',
      `Test: ${iterations} identical requests`,
      `Result: ${success ? 'PASS' : 'FAIL'} (${uniqueHashes.length} unique hashes)`,
      `Hashes: ${uniqueHashes.join(', ')}`
    ].join('\n'));
    
    artifacts = {
      responses,
      hashes,
      exclusionsFile
    };
  }
  
  return {
    success,
    hashCount: hashes.length,
    uniqueHashes,
    exclusions: [
      'artifacts.timestamp',
      'audio.latency_ms',
      'audio.url query params'
    ],
    artifacts
  };
}

/**
 * Test fail-closed behavior with forced gate failure
 */
export async function testFailClosed(
  composeEndpoint: string,
  payload: any,
  forceFail: string = 'step_leap'
): Promise<{ success: boolean; text: string; failClosed: boolean }> {
  // Add test override to force gate failure
  const testPayload = {
    ...payload,
    testOverride: {
      forceFail,
      calibrated: false
    }
  };
  
  const response = await fetch(composeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Check if text contains only knob hints (no musical adjectives)
  const text = data.text?.short || '';
  const hasMusicalAdjectives = /\b(social|equilibrated|connected|expansive|cosmic|delicate|harmonious|introspective)\b/i.test(text);
  const hasKnobHints = /\b(step_bias|leap_cap|rhythm_template|syncopation)\b/i.test(text);
  
  const failClosed = !hasMusicalAdjectives && hasKnobHints;
  
  return {
    success: failClosed,
    text,
    failClosed
  };
}

/**
 * Test overlay Δ thresholds
 */
export async function testOverlayThresholds(
  composeEndpoint: string,
  basePayload: any
): Promise<{ aboveThreshold: boolean; belowThreshold: boolean }> {
  // Test above threshold (should show contrast)
  const abovePayload = {
    ...basePayload,
    mode: 'overlay',
    overlayParams: {
      natalLatitude: 34.05,
      natalLongitude: -118.25,
      natalDatetime: '1990-01-01T12:00:00Z',
      currentLatitude: 34.05,
      currentLongitude: -118.25,
      currentDatetime: '2024-08-08T12:00:00Z' // Large time delta
    }
  };
  
  const aboveResponse = await fetch(composeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(abovePayload)
  });
  
  const aboveData = await aboveResponse.json();
  const aboveText = aboveData.text?.short || '';
  const aboveThreshold = aboveText.includes('Compared to your natal chart');
  
  // Test below threshold (should not show contrast)
  const belowPayload = {
    ...basePayload,
    mode: 'overlay',
    overlayParams: {
      natalLatitude: 34.05,
      natalLongitude: -118.25,
      natalDatetime: '1990-01-01T12:00:00Z',
      currentLatitude: 34.05,
      currentLongitude: -118.25,
      currentDatetime: '1990-01-01T12:05:00Z' // Small time delta
    }
  };
  
  const belowResponse = await fetch(composeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(belowPayload)
  });
  
  const belowData = await belowResponse.json();
  const belowText = belowData.text?.short || '';
  const belowThreshold = !belowText.includes('Compared to your natal chart');
  
  return { aboveThreshold, belowThreshold };
}
