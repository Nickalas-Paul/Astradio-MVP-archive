// vnext/api/health.ts - Model health check for startup validation
import crypto from "crypto";
import path from "path";
import fs from "fs";

let tf: any, model: any;

export async function loadModelOnce() {
  try {
    // Try tfjs-node first (preferred for production)
    tf = tf ?? (await import("@tensorflow/tfjs-node"));
    await tf.setBackend("tensorflow");
    await tf.ready();
    
    const modelPath = path.resolve(process.cwd(), "models", "student-v1", "model.json");
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model not found at ${modelPath}`);
    }
    
    // Calculate SHA256 checksum
    const raw = fs.readFileSync(modelPath);
    const sha = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
    
    // Load model to validate structure
    const url = `file://${modelPath.replace(/\\/g, "/")}`;
    model = model ?? await tf.loadLayersModel(url);
    
    // Get output shape
    const outShape = model.outputs?.[0]?.shape ?? [];
    
    return { 
      backend: tf.getBackend(), 
      sha256: sha, 
      outShape: outShape,
      modelPath: modelPath
    };
    
  } catch (error: any) {
    throw new Error(`Model health check failed: ${error.message}`);
  }
}

export async function validateModelRequirements() {
  const info = await loadModelOnce();
  
  // Validate backend
  if (process.env.STRICT_ML === "true" && info.backend !== "tensorflow") {
    throw new Error("STRICT_ML requires tfjs-node backend");
  }
  
  // Validate output shape (should be 6D for control vector)
  if (info.outShape.length > 0 && info.outShape[info.outShape.length - 1] !== 6) {
    console.warn(`⚠️ Expected 6D output, got: [${info.outShape.join(', ')}]`);
  }
  
  return info;
}
