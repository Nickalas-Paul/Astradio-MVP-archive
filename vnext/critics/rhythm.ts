/**
 * Rhythmic Quality Critics - Pure Scoring Functions
 * Evaluates ML-generated plans for rhythmic quality
 */

import type { Plan, EventToken } from "../contracts";

export type RhythmicScores = {
  syncopation: number;      // 0..1 appropriate syncopation
  density_curve: number;    // 0..1 good density progression
  groove_consistency: number; // 0..1 consistent rhythmic patterns
  tempo_stability: number;   // 0..1 stable tempo
  accent_placement: number;  // 0..1 good accent placement
};

/**
 * Score rhythmic quality of a plan
 */
export function scoreRhythm(plan: Plan): RhythmicScores {
  const rhythmEvents = plan.events.filter(e => e.channel === "rhythm");
  const allEvents = plan.events;
  
  if (rhythmEvents.length === 0 && allEvents.length === 0) {
    return { 
      syncopation: 0.5, 
      density_curve: 0.5, 
      groove_consistency: 0.5, 
      tempo_stability: 0.5, 
      accent_placement: 0.5 
    };
  }

  return {
    syncopation: calculateSyncopation(rhythmEvents, plan.bpm),
    density_curve: calculateDensityCurve(allEvents, plan.durationSec),
    groove_consistency: calculateGrooveConsistency(rhythmEvents, plan.durationSec),
    tempo_stability: calculateTempoStability(allEvents, plan.bpm),
    accent_placement: calculateAccentPlacement(rhythmEvents, plan.bpm)
  };
}

/**
 * Calculate syncopation appropriateness
 */
function calculateSyncopation(rhythmEvents: EventToken[], bpm: number): number {
  if (rhythmEvents.length < 2) return 0.5;
  
  const beatLength = 60 / bpm;
  const quarterNote = beatLength;
  const eighthNote = beatLength / 2;
  
  let syncopatedEvents = 0;
  let totalEvents = 0;
  
  for (const event of rhythmEvents) {
    totalEvents++;
    const beatPosition = (event.t0 % beatLength) / beatLength;
    
    // Syncopation: events on weak beats (0.25, 0.75) or off-beat
    if (beatPosition > 0.1 && beatPosition < 0.4) { // Weak beat 1
      syncopatedEvents++;
    } else if (beatPosition > 0.6 && beatPosition < 0.9) { // Weak beat 3
      syncopatedEvents++;
    }
  }
  
  // Some syncopation is good, too much is chaotic
  const syncopationRatio = syncopatedEvents / totalEvents;
  const optimalSyncopation = 0.3; // 30% syncopated events
  
  return 1 - Math.abs(syncopationRatio - optimalSyncopation) * 2;
}

/**
 * Calculate density curve (build and release)
 */
function calculateDensityCurve(events: EventToken[], durationSec: number): number {
  if (events.length < 4) return 0.5;
  
  // Divide into 8 sections
  const sections = 8;
  const sectionLength = durationSec / sections;
  const sectionDensities: number[] = [];
  
  for (let i = 0; i < sections; i++) {
    const start = i * sectionLength;
    const end = (i + 1) * sectionLength;
    const sectionEvents = events.filter(e => e.t0 >= start && e.t0 < end);
    sectionDensities.push(sectionEvents.length);
  }
  
  // Check for good density curve: build to middle, then release
  let curveScore = 0;
  const midPoint = Math.floor(sections / 2);
  
  // First half should generally increase
  for (let i = 0; i < midPoint - 1; i++) {
    if (sectionDensities[i + 1] >= sectionDensities[i]) {
      curveScore++;
    }
  }
  
  // Second half can vary but shouldn't be too chaotic
  let variance = 0;
  for (let i = midPoint; i < sections - 1; i++) {
    variance += Math.abs(sectionDensities[i + 1] - sectionDensities[i]);
  }
  const avgVariance = variance / (sections - midPoint - 1);
  const maxDensity = Math.max(...sectionDensities);
  const normalizedVariance = avgVariance / maxDensity;
  
  // Lower variance is better for second half
  curveScore += (1 - normalizedVariance) * (sections - midPoint);
  
  return curveScore / sections;
}

/**
 * Calculate groove consistency
 */
function calculateGrooveConsistency(rhythmEvents: EventToken[], durationSec: number): number {
  if (rhythmEvents.length < 4) return 0.5;
  
  // Look for repeated rhythmic patterns
  const beatLength = 60 / 120; // Assume 120 BPM
  const patternLength = 4; // 4-beat patterns
  const patternDuration = beatLength * patternLength;
  
  const patterns: string[] = [];
  for (let start = 0; start < durationSec - patternDuration; start += beatLength) {
    const pattern = extractRhythmicPattern(rhythmEvents, start, patternDuration);
    patterns.push(pattern);
  }
  
  // Count pattern repetitions
  const patternCounts = new Map<string, number>();
  patterns.forEach(pattern => {
    patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
  });
  
  // Calculate consistency score
  const totalPatterns = patterns.length;
  const uniquePatterns = patternCounts.size;
  const consistency = 1 - (uniquePatterns / totalPatterns);
  
  return Math.max(0, consistency);
}

/**
 * Calculate tempo stability
 */
function calculateTempoStability(events: EventToken[], bpm: number): number {
  if (events.length < 4) return 0.5;
  
  const beatLength = 60 / bpm;
  const intervals: number[] = [];
  
  // Calculate intervals between events
  const sortedEvents = events.sort((a, b) => a.t0 - b.t0);
  for (let i = 1; i < sortedEvents.length; i++) {
    intervals.push(sortedEvents[i].t0 - sortedEvents[i-1].t0);
  }
  
  // Calculate coefficient of variation (stability)
  const mean = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const coefficient = stdDev / mean;
  
  // Lower coefficient = more stable
  return Math.max(0, 1 - coefficient);
}

/**
 * Calculate accent placement
 */
function calculateAccentPlacement(rhythmEvents: EventToken[], bpm: number): number {
  if (rhythmEvents.length === 0) return 0.5;
  
  const beatLength = 60 / bpm;
  let strongBeatAccents = 0;
  let totalAccents = 0;
  
  for (const event of rhythmEvents) {
    if (event.velocity > 0.7) { // Consider high velocity as accent
      totalAccents++;
      const beatPosition = (event.t0 % beatLength) / beatLength;
      
      // Strong beats: 0 (downbeat) and 0.5 (beat 3)
      if (beatPosition < 0.1 || (beatPosition > 0.4 && beatPosition < 0.6)) {
        strongBeatAccents++;
      }
    }
  }
  
  return totalAccents > 0 ? strongBeatAccents / totalAccents : 0.5;
}

/**
 * Extract rhythmic pattern from events in a time window
 */
function extractRhythmicPattern(events: EventToken[], startTime: number, duration: number): string {
  const windowEvents = events
    .filter(e => e.t0 >= startTime && e.t0 < startTime + duration)
    .sort((a, b) => a.t0 - b.t0);
  
  // Convert to beat positions
  const beatLength = duration / 4; // 4 beats
  const pattern = windowEvents.map(e => {
    const beatPos = Math.floor((e.t0 - startTime) / beatLength);
    return beatPos.toString();
  });
  
  return pattern.join(',');
}
