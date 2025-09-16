// vnext/ml/student.ts
import path from "path";
import fs from "fs";
import type { FeatureVec, Plan, EventToken } from "../contracts";

// Prefer native Node backend for reliable model loading
let tf: typeof import("@tensorflow/tfjs");
let backend: "node" | "http" = "node";
let model: import("@tensorflow/tfjs").LayersModel | null = null;

// Resolve model dir once (repo-root/models/student-v1/)
const MODEL_DIR = path.resolve(process.cwd(), "models", "student-v1");
const MODEL_JSON_FILE = path.join(MODEL_DIR, "model.json");
const MODEL_METADATA_FILE = path.join(MODEL_DIR, "metadata.json");
const MODEL_HTTP_URL = "http://localhost:3000/models/student-v1/model.json"; // if you later serve via Express static

async function ensureTF() {
  if (!tf) {
    try {
      // Use tfjs-node for file:// loading
      tf = await import("@tensorflow/tfjs-node");
      await tf.setBackend("tensorflow");
      backend = "node";
      console.log("🧠 Using TensorFlow.js Node backend");
    } catch {
      // Fallback to browser/http backend (served model)
      tf = await import("@tensorflow/tfjs");
      backend = "http";
      console.log("🌐 Using TensorFlow.js browser backend (HTTP)");
    }
    await tf.ready();
  }
}

async function loadModel(): Promise<import("@tensorflow/tfjs").LayersModel> {
  await ensureTF();
  if (model) return model;

  // Load and verify model metadata
  let metadata: any = null;
  if (fs.existsSync(MODEL_METADATA_FILE)) {
    metadata = JSON.parse(fs.readFileSync(MODEL_METADATA_FILE, 'utf8'));
    console.log(`📋 Model metadata: v${metadata.version}, trained ${metadata.trainingDate}`);
    console.log(`🎯 Expected output shape: [${metadata.outputShape.join(', ')}]`);
  }

  if (backend === "node") {
    if (!fs.existsSync(MODEL_JSON_FILE)) {
      throw new Error(`Model not found at ${MODEL_JSON_FILE}. Expected models/student-v1/model.json`);
    }
    const url = `file://${MODEL_JSON_FILE.replace(/\\/g, "/")}`;
    console.log(`📂 Loading model from: ${url}`);
    model = await tf.loadLayersModel(url);
    } else {
      // Production kill-switch: disable HTTP backend in strict mode
      if (process.env.ALLOW_HTTP_MODEL === "false" || process.env.STRICT_ML === "true") {
        throw new Error("HTTP model backend disabled in STRICT_ML");
      }
      
      // Requires: app.use("/models", express.static(path.join(process.cwd(), "models")));
      console.log(`🌐 Loading model from HTTP: ${MODEL_HTTP_URL}`);
      model = await tf.loadLayersModel(MODEL_HTTP_URL);
    }
    
    // Verify model output shape
    const outputShape = model.outputs[0].shape;
    console.log(`✅ Model loaded successfully`);
    console.log(`📊 Model input shape: [${model.inputs[0].shape.join(', ')}]`);
    console.log(`📊 Model output shape: [${outputShape.join(', ')}]`);
    
    // Verify output shape matches expected 6D control vector
    if (outputShape[1] !== 6) {
      console.warn(`⚠️ Warning: Model output shape [${outputShape.join(', ')}] does not match expected [1, 6]`);
    }
    
    return model!;
}

// --- Raw vector generation ---
export async function studentVector(feat: FeatureVec): Promise<number[]> {
  try {
    const m = await loadModel();
    const input = (tf.tensor2d([Array.from(feat)], [1, 64]) as any);
    const out = m.predict(input) as any; // model outputs [1, 6] control vector
    const rawVec = Array.from(await out.data()) as number[];
    
    // Use the 6D control vector directly
    const vec: [number, number, number, number, number, number] = [
      (rawVec[0] ?? 0.5),
      (rawVec[1] ?? 0.5),
      (rawVec[2] ?? 0.5),
      (rawVec[3] ?? 0.5),
      (rawVec[4] ?? 0.5),
      (rawVec[5] ?? 0.5)
    ];
    input.dispose?.(); out.dispose?.();

    console.log(`🎯 Student model prediction: [${vec.map(v => v.toFixed(3)).join(', ')}]`);
    return vec;
  } catch (e: any) {
    console.warn(`⚠️ Student model failed: ${e.message}`);
    throw e; // Don't fallback for raw vector generation
  }
}

// --- Inference API (keep shape identical) ---
export async function generateWithStudent(feat: FeatureVec): Promise<Plan> {
  try {
    console.log(`🧠 Loading ML model for inference...`);
    const m = await loadModel();
    console.log(`✅ Model loaded, running inference...`);
    
    const input = (tf.tensor2d([Array.from(feat)], [1, 64]) as any);
    const out = m.predict(input) as any; // v1: [1,6] ; v2: [ctrl, arc, density, cadence, motif]
    let ctrl: number[] = [];
    if (Array.isArray(out)) {
      console.log(`📊 Multi-head model detected, extracting ctrl head`);
      const [oCtrl] = out as any[];
      ctrl = Array.from(await oCtrl.data());
      (out as any[]).forEach(t=>t.dispose?.());
    } else {
      console.log(`📊 Single-head model detected`);
      const raw = Array.from(await out.data()) as number[];
      ctrl = raw;
      (out as any).dispose?.();
    }
    
    // Use the 6D control vector directly
    const vec: [number, number, number, number, number, number] = [
      (ctrl[0] ?? 0.5),
      (ctrl[1] ?? 0.5),
      (ctrl[2] ?? 0.5),
      (ctrl[3] ?? 0.5),
      (ctrl[4] ?? 0.5),
      (ctrl[5] ?? 0.5)
    ];
    input.dispose?.();

    console.log(`🎯 Student model prediction: [${vec.map(v => v.toFixed(3)).join(', ')}]`);
    console.log(`📊 Using vectorToPlan with source: student`);
    return vectorToPlan(vec, "student");
  } catch (e: any) {
    console.warn(`⚠️ Student model failed: ${e.message}`);
    console.log(`🔄 Falling back to deterministic plan`);
    
    // Production kill-switch: disable fallback in strict mode
    if (process.env.STRICT_ML === "true" || process.env.ALLOW_STUDENT_FALLBACK === "false") {
      throw new Error("Student fallback disabled by STRICT_ML/ALLOW_STUDENT_FALLBACK");
    }
    
    // Dev-only deterministic guard: deterministic generator (not rules). Audit should mark source="student-fallback".
    return deterministicPlan(feat, "student-fallback");
  }
}

// --- Helpers (same as your previous stub, kept deterministic) ---
export function vectorToPlan(v: [number, number, number, number, number, number], source: string): Plan {
  const durationSec = +(process.env.VNEXT_DURATION_SEC || 60);
  const bpm = Math.round(80 + v[0] * 60);
  const key = "A minor";
  const events: EventToken[] = [];
  const step = durationSec / 128;
  
  // Use control vector to create more interesting patterns
  const melodyWeight = v[4]; // melody control
  const harmonyWeight = v[3]; // harmony control
  const rhythmWeight = v[2]; // rhythm control
  const density = v[1]; // key control as density
  
  for (let i = 0; i < 128; i++) {
    const t0 = i * step;
    const t1 = t0 + step * 0.9;
    
    // Melody: create arc pattern with some variation
    if (melodyWeight > 0.3) {
      const phrase = Math.floor(i / 32); // 4 phrases of 32 steps each
      const phrasePos = (i % 32) / 32; // position within phrase
      const basePitch = 60 + phrase * 2; // slight rise per phrase
      const arc = Math.sin(phrasePos * Math.PI) * 4; // arc within phrase
      const variation = Math.sin(i * 0.3) * 2; // subtle variation
      const pitch = Math.round(basePitch + arc + variation);
      
      events.push({ 
        t0, 
        t1, 
        pitch: Math.max(48, Math.min(84, pitch)), 
        velocity: 0.6 + melodyWeight * 0.2, 
        channel: "melody" 
      });
    }
    
    // Harmony: chord tones based on harmony weight
    if (harmonyWeight > 0.4 && i % 4 === 0) {
      const chordRoot = 60 + Math.floor(i / 16) % 3; // simple progression
      events.push({ 
        t0, 
        t1, 
        pitch: chordRoot, 
        velocity: 0.5 + harmonyWeight * 0.2, 
        channel: "harmony" 
      });
      events.push({ 
        t0, 
        t1, 
        pitch: chordRoot + 4, 
        velocity: 0.4 + harmonyWeight * 0.2, 
        channel: "harmony" 
      });
    }
    
    // Bass: walking pattern
    if (i % 2 === 0) {
      const bassPitch = 36 + (i % 8) + Math.floor(i / 16) * 2;
      events.push({ 
        t0, 
        t1, 
        pitch: bassPitch, 
        velocity: 0.55, 
        channel: "bass" 
      });
    }
    
    // Rhythm: accent pattern
    if (rhythmWeight > 0.3 && i % 4 === 0) {
      events.push({ 
        t0, 
        t1, 
        pitch: 42, 
        velocity: 0.4 + rhythmWeight * 0.3, 
        channel: "rhythm" 
      });
    }
  }
  
  console.log(`🎵 Generated plan with ${events.length} events, melody_weight=${melodyWeight.toFixed(2)}, harmony_weight=${harmonyWeight.toFixed(2)}`);
  
  return { 
    id: `plan_${Date.now()}`, 
    featureHash: `${v[0].toFixed(4)}:${v[1].toFixed(4)}`, 
    durationSec, 
    bpm, 
    key, 
    events 
  };
}

function deterministicPlan(_feat: FeatureVec, source: string): Plan {
  console.log(`🔄 Using deterministic fallback (${source})`);
  return vectorToPlan([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], source);
}

/**
 * Get model metadata
 */
export function getModelMetadata(): any {
  return {
    backend,
    modelDir: MODEL_DIR,
    hasModel: fs.existsSync(MODEL_JSON_FILE)
  };
}