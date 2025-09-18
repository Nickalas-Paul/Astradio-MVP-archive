// vnext/ml/model-loader.ts
// A/B model loader with environment flag support and canary routing

import path from 'path';
import fs from 'fs';
import { StudentV2Adapter } from './model-adapter';

export type ModelVersion = 'v1' | 'v2';

export interface ModelConfig {
  version: ModelVersion;
  path: string;
  metadata: any;
  adapter?: StudentV2Adapter;
}

export interface CanaryConfig {
  enabled: boolean;
  percent: number;
  buckets: string[]; // sun-sign buckets for canary routing
  rollbackThresholds: {
    passRateDrop: number;    // e.g., 0.05 (5pp drop)
    qualityDrop: number;     // e.g., 0.03 (0.03 quality drop)
    errorRateIncrease: number; // e.g., 0.02 (2pp error increase)
    latencyIncrease: number;   // e.g., 100 (100ms increase)
  };
}

export class ModelLoader {
  private v1Config: ModelConfig;
  private v2Config: ModelConfig | null = null;
  private canaryConfig: CanaryConfig;
  private telemetry: any[] = [];
  
  constructor() {
    this.canaryConfig = this.loadCanaryConfig();
    this.v1Config = this.loadV1Config();
    this.loadV2IfAvailable();
  }
  
  private loadCanaryConfig(): CanaryConfig {
    const defaultConfig: CanaryConfig = {
      enabled: process.env.STUDENT_V2_CANARY === 'true',
      percent: Number(process.env.CANARY_PERCENT || 10),
      buckets: ['aries', 'taurus', 'gemini'], // Start with fire/earth signs
      rollbackThresholds: {
        passRateDrop: 0.05,
        qualityDrop: 0.03,
        errorRateIncrease: 0.02,
        latencyIncrease: 100
      }
    };
    
    console.log(`[ModelLoader] Canary config: ${defaultConfig.enabled ? 'enabled' : 'disabled'}, ${defaultConfig.percent}%`);
    return defaultConfig;
  }
  
  private loadV1Config(): ModelConfig {
    const modelPath = path.resolve(process.cwd(), 'models', 'student-v1');
    const metadataPath = path.join(modelPath, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Student-v1 metadata not found at ${metadataPath}`);
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    return {
      version: 'v1',
      path: modelPath,
      metadata
    };
  }
  
  private loadV2IfAvailable(): void {
    const modelPath = path.resolve(process.cwd(), 'models', 'student-v2');
    const metadataPath = path.join(modelPath, 'metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      // Load calibration and create adapter
      let adapter: StudentV2Adapter | undefined;
      if (metadata.calibration) {
        adapter = StudentV2Adapter.fromMetadata(metadata);
        console.log('[ModelLoader] Student-v2 adapter loaded with calibration');
      } else {
        console.warn('[ModelLoader] Student-v2 found but no calibration - using default adapter');
        adapter = new StudentV2Adapter();
      }
      
      this.v2Config = {
        version: 'v2',
        path: modelPath,
        metadata,
        adapter
      };
      
      console.log('[ModelLoader] Student-v2 model available for A/B testing');
    } else {
      console.log('[ModelLoader] Student-v2 not found - A/B testing disabled');
    }
  }
  
  /**
   * Select model version based on environment flags and canary routing
   */
  selectModel(chartContext?: any): ModelVersion {
    // Force model version via environment variable
    const forceModel = process.env.STUDENT_MODEL as ModelVersion;
    if (forceModel && (forceModel === 'v1' || forceModel === 'v2')) {
      console.log(`[ModelLoader] Forced model selection: ${forceModel}`);
      return forceModel;
    }
    
    // Force model version via header (for manual testing)
    const headerModel = process.env.STUDENT_MODEL_HEADER as ModelVersion;
    if (headerModel && (headerModel === 'v1' || headerModel === 'v2')) {
      console.log(`[ModelLoader] Header model selection: ${headerModel}`);
      return headerModel;
    }
    
    // Canary routing
    if (this.canaryConfig.enabled && this.v2Config) {
      const shouldUseV2 = this.shouldUseCanary(chartContext);
      if (shouldUseV2) {
        console.log('[ModelLoader] Canary routing: using Student-v2');
        return 'v2';
      }
    }
    
    // Default to v1
    console.log('[ModelLoader] Default routing: using Student-v1');
    return 'v1';
  }
  
  private shouldUseCanary(chartContext?: any): boolean {
    if (!this.canaryConfig.enabled || !this.v2Config) {
      return false;
    }
    
    // Simple hash-based routing for canary percentage
    const userId = chartContext?.userId || 'default';
    const hash = this.hashString(userId);
    const bucket = hash % 100;
    
    if (bucket >= this.canaryConfig.percent) {
      return false;
    }
    
    // Additional sun-sign bucket filtering
    if (chartContext?.sunSign) {
      const sunSign = chartContext.sunSign.toLowerCase();
      if (!this.canaryConfig.buckets.includes(sunSign)) {
        return false;
      }
    }
    
    return true;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Get model configuration for selected version
   */
  getModelConfig(version: ModelVersion): ModelConfig {
    if (version === 'v2' && this.v2Config) {
      return this.v2Config;
    }
    return this.v1Config;
  }
  
  /**
   * Log telemetry for A/B testing monitoring
   */
  logTelemetry(data: {
    modelVersion: ModelVersion;
    chartContext?: any;
    controlVector: number[];
    qualityScore?: number;
    passRate?: boolean;
    latency?: number;
    error?: string;
  }): void {
    const telemetryEntry = {
      timestamp: new Date().toISOString(),
      source: `model-${data.modelVersion}`,
      ...data
    };
    
    this.telemetry.push(telemetryEntry);
    
    // Log to console for monitoring
    console.log(`[Telemetry] ${data.modelVersion}: quality=${data.qualityScore?.toFixed(3)}, pass=${data.passRate}, latency=${data.latency}ms`);
    
    // Check rollback thresholds
    this.checkRollbackThresholds(data.modelVersion);
  }
  
  private checkRollbackThresholds(version: ModelVersion): void {
    if (version !== 'v2' || !this.canaryConfig.enabled) {
      return;
    }
    
    // Analyze recent telemetry for v2
    const recentV2 = this.telemetry
      .filter(entry => entry.source === 'model-v2')
      .slice(-100); // Last 100 entries
    
    if (recentV2.length < 20) {
      return; // Need more data
    }
    
    // Calculate metrics
    const passRate = recentV2.filter(entry => entry.passRate).length / recentV2.length;
    const avgQuality = recentV2.reduce((sum, entry) => sum + (entry.qualityScore || 0), 0) / recentV2.length;
    const avgLatency = recentV2.reduce((sum, entry) => sum + (entry.latency || 0), 0) / recentV2.length;
    const errorRate = recentV2.filter(entry => entry.error).length / recentV2.length;
    
    // Compare with baseline (v1) metrics
    const recentV1 = this.telemetry
      .filter(entry => entry.source === 'model-v1')
      .slice(-100);
    
    if (recentV1.length < 20) {
      return; // Need v1 baseline
    }
    
    const v1PassRate = recentV1.filter(entry => entry.passRate).length / recentV1.length;
    const v1AvgQuality = recentV1.reduce((sum, entry) => sum + (entry.qualityScore || 0), 0) / recentV1.length;
    const v1AvgLatency = recentV1.reduce((sum, entry) => sum + (entry.latency || 0), 0) / recentV1.length;
    const v1ErrorRate = recentV1.filter(entry => entry.error).length / recentV1.length;
    
    // Check rollback conditions
    const passRateDrop = v1PassRate - passRate;
    const qualityDrop = v1AvgQuality - avgQuality;
    const errorRateIncrease = errorRate - v1ErrorRate;
    const latencyIncrease = avgLatency - v1AvgLatency;
    
    const shouldRollback = 
      passRateDrop > this.canaryConfig.rollbackThresholds.passRateDrop ||
      qualityDrop > this.canaryConfig.rollbackThresholds.qualityDrop ||
      errorRateIncrease > this.canaryConfig.rollbackThresholds.errorRateIncrease ||
      latencyIncrease > this.canaryConfig.rollbackThresholds.latencyIncrease;
    
    if (shouldRollback) {
      console.error('[ModelLoader] 🚨 CANARY ROLLBACK TRIGGERED:');
      console.error(`  Pass Rate Drop: ${(passRateDrop*100).toFixed(1)}pp (threshold: ${(this.canaryConfig.rollbackThresholds.passRateDrop*100).toFixed(1)}pp)`);
      console.error(`  Quality Drop: ${qualityDrop.toFixed(3)} (threshold: ${this.canaryConfig.rollbackThresholds.qualityDrop})`);
      console.error(`  Error Rate Increase: ${(errorRateIncrease*100).toFixed(1)}pp (threshold: ${(this.canaryConfig.rollbackThresholds.errorRateIncrease*100).toFixed(1)}pp)`);
      console.error(`  Latency Increase: ${latencyIncrease.toFixed(0)}ms (threshold: ${this.canaryConfig.rollbackThresholds.latencyIncrease}ms)`);
      
      // Disable canary
      this.canaryConfig.enabled = false;
      console.error('[ModelLoader] Canary disabled - reverting to Student-v1');
    }
  }
  
  /**
   * Get current canary status
   */
  getCanaryStatus(): { enabled: boolean; percent: number; buckets: string[] } {
    return {
      enabled: this.canaryConfig.enabled,
      percent: this.canaryConfig.percent,
      buckets: this.canaryConfig.buckets
    };
  }
  
  /**
   * Get telemetry summary
   */
  getTelemetrySummary(): any {
    const v1Entries = this.telemetry.filter(entry => entry.source === 'model-v1');
    const v2Entries = this.telemetry.filter(entry => entry.source === 'model-v2');
    
    return {
      total: this.telemetry.length,
      v1: {
        count: v1Entries.length,
        passRate: v1Entries.filter(e => e.passRate).length / Math.max(v1Entries.length, 1),
        avgQuality: v1Entries.reduce((sum, e) => sum + (e.qualityScore || 0), 0) / Math.max(v1Entries.length, 1),
        avgLatency: v1Entries.reduce((sum, e) => sum + (e.latency || 0), 0) / Math.max(v1Entries.length, 1)
      },
      v2: {
        count: v2Entries.length,
        passRate: v2Entries.filter(e => e.passRate).length / Math.max(v2Entries.length, 1),
        avgQuality: v2Entries.reduce((sum, e) => sum + (e.qualityScore || 0), 0) / Math.max(v2Entries.length, 1),
        avgLatency: v2Entries.reduce((sum, e) => sum + (e.latency || 0), 0) / Math.max(v2Entries.length, 1)
      }
    };
  }
}

// Global instance
export const modelLoader = new ModelLoader();
