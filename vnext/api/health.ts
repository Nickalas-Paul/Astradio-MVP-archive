/**
 * vnext/api/health.ts
 * ML health probe for startup and GET /api/ml-status.
 * Before: server had no health module, so validateModelRequirements was always the
 * in-server fallback { backend: 'noop', sha256: 'dev' } → startup log showed noop/dev.
 * This module runs one real inference so startup and ml-status show actual backend/sha.
 * When ML_REQUIRED=1, we throw if model load fails (no silent noop).
 */

import { studentVector, resolveModelDir, logMlPreflight } from '../ml';

const ZERO_FEAT = new Float32Array(64);

export interface ModelRequirements {
  backend: string;
  sha256: string;
  outShape: number[];
}

/**
 * Called at server startup. Runs one inference to get real backend + model_sha.
 * If ML_REQUIRED=1 and model load fails, throws (fail-fast). Otherwise returns noop/dev.
 */
export async function validateModelRequirements(): Promise<ModelRequirements> {
  logMlPreflight();
  try {
    const result = await studentVector(ZERO_FEAT as any);
    return {
      backend: result.tf_backend,
      sha256: result.model_sha,
      outShape: [6],
    };
  } catch (e: any) {
    if (process.env.ML_REQUIRED === '1') {
      const msg = e?.message ?? String(e);
      console.error('[ML] Model load failed (ML_REQUIRED=1):', e?.stack ?? msg);
      throw new Error(
        `ML_REQUIRED=1 but model load failed: ${msg}. ` +
        `Ensure models/student-v2.2/model.json (and group1-shard1of1.bin) exist, or set VNEXT_MODEL_PATH to a valid TFJS layers dir.`
      );
    }
    return { backend: 'noop', sha256: 'dev', outShape: [0] };
  }
}

export interface MLStatusPayload {
  tf_backend: string;
  model_sha: string;
  ml_used: boolean;
  inference_ms: number;
  model_path_hint: string;
}

/**
 * For GET /api/ml-status. One inference + resolved path hint.
 */
export async function getMLStatus(): Promise<MLStatusPayload> {
  try {
    const { dir, modelId } = resolveModelDir();
    const result = await studentVector(ZERO_FEAT as any);
    return {
      tf_backend: result.tf_backend,
      model_sha: result.model_sha,
      ml_used: true,
      inference_ms: result.inference_ms,
      model_path_hint: `${dir} (${modelId})`,
    };
  } catch (e: any) {
    const { dir, modelId } = resolveModelDir();
    return {
      tf_backend: 'unknown',
      model_sha: 'unknown',
      ml_used: false,
      inference_ms: 0,
      model_path_hint: `${dir} (${modelId}) - load failed: ${e?.message ?? e}`,
    };
  }
}
