/**
 * Harmonic Quality Critics - Pure Scoring Functions
 * Evaluates ML-generated plans for harmonic progression quality
 */

import type { Plan, EventToken } from "../contracts";

export type HarmonicScores = {
  progression_legality: number;  // 0..1 valid chord progressions
  harmonic_rhythm: number;       // 0..1 appropriate chord change timing
  voice_leading: number;         // 0..1 smooth voice movement
  tension_resolution: number;    // 0..1 proper tension and release
  key_consistency: number;       // 0..1 staying in key
};

/**
 * Score harmonic quality of a plan
 */
export function scoreHarmony(plan: Plan): HarmonicScores {
  const harmonyEvents = plan.events.filter(e => e.channel === "harmony");
  const bassEvents = plan.events.filter(e => e.channel === "bass");
  
  if (harmonyEvents.length === 0 && bassEvents.length === 0) {
    return { 
      progression_legality: 0.5, 
      harmonic_rhythm: 0.5, 
      voice_leading: 0.5, 
      tension_resolution: 0.5, 
      key_consistency: 0.5 
    };
  }

  return {
    progression_legality: calculateProgressionLegality(harmonyEvents, plan.key),
    harmonic_rhythm: calculateHarmonicRhythm(harmonyEvents, plan.durationSec),
    voice_leading: calculateVoiceLeading(harmonyEvents, bassEvents),
    tension_resolution: calculateTensionResolution(harmonyEvents, plan.durationSec),
    key_consistency: calculateKeyConsistency(harmonyEvents, plan.key)
  };
}

/**
 * Calculate chord progression legality
 */
function calculateProgressionLegality(harmonyEvents: EventToken[], key: string): number {
  if (harmonyEvents.length < 2) return 0.5;
  
  // Extract chord roots (simplified - just use pitch classes)
  const chordRoots = harmonyEvents.map(e => e.pitch % 12);
  
  // Count valid progressions (simplified rules)
  let validProgressions = 0;
  for (let i = 1; i < chordRoots.length; i++) {
    const interval = (chordRoots[i] - chordRoots[i-1] + 12) % 12;
    // Common progressions: 4th up, 5th up, 2nd up, 3rd up
    if ([5, 7, 2, 4].includes(interval)) {
      validProgressions++;
    }
  }
  
  return validProgressions / (chordRoots.length - 1);
}

/**
 * Calculate harmonic rhythm appropriateness
 */
function calculateHarmonicRhythm(harmonyEvents: EventToken[], durationSec: number): number {
  if (harmonyEvents.length < 2) return 0.5;
  
  // Calculate time between chord changes
  const sortedEvents = harmonyEvents.sort((a, b) => a.t0 - b.t0);
  const intervals: number[] = [];
  
  for (let i = 1; i < sortedEvents.length; i++) {
    intervals.push(sortedEvents[i].t0 - sortedEvents[i-1].t0);
  }
  
  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  const beatLength = 60 / 120; // Assume 120 BPM for now
  
  // Good harmonic rhythm: 1-4 beats per chord
  const optimalMin = beatLength;
  const optimalMax = beatLength * 4;
  
  if (avgInterval < optimalMin) return avgInterval / optimalMin;
  if (avgInterval > optimalMax) return optimalMax / avgInterval;
  return 1.0;
}

/**
 * Calculate voice leading smoothness
 */
function calculateVoiceLeading(harmonyEvents: EventToken[], bassEvents: EventToken[]): number {
  if (harmonyEvents.length < 2) return 0.5;
  
  // Simplified: check for small intervals between harmony notes
  const sortedHarmony = harmonyEvents.sort((a, b) => a.t0 - b.t0);
  let smoothMovements = 0;
  let totalMovements = 0;
  
  for (let i = 1; i < sortedHarmony.length; i++) {
    const interval = Math.abs(sortedHarmony[i].pitch - sortedHarmony[i-1].pitch);
    totalMovements++;
    if (interval <= 7) { // Within a 5th
      smoothMovements++;
    }
  }
  
  return totalMovements > 0 ? smoothMovements / totalMovements : 0.5;
}

/**
 * Calculate tension and resolution
 */
function calculateTensionResolution(harmonyEvents: EventToken[], durationSec: number): number {
  if (harmonyEvents.length < 4) return 0.5;
  
  // Divide into sections and look for tension build and release
  const sections = 4;
  const sectionLength = durationSec / sections;
  const sectionPitches: number[][] = [];
  
  for (let i = 0; i < sections; i++) {
    const start = i * sectionLength;
    const end = (i + 1) * sectionLength;
    const sectionEvents = harmonyEvents.filter(e => e.t0 >= start && e.t0 < end);
    sectionPitches.push(sectionEvents.map(e => e.pitch));
  }
  
  // Look for increasing complexity (tension) then resolution
  let tensionScore = 0;
  for (let i = 0; i < sections - 1; i++) {
    const currentComplexity = calculatePitchComplexity(sectionPitches[i]);
    const nextComplexity = calculatePitchComplexity(sectionPitches[i + 1]);
    
    if (i < sections / 2) {
      // First half should build tension
      if (nextComplexity > currentComplexity) tensionScore++;
    } else {
      // Second half should resolve
      if (nextComplexity < currentComplexity) tensionScore++;
    }
  }
  
  return tensionScore / (sections - 1);
}

/**
 * Calculate key consistency
 */
function calculateKeyConsistency(harmonyEvents: EventToken[], key: string): number {
  if (harmonyEvents.length === 0) return 0.5;
  
  // Simplified: check if pitches are in the key
  const keyPitches = getKeyPitches(key);
  const inKeyCount = harmonyEvents.filter(e => keyPitches.includes(e.pitch % 12)).length;
  
  return inKeyCount / harmonyEvents.length;
}

/**
 * Get pitches in a key (simplified)
 */
function getKeyPitches(key: string): number[] {
  // Major scale intervals
  const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
  const keyMap: { [key: string]: number } = {
    'C': 0, 'G': 7, 'D': 2, 'A': 9, 'E': 4, 'B': 11, 'F#': 6, 'C#': 1,
    'G#': 8, 'D#': 3, 'A#': 10, 'F': 5
  };
  
  const root = keyMap[key] || 0;
  return majorIntervals.map(interval => (root + interval) % 12);
}

/**
 * Calculate pitch complexity (simplified)
 */
function calculatePitchComplexity(pitches: number[]): number {
  if (pitches.length === 0) return 0;
  
  const uniquePitches = new Set(pitches.map(p => p % 12));
  const range = Math.max(...pitches) - Math.min(...pitches);
  
  return (uniquePitches.size / 12) + (range / 60); // Normalized
}
