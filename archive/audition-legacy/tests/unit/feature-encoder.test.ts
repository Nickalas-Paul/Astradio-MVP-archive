// feature-encoder.test.ts - Unit tests for feature encoding

import { FeatureEncoder } from '../feature-encoder';
import { ChartContext } from '../contracts';

describe('FeatureEncoder', () => {
  let encoder: FeatureEncoder;

  beforeEach(() => {
    encoder = new FeatureEncoder();
  });

  test('should produce correct feature length', () => {
    const chart: ChartContext = {
      planets: {
        sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120,
        jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270
      },
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
      aspects: [],
      moonPhase: 0.5,
      dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
    };

    const features = encoder.encode(chart);
    expect(features).toHaveLength(FeatureEncoder.FEATURE_LEN);
  });

  test('should never produce NaN or Infinity', () => {
    const chart: ChartContext = {
      planets: {
        sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120,
        jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270
      },
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
      aspects: [],
      moonPhase: 0.5,
      dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
    };

    const features = encoder.encode(chart);
    
    features.forEach((feature, index) => {
      expect(Number.isFinite(feature)).toBe(true);
      expect(feature).toBeGreaterThanOrEqual(0);
      expect(feature).toBeLessThanOrEqual(1);
    });
  });

  test('should handle missing optional fields', () => {
    const chart: ChartContext = {
      planets: {
        sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120,
        jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270
      },
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
      // Missing aspects, moonPhase, dominantElements
    };

    const features = encoder.encode(chart);
    expect(features).toHaveLength(FeatureEncoder.FEATURE_LEN);
    expect(features.every(f => Number.isFinite(f))).toBe(true);
  });

  test('should produce different features for different charts', () => {
    const chart1: ChartContext = {
      planets: {
        sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120,
        jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270
      },
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
      aspects: [],
      moonPhase: 0.5,
      dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
    };

    const chart2: ChartContext = {
      planets: {
        sun: 180, moon: 210, mercury: 240, venus: 270, mars: 300,
        jupiter: 330, saturn: 0, uranus: 30, neptune: 60, pluto: 90
      },
      houses: [180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150],
      aspects: [],
      moonPhase: 0.8,
      dominantElements: { fire: 0.4, earth: 0.2, air: 0.3, water: 0.1 }
    };

    const features1 = encoder.encode(chart1);
    const features2 = encoder.encode(chart2);

    // Should have some differences
    const differences = features1.filter((f, i) => Math.abs(f - features2[i]) > 0.01).length;
    expect(differences).toBeGreaterThan(0);
  });
});
