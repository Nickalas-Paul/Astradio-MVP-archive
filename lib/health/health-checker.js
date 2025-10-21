// Comprehensive health check system with liveness and readiness probes

const redis = require('../redis');
const database = require('../database');

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.startTime = Date.now();
  }

  /**
   * Add a health check
   */
  addCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeout || 5000,
      critical: options.critical !== false, // Default to critical
      ...options
    });
  }

  /**
   * Run all health checks
   */
  async runChecks() {
    const results = {};
    const startTime = Date.now();

    for (const [name, check] of this.checks) {
      try {
        const checkStart = Date.now();
        
        // Run check with timeout
        const result = await Promise.race([
          check.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Check timeout')), check.timeout)
          )
        ]);

        results[name] = {
          status: 'healthy',
          duration: Date.now() - checkStart,
          result: result || 'OK'
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          duration: Date.now() - checkStart,
          error: error.message
        };
      }
    }

    const overallStatus = this.calculateOverallStatus(results);
    const totalDuration = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      duration: totalDuration,
      checks: results
    };
  }

  /**
   * Calculate overall health status
   */
  calculateOverallStatus(results) {
    const criticalChecks = Array.from(this.checks.entries())
      .filter(([, check]) => check.critical)
      .map(([name]) => name);

    const hasUnhealthyCritical = criticalChecks.some(name => 
      results[name]?.status === 'unhealthy'
    );

    if (hasUnhealthyCritical) {
      return 'unhealthy';
    }

    const hasUnhealthy = Object.values(results).some(check => 
      check.status === 'unhealthy'
    );

    return hasUnhealthy ? 'degraded' : 'healthy';
  }

  /**
   * Liveness probe - basic server health
   */
  async liveness() {
    return {
      status: 'alive',
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Readiness probe - all critical dependencies
   */
  async readiness() {
    const health = await this.runChecks();
    
    return {
      status: health.status,
      ready: health.status === 'healthy',
      timestamp: health.timestamp,
      checks: Object.fromEntries(
        Object.entries(health.checks).map(([name, check]) => [
          name,
          {
            status: check.status,
            duration: check.duration
          }
        ])
      )
    };
  }
}

// Initialize health checker with default checks
const healthChecker = new HealthChecker();

// Database health check
healthChecker.addCheck('database', async () => {
  try {
    const result = await database.query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}, { critical: true });

// Redis health check
healthChecker.addCheck('redis', async () => {
  try {
    const client = await redis.getClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    throw new Error(`Redis connection failed: ${error.message}`);
  }
}, { critical: true });

// Memory usage check
healthChecker.addCheck('memory', async () => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  
  if (heapUsedMB > 1000) { // 1GB threshold
    throw new Error(`High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`);
  }
  
  return {
    heapUsed: `${heapUsedMB}MB`,
    heapTotal: `${heapTotalMB}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  };
}, { critical: false });

// Disk space check
healthChecker.addCheck('disk', async () => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const stats = await fs.stat(process.cwd());
    // This is a simplified check - in production you'd use a proper disk space library
    return { available: 'OK' };
  } catch (error) {
    throw new Error(`Disk access failed: ${error.message}`);
  }
}, { critical: false });

module.exports = { HealthChecker, healthChecker };
