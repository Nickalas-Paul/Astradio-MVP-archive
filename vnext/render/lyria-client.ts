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

  const body = {
    instances: [
      {
        prompt: input.prompt,
        negative_prompt: input.negative_prompt || 'vocals, spoken word',
        seed: input.seed,
      },
    ],
    parameters: {},
  };

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
    // Sanitized: do not include response body (may contain tokens). Log status only.
    let err: Error & { code?: string; statusCode?: number } = new Error(`Lyria API error: ${res.status}`);
    err.code = 'LYRIA_API_ERROR';
    err.statusCode = res.status;
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
