// teacher.ts - ML Teacher that predicts 6-D vector from chart features

import { ChartContext, Vector6, FeatureVector } from './contracts';
import { ScalerLoader } from './scaler';
import { FeatureEncoder } from './feature-encoder';
import { Telemetry } from './telemetry';

export class Teacher {
  private scaler: ScalerLoader;
  private encoder: FeatureEncoder;
  private telemetry: Telemetry;

  constructor() {
    this.scaler = new ScalerLoader();
    this.encoder = new FeatureEncoder();
    this.telemetry = new Telemetry();
  }

  async initialize(): Promise<void> {
    await this.scaler.load();
  }

  async predictVector(chart: ChartContext, chartIndex: number): Promise<{raw: number[]; clamped: Vector6}> {
    try {
      // Encode chart to features
      const features = this.encoder.encode(chart);
      
      // Log feature diversity
      this.telemetry.logFeatureDiversity(features, chartIndex);
      
      // Standardize inputs
      const standardizedFeatures = this.scaler.standardizeX(features);
      
      // Run ML model (integrate with existing ML manager)
      const rawVector = await this.runMLModel(standardizedFeatures);
      
      // Log model output diversity
      this.telemetry.logModelOutputDiversity(rawVector, chartIndex);
      
      // Destandardize outputs
      const destandardized = this.scaler.destandardizeY(rawVector);
      
      // Clamp to [0,1]
      const clamped: Vector6 = destandardized.map(val => Math.max(0, Math.min(1, val))) as Vector6;
      
      return { raw: destandardized, clamped };
      
    } catch (error) {
      throw new Error(`ML prediction failed: ${error.message}`);
    }
  }

  private async runMLModel(features: number[]): Promise<number[]> {
    // Integrate with existing ML manager
    if (typeof window !== 'undefined' && window.mlManager) {
      try {
        const result = await window.mlManager.generate(features, { mode: 'vector_prediction' });
        if (!result || !result.vector || result.vector.length < 6) {
          throw new Error('ML returned invalid vector');
        }
        
        // Validate vector is finite
        const nonFinite = result.vector.filter(v => !Number.isFinite(v));
        if (nonFinite.length > 0) {
          throw new Error(`ML returned non-finite values: ${nonFinite.length}`);
        }
        
        return result.vector;
      } catch (error) {
        throw new Error(`ML model error: ${error.message}`);
      }
    } else {
      throw new Error('ML models not available');
    }
  }
}
