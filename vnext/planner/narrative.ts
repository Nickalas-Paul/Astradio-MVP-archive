// vnext/planner/narrative.ts
import { Plan, EventToken } from "../contracts";

/**
 * ML-driven compact planner:
 * - Input vector v[6] in [0,1]: tempo, brightness, density, arc, motifSel, cadenceSel
 * - Output: 4 phrases × 4 bars of melody/harmony/bass/rhythm with a clear arc + cadence.
 * No rules fallback; deterministic mapping from ML heads.
 */

type V6 = [number, number, number, number, number, number];

const PPQ = 4;            // beats per bar grid (quarter notes)
const BARS = 16;          // 4 phrases * 4 bars
const PHRASE = 4;         // bars per phrase
const DUR_SEC = 60;

const MOTIFS: number[][] = [
  [0, +2, +4],    // up-step motif
  [0, +3, +5],    // minor third motif
  [0, +2, -1],    // turn figure
  [0, -2, -4],    // down-step motif
  [0, +4, +7],    // triad figure
  [0, +1, +2],    // scalar tight
  [0, +5, +7],    // fifth motif
  [0, -1, +2],    // neighbor motion
];

const CADENCE_ENDS = [ 71, 72, 74, 76 ]; // B4, C5, D5, E5 as simple cadence targets

function lerp(a:number,b:number,t:number){ return a+(b-a)*t; }
function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }
function pick<T>(arr:T[], t:number){ return arr[Math.floor(clamp01(t)*arr.length) % arr.length]; }
function quantizeBeat(time:number, bpm:number){ return Math.round(time * bpm * (PPQ/60)) / (bpm*(PPQ/60)); }

export function planFromVector(v: V6, guidance?: { tempoBias?: number; arcBias?: number; densityBias?: number; motifIdx?: number; cadenceIdx?: number }): Plan {
  const [vTempo, vBright, vDense, vArc, vMotif, vCad] = v;

  // Apply astrological guidance biases if provided
  const tempoBias = guidance?.tempoBias || 0;
  const arcBias = guidance?.arcBias || 0;
  const densityBias = guidance?.densityBias || 0;
  
  // tempo & register from ML (with astro bias)
  const biasedTempo = Math.max(0, Math.min(1, vTempo * (1 + 0.1 * tempoBias)));
  const bpm = Math.round( lerp(70, 140, biasedTempo) );
  const baseCenter = Math.round( lerp(55, 67, vBright) ); // G3..G4 center

  // phrase-level arc: low → high → resolve (with astro bias)
  // arc height scales phrase centers; vArc controls lift
  const biasedArc = Math.max(0, Math.min(1, vArc * (1 + 0.3 * arcBias)));
  const arcLift = lerp(3, 10, biasedArc); // semitone lift at climax
  const phraseCenters = [
    baseCenter - Math.round(arcLift*0.5),
    baseCenter + Math.round(arcLift*0.4),
    baseCenter + Math.round(arcLift*1.0),
    baseCenter - Math.round(arcLift*0.2),
  ];

  // Use guidance motif/cadence if provided, otherwise use ML vector
  const motifIdx = guidance?.motifIdx !== undefined ? guidance.motifIdx : Math.floor(vMotif * MOTIFS.length);
  const cadenceIdx = guidance?.cadenceIdx !== undefined ? guidance.cadenceIdx : Math.floor(vCad * CADENCE_ENDS.length);
  
  const motif = MOTIFS[motifIdx % MOTIFS.length];
  const cadencePitch = CADENCE_ENDS[cadenceIdx % CADENCE_ENDS.length];

  // density per half-bar (0..1) → notes per slot (with astro bias)
  const biasedDensity = Math.max(0, Math.min(1, vDense + 0.2 * densityBias));
  const density = lerp(0.3, 0.9, biasedDensity);

  const events: EventToken[] = [];
  const secondsPerBeat = 60 / bpm;
  const totalBeats = BARS * 4;
  const secPerGrid = secondsPerBeat; // quarter-note grid

  // Helper to push an event
  const push = (tBeats:number, durBeats:number, pitch:number, vel:number, channel:"melody"|"harmony"|"bass"|"rhythm")=>{
    const t0 = quantizeBeat(tBeats * secondsPerBeat, bpm);
    const t1 = quantizeBeat((tBeats+durBeats) * secondsPerBeat, bpm);
    events.push({ t0, t1, pitch, velocity: vel, channel });
  };

  // Melody: place motif instances each bar, transposed to phrase center
  let beat = 0;
  for (let bar = 0; bar < BARS; bar++) {
    const phraseIdx = Math.floor(bar / PHRASE);
    const center = phraseCenters[phraseIdx];
    const barStart = bar * 4;

    // choose 2-3 motif drops per bar depending on density
    const drops = density > 0.75 ? 3 : (density > 0.5 ? 2 : 1);
    for (let k = 0; k < drops; k++) {
      const slot = k * (4 / drops);             // within bar
      const root = center + ((bar % 2) ? 0 : -2); // slight period lift
      const vel = 0.7 + 0.1 * (k % 2);
      // place motif as quarter-notes
      for (let i = 0; i < motif.length; i++) {
        const t = barStart + slot + i * 1;
        const p = root + motif[i];
        push(t, 1, p, vel, "melody");
      }
    }
    // cadence at end of each phrase
    if ((bar+1) % PHRASE === 0) {
      const t = barStart + 3; // last beat
      push(t, 1, cadencePitch, 0.9, "melody");
    }
    beat += 4;
  }

  // Bass: tonic–dominant ostinato aligned to phrase centers
  for (let bar = 0; bar < BARS; bar++) {
    const phraseIdx = Math.floor(bar / PHRASE);
    const c = phraseCenters[phraseIdx];
    const bass = c - 24; // two octaves down
    const barStart = bar * 4;
    push(barStart + 0, 2, bass, 0.7, "bass");
    push(barStart + 2, 2, bass + 7, 0.7, "bass"); // dominant
  }

  // Harmony: block triads under each bar's center
  for (let bar = 0; bar < BARS; bar++) {
    const phraseIdx = Math.floor(bar / PHRASE);
    const c = phraseCenters[phraseIdx];
    const triad = [c, c+4, c+7];
    const barStart = bar * 4;
    for (const p of triad) push(barStart, 4, p, 0.5, "harmony");
  }

  // Rhythm: light kick on 1 & 3, hat on 2 & 4 (just to drive groove score)
  for (let bar = 0; bar < BARS; bar++) {
    const barStart = bar * 4;
    push(barStart + 0, 0.1, 36, 0.8, "rhythm");
    push(barStart + 2, 0.1, 36, 0.7, "rhythm");
    push(barStart + 1, 0.05, 42, 0.4, "rhythm");
    push(barStart + 3, 0.05, 42, 0.4, "rhythm");
  }

  // Clamp to 60s duration
  const duration = Math.min(DUR_SEC, totalBeats * secondsPerBeat);
  return {
    id: `plan_${Date.now()}`,
    featureHash: "v6",
    durationSec: duration,
    bpm,
    key: "A minor",
    events
  };
}
