/**
 * Comprehensive Test Runner for Unified Spec v1.1
 * Orchestrates all test suites and provides unified reporting
 */

import { ContractTester } from './contract-tests';
import { SnapshotTester } from './snapshot-tests';
import { LoadTester } from './load-test';
import { E2ETester } from './e2e-test';

interface TestSuiteResult {
  suite: string;
  passed: boolean;
  duration_ms: number;
  details: string;
  results?: any[];
}

interface OverallResult {
  allPassed: boolean;
  totalSuites: number;
  passedSuites: number;
  totalDuration_ms: number;
  suiteResults: TestSuiteResult[];
  readyForStaging: boolean;
}

class TestRunner {
  private results: TestSuiteResult[] = [];
  private startTime: number = 0;

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<OverallResult> {
    console.log('🚀 Starting Comprehensive Test Suite for Unified Spec v1.1');
    console.log('=' .repeat(70));
    
    this.startTime = Date.now();
    
    // Run test suites in order
    await this.runContractTests();
    await this.runSnapshotTests();
    await this.runE2ETests();
    await this.runLoadTests();
    
    const totalDuration = Date.now() - this.startTime;
    
    const overallResult: OverallResult = {
      allPassed: this.results.every(r => r.passed),
      totalSuites: this.results.length,
      passedSuites: this.results.filter(r => r.passed).length,
      totalDuration_ms: totalDuration,
      suiteResults: this.results,
      readyForStaging: this.isReadyForStaging()
    };
    
    this.printOverallResults(overallResult);
    
    return overallResult;
  }

  /**
   * Run contract tests
   */
  private async runContractTests(): Promise<void> {
    console.log('\n📋 Running Contract Tests...');
    const startTime = Date.now();
    
    try {
      const tester = new ContractTester();
      const results = await tester.runAllTests();
      
      const passed = results.every(r => r.passed);
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: 'Contract Tests',
        passed,
        duration_ms: duration,
        details: `${results.filter(r => r.passed).length}/${results.length} tests passed`,
        results
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        suite: 'Contract Tests',
        passed: false,
        duration_ms: duration,
        details: `Failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Run snapshot tests
   */
  private async runSnapshotTests(): Promise<void> {
    console.log('\n📸 Running Snapshot Tests...');
    const startTime = Date.now();
    
    try {
      const tester = new SnapshotTester();
      const results = await tester.runAllTests();
      
      const passed = results.every(r => r.passed);
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: 'Snapshot Tests',
        passed,
        duration_ms: duration,
        details: `${results.filter(r => r.passed).length}/${results.length} tests passed`,
        results
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        suite: 'Snapshot Tests',
        passed: false,
        duration_ms: duration,
        details: `Failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Run E2E tests
   */
  private async runE2ETests(): Promise<void> {
    console.log('\n🔄 Running E2E Tests...');
    const startTime = Date.now();
    
    try {
      const tester = new E2ETester();
      const results = await tester.runAllTests();
      
      const passed = results.every(r => r.success);
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: 'E2E Tests',
        passed,
        duration_ms: duration,
        details: `${results.filter(r => r.success).length}/${results.length} fixtures passed`,
        results
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        suite: 'E2E Tests',
        passed: false,
        duration_ms: duration,
        details: `Failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Run load tests
   */
  private async runLoadTests(): Promise<void> {
    console.log('\n🚀 Running Load Tests...');
    const startTime = Date.now();
    
    try {
      const tester = new LoadTester();
      const result = await tester.runLoadTest();
      
      const passed = result.p95Latency < 10 && 
                   (result.successfulRequests / result.totalRequests * 100) > 95 && 
                   (result.requestsPerSecond / result.targetRPS * 100) > 90;
      
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: 'Load Tests',
        passed,
        duration_ms: duration,
        details: `P95: ${result.p95Latency.toFixed(2)}ms, Success: ${(result.successfulRequests / result.totalRequests * 100).toFixed(1)}%, RPS: ${result.requestsPerSecond.toFixed(1)}`,
        results: [result]
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        suite: 'Load Tests',
        passed: false,
        duration_ms: duration,
        details: `Failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Check if ready for staging
   */
  private isReadyForStaging(): boolean {
    return this.results.every(r => r.passed);
  }

  /**
   * Print overall results
   */
  private printOverallResults(result: OverallResult): void {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 COMPREHENSIVE TEST SUITE RESULTS');
    console.log('='.repeat(70));
    
    console.log(`📊 Summary:`);
    console.log(`  Total Test Suites: ${result.totalSuites}`);
    console.log(`  Passed: ${result.passedSuites} (${(result.passedSuites / result.totalSuites * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${result.totalSuites - result.passedSuites}`);
    console.log(`  Total Duration: ${(result.totalDuration_ms / 1000).toFixed(1)}s`);
    
    console.log(`\n📋 Suite Results:`);
    result.suiteResults.forEach(suite => {
      const icon = suite.passed ? '✅' : '❌';
      const duration = (suite.duration_ms / 1000).toFixed(1);
      console.log(`  ${icon} ${suite.suite}: ${suite.details} (${duration}s)`);
    });
    
    console.log(`\n🎯 Staging Readiness:`);
    console.log(`  Ready for Staging: ${result.readyForStaging ? '✅ YES' : '❌ NO'}`);
    
    if (result.readyForStaging) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('✅ Schema parity verified');
      console.log('✅ Text p95 <10ms confirmed');
      console.log('✅ Fail-closed behavior validated');
      console.log('✅ E2E pipeline functional');
      console.log('✅ Load performance acceptable');
      console.log('\n🚀 READY FOR STAGING DEPLOYMENT');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED');
      console.log('Review failed test suites above before proceeding to staging');
    }
    
    console.log('\n📝 Next Steps:');
    if (result.readyForStaging) {
      console.log('1. Deploy to staging with TEXT_V11=true flag');
      console.log('2. Enable dashboards and monitoring');
      console.log('3. Run internal dogfooding tests');
      console.log('4. Collect feedback and iterate');
      console.log('5. Promote to production after validation');
    } else {
      console.log('1. Fix failing test suites');
      console.log('2. Re-run comprehensive test suite');
      console.log('3. Repeat until all tests pass');
    }
  }
}

// Run all tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().then(result => {
    process.exit(result.readyForStaging ? 0 : 1);
  });
}

export { TestRunner };
