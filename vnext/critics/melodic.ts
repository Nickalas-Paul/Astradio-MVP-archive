/**
 * Melodic Quality Critics - Pure Scoring Functions
 * Evaluates ML-generated plans for melodic narrative quality
 * NO GENERATION - Only scoring existing plans
 */

import type { Plan, EventToken } from "../contracts";

export type MelodicScores = {
  arc: number;            // 0..1 rise→climax→resolution profile
  motif_recurrence: number; // 0..1 repeated n-grams
  contour_entropy: number;  // 0..1 variety without noise
  step_leap_ratio: number;  // 0..1 healthy steps > leaps
  range_ok: number;         // 0..1 within vocal/instrumental range
  narrative_flow: number;   // 0..1 coherent melodic development
};

/**
 * Score melodic quality of a plan
 */
export function scoreMelody(plan: Plan): MelodicScores {
  const notes = plan.events.filter(e => e.channel === "melody").sort((a,b)=> a.t0-b.t0);
  if (notes.length < 16) return zero();

  const pitches = notes.map(n => n.pitch);
  const deltas = pitches.slice(1).map((p,i)=> p - pitches[i]);
  const steps = deltas.filter(d => Math.abs(d) <= 2).length;
  const leaps = deltas.length - steps;

  // motif recurrence: count repeated 3-grams
  const grams = new Map<string, number>();
  for (let i=0;i<pitches.length-2;i++){
    const key = `${pitches[i]}-${pitches[i+1]}-${pitches[i+2]}`;
    grams.set(key, (grams.get(key) || 0) + 1);
  }
  const repeats = Array.from(grams.values()).filter(c=>c>=2).reduce((a,b)=>a+b,0);
  const motif_recurrence = Math.min(1, repeats / Math.max(1, pitches.length/3));

  // contour / arc: average pitch in thirds
  const thirds = Math.max(3, Math.floor(pitches.length / 3));
  const mean = (arr:number[]) => arr.reduce((a,b)=>a+b,0)/arr.length;
  const seg1 = mean(pitches.slice(0, thirds));
  const seg2 = mean(pitches.slice(thirds, 2*thirds));
  const seg3 = mean(pitches.slice(2*thirds));
  const rise = Math.max(0, seg2 - seg1) / 12;     // normalize to an octave
  const resolve = Math.max(0, seg2 - seg3) / 12;
  const arc = Math.max(0, Math.min(1, (rise + resolve) / 2));

  // contour_entropy: variety without noise (reward mixed small steps)
  const uniqueSteps = new Set(deltas.map(d => Math.sign(d) * Math.min(3, Math.abs(d))));
  const contour_entropy = Math.min(1, uniqueSteps.size / 6);

  // step/leap ratio
  const step_leap_ratio = deltas.length ? steps / deltas.length : 0;

  // range_ok: inside 48..84 (C3..C6)
  const min = Math.min(...pitches), max = Math.max(...pitches);
  const clamped = Math.max(0, Math.min(1, (Math.min(max,84) - Math.max(min,48)) / (84-48)));
  const range_ok = clamped;

  return { arc, motif_recurrence, contour_entropy, step_leap_ratio, range_ok, narrative_flow: 0 };
}

function zero(){ return { arc:0, motif_recurrence:0, contour_entropy:0, step_leap_ratio:0, range_ok:0, narrative_flow:0 }; }
