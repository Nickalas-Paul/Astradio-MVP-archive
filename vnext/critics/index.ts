// vnext/critics/index.ts
// Consolidated musical critics for melody, harmony, and rhythm evaluation

import { Plan, EventToken } from '../contracts';

// =============================================================================
// MELODIC CRITIC - Evaluate melodic quality and arc
// =============================================================================

export interface MelodicScores {
  arc: number;
  motif_recurrence: number;
  contour_entropy: number;
  step_leap_ratio: number;
  range_ok: number;
  narrative_flow: number;
  gaming_penalty: number;
}

export function scoreMelody(plan: Plan): MelodicScores {
  const melodyEvents = plan.events.filter(e => e.channel === "melody").sort((a, b) => a.t0 - b.t0);
  
  if (melodyEvents.length < 8) {
    return {
      arc: 0,
      motif_recurrence: 0,
      contour_entropy: 0,
      step_leap_ratio: 0,
      range_ok: 0,
      narrative_flow: 0,
      gaming_penalty: 1.0
    };
  }
  
  const pitches = melodyEvents.map(e => e.pitch);
  const deltas = pitches.slice(1).map((p, i) => p - pitches[i]);
  
  // Arc calculation - divide into thirds and measure rise/resolve
  const thirds = Math.max(3, Math.floor(pitches.length / 3));
  const seg1 = pitches.slice(0, thirds);
  const seg2 = pitches.slice(thirds, 2 * thirds);
  const seg3 = pitches.slice(2 * thirds);
  
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const seg1Mean = mean(seg1);
  const seg2Mean = mean(seg2);
  const seg3Mean = mean(seg3);
  
  const rise = Math.max(0, seg2Mean - seg1Mean) / 12;
  const resolve = Math.max(0, seg2Mean - seg3Mean) / 12;
  const arc = Math.max(0, Math.min(1, (rise + resolve) / 2));
  
  // Motif recurrence - look for repeated patterns
  const motif_recurrence = calculateMotifRecurrence(pitches);
  
  // Contour entropy - measure melodic unpredictability
  const contour_entropy = calculateContourEntropy(deltas);
  
  // Step/leap ratio - prefer stepwise motion
  const step_leap_ratio = calculateStepLeapRatio(deltas);
  
  // Range check - ensure reasonable pitch range
  const range_ok = calculateRangeOk(pitches);
  
  // Narrative flow - overall melodic coherence
  const narrative_flow = calculateNarrativeFlow(pitches, deltas);
  
  // Gaming penalty - detect artificial patterns
  const gaming_penalty = detectGamingPatterns(pitches, deltas);
  
  return {
    arc,
    motif_recurrence,
    contour_entropy,
    step_leap_ratio,
    range_ok,
    narrative_flow,
    gaming_penalty
  };
}

// =============================================================================
// HARMONY CRITIC - Evaluate harmonic progression and voice leading
// =============================================================================

export interface HarmonyScores {
  progression_legality: number;
  voice_leading: number;
  tension: number;
  complexity: number;
  resolution: number;
}

export function scoreHarmony(plan: Plan): HarmonyScores {
  const harmonyEvents = plan.events.filter(e => e.channel === "harmony").sort((a, b) => a.t0 - b.t0);
  
  if (harmonyEvents.length < 4) {
    return {
      progression_legality: 0,
      voice_leading: 0,
      tension: 0,
      complexity: 0,
      resolution: 0
    };
  }
  
  // Extract chord progressions
  const chords = harmonyEvents.map(e => e.pitch); // Simplified - would need full chord analysis
  
  // Progression legality - check for valid chord progressions
  const progression_legality = calculateProgressionLegality(chords);
  
  // Voice leading - measure smooth voice movement
  const voice_leading = calculateVoiceLeading(harmonyEvents);
  
  // Tension - measure harmonic tension and release
  const tension = calculateHarmonicTension(chords);
  
  // Complexity - measure harmonic sophistication
  const complexity = calculateHarmonicComplexity(chords);
  
  // Resolution - check for proper cadences
  const resolution = calculateHarmonicResolution(chords);
  
  return {
    progression_legality,
    voice_leading,
    tension,
    complexity,
    resolution
  };
}

// =============================================================================
// RHYTHM CRITIC - Evaluate rhythmic patterns and groove
// =============================================================================

export interface RhythmScores {
  syncopation: number;
  groove: number;
  tempo: number;
  diversity: number;
  accent: number;
}

export function scoreRhythm(plan: Plan): RhythmScores {
  const rhythmEvents = plan.events.filter(e => e.channel === "rhythm").sort((a, b) => a.t0 - b.t0);
  
  if (rhythmEvents.length < 4) {
    return {
      syncopation: 0,
      groove: 0,
      tempo: 0,
      diversity: 0,
      accent: 0
    };
  }
  
  // Extract rhythmic patterns
  const durations = rhythmEvents.map(e => (e as any).duration || 0.25);
  const onsets = rhythmEvents.map(e => e.t0);
  
  // Syncopation - measure off-beat emphasis
  const syncopation = calculateSyncopation(onsets);
  
  // Groove - measure rhythmic feel and consistency
  const groove = calculateGroove(durations, onsets);
  
  // Tempo - evaluate tempo appropriateness
  const tempo = calculateTempoScore(durations);
  
  // Diversity - measure rhythmic variety
  const diversity = calculateRhythmicDiversity(durations);
  
  // Accent - measure dynamic accent patterns
  const accent = calculateAccentPattern(rhythmEvents);
  
  return {
    syncopation,
    groove,
    tempo,
    diversity,
    accent
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateMotifRecurrence(pitches: number[]): number {
  // Simplified motif detection
  const motifs = new Map<string, number>();
  
  for (let i = 0; i < pitches.length - 3; i++) {
    const motif = pitches.slice(i, i + 3).join(',');
    motifs.set(motif, (motifs.get(motif) || 0) + 1);
  }
  
  const totalMotifs = motifs.size;
  const repeatedMotifs = Array.from(motifs.values()).filter(count => count > 1).length;
  
  return totalMotifs > 0 ? repeatedMotifs / totalMotifs : 0;
}

function calculateContourEntropy(deltas: number[]): number {
  if (deltas.length === 0) return 0;
  
  const contour = deltas.map(d => d > 0 ? 1 : d < 0 ? -1 : 0);
  const transitions = new Map<string, number>();
  
  for (let i = 0; i < contour.length - 1; i++) {
    const transition = `${contour[i]}->${contour[i + 1]}`;
    transitions.set(transition, (transitions.get(transition) || 0) + 1);
  }
  
  const total = Array.from(transitions.values()).reduce((sum, count) => sum + count, 0);
  let entropy = 0;
  
  for (const count of transitions.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  
  return Math.min(1, entropy / 3); // Normalize to [0,1]
}

function calculateStepLeapRatio(deltas: number[]): number {
  if (deltas.length === 0) return 0;
  
  const steps = deltas.filter(d => Math.abs(d) <= 2).length;
  const leaps = deltas.filter(d => Math.abs(d) > 2).length;
  
  return steps / (steps + leaps);
}

function calculateRangeOk(pitches: number[]): number {
  if (pitches.length === 0) return 0;
  
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  const range = max - min;
  
  // Prefer ranges between 1-2 octaves
  if (range >= 12 && range <= 24) return 1;
  if (range < 12) return range / 12;
  return Math.max(0, 1 - (range - 24) / 12);
}

function calculateNarrativeFlow(pitches: number[], deltas: number[]): number {
  // Measure overall melodic coherence and direction
  const directionChanges = deltas.slice(1).filter((d, i) => 
    (d > 0) !== (deltas[i] > 0)
  ).length;
  
  const flowScore = 1 - (directionChanges / Math.max(1, deltas.length));
  return Math.max(0, Math.min(1, flowScore));
}

function detectGamingPatterns(pitches: number[], deltas: number[]): number {
  // Detect artificial patterns like repeated notes or mechanical sequences
  let penalty = 0;
  
  // Check for too many repeated pitches
  const repeatedNotes = deltas.filter(d => d === 0).length;
  if (repeatedNotes / pitches.length > 0.3) penalty += 0.3;
  
  // Check for mechanical sequences (exact intervals)
  const uniqueIntervals = new Set(deltas.map(Math.abs));
  if (uniqueIntervals.size < 3 && pitches.length > 10) penalty += 0.4;
  
  // Check for extreme ranges
  const range = Math.max(...pitches) - Math.min(...pitches);
  if (range > 36) penalty += 0.3;
  
  return Math.min(1, penalty);
}

function calculateProgressionLegality(chords: number[]): number {
  // Simplified chord progression analysis
  // In reality, this would analyze actual chord functions
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateVoiceLeading(harmonyEvents: EventToken[]): number {
  // Simplified voice leading analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateHarmonicTension(chords: number[]): number {
  // Simplified tension analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateHarmonicComplexity(chords: number[]): number {
  // Simplified complexity analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateHarmonicResolution(chords: number[]): number {
  // Simplified resolution analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateSyncopation(onsets: number[]): number {
  // Simplified syncopation analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateGroove(durations: number[], onsets: number[]): number {
  // Simplified groove analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateTempoScore(durations: number[]): number {
  // Simplified tempo analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}

function calculateRhythmicDiversity(durations: number[]): number {
  // Simplified diversity analysis
  const uniqueDurations = new Set(durations);
  return Math.min(1, uniqueDurations.size / 8);
}

function calculateAccentPattern(rhythmEvents: EventToken[]): number {
  // Simplified accent analysis
  return Math.random() * 0.8 + 0.2; // Placeholder
}
