// quality-gates.test.ts - Unit tests for quality gates

import { QualityGates } from '../quality-gates';
import { Composition, CompositionEvent } from '../contracts';

describe('QualityGates', () => {
  let gates: QualityGates;

  beforeEach(() => {
    gates = new QualityGates();
  });

  test('should fail on insufficient melodic activity', () => {
    const composition: Composition = {
      events: [],
      analysis: { melodic_activity: 0.05 }, // Below threshold
      meta: { bpm: 120 }
    };

    const result = gates.evaluate(composition);
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain('melodic_activity');
    expect(result.score).toBe(0);
  });

  test('should pass melodic activity gate', () => {
    const composition: Composition = {
      events: [],
      analysis: { melodic_activity: 0.15 }, // Above threshold
      meta: { bpm: 120 }
    };

    const result = gates.evaluate(composition);
    expect(result.passed).toBe(true);
    expect(result.failedGates).not.toContain('melodic_activity');
    expect(result.score).toBeGreaterThan(0);
  });

  test('should compute melodic activity from events when missing', () => {
    const events: CompositionEvent[] = [
      { type: 'note', t: 0, dur: 1, pitch: 60, vel: 0.8 },
      { type: 'note', t: 1, dur: 1, pitch: 62, vel: 0.8 },
      { type: 'note', t: 2, dur: 1, pitch: 64, vel: 0.8 },
      { type: 'chord', t: 3, dur: 2, pitches: [60, 64, 67], vel: 0.8 }
    ];

    const composition: Composition = {
      events,
      meta: { bpm: 120 }
      // No analysis.melodic_activity
    };

    const result = gates.evaluate(composition);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test('should fail on insufficient notes', () => {
    const events: CompositionEvent[] = Array.from({ length: 30 }, (_, i) => ({
      type: 'note' as const,
      t: i * 0.5,
      dur: 0.5,
      pitch: 60 + i,
      vel: 0.8
    }));

    const composition: Composition = {
      events,
      analysis: { melodic_activity: 0.15 },
      meta: { bpm: 120 }
    };

    const result = gates.evaluate(composition);
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain('basic_sanity');
  });

  test('should pass with sufficient notes and good melodic activity', () => {
    const events: CompositionEvent[] = Array.from({ length: 80 }, (_, i) => ({
      type: 'note' as const,
      t: i * 0.5,
      dur: 0.5,
      pitch: 60 + (i % 12),
      vel: 0.8
    }));

    const composition: Composition = {
      events,
      analysis: { melodic_activity: 0.15 },
      meta: { bpm: 120 }
    };

    const result = gates.evaluate(composition);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test('should fail on invalid timing', () => {
    const events: CompositionEvent[] = [
      { type: 'note', t: 0, dur: 1, pitch: 60, vel: 0.8 },
      { type: 'note', t: NaN, dur: 1, pitch: 62, vel: 0.8 }, // Invalid timing
      { type: 'note', t: 2, dur: 1, pitch: 64, vel: 0.8 }
    ];

    const composition: Composition = {
      events,
      analysis: { melodic_activity: 0.15 },
      meta: { bpm: 120 }
    };

    const result = gates.evaluate(composition);
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain('basic_sanity');
  });

  test('should evaluate gates in correct order', () => {
    const composition: Composition = {
      events: [],
      analysis: { melodic_activity: 0.05 }, // Should fail first
      meta: { bpm: 120 }
    };

    const result = gates.evaluate(composition);
    expect(result.failedGates[0]).toBe('melodic_activity');
    expect(result.failedGates).toHaveLength(1);
  });
});
