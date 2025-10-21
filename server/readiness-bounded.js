// Bounded Readiness Endpoint
// Only checks what's required to take traffic - fast, deterministic, bounded

const express = require('express');

class BoundedReadinessChecker {
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Fast readiness check - only what's required to take traffic
   */
  async checkReadiness() {
    const startTime = Date.now();
    const checks = {};
    let allReady = true;

    // 1. vNext handler mount (critical - must be fast)
    try {
      const composeMod = require('../lib/opt/optional').optionalRequire(
        require('path').join(__dirname, '..', 'dist', 'vnext', 'api', 'compose')
      );
      checks.vnext_handler = {
        status: composeMod?.vnextCompose ? 'ready' : 'not_ready',
        duration: Date.now() - startTime
      };
      if (!composeMod?.vnextCompose) allReady = false;
    } catch (error) {
      checks.vnext_handler = {
        status: 'error',
        error: error.message,
        duration: Date.now() - startTime
      };
      allReady = false;
    }

    // 2. Model artifacts presence (critical - must be fast)
    try {
      const fs = require('fs');
      const path = require('path');
      const modelsDir = path.join(__dirname, '..', 'models');
      const hasModels = fs.existsSync(modelsDir) && fs.readdirSync(modelsDir).length > 0;
      checks.model_artifacts = {
        status: hasModels ? 'ready' : 'not_ready',
        duration: Date.now() - startTime
      };
      if (!hasModels) allReady = false;
    } catch (error) {
      checks.model_artifacts = {
        status: 'error',
        error: error.message,
        duration: Date.now() - startTime
      };
      allReady = false;
    }

    // 3. Storage writeability (critical - must be fast)
    try {
      const fs = require('fs');
      const path = require('path');
      const exportsDir = path.join(__dirname, '..', 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }
      const testFile = path.join(exportsDir, '.readiness-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      checks.storage_write = {
        status: 'ready',
        duration: Date.now() - startTime
      };
    } catch (error) {
      checks.storage_write = {
        status: 'error',
        error: error.message,
        duration: Date.now() - startTime
      };
      allReady = false;
    }

    // 4. Memory check (non-critical but fast)
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      checks.memory = {
        status: heapUsedMB < 1000 ? 'ready' : 'warning',
        heapUsed: `${heapUsedMB}MB`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      checks.memory = {
        status: 'error',
        error: error.message,
        duration: Date.now() - startTime
      };
    }

    const totalDuration = Date.now() - startTime;

    return {
      ready: allReady,
      status: allReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      duration: totalDuration,
      checks
    };
  }
}

module.exports = { BoundedReadinessChecker };
