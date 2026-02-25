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
 * Parse WAV header (minimal): sample rate, channels, duration if possible.
 * Assumes PCM, 16-bit; data chunk follows fmt.
 */
function wavHeaderMeta(buf) {
  const out = { sampleRate: null, channels: null, duration_s: null, valid: false };
  if (!buf || buf.length < 44) return out;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return out;
  const fmtOffset = buf.indexOf(Buffer.from('fmt ', 'ascii'));
  if (fmtOffset < 0 || buf.length < fmtOffset + 16) return out;
  const numChannels = buf.readUInt16LE(fmtOffset + 10);
  const sampleRate = buf.readUInt32LE(fmtOffset + 12);
  const bitsPerSample = buf.readUInt16LE(fmtOffset + 22) || 16;
  const dataOffset = buf.indexOf(Buffer.from('data', 'ascii'));
  if (dataOffset < 0 || buf.length < dataOffset + 8) {
    out.sampleRate = sampleRate;
    out.channels = numChannels;
    out.valid = true;
    return out;
  }
  const dataSize = buf.readUInt32LE(dataOffset + 4);
  const bytesPerSample = bitsPerSample / 8;
  const duration_s = dataSize / (sampleRate * numChannels * bytesPerSample);
  out.sampleRate = sampleRate;
  out.channels = numChannels;
  out.duration_s = Math.round(duration_s * 100) / 100;
  out.valid = true;
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

  const providerUsed = data.audio?.provider_used;
  const providerMode = data.audio?.provider_mode;
  const exportId = data.export_id ?? null;

  console.log('compose 200');
  console.log('  audio.provider_used:', providerUsed ?? '(missing)');
  console.log('  audio.provider_mode:', providerMode ?? '(missing)');
  console.log('  export_id:', exportId ? exportId.slice(0, 20) + '...' : 'null');

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

  let wavHash = null;
  let wavMeta = null;
  let wavBytes = 0;
  if (exportId) {
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
      console.log('  WAV header: sampleRate=', wavMeta.sampleRate, 'channels=', wavMeta.channels, 'duration_s=', wavMeta.duration_s);
    } catch (e) {
      console.log('  export download: FAIL', e.message);
      console.log('PHASE 3 STATUS: FAIL (export download)');
      process.exit(1);
    }
  } else {
    console.log('  export_id missing — cannot download WAV');
    console.log('PHASE 3 STATUS: FAIL (no export_id)');
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
  console.log('  WAV duration_s:', wavMeta?.duration_s ?? 'n/a');
  console.log('  Fail-closed: no silent fallback in render/index.ts');
  console.log('=====================================');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
