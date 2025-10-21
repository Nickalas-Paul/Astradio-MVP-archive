#!/usr/bin/env node

// Integration Test Runner
// Runs all contract tests and smoke tests to verify non-breaking integration

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Astradio Integration Tests...\n');

// Test configuration
const tests = [
  {
    name: 'Engine Adapter Contract Tests',
    command: 'npx jest tests/engine-adapter.contract.test.ts --verbose',
    description: 'Verifies adapter invariants and stage ordering'
  },
  {
    name: 'E2E Smoke Tests',
    command: 'npx playwright test tests/e2e.smoke.spec.ts --reporter=list',
    description: 'Verifies UI never blocks engine operations'
  }
];

// Check if required dependencies are installed
function checkDependencies() {
  console.log('📦 Checking dependencies...');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['jest', '@playwright/test'];
  
  for (const dep of requiredDeps) {
    if (!packageJson.devDependencies?.[dep] && !packageJson.dependencies?.[dep]) {
      console.error(`❌ Missing dependency: ${dep}`);
      console.error('Please install with: npm install --save-dev jest @playwright/test');
      process.exit(1);
    }
  }
  
  console.log('✅ All dependencies found\n');
}

// Run a single test
function runTest(test) {
  console.log(`🔍 ${test.name}`);
  console.log(`   ${test.description}`);
  
  try {
    const output = execSync(test.command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    console.log('✅ PASSED\n');
    return { success: true, output };
  } catch (error) {
    console.log('❌ FAILED');
    console.log(error.stdout || error.message);
    console.log('');
    return { success: false, error: error.stdout || error.message };
  }
}

// Main test runner
async function runIntegrationTests() {
  checkDependencies();
  
  const results = [];
  let allPassed = true;
  
  for (const test of tests) {
    const result = runTest(test);
    results.push({ ...test, ...result });
    
    if (!result.success) {
      allPassed = false;
    }
  }
  
  // Summary
  console.log('📊 Test Summary');
  console.log('================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} ${result.name}`);
  });
  
  console.log('');
  
  if (allPassed) {
    console.log('🎉 All integration tests passed!');
    console.log('✅ Engine adapter contracts verified');
    console.log('✅ UI never blocks engine operations');
    console.log('✅ Feature flags work correctly');
    console.log('✅ Timeline clamping prevents drift');
    console.log('✅ Telemetry is non-blocking');
    console.log('✅ Error handling is graceful');
    console.log('\n🚀 Ready for production deployment!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please fix issues before deployment.');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Astradio Integration Test Runner

Usage: node scripts/test-integration.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Show detailed output

Tests:
  - Engine Adapter Contract Tests: Verifies adapter invariants
  - E2E Smoke Tests: Verifies UI never blocks engine operations

Examples:
  node scripts/test-integration.js
  node scripts/test-integration.js --verbose
`);
  process.exit(0);
}

// Run tests
runIntegrationTests().catch(error => {
  console.error('💥 Test runner failed:', error.message);
  process.exit(1);
});
