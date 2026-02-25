#!/usr/bin/env node
/**
 * Phase 2 — Determinism & Repeatability.
 * Same chart input and controls → stable plan_sha256, explanation section titles, and (reported) WAV hashes.
 *
 * Usage:
 *   WEB_URL=https://your-app.vercel.app node scripts/phase2-determinism.js
 *   WEB_URL=http://localhost:3000 ENGINE_URL=http://localhost:4000 node scripts/phase2-determinism.js
 */
const crypto = require('crypto');
const { request } = require('undici');

const WEB_URL = (process.env.WEB_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) || 'http://localhost:3000').replace(/\/+$/, '');
const ENGINE_URL = (process.env.ENGINE_URL || process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const N = Math.max(1, parseInt(process.env.PHASE2_RUNS || '5', 10) || 5);
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

// Fixed chart payload (identical across runs)
const FIXED_PAYLOAD = {
  mode: 'sandbox',
  chartData: { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
  controls: {},
};

async function runOneCompose(runIndex) {
  const composeUrl = withShare(`${WEB_URL}/api/compose`);
  const res = await request(composeUrl, {
    method: 'POST',
    headers: buildWebJsonHeaders(),
    body: JSON.stringify(FIXED_PAYLOAD),
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
    throw new Error(`POST /api/compose ${res.statusCode}: ${text?.slice(0, 200) || ''}`);
  }
  const planSha = data.hashes?.plan_sha256 ?? null;
  const sections = data.explanation?.sections;
  const sectionTitles = Array.isArray(sections) ? sections.map((s) => s.title || '').filter(Boolean) : [];
  const exportId = data.export_id ?? null;
  return { planSha, sectionTitles, exportId, runIndex };
}

async function downloadWav(exportId) {
  const url = withShare(`${WEB_URL}/api/exports/${exportId}`);
  const res = await fetch(url, { headers: buildWebHeaders() });
  if (!res.ok) throw new Error(`GET /api/exports/:id ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function main() {
  const runs = [];
  console.log(`Phase 2 — Determinism (N=${N}), WEB_URL=${WEB_URL}\n`);

  for (let i = 1; i <= N; i++) {
    const one = await runOneCompose(i);
    let wavBuffer = null;
    let wavSha = null;
    let wavBytes = 0;
    if (one.exportId) {
      try {
        wavBuffer = await downloadWav(one.exportId);
        wavBytes = wavBuffer.length;
        wavSha = sha256Buffer(wavBuffer);
      } catch (e) {
        wavSha = `error: ${e.message}`;
      }
    } else {
      wavSha = 'no_export_id';
    }
    runs.push({
      runIndex: i,
      planSha: one.planSha,
      sectionTitles: one.sectionTitles,
      exportId: one.exportId,
      wavSha,
      wavBytes,
    });
  }

  const planHashes = runs.map((r) => r.planSha);
  const sectionTitlesList = runs.map((r) => r.sectionTitles);
  const wavHashes = runs.map((r) => (typeof r.wavSha === 'string' && r.wavSha.startsWith('error:') ? null : r.wavSha));
  const wavBytesList = runs.map((r) => r.wavBytes);

  const planSet = new Set(planHashes.filter(Boolean));
  const planIdentical = planSet.size <= 1;

  const titlesKey = (t) => JSON.stringify(t);
  const titlesSet = new Set(sectionTitlesList.map(titlesKey));
  const sectionTitlesIdentical = titlesSet.size <= 1;

  const wavSet = new Set(wavHashes.filter(Boolean));
  const wavIdentical = wavSet.size <= 1;

  if (!wavIdentical && wavHashes.some(Boolean)) {
    console.log('audio nondeterministic');
    runs.forEach((r, i) => {
      console.log(`  Run ${i + 1}: wav_sha=${r.wavSha} bytes=${r.wavBytes}`);
    });
  }

  console.log('\nPHASE 2 DETERMINISM REPORT\n');
  console.log(`Runs: ${N}`);
  console.log(`Plan hashes identical: ${planIdentical}`);
  console.log(`Section titles identical: ${sectionTitlesIdentical}`);
  console.log(`WAV hashes identical: ${wavIdentical}`);
  console.log('');
  console.log('Plan hashes:');
  runs.forEach((r) => console.log(`  ${r.runIndex}: ${r.planSha ?? 'null'}`));
  console.log('');
  console.log('Section titles (run 1):');
  (runs[0]?.sectionTitles || []).forEach((t, i) => console.log(`  ${i + 1}: ${t}`));
  console.log('');
  console.log('WAV hashes:');
  runs.forEach((r) => console.log(`  ${r.runIndex}: ${r.wavSha}${typeof r.wavBytes === 'number' ? ` (${r.wavBytes} bytes)` : ''}`));
  if (!wavIdentical && wavHashes.some(Boolean)) {
    console.log('');
    console.log('Byte lengths:');
    runs.forEach((r) => console.log(`  ${r.runIndex}: ${r.wavBytes}`));
    console.log('');
    console.log('audio nondeterministic');
  }

  let status = 'PASS';
  if (!planIdentical || !sectionTitlesIdentical) status = 'FAIL';

  console.log(`STATUS: ${status}`);
  console.log('');

  process.exit(status === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
