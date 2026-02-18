/**
 * Phase 4C: Sandbox Environment Structuring Verification
 * 
 * Tests deterministic behavior of sandbox endpoints:
 * - Fixed birth + empty overrides => identical checksums across runs
 * - Fixed birth + fixed overrides => identical checksums across runs
 * - Fixed birth + sequential overrides => checksum changes per step, stable per step
 */

import type { SandboxBirth, SandboxOverrides } from '../contracts';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

interface SnapshotResponse {
  snapshot: any;
  meta: {
    baseHash: string;
    overridesHash: string;
    combinedHash: string;
  };
}

interface ReportResponse {
  features: number[];
  personality: any;
  guidance: any;
  explanation: any;
  seed: string;
  meta: {
    combinedHash: string;
  };
}

/**
 * Make POST request to sandbox endpoint
 */
async function postSandbox<T>(endpoint: string, body: any): Promise<T> {
  const url = `${API_BASE_URL}/api/sandbox/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

/**
 * Test Case 1: Fixed birth + empty overrides (3 runs)
 */
async function testCase1(): Promise<{ snapshotChecksum: string; reportChecksum: string }> {
  const birth: SandboxBirth = {
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7128,
    lon: -74.006,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  
  const overrides: SandboxOverrides = { planets: {} };
  
  console.log('\n[CASE 1] Fixed birth + empty overrides (3 runs)');
  
  const snapshotChecksums: string[] = [];
  const reportChecksums: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    const snapshotRes = await postSandbox<SnapshotResponse>('snapshot', { birth, overrides });
    snapshotChecksums.push(snapshotRes.meta.combinedHash);
    
    const reportRes = await postSandbox<ReportResponse>('report', { birth, overrides });
    reportChecksums.push(reportRes.meta.combinedHash);
    
    console.log(`  Run ${i + 1}: snapshot=${snapshotRes.meta.combinedHash.substring(0, 16)}... report=${reportRes.meta.combinedHash.substring(0, 16)}...`);
  }
  
  // Verify all checksums are identical
  const snapshotChecksum = snapshotChecksums[0];
  const reportChecksum = reportChecksums[0];
  
  if (!snapshotChecksums.every(c => c === snapshotChecksum)) {
    throw new Error(`CASE 1 FAILED: Snapshot checksums differ: ${snapshotChecksums.join(', ')}`);
  }
  
  if (!reportChecksums.every(c => c === reportChecksum)) {
    throw new Error(`CASE 1 FAILED: Report checksums differ: ${reportChecksums.join(', ')}`);
  }
  
  console.log(`  ✓ PASS: snapshot=${snapshotChecksum.substring(0, 16)}... report=${reportChecksum.substring(0, 16)}...`);
  
  return { snapshotChecksum, reportChecksum };
}

/**
 * Test Case 2: Fixed birth + fixed overrides (Sun=123.4, Moon=210.0) (3 runs)
 */
async function testCase2(): Promise<{ snapshotChecksum: string; reportChecksum: string }> {
  const birth: SandboxBirth = {
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7128,
    lon: -74.006,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  
  const overrides: SandboxOverrides = {
    planets: {
      sun: { lonDeg: 123.4 },
      moon: { lonDeg: 210.0 },
    },
  };
  
  console.log('\n[CASE 2] Fixed birth + fixed overrides (Sun=123.4, Moon=210.0) (3 runs)');
  
  const snapshotChecksums: string[] = [];
  const reportChecksums: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    const snapshotRes = await postSandbox<SnapshotResponse>('snapshot', { birth, overrides });
    snapshotChecksums.push(snapshotRes.meta.combinedHash);
    
    const reportRes = await postSandbox<ReportResponse>('report', { birth, overrides });
    reportChecksums.push(reportRes.meta.combinedHash);
    
    console.log(`  Run ${i + 1}: snapshot=${snapshotRes.meta.combinedHash.substring(0, 16)}... report=${reportRes.meta.combinedHash.substring(0, 16)}...`);
  }
  
  // Verify all checksums are identical
  const snapshotChecksum = snapshotChecksums[0];
  const reportChecksum = reportChecksums[0];
  
  if (!snapshotChecksums.every(c => c === snapshotChecksum)) {
    throw new Error(`CASE 2 FAILED: Snapshot checksums differ: ${snapshotChecksums.join(', ')}`);
  }
  
  if (!reportChecksums.every(c => c === reportChecksum)) {
    throw new Error(`CASE 2 FAILED: Report checksums differ: ${reportChecksums.join(', ')}`);
  }
  
  console.log(`  ✓ PASS: snapshot=${snapshotChecksum.substring(0, 16)}... report=${reportChecksum.substring(0, 16)}...`);
  
  return { snapshotChecksum, reportChecksum };
}

/**
 * Test Case 3: Fixed birth + sequential overrides (Sun=0.0 -> 0.1 -> 0.2 -> 0.3)
 */
async function testCase3(): Promise<{ checksums: string[] }> {
  const birth: SandboxBirth = {
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7128,
    lon: -74.006,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  
  console.log('\n[CASE 3] Fixed birth + sequential overrides (Sun=0.0 -> 0.1 -> 0.2 -> 0.3)');
  
  const checksums: string[] = [];
  const steps = [0.0, 0.1, 0.2, 0.3];
  
  for (const step of steps) {
    const overrides: SandboxOverrides = {
      planets: {
        sun: { lonDeg: step },
      },
    };
    
    // Run each step 2 times to verify stability
    const stepChecksums: string[] = [];
    for (let i = 0; i < 2; i++) {
      const snapshotRes = await postSandbox<SnapshotResponse>('snapshot', { birth, overrides });
      stepChecksums.push(snapshotRes.meta.combinedHash);
    }
    
    // Verify step is stable
    if (!stepChecksums.every(c => c === stepChecksums[0])) {
      throw new Error(`CASE 3 FAILED: Step Sun=${step} checksums differ: ${stepChecksums.join(', ')}`);
    }
    
    const stepChecksum = stepChecksums[0];
    checksums.push(stepChecksum);
    console.log(`  Sun=${step.toFixed(1)}°: ${stepChecksum.substring(0, 16)}...`);
  }
  
  // Verify checksums change between steps
  for (let i = 0; i < checksums.length - 1; i++) {
    if (checksums[i] === checksums[i + 1]) {
      throw new Error(`CASE 3 FAILED: Checksums identical for steps ${i} and ${i + 1}`);
    }
  }
  
  console.log(`  ✓ PASS: Checksums change per step, stable per step`);
  
  return { checksums };
}

/**
 * Main verification
 */
async function main() {
  console.log('Phase 4C: Sandbox Environment Structuring Verification');
  console.log(`API_BASE_URL: ${API_BASE_URL}`);
  
  // Precondition: Verify endpoints are available
  console.log('\n[PRECONDITION] Verifying endpoints...');
  try {
    const testBirth: SandboxBirth = {
      date: '1990-01-15',
      time: '12:00',
      lat: 40.7128,
      lon: -74.006,
      tz: 'UTC',
      houseSystem: 'placidus',
    };
    
    await postSandbox<SnapshotResponse>('snapshot', { birth: testBirth, overrides: { planets: {} } });
    await postSandbox<ReportResponse>('report', { birth: testBirth, overrides: { planets: {} } });
    console.log('  ✓ Endpoints available');
  } catch (err) {
    console.error('  ✗ Endpoints not available:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
  
  // Run test cases
  const case1 = await testCase1();
  const case2 = await testCase2();
  const case3 = await testCase3();
  
  // Output results
  console.log('\n=== VERIFICATION RESULTS ===');
  console.log(`CASE1_SNAPSHOT_CHECKSUM=${case1.snapshotChecksum}`);
  console.log(`CASE1_REPORT_CHECKSUM=${case1.reportChecksum}`);
  console.log(`CASE2_SNAPSHOT_CHECKSUM=${case2.snapshotChecksum}`);
  console.log(`CASE2_REPORT_CHECKSUM=${case2.reportChecksum}`);
  console.log(`CASE3_CHECKSUMS=${case3.checksums.join(',')}`);
  console.log('\nVERIFICATION=PASS');
}

main().catch((err) => {
  console.error('\nVERIFICATION=FAIL');
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
