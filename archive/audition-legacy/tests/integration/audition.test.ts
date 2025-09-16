// audition.test.ts - Integration tests for full audition flow

import { AuditionRunner } from '../audition-runner';
import { ChartContext } from '../contracts';

describe('AuditionRunner Integration', () => {
  let runner: AuditionRunner;

  beforeEach(() => {
    runner = new AuditionRunner();
    
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

    // Mock ML manager
    (window as any).mlManager = {
      generate: jest.fn().mockResolvedValue({
        vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
      })
    };

    // Mock AudioEngine
    (window as any).audioEngine = {
      generateComposition: jest.fn().mockReturnValue({
        events: Array.from({ length: 80 }, (_, i) => ({
          type: 'note',
          t: i * 0.5,
          dur: 0.5,
          pitch: 60 + (i % 12),
          vel: 0.8
        })),
        analysis: { melodic_activity: 0.15 },
        meta: { bpm: 120 }
      })
    };
  });

  test('should fail fast without scaler', async () => {
    (window as any).ModelArtifacts = undefined;
    
    const charts: ChartContext[] = [
      {
        planets: { sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120, jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270 },
        houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
      }
    ];

    await expect(runner.run(charts)).rejects.toThrow('REAL TRAINING SCALER REQUIRED');
  });

  test('should process charts and select winner', async () => {
    const charts: ChartContext[] = [
      {
        planets: { sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120, jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270 },
        houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
        aspects: [],
        moonPhase: 0.5,
        dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
      },
      {
        planets: { sun: 180, moon: 210, mercury: 240, venus: 270, mars: 300, jupiter: 330, saturn: 0, uranus: 30, neptune: 60, pluto: 90 },
        houses: [180, 210, 240, 270, 300, 330, 0, 30, 60, 90, 120, 150],
        aspects: [],
        moonPhase: 0.8,
        dominantElements: { fire: 0.4, earth: 0.2, air: 0.3, water: 0.1 }
      }
    ];

    const result = await runner.run(charts);

    expect(result.total).toBe(2);
    expect(result.cases).toHaveLength(2);
    expect(result.passed).toBeGreaterThan(0);
    expect(result.preClampVariance).toBeDefined();
  });

  test('should handle chart processing errors gracefully', async () => {
    // Mock ML manager to throw error
    (window as any).mlManager.generate = jest.fn().mockRejectedValue(new Error('ML model error'));

    const charts: ChartContext[] = [
      {
        planets: { sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120, jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270 },
        houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
      }
    ];

    const result = await runner.run(charts);

    expect(result.total).toBe(1);
    expect(result.cases[0].error).toBeDefined();
    expect(result.passed).toBe(0);
  });

  test('should not render audio when no compositions pass', async () => {
    // Mock AudioEngine to produce failing composition
    (window as any).audioEngine.generateComposition = jest.fn().mockReturnValue({
      events: [], // No events = fails basic sanity
      analysis: { melodic_activity: 0.05 }, // Fails melodic activity
      meta: { bpm: 120 }
    });

    const charts: ChartContext[] = [
      {
        planets: { sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120, jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270 },
        houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
      }
    ];

    const result = await runner.run(charts);

    expect(result.passed).toBe(0);
    expect(result.winnerIndex).toBeUndefined();
    expect(result.cases.every(c => !c.renderUrl)).toBe(true);
  });
});
