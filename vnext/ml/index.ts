// vnext/ml/index.ts
// Consolidated ML components: model loading, student training, and retrieval

import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FeatureVec } from '../contracts';

const isNode = typeof process !== 'undefined' && !!process.versions?.node;

try {
  require('@tensorflow/tfjs-backend-wasm');
} catch { /* ignore */ }

// =============================================================================
// MODEL LOADER - Centralized model loading and management
// =============================================================================

interface ModelMetadata {
  version: string;
  architecture: string;
  trainingDate: string;
  performance: Record<string, number>;
  checksum: string;
}

function isTfjsLayersModelJson(p: string): boolean {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    return !!(j && (j.modelTopology || j.format === 'layers-model'));
  } catch {
    return false;
  }
}

function modelSha(jsonPath: string): string {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    return 'unknown';
  }
}

/**
 * ML preflight: log cwd, env, path existence, and resolved path before any load.
 * Runs even if ML will fail closed so Render logs show the truth.
 */
export function logMlPreflight(): void {
  const cwd = process.cwd();
  const vnextPath = process.env.VNEXT_MODEL_PATH ?? '<unset>';
  const runtimeModel = process.env.RUNTIME_MODEL ?? '<unset>';

  const cwdModelsJson = path.join(cwd, 'models', 'student-v2.2', 'model.json');
  const cwdModelsBin = path.join(cwd, 'models', 'student-v2.2', 'group1-shard1of1.bin');
  const distModelsJson = path.join(cwd, 'dist', 'models', 'student-v2.2', 'model.json');
  const distModelsBin = path.join(cwd, 'dist', 'models', 'student-v2.2', 'group1-shard1of1.bin');

  const cwdJsonExists = fs.existsSync(cwdModelsJson);
  const cwdBinExists = fs.existsSync(cwdModelsBin);
  const distJsonExists = fs.existsSync(distModelsJson);
  const distBinExists = fs.existsSync(distModelsBin);

  const safeSize = (p: string) => {
    try {
      return fs.existsSync(p) ? fs.statSync(p).size : 0;
    } catch {
      return -1;
    }
  };

  const { dir, modelId } = resolveModelDir();
  const resolvedJson = path.join(dir, 'model.json');
  const resolvedBin = path.join(dir, 'group1-shard1of1.bin');

  console.log('[ML_PREFLIGHT]', JSON.stringify({
    process_cwd: cwd,
    VNEXT_MODEL_PATH: vnextPath,
    RUNTIME_MODEL: runtimeModel,
    models_student_v22_model_json_cwd: cwdJsonExists,
    models_student_v22_bin_cwd: cwdBinExists,
    dist_models_student_v22_model_json: distJsonExists,
    dist_models_student_v22_bin: distBinExists,
    resolved_model_dir: dir,
    resolved_model_id: modelId,
    resolved_model_json: resolvedJson,
    resolved_bin: resolvedBin,
    resolved_json_exists: fs.existsSync(resolvedJson),
    resolved_bin_exists: fs.existsSync(resolvedBin),
    resolved_json_size: safeSize(resolvedJson),
    resolved_bin_size: safeSize(resolvedBin),
  }));
}

/**
 * Resolve model directory: VNEXT_MODEL_PATH (env) > dist/models (production) > models (local dev).
 * On Render, models are copied into dist/ during build; cwd/models may be absent.
 */
function resolveModelDir(): { dir: string; modelId: string } {
  const envPath = process.env.VNEXT_MODEL_PATH;
  if (envPath) {
    const trimmed = envPath.trim();
    const toModelJson = trimmed.endsWith('model.json')
      ? trimmed
      : path.join(trimmed, 'model.json');
    if (fs.existsSync(toModelJson) && isTfjsLayersModelJson(toModelJson)) {
      const dir = path.dirname(toModelJson);
      console.log(`[ML] Using VNEXT_MODEL_PATH: ${dir}`);
      return { dir, modelId: path.basename(dir) };
    }
    console.warn(`[ML] VNEXT_MODEL_PATH not valid TFJS layers or missing: ${toModelJson}`);
  }

  const cwd = process.cwd();
  const distModelsJson = path.join(cwd, 'dist', 'models', 'student-v2.2', 'model.json');
  const cwdModelsJson = path.join(cwd, 'models', 'student-v2.2', 'model.json');

  if (fs.existsSync(distModelsJson) && isTfjsLayersModelJson(distModelsJson)) {
    const dir = path.dirname(distModelsJson);
    console.log(`[ML] Using dist/models (production): ${dir}`);
    return { dir, modelId: 'student-v2.2' };
  }
  if (fs.existsSync(cwdModelsJson) && isTfjsLayersModelJson(cwdModelsJson)) {
    const dir = path.dirname(cwdModelsJson);
    console.log(`[ML] Using models (local dev): ${dir}`);
    return { dir, modelId: 'student-v2.2' };
  }

  const id = process.env.RUNTIME_MODEL || 'student-v2.8-slice-batch';
  const base = path.resolve(cwd, 'models');
  const candidate = path.join(base, id, 'model.json');
  const fallback = path.join(base, 'student-v2.2', 'model.json');

  if (fs.existsSync(candidate) && isTfjsLayersModelJson(candidate)) {
    return { dir: path.dirname(candidate), modelId: id };
  }
  const fallbackDir = path.dirname(fallback);
  return { dir: fallbackDir, modelId: 'student-v2.2' };
}

/** Node-only: fs-based IOHandler so we can load models without tfjs-node native addon. */
function createFsIOHandler(jsonPath: string): tf.io.IOHandler & { name?: string } {
  const dir = path.dirname(jsonPath);
  return {
    name: `fs:${jsonPath}`,
    load: async () => {
      const modelJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const manifest = modelJson.weightsManifest as Array<{ paths: string[]; weights: tf.io.WeightsManifestEntry[] }>;
      if (!manifest || !Array.isArray(manifest)) {
        throw new Error('Invalid model.json: missing weightsManifest');
      }
      const buffers: Buffer[] = [];
      const weightSpecs: tf.io.WeightsManifestEntry[] = [];
      for (const group of manifest) {
        for (const rel of group.paths) {
          const fp = path.join(dir, rel);
          buffers.push(fs.readFileSync(fp));
        }
        weightSpecs.push(...group.weights);
      }
      const n = buffers.reduce((s, b) => s + b.length, 0);
      const out = new ArrayBuffer(n);
      const u8 = new Uint8Array(out);
      let o = 0;
      for (const b of buffers) {
        u8.set(b, o);
        o += b.length;
      }
      return {
        modelTopology: modelJson.modelTopology,
        weightSpecs,
        weightData: out,
        format: modelJson.format,
        generatedBy: modelJson.generatedBy,
        convertedBy: modelJson.convertedBy,
      } as tf.io.ModelArtifacts;
    },
  };
}

class ModelLoader {
  private models: Map<string, tf.LayersModel> = new Map();
  private metadata: Map<string, ModelMetadata> = new Map();

  async loadModel(handler: string | tf.io.IOHandler): Promise<tf.LayersModel> {
    const key = typeof handler === 'string' ? handler : (handler as any).name || 'handler';
    if (this.models.has(key)) {
      return this.models.get(key)!;
    }

    if (typeof handler === 'string') {
      console.log(`[ML] Loading model from: ${handler}`);
    } else {
      console.log(`[ML] Loading model via IOHandler`);
    }

    const model = await tf.loadLayersModel(handler);
    this.models.set(key, model);

    if (typeof handler === 'string' && handler.endsWith('model.json')) {
      const metadataPath = handler.replace('model.json', 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          this.metadata.set(key, metadata as ModelMetadata);
        } catch { /* ignore */ }
      }
    }

    return model;
  }

  getMetadata(modelPath: string): ModelMetadata | null {
    return this.metadata.get(modelPath) || null;
  }

  dispose(): void {
    this.models.forEach((m) => m.dispose());
    this.models.clear();
    this.metadata.clear();
  }
}

// =============================================================================
// MODEL ADAPTER - Interface between different model versions
// =============================================================================

interface ModelAdapter {
  name: string;
  version: string;
  adapt(input: tf.Tensor): tf.Tensor;
  getOutputShape(): number[];
}

class StudentV2Adapter implements ModelAdapter {
  name = 'student-v2';
  version = '2.2';

  adapt(input: tf.Tensor): tf.Tensor {
    return input;
  }

  getOutputShape(): number[] {
    return [6];
  }
}

// =============================================================================
// STUDENT MODEL - Main ML model for astrological music generation
// =============================================================================

export interface StudentVectorResult {
  vector: number[];
  confidence: number;
  modelVersion: string;
  timestamp: string;
  inference_ms: number;
  model_sha: string;
  tf_backend: string;
  ml_used: boolean;
}

const MODEL_DIR = path.resolve(process.cwd(), 'models', 'student-v2.2');
const MODEL_JSON_FILE = path.join(MODEL_DIR, 'model.json');
const MODEL_METADATA_FILE = path.join(MODEL_DIR, 'metadata.json');
const MODEL_HTTP_URL = 'http://localhost:3000/models/student-v2.2/model.json';

const modelLoader = new ModelLoader();
const adapter = new StudentV2Adapter();

function ensure64(feat: FeatureVec): Float32Array {
  const a = Array.from(feat);
  if (a.length >= 64) return new Float32Array(a.slice(0, 64));
  const out = new Float32Array(64);
  out.set(a);
  return out;
}

export async function studentVector(feat: FeatureVec): Promise<StudentVectorResult> {
  try {
    await tf.ready();
    const padded = ensure64(feat);
    let handler: string | tf.io.IOHandler;
    let modelId: string;
    let model_sha = 'unknown';

    if (isNode) {
      const { dir, modelId: id } = resolveModelDir();
      modelId = id;
      const jsonPath = path.join(dir, 'model.json');
      model_sha = modelSha(jsonPath);
      handler = createFsIOHandler(jsonPath);
      console.log(`[ML] Using fs IOHandler: ${jsonPath}`);
    } else {
      const useHTTP = process.env.STRICT_ML === 'false';
      handler = useHTTP ? MODEL_HTTP_URL : `file://${MODEL_JSON_FILE}`;
      modelId = 'student-v2.2';
    }

    const model = await modelLoader.loadModel(handler);
    const backend = tf.getBackend() || 'unknown';

    const inputTensor = tf.tensor2d([Array.from(padded)], [1, 64]);
    const t0 = process.hrtime?.bigint ? process.hrtime.bigint() : BigInt(0);

    const out = model.predict(inputTensor);
    const outputs = Array.isArray(out) ? out : [out];
    const headCtrl = outputs[0] as tf.Tensor;
    const adapted = adapter.adapt(headCtrl);
    const adaptedData = await adapted.data();

    const t1 = process.hrtime?.bigint ? process.hrtime.bigint() : BigInt(0);
    const inference_ms = Number((t1 - t0) / BigInt(1_000_000));

    inputTensor.dispose();
    for (const t of outputs) t.dispose();
    // adapted === headCtrl (passthrough), already disposed

    const vec = Array.from(adaptedData);
    return {
      vector: vec,
      confidence: calculateConfidence(adaptedData as Float32Array),
      modelVersion: adapter.version,
      timestamp: new Date().toISOString(),
      inference_ms,
      model_sha,
      tf_backend: backend,
      ml_used: true,
    };
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error('[ML] Student model inference failed:', msg);
    if (process.env.DEBUG_ML && error?.stack) console.error('[ML]', error.stack);
    const err = new Error(`ML inference failed: ${msg}`) as Error & { code?: string };
    err.code = 'ML_INFERENCE_UNAVAILABLE';
    throw err;
  }
}

// =============================================================================
// MODEL REFINER - Post-processing and refinement
// =============================================================================

interface RefinementOptions {
  smoothing: boolean;
  calibration: boolean;
  constraints: Record<string, number>;
}

export function refineModelOutput(
  vector: number[],
  options: RefinementOptions = { smoothing: true, calibration: false, constraints: {} }
): number[] {
  let refined = [...vector];

  if (options.smoothing) refined = applySmoothing(refined);
  if (options.calibration) refined = applyCalibration(refined);
  Object.entries(options.constraints).forEach(([key, value]) => {
    const idx = getConstraintIndex(key);
    if (idx >= 0 && idx < refined.length) refined[idx] = Math.max(0, Math.min(1, value));
  });

  return refined;
}

// =============================================================================
// RETRIEVAL SYSTEM - Model and data retrieval utilities
// =============================================================================

interface RetrievalOptions {
  maxResults: number;
  similarityThreshold: number;
  includeMetadata: boolean;
}

class ModelRetrieval {
  private index: Map<string, any> = new Map();

  async buildIndex(): Promise<void> {
    console.log('Building model retrieval index...');
  }

  async search(
    query: string,
    options: RetrievalOptions = { maxResults: 10, similarityThreshold: 0.7, includeMetadata: true }
  ): Promise<any[]> {
    const results: any[] = [];
    for (const [key, value] of this.index) {
      const sim = calculateSimilarity(query, key);
      if (sim >= options.similarityThreshold) {
        results.push({
          key,
          value,
          similarity: sim,
          metadata: options.includeMetadata ? null : undefined,
        });
      }
    }
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, options.maxResults);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateConfidence(outputData: Float32Array | Int32Array | Uint8Array): number {
  const values = Array.from(outputData);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const magnitude = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
  return Math.min(1, variance * magnitude);
}

function applySmoothing(vector: number[]): number[] {
  const smoothed = [...vector];
  const w = 2;
  for (let i = w; i < vector.length - w; i++) {
    const win = vector.slice(i - w, i + w + 1);
    smoothed[i] = win.reduce((s, v) => s + v, 0) / win.length;
  }
  return smoothed;
}

function applyCalibration(vector: number[]): number[] {
  return vector.map((v) => 1 / (1 + Math.exp(-5 * (v - 0.5))));
}

function getConstraintIndex(key: string): number {
  const m: Record<string, number> = {
    tempo: 0,
    brightness: 1,
    density: 2,
    arc: 3,
    motif: 4,
    cadence: 5,
  };
  return m[key] ?? -1;
}

function calculateSimilarity(q: string, k: string): number {
  const ql = q.toLowerCase();
  const kl = k.toLowerCase();
  if (ql === kl) return 1;
  if (kl.includes(ql)) return 0.8;
  if (ql.includes(kl)) return 0.6;
  const qc = new Set(ql);
  const kc = new Set(kl);
  const inter = new Set([...qc].filter((x) => kc.has(x)));
  const union = new Set([...qc, ...kc]);
  return inter.size / union.size;
}

export {
  ModelLoader,
  StudentV2Adapter,
  ModelRetrieval,
  MODEL_DIR,
  MODEL_JSON_FILE,
  MODEL_METADATA_FILE,
  MODEL_HTTP_URL,
  resolveModelDir,
};

export type { ModelAdapter, RefinementOptions, RetrievalOptions };
