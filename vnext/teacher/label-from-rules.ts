// vnext/teacher/label-from-rules.ts
// Offline label generator using existing plan structure and critics.
// NOTE: This runs entirely offline and does not affect runtime behavior.

import fs from "fs";
import path from "path";
import { encodeFeatures } from "../feature-encode";
import type { EphemerisSnapshot, Plan, EventToken } from "../contracts";
import { scoreMelody } from "../critics/melodic";
import { scoreRhythm } from "../critics/rhythm";
import { scoreHarmony } from "../critics/harmony";

const DATASETS_DIR = path.resolve(process.cwd(), "datasets");
const SNAPSHOTS_FILE = path.join(DATASETS_DIR, "snapshots.jsonl");
const LABELS_DIR = path.join(DATASETS_DIR, "labels");
const OUTPUT_FILE = path.join(LABELS_DIR, "train.jsonl");
const MOTIF_VOCAB_FILE = path.resolve(process.cwd(), "vnext", "teacher", "motif_vocab.json");

type LabelRow = {
  feat: number[];
  directives: {
    tempo_norm: number;
    density_curve: [number, number, number, number];
    motif_rate: number;
    syncopation: number;
    harmonic_change_rate: number;
    melodic_range_norm: number;
  };
  arc_curve: [number, number, number];
  cadence_class: 0 | 1 | 2 | 3; // perfect, plagal, deceptive, half
  motif_tokens: number[]; // length<=8
};

function ensureDirs() {
  if (!fs.existsSync(LABELS_DIR)) fs.mkdirSync(LABELS_DIR, { recursive: true });
}

function loadSnapshots(limit: number): EphemerisSnapshot[] {
  if (!fs.existsSync(SNAPSHOTS_FILE)) {
    throw new Error(`Missing snapshots at ${SNAPSHOTS_FILE}`);
  }
  const out: EphemerisSnapshot[] = [];
  const lines = fs.readFileSync(SNAPSHOTS_FILE, "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(0, limit)) {
    try { out.push(JSON.parse(line)); } catch { /* ignore */ }
  }
  return out;
}

function simpleTeacherPlan(feat: Float32Array, durationSec = +(process.env.VNEXT_DURATION_SEC || 60)): Plan {
  // Deterministic structure with light phrase segmentation; no runtime rules are used.
  const bpm = Math.round(80 + feat[0] * 60);
  const key = "A minor";
  const events: EventToken[] = [];
  const totalSteps = 128;
  const step = durationSec / totalSteps;
  for (let i = 0; i < totalSteps; i++) {
    const t0 = i * step;
    const t1 = t0 + step * 0.9;
    const base = 58 + ((i % 7) as number);
    const isPhraseAccent = Math.floor(i / 16) % 4 === 1;
    const pitch = base + (isPhraseAccent ? 2 : 0);
    events.push({ t0, t1, pitch, velocity: 0.65, channel: i % 4 === 0 ? "harmony" : "melody" });
    if (i % 2 === 0) events.push({ t0, t1, pitch: 36 + (i % 5), velocity: 0.55, channel: "bass" });
    if (i % 4 === 0) events.push({ t0, t1, pitch: 42, velocity: 0.5, channel: "rhythm" });
  }
  return { id: `teacher_${Date.now()}_${Math.random().toString(16).slice(2)}`, featureHash: "teacher", durationSec, bpm, key, events };
}

function normalizeTempo(bpm: number): number { return Math.max(0, Math.min(1, (bpm - 60) / 120)); }

function densityCurve(events: EventToken[], durationSec: number): [number, number, number, number] {
  const sections = 4; const secLen = durationSec / sections; const out: number[] = [];
  for (let i = 0; i < sections; i++) {
    const s = i * secLen, e = (i + 1) * secLen;
    out.push(events.filter(ev => ev.t0 >= s && ev.t0 < e).length);
  }
  const max = Math.max(1, ...out);
  return [out[0] / max, out[1] / max, out[2] / max, out[3] / max] as any;
}

function harmonicChangeRate(events: EventToken[], durationSec: number): number {
  const harmony = events.filter(e => e.channel === "harmony").sort((a,b)=>a.t0-b.t0);
  if (harmony.length < 2) return 0;
  let changes = 0;
  for (let i = 1; i < harmony.length; i++) if (harmony[i].pitch !== harmony[i-1].pitch) changes++;
  return Math.min(1, changes / (durationSec / 0.5));
}

function melodicRangeNorm(events: EventToken[]): number {
  const mel = events.filter(e=>e.channel==="melody");
  if (mel.length === 0) return 0;
  const pitches = mel.map(e=>e.pitch);
  const r = Math.max(...pitches) - Math.min(...pitches);
  return Math.max(0, Math.min(1, r / 24));
}

function arcCurveFromMelody(events: EventToken[], durationSec: number): [number, number, number] {
  const mel = events.filter(e=>e.channel==="melody").sort((a,b)=>a.t0-b.t0);
  if (mel.length === 0) return [0,0,0];
  const thirds = durationSec / 3;
  const mean = (arr: number[]) => arr.reduce((a,b)=>a+b,0) / (arr.length || 1);
  const seg = [
    mel.filter(e=>e.t0 < thirds).map(e=>e.pitch),
    mel.filter(e=>e.t0 >= thirds && e.t0 < 2*thirds).map(e=>e.pitch),
    mel.filter(e=>e.t0 >= 2*thirds).map(e=>e.pitch)
  ];
  const base = seg.map(s=> (s.length? mean(s): 60));
  const min = Math.min(...base), max = Math.max(...base); const span = Math.max(1, max-min);
  return [ (base[0]-min)/span, (base[1]-min)/span, (base[2]-min)/span ] as any;
}

function cadenceClassFromMelody(events: EventToken[]): 0|1|2|3 {
  const mel = events.filter(e=>e.channel==="melody").sort((a,b)=>a.t0-b.t0);
  if (mel.length === 0) return 3; // half
  const end = mel[mel.length-1].pitch % 12;
  // crude mapping in A minor: A=9 perfect(0), D=2 plagal(1), F=5 deceptive(2), else half(3)
  if (end === 9) return 0; if (end === 2) return 1; if (end === 5) return 2; return 3;
}

function topMotifTokens(pitches: number[], vocab: Record<string, number>, k = 8): number[] {
  const grams = new Map<string, number>();
  for (let i=0;i<pitches.length-2;i++) {
    const key = `${pitches[i]}-${pitches[i+1]}-${pitches[i+2]}`;
    grams.set(key, (grams.get(key)||0)+1);
  }
  const sorted = Array.from(grams.entries()).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([g])=>g);
  return sorted.map(g=> vocab[g] ?? 0);
}

function ensureMotifVocab(vocabPath: string): Record<string, number> {
  if (fs.existsSync(vocabPath)) return JSON.parse(fs.readFileSync(vocabPath, "utf8"));
  const seed: Record<string, number> = {};
  // seed a tiny vocab
  const seeds = ["60-62-64","62-64-65","64-65-67","67-65-64","65-64-62","62-60-59","60-60-60","60-63-67"];
  seeds.forEach((g,i)=> seed[g]=i);
  fs.writeFileSync(vocabPath, JSON.stringify(seed, null, 2));
  return seed;
}

export async function main(limit = +(process.env.LABEL_LIMIT || 500)) {
  ensureDirs();
  const vocab = ensureMotifVocab(MOTIF_VOCAB_FILE);
  const snapshots = loadSnapshots(limit);
  const out = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });
  let written = 0;

  for (const snap of snapshots) {
    const feat = encodeFeatures(snap as any);
    const plan = simpleTeacherPlan(feat);
    const mel = scoreMelody(plan);
    const rhy = scoreRhythm(plan);
    const har = scoreHarmony(plan);

    const pitches = plan.events.filter(e=>e.channel==="melody").map(e=>e.pitch);
    const row: LabelRow = {
      feat: Array.from(feat),
      directives: {
        tempo_norm: normalizeTempo(plan.bpm),
        density_curve: densityCurve(plan.events, plan.durationSec),
        motif_rate: Math.max(0, Math.min(1, mel.motif_recurrence)),
        syncopation: Math.max(0, Math.min(1, rhy.syncopation)),
        harmonic_change_rate: harmonicChangeRate(plan.events, plan.durationSec),
        melodic_range_norm: Math.max(0, Math.min(1, mel.range_ok)),
      },
      arc_curve: arcCurveFromMelody(plan.events, plan.durationSec),
      cadence_class: cadenceClassFromMelody(plan.events),
      motif_tokens: topMotifTokens(pitches, vocab, 8)
    };
    out.write(JSON.stringify(row) + "\n");
    written++;
  }

  out.end();
  console.log(`Wrote ${written} label rows to ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}


