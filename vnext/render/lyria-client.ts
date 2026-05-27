/**
 * Vertex AI Lyria client: prompt + seed → 30s WAV (base64).
 * Endpoint: POST .../publishers/google/models/lyria-002:predict
 */

const LYRIA_MODEL = 'lyria-002';

/** Known Vertex / Lyria prediction fields that may carry base64 WAV. */
const KNOWN_AUDIO_FIELD_ORDER = ['audioContent', 'bytesBase64Encoded', 'audio'] as const;

function isRiffWavePrefix(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45
  );
}

function riffDeclaredEnd(buf: Buffer): number | null {
  if (buf.length < 8) return null;
  const riffSize = buf.readUInt32LE(4);
  return 8 + riffSize;
}

/** Matches compose Lyria export gate (do not widen policy here). */
const LYRIA_EXPORT_DURATION_MIN_S = 27;
const LYRIA_EXPORT_DURATION_MAX_S = 40;

const MAX_CHUNK_BODY_BYTES = 256 * 1024 * 1024;
const MAX_CHUNKS = 64;

type FmtInfo = {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};

type WavLayoutScan =
  | {
      ok: true;
      fmt: FmtInfo;
      dataHeaderOffset: number;
      declaredDataSize: number;
      actualPcmBytes: number;
      declaredRiffPayloadSize: number;
    }
  | { ok: false; reason: string };

/**
 * Scan RIFF/WAVE for fmt + data; tolerate declared sizes past EOF (provider stale headers).
 * Assumes PCM in `data` runs to end of buffer (data is last relevant chunk for Lyria output).
 */
function scanWavLayoutForNormalize(buf: Buffer): WavLayoutScan {
  if (!isRiffWavePrefix(buf) || buf.length < 12) {
    return { ok: false, reason: 'not_riff_wave' };
  }

  const declaredRiffPayloadSize = buf.readUInt32LE(4);
  let fmt: FmtInfo | null = null;
  let dataHeaderOffset = -1;
  let declaredDataSize = 0;

  let i = 12;
  let chunkIndex = 0;

  while (i + 8 <= buf.length && chunkIndex < MAX_CHUNKS) {
    const chunkId = buf.toString('ascii', i, i + 4);
    const chunkSize = buf.readUInt32LE(i + 4);
    if (chunkSize > MAX_CHUNK_BODY_BYTES) {
      return { ok: false, reason: 'chunk_size_implausible' };
    }
    const bodyStart = i + 8;

    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || bodyStart + 16 > buf.length) {
        return { ok: false, reason: 'fmt_missing_or_truncated' };
      }
      fmt = {
        audioFormat: buf.readUInt16LE(bodyStart),
        numChannels: buf.readUInt16LE(bodyStart + 2),
        sampleRate: buf.readUInt32LE(bodyStart + 4),
        byteRate: buf.readUInt32LE(bodyStart + 8),
        blockAlign: buf.readUInt16LE(bodyStart + 12),
        bitsPerSample: buf.readUInt16LE(bodyStart + 14),
      };
    } else if (chunkId === 'data') {
      dataHeaderOffset = i;
      declaredDataSize = chunkSize;
      break;
    }

    const bodyEnd = bodyStart + chunkSize;
    if (bodyEnd > buf.length) {
      return { ok: false, reason: 'truncated_before_data' };
    }
    i = bodyEnd + (chunkSize % 2);
    chunkIndex++;
  }

  if (chunkIndex >= MAX_CHUNKS) {
    return { ok: false, reason: 'too_many_chunks' };
  }
  if (!fmt) {
    return { ok: false, reason: 'missing_fmt' };
  }
  if (dataHeaderOffset < 0) {
    return { ok: false, reason: 'missing_data' };
  }

  const pcmStart = dataHeaderOffset + 8;
  if (pcmStart > buf.length) {
    return { ok: false, reason: 'data_header_past_eof' };
  }
  const actualPcmBytes = buf.length - pcmStart;

  return {
    ok: true,
    fmt,
    dataHeaderOffset,
    declaredDataSize,
    actualPcmBytes,
    declaredRiffPayloadSize,
  };
}

/** Loose sanity only; duration contract and frame alignment are enforced separately. */
function fmtLooksLikeSanePcm(f: FmtInfo): boolean {
  if (f.audioFormat !== 1) return false;
  if (f.sampleRate < 8000 || f.sampleRate > 192000) return false;
  if (f.blockAlign < 1 || f.blockAlign > 8192) return false;
  const br = effectiveByteRate(f);
  return br > 0 && Number.isFinite(br);
}

function effectiveByteRate(f: FmtInfo): number {
  if (f.byteRate > 0 && Number.isFinite(f.byteRate)) return f.byteRate;
  return f.sampleRate * f.blockAlign;
}

/**
 * If provider WAV has valid fmt/data/PCM but stale RIFF or data chunk sizes, patch header to match actual bytes.
 * Returns a new Buffer when repaired; otherwise null (caller keeps original and may fail elsewhere).
 */
function normalizeProviderWavHeaderSizes(buf: Buffer): Buffer | null {
  const scan = scanWavLayoutForNormalize(buf);
  if (!scan.ok) {
    return null;
  }

  const { fmt, dataHeaderOffset, declaredDataSize, actualPcmBytes, declaredRiffPayloadSize } = scan;

  if (!fmtLooksLikeSanePcm(fmt)) {
    return null;
  }

  const br = effectiveByteRate(fmt);
  if (actualPcmBytes <= 0 || actualPcmBytes % fmt.blockAlign !== 0) {
    return null;
  }

  const durationSec = actualPcmBytes / br;
  if (!Number.isFinite(durationSec) || durationSec < LYRIA_EXPORT_DURATION_MIN_S || durationSec > LYRIA_EXPORT_DURATION_MAX_S) {
    return null;
  }

  const correctRiffPayload = buf.length - 8;
  const riffOverstated = declaredRiffPayloadSize !== correctRiffPayload;
  const dataOverstated = declaredDataSize > actualPcmBytes;

  if (!riffOverstated && !dataOverstated) {
    return null;
  }

  if (declaredDataSize < actualPcmBytes) {
    return null;
  }

  const out = Buffer.from(buf);
  out.writeUInt32LE(correctRiffPayload, 4);
  out.writeUInt32LE(actualPcmBytes, dataHeaderOffset + 4);

  try {
    console.log(
      '[LYRIA_WAV_HEADER_NORMALIZED]',
      JSON.stringify({
        file_length: out.length,
        riff_payload_was: declaredRiffPayloadSize,
        riff_payload_now: correctRiffPayload,
        data_declared_was: declaredDataSize,
        data_declared_now: actualPcmBytes,
        duration_s_approx: Math.round(durationSec * 1000) / 1000,
        byte_rate: br,
      })
    );
  } catch {
    // best-effort only
  }

  return out;
}

type CandidateMetric = {
  path: string;
  base64Length: number;
  decodedLength: number;
  expectedDecodedApprox: number;
  riffOk: boolean;
  riffExpectedEnd: number | null;
};

function collectStringCandidates(pred: Record<string, unknown>): { path: string; value: string }[] {
  const seen = new Set<string>();
  const out: { path: string; value: string }[] = [];

  const push = (path: string, value: string) => {
    if (!value || seen.has(path)) return;
    seen.add(path);
    out.push({ path, value });
  };

  for (const k of KNOWN_AUDIO_FIELD_ORDER) {
    const v = pred[k];
    if (typeof v === 'string' && v.length > 0) push(k, v);
  }

  for (const [k, v] of Object.entries(pred)) {
    if ((KNOWN_AUDIO_FIELD_ORDER as readonly string[]).includes(k)) continue;
    if (typeof v === 'string' && v.length >= 1000) push(k, v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (typeof v2 === 'string' && v2.length >= 1000) push(`${k}.${k2}`, v2);
      }
    }
  }

  return out;
}

function scoreCandidate(path: string, base64: string): CandidateMetric {
  const buf = Buffer.from(base64, 'base64');
  const decodedLength = buf.length;
  const expectedDecodedApprox = Math.floor(base64.length * (3 / 4));
  const riffOk = isRiffWavePrefix(buf);
  const riffExpectedEnd = riffOk ? riffDeclaredEnd(buf) : null;
  return {
    path,
    base64Length: base64.length,
    decodedLength,
    expectedDecodedApprox,
    riffOk,
    riffExpectedEnd,
  };
}

function pickBestAudioCandidate(metrics: CandidateMetric[]): CandidateMetric | null {
  const wav = metrics.filter((m) => m.riffOk);
  if (wav.length === 0) return null;

  const priorityRank = (path: string): number => {
    const idx = (KNOWN_AUDIO_FIELD_ORDER as readonly string[]).indexOf(path.split('.')[0] || path);
    return idx === -1 ? 999 : idx;
  };

  wav.sort((a, b) => {
    // Prefer complete payload (decoded covers RIFF-declared size), then longest decode, then known field order.
    const aComplete = a.riffExpectedEnd != null && a.decodedLength >= a.riffExpectedEnd ? 1 : 0;
    const bComplete = b.riffExpectedEnd != null && b.decodedLength >= b.riffExpectedEnd ? 1 : 0;
    if (aComplete !== bComplete) return bComplete - aComplete;
    if (b.decodedLength !== a.decodedLength) return b.decodedLength - a.decodedLength;
    return priorityRank(a.path) - priorityRank(b.path);
  });

  return wav[0] ?? null;
}

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

    const recitationBlocked =
      status === 400 &&
      typeof meta.error_message === 'string' &&
      meta.error_message.toLowerCase().includes('recitation');
    let err: Error & { code?: string; statusCode?: number; reason?: string } = new Error(
      recitationBlocked && meta.error_message
        ? meta.error_message.slice(0, 400)
        : `Lyria API error: ${status}`
    );
    err.code = recitationBlocked ? 'LYRIA_RECITATION_BLOCKED' : 'LYRIA_API_ERROR';
    err.statusCode = status;
    if (recitationBlocked) err.reason = 'recitation';
    throw err;
  }

  const http_status = res.status;
  const content_length_header = res.headers.get('content-length');
  const transfer_encoding = res.headers.get('transfer-encoding');
  const rawText = await res.text();
  const raw_text_length = rawText.length;
  const raw_byte_length = Buffer.byteLength(rawText, 'utf8');
  const data = JSON.parse(rawText) as Record<string, unknown>;

  const predictions = Array.isArray(data.predictions) ? data.predictions : [];
  const predictions_count = predictions.length;
  const pred = predictions[0];
  const predObj = pred && typeof pred === 'object' ? (pred as Record<string, unknown>) : undefined;

  const predKeys = predObj ? Object.keys(predObj) : [];

  // Length-only audit of every string field on predictions[0] (and long nested strings); no base64 in logs.
  const candidate_lengths: Record<string, number | null> = {};
  if (predObj) {
    for (const [k, v] of Object.entries(predObj)) {
      if (typeof v === 'string') candidate_lengths[k] = v.length;
      else candidate_lengths[k] = null;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
          const pk = `${k}.${k2}`;
          if (typeof v2 === 'string') candidate_lengths[pk] = v2.length;
          else candidate_lengths[pk] = null;
        }
      }
    }
  }

  const candidates = predObj ? collectStringCandidates(predObj) : [];
  const metrics: CandidateMetric[] = [];
  for (const { path, value } of candidates) {
    const m = scoreCandidate(path, value);
    if (m) metrics.push(m);
  }

  const best = pickBestAudioCandidate(metrics);

  let base64Audio: string | undefined;
  let selected_field: string | undefined;

  if (best && predObj) {
    const chosen = candidates.find((c) => c.path === best.path);
    if (chosen) {
      base64Audio = chosen.value;
      selected_field = best.path;
    }
  }

  // Fallback: legacy priority if nothing decodes as RIFF/WAVE (same keys as before)
  if (!base64Audio && predObj) {
    if (typeof predObj.audioContent === 'string') {
      base64Audio = predObj.audioContent;
      selected_field = 'audioContent';
    } else if (typeof predObj.bytesBase64Encoded === 'string') {
      base64Audio = predObj.bytesBase64Encoded;
      selected_field = 'bytesBase64Encoded';
    } else if (typeof predObj.audio === 'string') {
      base64Audio = predObj.audio;
      selected_field = 'audio';
    }
  }

  try {
    console.log(
      '[LYRIA_FIELD_AUDIT]',
      JSON.stringify({
        keys: predKeys,
        candidate_lengths,
        candidate_metrics: metrics.map((m) => ({
          path: m.path,
          base64Length: m.base64Length,
          decodedLength: m.decodedLength,
          expectedDecodedApprox: m.expectedDecodedApprox,
          riffOk: m.riffOk,
          riffExpectedEnd: m.riffExpectedEnd,
          complete: m.riffExpectedEnd != null && m.decodedLength >= m.riffExpectedEnd,
        })),
        selected_field: selected_field ?? null,
      })
    );
  } catch {
    // best-effort only
  }

  if (!base64Audio) {
    // Safe response-shape logging (no payload, no base64, no credentials)
    const topKeys = Object.keys(data);
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

  // Base64 decode; optional provider-boundary repair of stale RIFF/data chunk sizes (no re-encode).
  let wavBuffer: Buffer = Buffer.from(base64Audio, 'base64');
  const normalized = normalizeProviderWavHeaderSizes(wavBuffer);
  if (normalized) {
    // Avoid TS2322 Buffer<ArrayBufferLike> vs Buffer<ArrayBuffer> under strict @types/node generics.
    wavBuffer = normalized as Buffer;
  }

  const decoded_length = wavBuffer.length;
  const expected_decoded_length = Math.floor(base64Audio.length * (3 / 4));
  let riff_size_field: number | null = null;
  let riff_expected_end: number | null = null;
  if (wavBuffer.length >= 8) {
    riff_size_field = wavBuffer.readUInt32LE(4);
    riff_expected_end = 8 + riff_size_field;
  }
  const buffer_length = decoded_length;

  if (
    isRiffWavePrefix(wavBuffer) &&
    riff_expected_end != null &&
    buffer_length < riff_expected_end
  ) {
    const truncErr = new Error(
      `Lyria WAV payload truncated: buffer_length=${buffer_length} riff_expected_end=${riff_expected_end} field=${selected_field ?? '?'}`
    ) as Error & {
      code?: string;
      reason?: string;
      lyria_truncation?: { buffer_length: number; riff_expected_end: number; selected_field: string | undefined };
    };
    truncErr.code = 'INCOMPLETE_WAV_PAYLOAD';
    truncErr.reason = 'provider_payload_truncated';
    truncErr.lyria_truncation = {
      buffer_length,
      riff_expected_end,
      selected_field,
    };
    throw truncErr;
  }

  console.log('[LYRIA_RESPONSE_DIAGNOSTICS]', {
    http_status,
    content_length_header,
    transfer_encoding,
    raw_text_length,
    raw_byte_length,
    predictions_count,
    selected_field,
    base64_typeof: typeof base64Audio,
    base64_length: base64Audio.length,
    decoded_length,
    expected_decoded_length,
    riff_size_field,
    riff_expected_end,
    buffer_length,
  });

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
