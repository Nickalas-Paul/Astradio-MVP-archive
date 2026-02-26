/**
 * Vertex AI Lyria client: prompt + seed → 30s WAV (base64).
 * Endpoint: POST .../publishers/google/models/lyria-002:predict
 */

const LYRIA_MODEL = 'lyria-002';

export interface LyriaPredictInput {
  prompt: string;
  seed: number;
  negative_prompt?: string;
}

export interface LyriaPredictResult {
  wavBuffer: Buffer;
  sha256: string;
  size_bytes: number;
  model?: string;
  requestId?: string;
}

export async function callLyriaPredict(input: LyriaPredictInput): Promise<LyriaPredictResult> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for Lyria');
  }
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${LYRIA_MODEL}:predict`;

  const instance: Record<string, unknown> = {
    prompt: input.prompt,
    seed: input.seed,
  };
  if (input.negative_prompt != null && input.negative_prompt !== '') {
    instance.negative_prompt = input.negative_prompt;
  } else {
    instance.negative_prompt = 'vocals';
  }
  // Lyria outputs 30s per clip. Using seed yields 1 sample (sample_count cannot be used with seed).
  const body = {
    instances: [instance],
    parameters: {},
  };

  // Phase 3 observability: log top-level request keys (no bodies or secrets)
  try {
    const instanceKeys = Array.isArray(body.instances) && body.instances[0] ? Object.keys(body.instances[0]) : [];
    console.log(
      '[LYRIA_REQUEST_KEYS]',
      JSON.stringify({
        body_keys: Object.keys(body),
        instance_keys: instanceKeys,
      })
    );
    // Phase 3.1: duration contract — Lyria returns ~30–33s per clip (fixed by API, no duration param)
    console.log('[LYRIA_PARAMS]', JSON.stringify({ duration_expected_s: 30, candidates: 1 }));
  } catch {
    // best-effort only
  }

  const token = await getAccessToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const status = res.status;

    // Phase 3 observability: sanitized error body for diagnostics (no tokens, no request bodies)
    let meta: {
      status: number;
      error_message?: string;
      error_status?: string;
      error_details?: unknown;
    } = { status };
    try {
      const parsed = JSON.parse(text);
      const errObj = (parsed as any).error || parsed;
      if (typeof errObj.message === 'string') {
        meta.error_message = errObj.message.slice(0, 400);
      }
      if (typeof errObj.status === 'string') {
        meta.error_status = errObj.status;
      }
      if (errObj.details !== undefined) {
        meta.error_details = errObj.details;
      }
    } catch {
      // leave meta as-is; raw text may contain sensitive info so we don't log it
    }
    if (status === 400) {
      console.warn('[LYRIA_400]', JSON.stringify(meta));
    } else {
      console.warn('[LYRIA_ERROR]', JSON.stringify(meta));
    }

    let err: Error & { code?: string; statusCode?: number } = new Error(`Lyria API error: ${status}`);
    err.code = 'LYRIA_API_ERROR';
    err.statusCode = status;
    throw err;
  }

  const data = (await res.json()) as Record<string, unknown>;
  const pred = Array.isArray(data.predictions) ? data.predictions[0] : undefined;
  const predObj = pred && typeof pred === 'object' ? (pred as Record<string, unknown>) : undefined;

  // Extract base64 audio from whichever field is present (priority order)
  let base64Audio: string | undefined;
  if (predObj) {
    if (typeof predObj.audioContent === 'string') base64Audio = predObj.audioContent;
    else if (typeof predObj.bytesBase64Encoded === 'string') base64Audio = predObj.bytesBase64Encoded;
    else if (typeof predObj.audio === 'string') base64Audio = predObj.audio;
  }

  if (!base64Audio) {
    // Safe response-shape logging (no payload, no base64, no credentials)
    const topKeys = Object.keys(data);
    const predKeys = predObj ? Object.keys(predObj) : [];
    const errInfo: Record<string, unknown> = {
      response_top_keys: topKeys,
      predictions_0_keys: predKeys,
    };
    const errField = data.error as Record<string, unknown> | undefined;
    if (errField && typeof errField === 'object') {
      errInfo.error_status = errField.status;
      const msg = typeof errField.message === 'string' ? errField.message : String(errField.message ?? '');
      errInfo.error_message = msg.slice(0, 300);
    }
    console.warn('[LYRIA_RESPONSE_SHAPE]', JSON.stringify(errInfo));
    throw new Error(`Lyria response missing audio field. prediction keys: [${predKeys.join(', ')}]`);
  }

  // No post-processing: Lyria output is used as-is (no concatenation, padding, or re-encode)
  const wavBuffer = Buffer.from(base64Audio, 'base64');
  const crypto = require('crypto') as typeof import('crypto');
  const sha256 = crypto.createHash('sha256').update(wavBuffer).digest('hex');
  return {
    wavBuffer,
    sha256,
    size_bytes: wavBuffer.length,
    model: (data.model as string) || LYRIA_MODEL,
    requestId: data.deployedModelId as string | undefined,
  };
}

async function getAccessToken(): Promise<string> {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN.trim();
  try {
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    if (res.token) return res.token;
  } catch {
    // fallback to gcloud CLI
  }
  const { execSync } = require('child_process');
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}
