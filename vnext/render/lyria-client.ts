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

  const data = (await res.json()) as {
    predictions?: Array<{ audioContent?: string; mimeType?: string }>;
    model?: string;
    deployedModelId?: string;
  };
  const pred = data.predictions?.[0];
  if (!pred?.audioContent) {
    throw new Error('Lyria response missing predictions[0].audioContent');
  }
  const wavBuffer = Buffer.from(pred.audioContent, 'base64');
  const crypto = require('crypto') as typeof import('crypto');
  const sha256 = crypto.createHash('sha256').update(wavBuffer).digest('hex');
  return {
    wavBuffer,
    sha256,
    size_bytes: wavBuffer.length,
    model: data.model || LYRIA_MODEL,
    requestId: data.deployedModelId,
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
