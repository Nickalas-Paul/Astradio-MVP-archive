#!/usr/bin/env node

/**
 * 24-Hour Staging Soak Runner
 * 
 * Validates staging environment health and compose API performance
 * with deterministic golden chart set testing.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  baseUrl: process.env.STAGING_BASE_URL || 'https://staging.astradio.io',
  authHeader: process.env.STAGING_AUTH_HEADER || '',
  timeout: 10000, // 10 seconds
  maxRetries: 2,
  rateLimit: 1000, // 1 RPS max
  outputDir: 'artifacts/soak',
  thresholds: {
    errorRate: 0.01, // 1%
    fallbackRate: 0.02, // 2%
    composeLatencyP95: 1800, // ms
    audioStartupP95: 2500 // ms
  }
};

// Golden charts dataset
const GOLDEN_CHARTS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../artifacts/soak/golden-charts.json'), 'utf8')
);

class SoakRunner {
  constructor() {
    this.results = [];
    this.determinismResults = [];
    this.startTime = Date.now();
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    const dirs = [CONFIG.outputDir, path.join(CONFIG.outputDir, 'hars')];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'SoakRunner/1.0'
      };

      if (CONFIG.authHeader) {
        headers['Authorization'] = CONFIG.authHeader;
      }

      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async withRetry(fn, maxRetries = CONFIG.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async checkHealth() {
    console.log('🔍 Checking health endpoints...');
    
    const healthChecks = [
      { name: 'health', url: `${CONFIG.baseUrl}/health` },
      { name: 'readyz', url: `${CONFIG.baseUrl}/readyz` }
    ];

    const results = {};
    
    for (const check of healthChecks) {
      try {
        const response = await this.withRetry(() => this.makeRequest(check.url));
        const data = await response.json();
        
        results[check.name] = {
          status: response.status,
          ok: response.ok,
          data: data,
          success: response.ok && data.status === 'ok' || data.ready === true
        };
        
        console.log(`✅ ${check.name}: ${response.status} ${data.status || data.ready}`);
      } catch (error) {
        results[check.name] = {
          status: 0,
          ok: false,
          error: error.message,
          success: false
        };
        
        console.log(`❌ ${check.name}: ${error.message}`);
      }
    }

    // Fail if any health check fails
    const allHealthy = Object.values(results).every(r => r.success);
    if (!allHealthy) {
      throw new Error('Health checks failed - staging not ready');
    }

    return results;
  }

  async testChart(chart, isDeterminismTest = false) {
    const startTime = Date.now();
    let result = {
      timestamp: new Date().toISOString(),
      chart_id: chart.id,
      chart_name: chart.name,
      success: false,
      isDeterminismTest
    };

    try {
      const response = await this.withRetry(() => 
        this.makeRequest(`${CONFIG.baseUrl}/api/compose`, {
          method: 'POST',
          body: JSON.stringify({
            date: chart.date,
            time: chart.time,
            location: chart.location,
            geo: chart.geo
          })
        })
      );

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Validate response structure
      const hasSpec = data.explanation?.spec === 'UnifiedSpecV1.1';
      const hasControlHash = data.hashes?.control && data.hashes.control.startsWith('sha256:');
      const hasAudioUrl = data.audio?.url && data.audio.url.length > 0;
      const hasRendererHash = data.hashes?.renderer && data.hashes.renderer.startsWith('sha256:');

      result = {
        ...result,
        success: response.ok && hasSpec && hasControlHash && hasAudioUrl && hasRendererHash,
        status: response.status,
        spec: data.explanation?.spec,
        controlHash: data.hashes?.control,
        rendererHash: data.hashes?.renderer,
        audioUrl: data.audio?.url,
        audioUrlPresent: !!data.audio?.url,
        latency: latency,
        composeLatencyMs: data.telemetry?.compose_latency_ms || null,
        audioStartupMs: data.telemetry?.audio_startup_ms || null,
        fallbackUsed: data.telemetry?.fallback_used || false,
        responseSize: JSON.stringify(data).length
      };

      if (!result.success) {
        result.errorCode = !response.ok ? `HTTP_${response.status}` : 
                          !hasSpec ? 'SPEC_MISMATCH' :
                          !hasControlHash ? 'MISSING_CONTROL_HASH' :
                          !hasAudioUrl ? 'MISSING_AUDIO_URL' :
                          'MISSING_RENDERER_HASH';
      }

      // Save HAR on failure
      if (!result.success) {
        await this.saveHar(chart, result, data);
      }

    } catch (error) {
      result = {
        ...result,
        success: false,
        error: error.message,
        errorCode: error.name === 'AbortError' ? 'TIMEOUT' : 'REQUEST_FAILED',
        latency: Date.now() - startTime
      };

      await this.saveHar(chart, result, null);
    }

    return result;
  }

  async saveHar(chart, result, responseData) {
    const harData = {
      timestamp: result.timestamp,
      chart: chart,
      request: {
        url: `${CONFIG.baseUrl}/api/compose`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SoakRunner/1.0'
        },
        body: JSON.stringify({
          date: chart.date,
          time: chart.time,
          location: chart.location,
          geo: chart.geo
        })
      },
      response: responseData ? {
        status: result.status,
        data: responseData
      } : null,
      error: result.error || null,
      latency: result.latency
    };

    const filename = `failure-${chart.id}-${Date.now()}.json`;
    const filepath = path.join(CONFIG.outputDir, 'hars', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(harData, null, 2));
    console.log(`💾 Saved failure HAR: ${filename}`);
  }

  async testDeterminism() {
    console.log('🎯 Testing determinism...');
    
    // Pick first chart for determinism test
    const testChart = GOLDEN_CHARTS[0];
    
    try {
      const result1 = await this.testChart(testChart, true);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      const result2 = await this.testChart(testChart, true);
      
      const deterministic = result1.success && result2.success &&
                           result1.controlHash === result2.controlHash &&
                           result1.rendererHash === result2.rendererHash &&
                           result1.audioUrl === result2.audioUrl;
      
      const determinismResult = {
        timestamp: new Date().toISOString(),
        chart_id: testChart.id,
        deterministic,
        result1,
        result2,
        hashMatch: result1.controlHash === result2.controlHash,
        audioMatch: result1.audioUrl === result2.audioUrl
      };
      
      this.determinismResults.push(determinismResult);
      
      console.log(`🎯 Determinism: ${deterministic ? 'PASS' : 'FAIL'}`);
      if (!deterministic) {
        console.log(`   Hash match: ${determinismResult.hashMatch}`);
        console.log(`   Audio match: ${determinismResult.audioMatch}`);
      }
      
      return deterministic;
    } catch (error) {
      console.log(`❌ Determinism test failed: ${error.message}`);
      return false;
    }
  }

  async runSoak() {
    console.log('🚀 Starting 24-hour staging soak...');
    console.log(`📍 Target: ${CONFIG.baseUrl}`);
    console.log(`📊 Golden charts: ${GOLDEN_CHARTS.length}`);
    
    try {
      // 1. Health checks
      await this.checkHealth();
      
      // 2. Test all golden charts
      console.log('\n📈 Testing golden charts...');
      for (let i = 0; i < GOLDEN_CHARTS.length; i++) {
        const chart = GOLDEN_CHARTS[i];
        console.log(`Testing ${i + 1}/${GOLDEN_CHARTS.length}: ${chart.name}`);
        
        const result = await this.testChart(chart);
        this.results.push(result);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimit));
      }
      
      // 3. Determinism test
      const deterministic = await this.testDeterminism();
      
      // 4. Validate thresholds
      const validation = this.validateThresholds();
      
      // 5. Save evidence
      await this.saveEvidence();
      
      // 6. Generate summary
      const summary = this.generateSummary(validation, deterministic);
      
      console.log('\n📊 Soak Summary:');
      console.log(summary);
      
      // Exit with error code if thresholds breached
      if (!validation.passed) {
        console.log('\n❌ Thresholds breached - failing job');
        process.exit(1);
      }
      
      if (!deterministic) {
        console.log('\n❌ Determinism failed - failing job');
        process.exit(1);
      }
      
      console.log('\n✅ Soak completed successfully');
      
    } catch (error) {
      console.error(`\n💥 Soak failed: ${error.message}`);
      await this.saveEvidence();
      process.exit(1);
    }
  }

  validateThresholds() {
    const results = this.results.filter(r => !r.isDeterminismTest);
    
    if (results.length === 0) {
      return { passed: false, reason: 'No results to validate' };
    }
    
    const errors = results.filter(r => !r.success);
    const errorRate = errors.length / results.length;
    
    const fallbacks = results.filter(r => r.fallbackUsed);
    const fallbackRate = fallbacks.length / results.length;
    
    const composeLatencies = results
      .map(r => r.composeLatencyMs)
      .filter(l => l !== null && l !== undefined)
      .sort((a, b) => a - b);
    
    const audioLatencies = results
      .map(r => r.audioStartupMs)
      .filter(l => l !== null && l !== undefined)
      .sort((a, b) => a - b);
    
    const composeP95 = composeLatencies.length > 0 ? 
      composeLatencies[Math.ceil(composeLatencies.length * 0.95) - 1] : 0;
    
    const audioP95 = audioLatencies.length > 0 ?
      audioLatencies[Math.ceil(audioLatencies.length * 0.95) - 1] : 0;
    
    const validation = {
      passed: true,
      errorRate,
      fallbackRate,
      composeP95,
      audioP95,
      thresholds: CONFIG.thresholds,
      breaches: []
    };
    
    if (errorRate > CONFIG.thresholds.errorRate) {
      validation.passed = false;
      validation.breaches.push(`Error rate ${(errorRate * 100).toFixed(2)}% > ${(CONFIG.thresholds.errorRate * 100)}%`);
    }
    
    if (fallbackRate > CONFIG.thresholds.fallbackRate) {
      validation.passed = false;
      validation.breaches.push(`Fallback rate ${(fallbackRate * 100).toFixed(2)}% > ${(CONFIG.thresholds.fallbackRate * 100)}%`);
    }
    
    if (composeP95 > CONFIG.thresholds.composeLatencyP95) {
      validation.passed = false;
      validation.breaches.push(`Compose P95 ${composeP95}ms > ${CONFIG.thresholds.composeLatencyP95}ms`);
    }
    
    if (audioP95 > CONFIG.thresholds.audioStartupP95) {
      validation.passed = false;
      validation.breaches.push(`Audio P95 ${audioP95}ms > ${CONFIG.thresholds.audioStartupP95}ms`);
    }
    
    return validation;
  }

  async saveEvidence() {
    // Save JSONL evidence
    const jsonlPath = path.join(CONFIG.outputDir, 'soak-evidence.jsonl');
    
    for (const result of this.results) {
      const line = `${result.timestamp} ${JSON.stringify(result)}\n`;
      fs.appendFileSync(jsonlPath, line);
    }
    
    // Save determinism results
    for (const result of this.determinismResults) {
      const line = `${result.timestamp} ${JSON.stringify(result)}\n`;
      fs.appendFileSync(jsonlPath, line);
    }
    
    console.log(`💾 Saved evidence to ${jsonlPath}`);
  }

  generateSummary(validation, deterministic) {
    const results = this.results.filter(r => !r.isDeterminismTest);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;
    
    return `
Total Tests: ${results.length}
Success: ${successCount}
Errors: ${errorCount}
Error Rate: ${(validation.errorRate * 100).toFixed(2)}%
Fallback Rate: ${(validation.fallbackRate * 100).toFixed(2)}%
Compose P95: ${validation.composeP95}ms
Audio P95: ${validation.audioP95}ms
Deterministic: ${deterministic ? 'PASS' : 'FAIL'}
Thresholds: ${validation.passed ? 'PASS' : 'FAIL'}
${validation.breaches.length > 0 ? `Breaches: ${validation.breaches.join(', ')}` : ''}`.trim();
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new SoakRunner();
  runner.runSoak().catch(error => {
    console.error('Soak runner failed:', error);
    process.exit(1);
  });
}

module.exports = SoakRunner;

