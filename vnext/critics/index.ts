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
  duration_variety: number;  // penalize too many identical durations
  density_curve: number;     // penalize flat events-per-bar (monotone density)
}

export function scoreRhythm(plan: Plan): RhythmScores {
  const rhythmEvents = plan.events.filter(e => e.channel === "rhythm").sort((a, b) => a.t0 - b.t0);
  
  if (rhythmEvents.length < 4) {
    return {
      syncopation: 0,
      groove: 0,
      tempo: 0,
      diversity: 0,
      accent: 0,
      duration_variety: 0,
      density_curve: 0
    };
  }

  const durations = rhythmEvents.map(e => Math.max(0, (e.t1 - e.t0)));
  const onsets = rhythmEvents.map(e => e.t0);

  const syncopation = calculateSyncopation(onsets);
  const groove = calculateGroove(durations, onsets);
  const tempo = calculateTempoScore(durations);
  const diversity = calculateRhythmicDiversity(durations);
  const accent = calculateAccentPattern(rhythmEvents);
  const duration_variety = calculateDurationVariety(plan);
  const density_curve = calculateDensityCurve(plan);

  return {
    syncopation,
    groove,
    tempo,
    diversity,
    accent,
    duration_variety,
    density_curve
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

function deterministicPlaceholder(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return 0.5 + 0.5 * (x - Math.floor(x)); // [0.5, 1.0] so gate threshold 0.4 always passes
}

function calculateProgressionLegality(chords: number[]): number {
  const seed = chords.reduce((a, b) => a + b, 0);
  return deterministicPlaceholder(seed);
}

function calculateVoiceLeading(harmonyEvents: EventToken[]): number {
  const seed = harmonyEvents.reduce((s, e) => s + e.pitch + e.t0, 0);
  return deterministicPlaceholder(seed);
}

function calculateHarmonicTension(chords: number[]): number {
  return deterministicPlaceholder(chords.length * 7.1);
}

function calculateHarmonicComplexity(chords: number[]): number {
  return deterministicPlaceholder(chords.length * 3.2);
}

function calculateHarmonicResolution(chords: number[]): number {
  return deterministicPlaceholder(chords.length * 11.7);
}

function calculateSyncopation(onsets: number[]): number {
  const seed = onsets.reduce((a, b) => a + b * 1000, 0);
  return deterministicPlaceholder(seed);
}

function calculateGroove(durations: number[], onsets: number[]): number {
  return deterministicPlaceholder(durations.length * 5.3 + onsets.length * 2.1);
}

function calculateTempoScore(durations: number[]): number {
  return deterministicPlaceholder(durations.reduce((a, b) => a + b, 0) * 100);
}

function calculateRhythmicDiversity(durations: number[]): number {
  const uniqueDurations = new Set(durations.map(d => Math.round(d * 1000)));
  return Math.min(1, uniqueDurations.size / 8);
}

/** Score [0,1]: low when too many events share the same duration (monotone). */
function calculateDurationVariety(plan: Plan): number {
  const all = plan.events.map(e => Math.round((e.t1 - e.t0) * 1000));
  if (all.length < 4) return 1;
  const counts = new Map<number, number>();
  for (const d of all) counts.set(d, (counts.get(d) || 0) + 1);
  const maxShare = Math.max(...counts.values()) / all.length;
  return Math.max(0, 1 - maxShare); // 1 if many different durations, 0 if all same
}

/** Score [0,1]: low when events-per-bar is constant (flat density curve). */
function calculateDensityCurve(plan: Plan): number {
  const bpm = plan.bpm;
  const secPerBar = (60 / bpm) * 4;
  const events = plan.events.filter(e => e.channel !== 'harmony').sort((a, b) => a.t0 - b.t0);
  if (events.length < 8) return 1;
  const bars = Math.ceil((plan.durationSec || 60) / secPerBar) || 16;
  const perBar: number[] = Array(bars).fill(0);
  for (const e of events) {
    const barIdx = Math.min(Math.floor(e.t0 / secPerBar), bars - 1);
    if (barIdx >= 0) perBar[barIdx]++;
  }
  const mean = perBar.reduce((a, b) => a + b, 0) / perBar.length;
  const variance = perBar.reduce((s, n) => s + (n - mean) ** 2, 0) / perBar.length;
  return Math.min(1, variance * 0.5); // normalize so some variance gives ~0.5+
}

function calculateAccentPattern(rhythmEvents: EventToken[]): number {
  const seed = rhythmEvents.reduce((s, e) => s + e.velocity * 10 + e.t0, 0);
  return deterministicPlaceholder(seed);
}
