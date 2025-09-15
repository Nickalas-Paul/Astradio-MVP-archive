// scaler.ts - Load and validate real training scaler statistics

import { TeacherScaler, FeatureVector } from './contracts';

export const FEATURE_LEN = 46; // Must match FeatureEncoder output length

export class ScalerLoader {
  private scaler: TeacherScaler | null = null;

  async load(): Promise<TeacherScaler> {
    try {
      // Try window.ModelArtifacts first (preferred)
      if (window.ModelArtifacts?.teacherScaler) {
        this.scaler = window.ModelArtifacts.teacherScaler;
        console.log('[Teacher] Loaded real scaler from window.ModelArtifacts');
      } else {
        throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
      }
      
      this.validate();
      return this.scaler;
      
    } catch (error) {
      console.error('[Teacher] Failed to load real training scaler:', error.message);
      throw error;
    }
  }

  private validate(): void {
    if (!this.scaler) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    const { x_mean, x_std, y_mean, y_std, version } = this.scaler;

    // Check all arrays present and finite
    if (!Array.isArray(x_mean) || !Array.isArray(x_std) || !Array.isArray(y_mean) || !Array.isArray(y_std)) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    // Check lengths match expected dimensions
    if (x_mean.length !== FEATURE_LEN || x_std.length !== FEATURE_LEN) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    if (y_mean.length !== 6 || y_std.length !== 6) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    // Check for finite values
    const allFinite = [...x_mean, ...x_std, ...y_mean, ...y_std].every(v => Number.isFinite(v));
    if (!allFinite) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    // Check for constant placeholder patterns (0.5/0.2 pattern)
    const xMeanConstant = x_mean.every(v => Math.abs(v - 0.5) < 0.001);
    const xStdConstant = x_std.every(v => Math.abs(v - 0.2) < 0.001);
    const yMeanConstant = y_mean.every(v => Math.abs(v - 0.5) < 0.001);
    const yStdConstant = y_std.every(v => Math.abs(v - 0.2) < 0.001);
    
    if (xMeanConstant || xStdConstant || yMeanConstant || yStdConstant) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    // Check for sufficient variance
    const xStdVariance = x_std.filter(s => s > 1e-6).length;
    const yStdVariance = y_std.filter(s => s > 1e-6).length;
    
    if (xStdVariance < x_std.length * 0.8 || yStdVariance < 4) {
      throw new Error('REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.');
    }

    console.log(`[Teacher] Scaler verified: x_mean[0..2]=[${x_mean.slice(0,3).map(v => v.toFixed(3)).join(',')}], x_std[0..2]=[${x_std.slice(0,3).map(v => v.toFixed(3)).join(',')}], version=${version}`);
  }

  standardizeX(features: FeatureVector): number[] {
    if (!this.scaler) throw new Error('Scaler not loaded');
    
    return features.map((val, i) => (val - this.scaler!.x_mean[i]) / (this.scaler!.x_std[i] || 1e-8));
  }

  destandardizeY(rawVector: number[]): number[] {
    if (!this.scaler) throw new Error('Scaler not loaded');
    
    return rawVector.map((val, i) => val * (this.scaler!.y_std[i] || 1e-8) + this.scaler!.y_mean[i]);
  }
}
