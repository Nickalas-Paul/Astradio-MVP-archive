// vnext/logger.ts
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'vnext-audit.jsonl');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 3;

// Ensure log directory exists on startup
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// Log rollover functionality
function rolloverLogIfNeeded() {
  if (!fs.existsSync(LOG_FILE)) return;
  
  const stats = fs.statSync(LOG_FILE);
  if (stats.size < MAX_LOG_SIZE) return;
  
  // Rotate existing logs
  for (let i = MAX_LOG_FILES - 1; i > 0; i--) {
    const oldFile = `${LOG_FILE}.${i}`;
    const newFile = `${LOG_FILE}.${i + 1}`;
    if (fs.existsSync(oldFile)) {
      if (i === MAX_LOG_FILES - 1) {
        fs.unlinkSync(oldFile); // Delete oldest
      } else {
        fs.renameSync(oldFile, newFile);
      }
    }
  }
  
  // Move current log to .1
  fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
}

// Initialize log directory
ensureLogDir();

export function logAudit(entry: any) {
  const timestamp = new Date().toISOString();
  const logLine = JSON.stringify({ ts: timestamp, ...entry }) + '\n';
  
  try {
    rolloverLogIfNeeded();
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (error) {
    console.warn('Failed to write audit log:', error);
  }
}

// Enhanced telemetry system (preserved from audition/)
export class Telemetry {
  private featureStats: { min: number[]; max: number[]; sum: number[]; count: number } | null = null;
  private modelOutputStats: { min: number[]; max: number[]; sum: number[]; count: number } | null = null;

  logFeatureDiversity(features: number[], chartIndex: number): void {
    if (!this.featureStats) {
      this.featureStats = { min: [...features], max: [...features], sum: [...features], count: 1 };
    } else {
      features.forEach((val, i) => {
        this.featureStats!.min[i] = Math.min(this.featureStats!.min[i], val);
        this.featureStats!.max[i] = Math.max(this.featureStats!.max[i], val);
        this.featureStats!.sum[i] += val;
      });
      this.featureStats.count++;
    }

    // Log summary every 10 charts
    if (chartIndex % 10 === 0 && this.featureStats) {
      const mean = this.featureStats.sum.map(s => s / this.featureStats!.count);
      const variance = features.map((val, i) => {
        const meanVal = mean[i];
        return Math.pow(val - meanVal, 2);
      });
      
      const highVarianceFeatures = variance.filter(v => v > 0.01).length;
      const totalFeatures = features.length;
      
      console.log(`[vNext] Feature diversity: ${highVarianceFeatures}/${totalFeatures} features with variance > 0.01 (${(highVarianceFeatures/totalFeatures*100).toFixed(1)}%)`);
      
      if (highVarianceFeatures < totalFeatures * 0.7) {
        console.warn(`[vNext] LOW FEATURE DIVERSITY: Only ${highVarianceFeatures}/${totalFeatures} features vary significantly`);
      }
    }
  }

  logModelOutputDiversity(rawVector: number[], chartIndex: number): void {
    if (!this.modelOutputStats) {
      this.modelOutputStats = { min: [...rawVector], max: [...rawVector], sum: [...rawVector], count: 1 };
    } else {
      rawVector.forEach((val, i) => {
        this.modelOutputStats!.min[i] = Math.min(this.modelOutputStats!.min[i], val);
        this.modelOutputStats!.max[i] = Math.max(this.modelOutputStats!.max[i], val);
        this.modelOutputStats!.sum[i] += val;
      });
      this.modelOutputStats.count++;
    }

    // Log summary every 10 charts
    if (chartIndex % 10 === 0 && this.modelOutputStats) {
      const mean = this.modelOutputStats.sum.map(s => s / this.modelOutputStats!.count);
      const variance = rawVector.map((val, i) => {
        const meanVal = mean[i];
        return Math.pow(val - meanVal, 2);
      });
      
      const highVarianceDims = variance.filter(v => v > 0.05).length;
      const totalDims = rawVector.length;
      
      console.log(`[vNext] Model output diversity: ${highVarianceDims}/${totalDims} dimensions with variance > 0.05 (${(highVarianceDims/totalDims*100).toFixed(1)}%)`);
      
      if (highVarianceDims < 4) {
        console.warn(`[vNext] LOW MODEL DIVERSITY: Only ${highVarianceDims}/${totalDims} dimensions vary significantly`);
      }
    }
  }

  logQualityResults(results: Array<{ passed: boolean; score: number }>): void {
    const passedCount = results.filter(r => r.passed).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    
    console.log(`[vNext] Quality results: ${passedCount}/${results.length} passed, avg score: ${avgScore.toFixed(2)}`);
  }

  calculateVariance(rawVectors: number[][]): Record<string, number> {
    if (rawVectors.length === 0) return {};

    const dims = ['tempo', 'brightness', 'density', 'arc', 'motif', 'cadence'];
    const variance: Record<string, number> = {};

    dims.forEach((dim, i) => {
      const values = rawVectors.map(v => v[i] || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const varianceVal = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      variance[dim] = varianceVal;
    });

    return variance;
  }
}

// Global telemetry instance
export const telemetry = new Telemetry();