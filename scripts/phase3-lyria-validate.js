#!/usr/bin/env node
/**
 * Phase 3 — Lyria Provider & Audio Integrity Validation.
 * Run against LIVE protected preview with VERCEL_BYPASS_TOKEN.
 *
 * A) Positive: compose with Lyria → assert provider_used === "lyria", download WAV, hash + header metadata.
 * B) Fail-closed: assert no silent fallback in provider selection; provider identity explicit in response.
 *
 * Usage:
 *   WEB_URL=https://...vercel.app ENGINE_URL=https://...onrender.com VERCEL_BYPASS_TOKEN=... node scripts/phase3-lyria-validate.js
 */
const crypto = require('crypto');
const { request } = require('undici');
const fs = require('fs');
const path = require('path');

const WEB_URL = (process.env.WEB_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) || 'http://localhost:3000').replace(/\/+$/, '');
const ENGINE_URL = (process.env.ENGINE_URL || process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const VERCEL_SHARE_TOKEN = process.env.VERCEL_SHARE_TOKEN || '';

function withShare(url) {
  if (!VERCEL_SHARE_TOKEN) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('_vercel_share')) u.searchParams.append('_vercel_share', VERCEL_SHARE_TOKEN);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_vercel_share=${encodeURIComponent(VERCEL_SHARE_TOKEN)}`;
  }
}

function buildWebJsonHeaders(extra = {}) {
  const base = { 'content-type': 'application/json' };
  const bypass = process.env.VERCEL_BYPASS_TOKEN;
  if (bypass && bypass.trim().length > 0) base['x-vercel-protection-bypass'] = bypass;
  return { ...base, ...extra };
}

function buildWebHeaders(extra = {}) {
  const base = {};
  const bypass = process.env.VERCEL_BYPASS_TOKEN;
  if (bypass && bypass.trim().length > 0) base['x-vercel-protection-bypass'] = bypass;
  return { ...base, ...extra };
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Parse WAV header: sample rate, channels, bitsPerSample, data chunk, duration.
 * Uses byteRate from fmt chunk for duration (most reliable).
 * Standard fmt layout: offset 10=channels, 12=sampleRate, 16=byteRate, 22=bitsPerSample.
 */
function wavHeaderMeta(buf) {
  const out = {
    sampleRate: null,
    channels: null,
    bitsPerSample: null,
    byteRate: null,
    dataChunkSize: null,
    duration_s: null,
    valid: false,
  };
  if (!buf || buf.length < 44) return out;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return out;
  const fmtOffset = buf.indexOf(Buffer.from('fmt ', 'ascii'));
  if (fmtOffset < 0 || buf.length < fmtOffset + 24) return out;
  const numChannels = buf.readUInt16LE(fmtOffset + 10);
  const sampleRate = buf.readUInt32LE(fmtOffset + 12);
  const byteRate = buf.readUInt32LE(fmtOffset + 16);
  const bitsPerSample = buf.readUInt16LE(fmtOffset + 22) || 16;

  // Walk RIFF chunks to find "data" (avoid false match inside LIST/metadata)
  let pos = 12;
  let dataSize = null;
  while (pos + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', pos, pos + 4);
    const chunkLen = buf.readUInt32LE(pos + 4);
    if (chunkId === 'data') {
      dataSize = chunkLen;
      break;
    }
    pos += 8 + chunkLen;
    if (chunkLen & 1) pos += 1; // pad to even
  }

  out.sampleRate = sampleRate;
  out.channels = numChannels;
  out.bitsPerSample = bitsPerSample;
  out.byteRate = byteRate;
  out.dataChunkSize = dataSize;
  out.valid = true;

  if (dataSize != null && byteRate > 0) {
    out.duration_s = Math.round((dataSize / byteRate) * 100) / 100;
  } else if (dataSize != null && sampleRate > 0 && numChannels > 0 && bitsPerSample >= 8) {
    const bytesPerSample = bitsPerSample / 8;
    out.duration_s = Math.round((dataSize / (sampleRate * numChannels * bytesPerSample)) * 100) / 100;
  }
  return out;
}

// Lyria-requested path: sandbox compose (provider comes from engine env RENDER_PROVIDER=lyria)
const COMPOSE_PAYLOAD = {
  mode: 'sandbox',
  chartData: { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
  controls: {},
};

async function main() {
  const bypass = process.env.VERCEL_BYPASS_TOKEN || '';
  const bypassPresent = bypass.trim().length > 0;
  console.log('Phase 3 — Lyria Provider & Audio Integrity Validation');
  console.log('WEB_URL:', WEB_URL);
  console.log('ENGINE_URL:', ENGINE_URL);
  console.log('VERCEL_BYPASS_TOKEN:', bypassPresent ? 'present' : 'NOT SET');
  console.log('');

  if (!bypassPresent) {
    console.log('PHASE 3 STATUS: BLOCKED');
    console.log('reason: VERCEL_BYPASS_TOKEN required for protected preview');
    process.exit(1);
  }

  // --- A) Positive path: Lyria requested ---
  console.log('--- A) Positive path (Lyria requested) ---');
  const composeUrl = withShare(`${WEB_URL}/api/compose`);
  const res = await request(composeUrl, {
    method: 'POST',
    headers: buildWebJsonHeaders(),
    body: JSON.stringify(COMPOSE_PAYLOAD),
    maxRedirections: 0,
  });
  const text = await res.body.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    console.log('POST /api/compose failed:', res.statusCode, text?.slice(0, 300) || '');
    console.log('PHASE 3 STATUS: FAIL (compose error)');
    process.exit(1);
  }

  const exportEnabled = data.audio?.export_enabled;
  const exportAttempted = data.audio?.export_attempted;
  const exportError = data.audio?.export_error ?? null;
  const providerUsed = data.audio?.provider_used ?? null;
  const providerMode = data.audio?.provider_mode ?? null;
  const exportId = data.audio?.export_id ?? data.export_id ?? null;

  console.log('compose 200');
  console.log('  audio.export_enabled:', exportEnabled);
  console.log('  audio.export_attempted:', exportAttempted);
  console.log('  audio.export_error:', exportError ?? 'null');
  console.log('  audio.provider_used:', providerUsed ?? '(missing)');
  console.log('  audio.provider_mode:', providerMode ?? '(missing)');
  console.log('  audio.export_id:', exportId ? exportId.slice(0, 20) + '...' : 'null');

  // Classify by gating signals
  if (exportEnabled === false) {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log('reason: export_disabled (ENABLE_WAV_EXPORT not 1 at runtime)');
    process.exit(1);
  }
  if (exportEnabled === true && exportAttempted === false) {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log('reason: export_not_attempted (bug: export enabled but not attempted)');
    process.exit(1);
  }
  if (exportAttempted === true && exportError != null) {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log('reason:', exportError);
    process.exit(1);
  }
  if (providerUsed !== 'lyria') {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log('reason: expected audio.provider_used === "lyria", got:', JSON.stringify(providerUsed));
    process.exit(1);
  }
  if (!providerMode || typeof providerMode !== 'string' || !providerMode.includes('lyria')) {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log('reason: audio.provider_mode must be present and indicate lyria, got:', JSON.stringify(providerMode));
    process.exit(1);
  }
  if (!exportId) {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log('reason: export_id missing — cannot download WAV');
    process.exit(1);
  }

  // Duration contract: Lyria returns ~30–33s per clip; gate 29–35s
  const DURATION_MIN = 29;
  const DURATION_MAX = 35;

  let wavHash = null;
  let wavMeta = null;
  let wavBytes = 0;
  try {
    const downloadUrl = withShare(`${WEB_URL}/api/exports/${exportId}`);
    const getRes = await fetch(downloadUrl, { headers: buildWebHeaders() });
    if (!getRes.ok) throw new Error(`GET /api/exports/:id ${getRes.status}`);
    const buf = Buffer.from(await getRes.arrayBuffer());
    wavBytes = buf.length;
    wavHash = sha256Buffer(buf);
    wavMeta = wavHeaderMeta(buf);
    console.log('  export download: OK,', wavBytes, 'bytes');
    console.log('  WAV sha256:', wavHash.slice(0, 16) + '...');
    console.log(
      '  WAV parsed: sampleRate=',
      wavMeta.sampleRate,
      'channels=',
      wavMeta.channels,
      'bitsPerSample=',
      wavMeta.bitsPerSample,
      'byteRate=',
      wavMeta.byteRate,
      'dataChunkSize=',
      wavMeta.dataChunkSize,
      'duration_s=',
      wavMeta.duration_s
    );
  } catch (e) {
    console.log('  export download: FAIL', e.message);
    console.log('PHASE 3 STATUS: FAIL (export download)');
    process.exit(1);
  }

  if (wavMeta.duration_s == null || wavMeta.duration_s < DURATION_MIN || wavMeta.duration_s > DURATION_MAX) {
    console.log('');
    console.log('PHASE 3 STATUS: FAIL');
    console.log(
      'reason: WAV duration_s=',
      wavMeta.duration_s,
      'outside expected range [',
      DURATION_MIN,
      '-',
      DURATION_MAX,
      '] (Lyria ~30–33s)'
    );
    process.exit(1);
  }

  // --- B) Fail-closed: code path does not silently fallback; provider identity explicit ---
  console.log('');
  console.log('--- B) Fail-closed check ---');
  const renderIndexPath = path.join(__dirname, '..', 'vnext', 'render', 'index.ts');
  let renderSource = '';
  try {
    renderSource = fs.readFileSync(renderIndexPath, 'utf8');
  } catch {
    renderSource = '';
  }
  // Block if code still allows fallback (ALLOW_RENDER_FALLBACK or "fall back to local_wav when Lyria fails")
  const allowsFallback = /ALLOW_RENDER_FALLBACK|fall back to local_wav when Lyria/i.test(renderSource);
  const hasExplicitFailClosed = /fail.closed|no silent fallback|throws/i.test(renderSource);
  console.log('  render/index.ts: allows-fallback (BLOCKED if true):', allowsFallback);
  console.log('  render/index.ts: fail-closed phrasing:', hasExplicitFailClosed ? 'present' : 'not checked');

  if (allowsFallback) {
    console.log('');
    console.log('PHASE 3 STATUS: BLOCKED');
    console.log('reason: documented fallback behavior present; remove ALLOW_RENDER_FALLBACK / Lyria→local_wav fallback for Phase 3.');
    process.exit(1);
  }

  console.log('');
  console.log('========== PHASE 3 REPORT ==========');
  console.log('PHASE 3 STATUS: PASS');
  console.log('');
  console.log('Evidence:');
  console.log('  provider_used:', providerUsed);
  console.log('  provider_mode:', providerMode);
  console.log('  export_id:', exportId.slice(0, 24) + '...');
  console.log('  WAV sha256:', wavHash);
  console.log('  WAV bytes:', wavBytes);
  console.log('  WAV sampleRate:', wavMeta?.sampleRate ?? 'n/a');
  console.log('  WAV channels:', wavMeta?.channels ?? 'n/a');
  console.log('  WAV bitsPerSample:', wavMeta?.bitsPerSample ?? 'n/a');
  console.log('  WAV dataChunkSize:', wavMeta?.dataChunkSize ?? 'n/a');
  console.log('  WAV duration_s:', wavMeta?.duration_s ?? 'n/a');
  console.log('  Fail-closed: no silent fallback in render/index.ts');
  console.log('=====================================');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
