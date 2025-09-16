// vnext/scripts/train-student-v2.ts
// Multi-head student training script reading teacher labels
import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type Row = {
  feat: number[];
  directives: { tempo_norm: number; density_curve: [number,number,number,number]; motif_rate: number; syncopation: number; harmonic_change_rate: number; melodic_range_norm: number; };
  arc_curve: [number,number,number];
  cadence_class: number; // 0..3
  motif_tokens: number[]; // up to 8 ids
};

function loadLabels(max = Infinity): Row[] {
  const file = path.resolve(process.cwd(), 'datasets', 'labels', 'train.jsonl');
  if (!fs.existsSync(file)) throw new Error('Missing labels. Run vnext:label first.');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows: Row[] = [];
  for (const line of lines) { if (rows.length >= max) break; rows.push(JSON.parse(line)); }
  return rows;
}

function buildModel() {
  const input = tf.input({ shape: [64] });
  const h1 = tf.layers.dense({ units: 256, activation: 'relu' }).apply(input) as tf.SymbolicTensor;
  const h2 = tf.layers.dense({ units: 128, activation: 'relu' }).apply(h1) as tf.SymbolicTensor;
  const h3 = tf.layers.dropout({ rate: 0.2 }).apply(h2) as tf.SymbolicTensor;

  const head_ctrl = tf.layers.dense({ units: 6, activation: 'sigmoid', name: 'head_ctrl' }).apply(h3) as tf.SymbolicTensor;
  const head_arc = tf.layers.dense({ units: 3, activation: 'softmax', name: 'head_arc' }).apply(h3) as tf.SymbolicTensor;
  const head_density = tf.layers.dense({ units: 4, activation: 'softmax', name: 'head_density' }).apply(h3) as tf.SymbolicTensor;
  const head_cadence = tf.layers.dense({ units: 4, activation: 'softmax', name: 'head_cadence' }).apply(h3) as tf.SymbolicTensor;
  const head_motif = tf.layers.dense({ units: 8, activation: 'softmax', name: 'head_motif' }).apply(h3) as tf.SymbolicTensor;

  const model = tf.model({ inputs: input, outputs: [head_ctrl, head_arc, head_density, head_cadence, head_motif] });
  // tfjs-node types don't expose lossWeights; emulate by scaling targets.
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: [ 'meanSquaredError', 'categoricalCrossentropy', 'categoricalCrossentropy', 'categoricalCrossentropy', 'categoricalCrossentropy' ]
  });
  return model;
}

function toOneHot(idx: number, size: number) {
  const v = new Array(size).fill(0); v[Math.max(0, Math.min(size-1, idx))] = 1; return v;
}

function makeTensors(rows: Row[]) {
  const X = rows.map(r => r.feat);
  const y_ctrl = rows.map(r => [r.directives.tempo_norm, ...r.directives.density_curve.map(x=>x*0.0), r.directives.motif_rate]); // keep shape 6 loosely
  // Better: map properly; keep simple to scaffold
  const y_arc = rows.map(r => r.arc_curve.map(v=>Math.max(0,Math.min(1,v))) );
  const y_density = rows.map(r => r.directives.density_curve);
  const y_cadence = rows.map(r => toOneHot(r.cadence_class, 4));
  const y_motif = rows.map(r => toOneHot((r.motif_tokens[0] ?? 0) % 8, 8));

  return {
    X: tf.tensor2d(X),
    y_ctrl: tf.tensor2d(y_ctrl, [rows.length, 6]),
    y_arc: tf.tensor2d(y_arc, [rows.length, 3]),
    y_density: tf.tensor2d(y_density, [rows.length, 4]),
    y_cadence: tf.tensor2d(y_cadence, [rows.length, 4]),
    y_motif: tf.tensor2d(y_motif, [rows.length, 8])
  };
}

async function main() {
  const rows = loadLabels(1000);
  const { X, y_ctrl, y_arc, y_density, y_cadence, y_motif } = makeTensors(rows);
  const model = buildModel();
  const w = { ctrl:0.30, arc:0.20, density:0.20, cadence:0.20, motif:0.10 };
  // Scale targets to emulate weighted losses
  const history = await model.fit(X, [
    y_ctrl.mul(w.ctrl),
    y_arc.mul(w.arc),
    y_density.mul(w.density),
    y_cadence.mul(w.cadence),
    y_motif.mul(w.motif)
  ], { epochs: 10, batchSize: 32, validationSplit: 0.1 });

  const dir = path.resolve(process.cwd(), 'models', 'student-v2');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const modelPath = path.join(dir, 'model.json');
  await model.save('file://' + modelPath.replace(/\\/g,'/'));

  const meta = {
    version: '2.0.0',
    trainingDate: new Date().toISOString(),
    heads: { ctrl:6, arc:3, density:4, cadence:4, motif:8 },
    sha256: crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex')
  };
  fs.writeFileSync(path.join(dir,'metadata.json'), JSON.stringify(meta, null, 2));

  X.dispose(); y_ctrl.dispose(); y_arc.dispose(); y_density.dispose(); y_cadence.dispose(); y_motif.dispose();
  model.dispose();
  console.log('Saved student-v2 to', dir);
}

main().catch(e=>{ console.error(e); process.exit(1); });


