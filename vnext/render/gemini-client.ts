/**
 * Vertex AI Gemini REST client (mirrors lyria-client auth pattern).
 * Model: gemini-2.5-flash via generateContent.
 */

export interface GeminiNarrateInput {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GeminiNarrateResult {
  text: string;
  model: string;
  latencyMs: number;
  cached: boolean;
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_ATTEMPTS = 3; // 1 initial + 2 retries on 5xx
const TIMEOUT_MS = 10_000;
/** Default output budget: thinking tokens share this cap on gemini-2.5-flash. */
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
/** Cap internal reasoning so visible output still has room inside the output budget. */
const THINKING_BUDGET = 1024;

async function getAccessToken(): Promise<string> {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN.trim();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    if (res.token) return res.token;
  } catch {
    // fallback to gcloud CLI
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { execSync } = require('child_process');
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

function buildUrl(projectId: string, location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callGeminiGenerate(input: GeminiNarrateInput): Promise<GeminiNarrateResult> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for Gemini');
  }

  const maxTokens = input.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const temperature = input.temperature ?? 0.8;
  const url = buildUrl(projectId, location);
  const token = await getAccessToken();
  // thinkingConfig lives inside generationConfig per Vertex / Gemini REST docs.
  const body = {
    contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
    },
  };

  const started = Date.now();
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
        TIMEOUT_MS
      );

      if (!res.ok) {
        const status = res.status;
        const text = await res.text().catch(() => '');
        const err = new Error(`Gemini API error: ${status}`) as Error & {
          statusCode?: number;
          code?: string;
        };
        err.statusCode = status;
        err.code = 'GEMINI_API_ERROR';
        if (status >= 500 && attempt < MAX_ATTEMPTS) {
          console.warn(`[GEMINI_RETRY] ${status} attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
          lastErr = err;
          continue;
        }
        // no retry on 4xx
        throw err;
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          finishReason?: string;
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini response truncated (MAX_TOKENS)');
      }
      if (finishReason !== undefined && finishReason !== 'STOP') {
        console.warn(`[GEMINI] unexpected finishReason=${finishReason}`);
        throw new Error(`Gemini response rejected (finishReason=${finishReason})`);
      }

      const text = candidate?.content?.parts?.[0]?.text?.trim() || '';
      if (!text) {
        throw new Error('Gemini response missing text');
      }

      return {
        text,
        model: GEMINI_MODEL,
        latencyMs: Date.now() - started,
        cached: false,
      };
    } catch (e) {
      const err = e as Error & { statusCode?: number; name?: string };
      const isTimeout = err.name === 'AbortError';
      const is5xx = typeof err.statusCode === 'number' && err.statusCode >= 500;
      if ((isTimeout || is5xx) && attempt < MAX_ATTEMPTS) {
        console.warn(`[GEMINI_RETRY] ${isTimeout ? 'timeout' : err.statusCode} attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
        lastErr = err;
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('Gemini generate exhausted retries');
}

/** Test helpers (exported for validation). */
export const __geminiTest = {
  buildUrl,
  GEMINI_MODEL,
  TIMEOUT_MS,
  MAX_ATTEMPTS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  THINKING_BUDGET,
};
