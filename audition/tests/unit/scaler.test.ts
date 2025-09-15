// scaler.test.ts - Unit tests for scaler validation

import { ScalerLoader } from '../scaler';

describe('ScalerLoader', () => {
  let scaler: ScalerLoader;

  beforeEach(() => {
    scaler = new ScalerLoader();
  });

  test('should reject missing scaler', async () => {
    // Mock missing scaler
    (window as any).ModelArtifacts = undefined;
    
    await expect(scaler.load()).rejects.toThrow('REAL TRAINING SCALER REQUIRED');
  });

  test('should reject placeholder scaler', async () => {
    // Mock placeholder scaler
    (window as any).ModelArtifacts = {
      teacherScaler: {
        x_mean: new Array(46).fill(0.5),
        x_std: new Array(46).fill(0.2),
        y_mean: new Array(6).fill(0.5),
        y_std: new Array(6).fill(0.2),
        version: 'v1'
      }
    };
    
    await expect(scaler.load()).rejects.toThrow('REAL TRAINING SCALER REQUIRED');
  });

  test('should reject wrong array lengths', async () => {
    // Mock scaler with wrong lengths
    (window as any).ModelArtifacts = {
      teacherScaler: {
        x_mean: new Array(45).fill(0.1), // Wrong length
        x_std: new Array(46).fill(0.1),
        y_mean: new Array(6).fill(0.1),
        y_std: new Array(6).fill(0.1),
        version: 'v1'
      }
    };
    
    await expect(scaler.load()).rejects.toThrow('REAL TRAINING SCALER REQUIRED');
  });

  test('should accept valid scaler', async () => {
    // Mock valid scaler
    (window as any).ModelArtifacts = {
      teacherScaler: {
        x_mean: Array.from({length: 46}, (_, i) => 0.1 + i * 0.01),
        x_std: Array.from({length: 46}, (_, i) => 0.2 + i * 0.01),
        y_mean: Array.from({length: 6}, (_, i) => 0.1 + i * 0.1),
        y_std: Array.from({length: 6}, (_, i) => 0.2 + i * 0.1),
        version: 'v1'
      }
    };
    
    const result = await scaler.load();
    expect(result).toBeDefined();
    expect(result.x_mean).toHaveLength(46);
    expect(result.y_mean).toHaveLength(6);
  });

  test('should standardize features correctly', async () => {
    // Mock valid scaler
    (window as any).ModelArtifacts = {
      teacherScaler: {
        x_mean: [0.5, 0.5],
        x_std: [0.2, 0.2],
        y_mean: [0.5, 0.5],
        y_std: [0.2, 0.2],
        version: 'v1'
      }
    };
    
    await scaler.load();
    
    const features = [0.7, 0.3];
    const standardized = scaler.standardizeX(features);
    
    expect(standardized[0]).toBeCloseTo(1.0); // (0.7 - 0.5) / 0.2
    expect(standardized[1]).toBeCloseTo(-1.0); // (0.3 - 0.5) / 0.2
  });
});
