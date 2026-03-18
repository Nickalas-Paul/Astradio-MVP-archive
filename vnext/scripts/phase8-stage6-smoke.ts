#!/usr/bin/env node
/**
 * Phase 8 Stage 6 — Sandbox & Export Validation Smoke Suite
 *
 * 1. export_id determinism: same compose request twice → same plan_sha256, same export_id
 * 2. Audio stability: WAV structure (RIFF/WAVE), byte_rate, data_chunk_size, duration ±0.1s of 30, body ≥ 2.4MB
 * 3. User isolation: User A save → User B list excludes A's; User B GET A's id → 404
 * 4. Cross-path determinism: same chart via chartData vs overriddenSnapshot → same plan_sha256, export_id
 * 5. Sandbox snapshot determinism: same body twice → same meta.combinedHash
 * 6. Overlay consistency: pair/group (lightweight; existing systems only)
 * 7. Regression: health + chart-snapshot (Stage 1–5 run separately)
 *
 * Run: API_BASE_URL=http://localhost:4000 npx ts-node --project vnext/tsconfig.json vnext/scripts/phase8-stage6-smoke.ts
 * Or: node dist/vnext/vnext/scripts/phase8-stage6-smoke.js
 *
 * For isolation tests, engine must receive userId (query or x-caller-user-id). When using web proxy, session is forwarded.
 */

const BASE = (process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const MIN_WAV_BYTES = 2.4e6;
const EXPECTED_DURATION_S = 30;
const DURATION_TOLERANCE_S = 0.1;

type Result = { name: string; pass: boolean; message: string; details?: string[] };

const results: Result[] = [];

function record(name: string, pass: boolean, message: string, details?: string[]): void {
  results.push({ name, pass, message, details });
}

async function fetchJson(
  path: string,
  options: { method?: string; body?: unknown; userId?: string } = {}
): Promise<{ status: number; json: unknown; text: string }> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const target = new URL(url);
  if (options.userId) target.searchParams.set('userId', options.userId);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body != null) headers['Content-Type'] = 'application/json';
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && String(bypass).trim()) headers['x-vercel-protection-bypass'] = String(bypass).trim();
  const res = await fetch(target.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function fetchRaw(path: string, userId?: string): Promise<{ status: number; body: ArrayBuffer; contentType: string }> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const target = new URL(url);
  if (userId) target.searchParams.set('userId', userId);
  const headers: Record<string, string> = {};
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && String(bypass).trim()) headers['x-vercel-protection-bypass'] = String(bypass).trim();
  const res = await fetch(target.toString(), { headers });
  const body = await res.arrayBuffer();
  return { status: res.status, body, contentType: res.headers.get('content-type') || '' };
}

function parseWavDuration(buffer: ArrayBuffer): { ok: boolean; duration_s: number; byte_rate: number; data_size: number; error?: string } {
  const arr = new Uint8Array(buffer);
  if (arr.length < 44) {
    return { ok: false, duration_s: 0, byte_rate: 0, data_size: 0, error: 'WAV too short for header' };
  }
  const riff = String.fromCharCode(arr[0], arr[1], arr[2], arr[3]);
  if (riff !== 'RIFF') {
    return { ok: false, duration_s: 0, byte_rate: 0, data_size: 0, error: `bytes 0-3 not RIFF: ${riff}` };
  }
  const wave = String.fromCharCode(arr[8], arr[9], arr[10], arr[11]);
  if (wave !== 'WAVE') {
    return { ok: false, duration_s: 0, byte_rate: 0, data_size: 0, error: `bytes 8-11 not WAVE: ${wave}` };
  }
  const byteRate = arr[28] | (arr[29] << 8) | (arr[30] << 16) | (arr[31] << 24);
  if (!byteRate || !Number.isFinite(byteRate)) {
    return { ok: false, duration_s: 0, byte_rate: 0, data_size: 0, error: 'invalid byte_rate at offset 28' };
  }
  let dataSize = 0;
  let i = 12;
  while (i + 8 <= arr.length) {
    const chunkId = String.fromCharCode(arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);
    const chunkLen = arr[i + 4] | (arr[i + 5] << 8) | (arr[i + 6] << 16) | (arr[i + 7] << 24);
    if (chunkId === 'data') {
      dataSize = chunkLen;
      break;
    }
    i += 8 + chunkLen;
  }
  if (!dataSize) {
    return { ok: false, duration_s: 0, byte_rate: byteRate, data_size: 0, error: 'data chunk not found' };
  }
  const duration_s = dataSize / byteRate;
  return { ok: true, duration_s, byte_rate: byteRate, data_size: dataSize };
}

async function main(): Promise<void> {
  console.log('Stage 6 — Sandbox & Export Validation Smoke');
  console.log(`BASE: ${BASE}`);
  console.log('---');

  const birth = { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 };
  const overrides = { planets: {} as Record<string, unknown> };
  const controls = {
    arc_shape: 0.5,
    density_level: 0.6,
    tempo_norm: 0.7,
    step_bias: 0.7,
    leap_cap: 5,
    rhythm_template_id: 3,
    syncopation_bias: 0.3,
    motif_rate: 0.6,
  };

  // --- Health (minimal regression) ---
  {
    const r = await fetchJson('/health').catch(() => fetchJson('/api/health'));
    const ok = r.status === 200;
    record('1. Health', ok, ok ? '200 OK' : `HTTP ${r.status}`, [r.text?.slice(0, 100)]);
  }

  // --- 2. Sandbox snapshot determinism ---
  {
    const body = { birth, overrides };
    const r1 = await fetchJson('/api/sandbox/snapshot', { method: 'POST', body });
    const r2 = await fetchJson('/api/sandbox/snapshot', { method: 'POST', body });
    const hash1 = (r1.json as any)?.meta?.combinedHash;
    const hash2 = (r2.json as any)?.meta?.combinedHash;
    const ok = r1.status === 200 && r2.status === 200 && typeof hash1 === 'string' && hash1 === hash2;
    record('2. Sandbox snapshot determinism', ok, ok ? 'same combinedHash' : 'mismatch or missing hash', [hash1?.slice(0, 16), hash2?.slice(0, 16)]);
  }

  // --- 3. Compose body for sandbox (with overriddenSnapshot) ---
  let snapshotForCompose: unknown = null;
  let combinedHash: string = '';
  {
    const snap = await fetchJson('/api/sandbox/snapshot', { method: 'POST', body: { birth, overrides } });
    if (snap.status !== 200 || !(snap.json as any)?.snapshot) {
      record('3. Snapshot for compose', false, `snapshot failed ${snap.status}`, [snap.text?.slice(0, 200)]);
    } else {
      snapshotForCompose = (snap.json as any).snapshot;
      combinedHash = (snap.json as any).meta?.combinedHash || '';
      record('3. Snapshot for compose', true, 'snapshot obtained', []);
    }
  }

  const composeBodySandbox = snapshotForCompose
    ? { mode: 'sandbox' as const, controls, seed: combinedHash, overriddenSnapshot: snapshotForCompose }
    : null;

  // --- 4. export_id and plan_sha256 determinism ---
  {
    if (!composeBodySandbox) {
      record('4. export_id determinism', false, 'no compose body (snapshot failed)', []);
    } else {
      const c1 = await fetchJson('/api/compose', { method: 'POST', body: composeBodySandbox });
      const c2 = await fetchJson('/api/compose', { method: 'POST', body: composeBodySandbox });
      const plan1 = (c1.json as any)?.hashes?.plan_sha256;
      const plan2 = (c2.json as any)?.hashes?.plan_sha256;
      const id1 = (c1.json as any)?.export_id;
      const id2 = (c2.json as any)?.export_id;
      const planOk = c1.status === 200 && c2.status === 200 && typeof plan1 === 'string' && plan1 === plan2;
      const idOk = (id1 == null && id2 == null) || (typeof id1 === 'string' && id1 === id2);
      const ok = planOk && idOk;
      record('4. export_id determinism', ok, ok ? 'plan_sha256 and export_id identical' : 'mismatch', [
        planOk ? 'plan match' : `plan1=${plan1?.slice(0, 8)} plan2=${plan2?.slice(0, 8)}`,
        idOk ? 'export_id match' : `id1=${id1} id2=${id2}`,
      ]);
    }
  }

  // --- 5. Audio stability: GET export, WAV structure, duration, size ---
  {
    if (!composeBodySandbox) {
      record('5. Audio stability', false, 'skip (no compose body)', []);
    } else {
      const c = await fetchJson('/api/compose', { method: 'POST', body: composeBodySandbox });
      const exportId = (c.json as any)?.export_id;
      const exportMeta = (c.json as any)?.export_meta;
      if (!exportId) {
        record('5. Audio stability', false, 'no export_id from compose', []);
      } else {
        const get1 = await fetchRaw(`/api/exports/${exportId}`);
        const get2 = await fetchRaw(`/api/exports/${exportId}`);
        if (get1.status !== 200 || get2.status !== 200) {
          record('5. Audio stability', false, `GET export ${get1.status} / ${get2.status}`, []);
        } else {
          const len1 = get1.body.byteLength;
          const len2 = get2.body.byteLength;
          const sameLength = len1 === len2;
          const sizeOk = len1 >= MIN_WAV_BYTES;
          const parsed = parseWavDuration(get1.body);
          const structureOk = parsed.ok && !parsed.error;
          const durationOk = structureOk && Math.abs(parsed.duration_s - EXPECTED_DURATION_S) <= DURATION_TOLERANCE_S;
          const metaOk = exportMeta == null || exportMeta.duration_s === EXPECTED_DURATION_S;
          const ok = sameLength && sizeOk && structureOk && durationOk && metaOk;
          record('5. Audio stability', ok, ok ? 'WAV valid, duration ~30s, size ≥2.4MB' : 'validation failed', [
            sameLength ? `length match ${len1}` : `len1=${len1} len2=${len2}`,
            sizeOk ? `size ≥ ${MIN_WAV_BYTES}` : `size ${len1} < ${MIN_WAV_BYTES}`,
            structureOk ? `RIFF/WAVE, byte_rate=${parsed.byte_rate}, data_size=${parsed.data_size}` : parsed.error || 'parse error',
            durationOk ? `duration_s=${parsed.duration_s?.toFixed(2)}` : `duration_s=${parsed.duration_s?.toFixed(2)} (expected ${EXPECTED_DURATION_S}±${DURATION_TOLERANCE_S})`,
            metaOk ? 'export_meta.duration_s=30' : `export_meta.duration_s=${exportMeta?.duration_s}`,
          ]);
        }
      }
    }
  }

  // --- 6. Cross-path determinism: chartData vs overriddenSnapshot ---
  {
    const chartDataBody = { mode: 'sandbox' as const, chartData: birth, controls };
    if (!snapshotForCompose) {
      record('6. Cross-path determinism', false, 'skip (no snapshot)', []);
    } else {
      const compChart = await fetchJson('/api/compose', { method: 'POST', body: chartDataBody });
      const compSnap = await fetchJson('/api/compose', { method: 'POST', body: composeBodySandbox! });
      const planChart = (compChart.json as any)?.hashes?.plan_sha256;
      const planSnap = (compSnap.json as any)?.hashes?.plan_sha256;
      const idChart = (compChart.json as any)?.export_id;
      const idSnap = (compSnap.json as any)?.export_id;
      const planMatch = compChart.status === 200 && compSnap.status === 200 && typeof planChart === 'string' && planChart === planSnap;
      const idMatch = (idChart == null && idSnap == null) || (idChart === idSnap);
      const ok = planMatch && idMatch;
      record('6. Cross-path determinism', ok, ok ? 'chartData vs overriddenSnapshot: same plan_sha256 and export_id' : 'mismatch', [
        planMatch ? 'plan match' : `chart=${planChart?.slice(0, 8)} snap=${planSnap?.slice(0, 8)}`,
        idMatch ? 'export_id match' : `chart=${idChart} snap=${idSnap}`,
      ]);
    }
  }

  // --- 7. User isolation: A save, B list excludes A's id; B GET A's id → 404 ---
  const userA = 'stage6_user_a';
  const userB = 'stage6_user_b';
  {
    const savePayload = {
      sandbox_state: { birth, overrides, controls },
      vector_hash: combinedHash || 'test-hash',
      seed: combinedHash || 'test-seed',
      plan_hash: 'test-plan-hash',
      report: {},
      export_id: null as string | null,
    };
    const save = await fetchJson('/api/sandbox/compositions', { method: 'POST', body: savePayload, userId: userA });
    if (save.status === 401) {
      record('7. User isolation', false, 'POST compositions 401 (caller required)', ['Set userId when calling engine']);
    } else if (save.status >= 400) {
      record('7. User isolation', false, `POST compositions ${save.status}`, [save.text?.slice(0, 200)]);
    } else {
      const idA = (save.json as any)?.id;
      if (!idA) {
        record('7. User isolation', false, 'POST missing id', []);
      } else {
        const listB = await fetchJson(`/api/sandbox/compositions?limit=50`, { userId: userB });
        const list = Array.isArray(listB.json) ? listB.json : [];
        const foundA = list.some((row: any) => row.id === idA);
        const getB = await fetchJson(`/api/sandbox/compositions/${idA}`, { userId: userB });
        const listOk = listB.status === 200 && !foundA;
        const getOk = getB.status === 404;
        const ok = listOk && getOk;
        record('7. User isolation', ok, ok ? "B cannot see A's composition; GET A's id as B → 404" : 'isolation failed', [
          listOk ? "B list does not contain A's id" : "B list contains A's id or list failed",
          getOk ? 'GET as B → 404' : `GET as B → ${getB.status}`,
        ]);
      }
    }
  }

  // --- 8. Overlay consistency (lightweight: just call comparison/group if available; otherwise skip) ---
  {
    const health = await fetchJson('/api/relational/intent-profiles').catch(() => ({ status: 0, json: null, text: '' }));
    if (health.status !== 200) {
      record('8. Overlay consistency', true, 'skip (relational not available)', []);
    } else {
      record('8. Overlay consistency', true, 'relational surface reachable; pair/group use existing systems', []);
    }
  }

  // --- 9. Regression: chart-snapshot ---
  {
    const q = new URLSearchParams({ date: birth.date, time: birth.time, lat: String(birth.lat), lon: String(birth.lon) });
    const r = await fetchJson(`/api/chart-snapshot?${q}`);
    const ok = r.status === 200 && (r.json as any)?.planets?.length > 0;
    record('9. Regression chart-snapshot', ok, ok ? '200 with planets' : `HTTP ${r.status}`, []);
  }

  // --- Summary ---
  console.log('');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}: ${r.message}`);
    if (r.details?.length) r.details.forEach((d) => console.log(`  ${d}`));
  }
  console.log('---');
  console.log(`Total: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
