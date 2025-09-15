// quality-gates.ts - Quality gates for composition evaluation

import { Composition, QualityReport, CompositionEvent } from './contracts';

export class QualityGates {
  private readonly MELODIC_ACTIVITY_THRESHOLD = 0.10;
  private readonly ARC_SHAPE_THRESHOLD = 0.30;
  private readonly MIN_NOTES = 60;

  evaluate(composition: Composition): QualityReport {
    const failedGates: string[] = [];
    let score = 0;

    // Gate 1: Melodic Activity (must be first)
    const melodicActivity = this.evaluateMelodicActivity(composition);
    if (melodicActivity < this.MELODIC_ACTIVITY_THRESHOLD) {
      failedGates.push('melodic_activity');
      return { passed: false, score: 0, failedGates };
    }
    score += melodicActivity * 40; // 40% of total score

    // Gate 2: Arc Shape
    const arcScore = this.evaluateArcShape(composition);
    if (arcScore < this.ARC_SHAPE_THRESHOLD) {
      failedGates.push('arc_shape');
      return { passed: false, score: 0, failedGates };
    }
    score += arcScore * 40; // 40% of total score

    // Gate 3: Basic Sanity
    const sanityScore = this.evaluateBasicSanity(composition);
    if (sanityScore < 0.5) {
      failedGates.push('basic_sanity');
      return { passed: false, score: 0, failedGates };
    }
    score += sanityScore * 20; // 20% of total score

    return {
      passed: true,
      score: Math.min(100, Math.max(0, score)),
      failedGates
    };
  }

  private evaluateMelodicActivity(composition: Composition): number {
    // Check if melodic_activity is already computed
    if (composition.analysis?.melodic_activity !== undefined) {
      return composition.analysis.melodic_activity;
    }

    // Compute melodic activity from events
    const events = composition.events || [];
    const melodicEvents = events.filter(e => e.type === 'note' || e.type === 'chord');
    
    if (melodicEvents.length === 0) return 0;

    // Calculate pitch diversity
    const pitches = new Set<number>();
    melodicEvents.forEach(event => {
      if (event.type === 'note') {
        pitches.add(event.pitch);
      } else if (event.type === 'chord') {
        event.pitches.forEach(p => pitches.add(p));
      }
    });

    // Calculate rhythmic diversity
    const timeIntervals = new Set<number>();
    for (let i = 1; i < melodicEvents.length; i++) {
      const interval = melodicEvents[i].t - melodicEvents[i-1].t;
      if (interval > 0) timeIntervals.add(Math.round(interval * 100) / 100);
    }

    // Combine pitch and rhythmic diversity
    const pitchDiversity = pitches.size / 24; // Max 2 octaves
    const rhythmicDiversity = timeIntervals.size / 20; // Max 20 different intervals
    
    return Math.min(1, (pitchDiversity + rhythmicDiversity) / 2);
  }

  private evaluateArcShape(composition: Composition): number {
    const events = composition.events || [];
    const melodicEvents = events.filter(e => e.type === 'note' || e.type === 'chord');
    
    if (melodicEvents.length < 10) return 0;

    // Analyze melodic arc (rising-falling pattern)
    const pitches: number[] = [];
    melodicEvents.forEach(event => {
      if (event.type === 'note') {
        pitches.push(event.pitch);
      } else if (event.type === 'chord') {
        pitches.push(event.pitches.reduce((a, b) => a + b, 0) / event.pitches.length);
      }
    });

    // Calculate arc score
    const arcScore = this.calculateMelodicArc(pitches);
    return Math.min(1, Math.max(0, arcScore));
  }

  private calculateMelodicArc(pitches: number[]): number {
    if (pitches.length < 3) return 0;

    // Divide into segments and analyze direction changes
    const segmentSize = Math.max(3, Math.floor(pitches.length / 4));
    let directionChanges = 0;
    let totalSegments = 0;

    for (let i = 0; i < pitches.length - segmentSize; i += segmentSize) {
      const segment = pitches.slice(i, i + segmentSize);
      const direction = this.getSegmentDirection(segment);
      
      if (direction !== 0) {
        totalSegments++;
        if (i > 0) {
          const prevSegment = pitches.slice(i - segmentSize, i);
          const prevDirection = this.getSegmentDirection(prevSegment);
          if (prevDirection !== 0 && prevDirection !== direction) {
            directionChanges++;
          }
        }
      }
    }

    return totalSegments > 0 ? directionChanges / totalSegments : 0;
  }

  private getSegmentDirection(segment: number[]): number {
    if (segment.length < 2) return 0;
    
    const first = segment[0];
    const last = segment[segment.length - 1];
    const diff = last - first;
    
    if (Math.abs(diff) < 2) return 0; // No clear direction
    return diff > 0 ? 1 : -1;
  }

  private evaluateBasicSanity(composition: Composition): number {
    const events = composition.events || [];
    
    // Check minimum note count
    if (events.length < this.MIN_NOTES) return 0;

    // Check for finite timing
    const invalidTiming = events.some(e => !Number.isFinite(e.t) || !Number.isFinite(e.dur));
    if (invalidTiming) return 0;

    // Check for monotonic timing
    const times = events.map(e => e.t).sort((a, b) => a - b);
    const isMonotonic = times.every((time, i) => i === 0 || time >= times[i-1]);
    if (!isMonotonic) return 0.5; // Partial credit for non-monotonic

    // Check for reasonable note density
    const duration = Math.max(...events.map(e => e.t + e.dur)) - Math.min(...events.map(e => e.t));
    const noteDensity = events.length / Math.max(duration, 1);
    
    if (noteDensity < 0.5 || noteDensity > 10) return 0.5; // Partial credit for extreme density

    return 1; // Full credit for sane composition
  }
}
