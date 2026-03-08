#!/usr/bin/env node
/**
 * Phase 6 — Sandbox end-to-end smoke.
 *
 * This hits the real engine HTTP surface when available:
 *  - POST /api/sandbox/snapshot
 *  - POST /api/sandbox/report
 *  - POST /api/compose (mode: 'sandbox', overriddenSnapshot)
 *  - Optional: GET /api/exports/:id when export is enabled
 *  - Optional: POST/GET /api/sandbox/compositions when DB is available
 *
 * Required checks fail the script (non-zero exit).
 * Optional checks print SKIP and do not fail when unavailable.
 */

type Json = any;

const ENGINE_BASE =
  (process.env.ENGINE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg);
}

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error('[phase6-sandbox-smoke] FAIL:', msg);
  process.exit(1);
}

async function postJson(path: string, body: Json): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${ENGINE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, json: data };
}

async function getRaw(path: string): Promise<Response> {
  return fetch(`${ENGINE_BASE}${path}`);
}

async function main(): Promise<void> {
  log(`[phase6-sandbox-smoke] ENGINE_BASE=${ENGINE_BASE}`);
  const requireEngine = process.env.PHASE6_SMOKE_REQUIRE_ENGINE === '1';

  // 0) Engine reachability preflight
  log('[0] GET /health preflight');
  try {
    const res = await fetch(`${ENGINE_BASE}/health`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const msg = `health status=${res.status} body=${text.slice(0, 200)}`;
      if (requireEngine) {
        fail(`Engine not healthy at BASE_URL=${ENGINE_BASE}: ${msg}`);
      } else {
        log(`SKIP: engine not healthy at ${ENGINE_BASE} (${msg})`);
        process.exit(0);
      }
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (requireEngine) {
      fail(`Engine not reachable at BASE_URL=${ENGINE_BASE}: ${msg}. Start engine or set ENGINE_BASE_URL.`);
    } else {
      log(`SKIP: engine not running at ${ENGINE_BASE} (${msg})`);
      process.exit(0);
    }
  }

  const birth = {
    date: '1990-01-01',
    time: '12:00',
    lat: 37.7749,
    lon: -122.4194,
  };
  const overrides = {
    planets: {
      sun: { lonDeg: 10 },
      moon: { lonDeg: 15 },
      mercury: { lonDeg: 20 },
      venus: { lonDeg: 25 },
      mars: { lonDeg: 30 },
    },
  };

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

  // 1) Snapshot
  log('[1] POST /api/sandbox/snapshot');
  const snapRes = await postJson('/api/sandbox/snapshot', { birth, overrides });
  if (snapRes.status !== 200) {
    fail(`snapshot status=${snapRes.status} body=${JSON.stringify(snapRes.json)}`);
  }
  const snapshot = snapRes.json?.snapshot;
  const meta = snapRes.json?.meta;
  if (!snapshot || !meta?.combinedHash) {
    fail('snapshot missing snapshot or meta.combinedHash');
  }
  const combinedHash: string = meta.combinedHash;

  // 2) Report
  log('[2] POST /api/sandbox/report');
  const reportRes = await postJson('/api/sandbox/report', { birth, overrides, seed: combinedHash });
  if (reportRes.status !== 200) {
    fail(`report status=${reportRes.status} body=${JSON.stringify(reportRes.json)}`);
  }
  const reportJson = reportRes.json;
  if (!reportJson || !reportJson.personality || !reportJson.explanation) {
    fail('report missing personality or explanation fields');
  }

  // 3) Compose
  log('[3] POST /api/compose (sandbox, overriddenSnapshot)');
  const composeBody = {
    mode: 'sandbox',
    controls,
    seed: combinedHash,
    overriddenSnapshot: snapshot,
  };
  const composeRes = await postJson('/api/compose', composeBody);
  if (composeRes.status !== 200) {
    fail(`compose status=${composeRes.status} body=${JSON.stringify(composeRes.json)}`);
  }
  const hashes = composeRes.json?.hashes;
  const planSha: string | undefined = hashes?.plan_sha256;
  if (!planSha || typeof planSha !== 'string') {
    fail('compose missing hashes.plan_sha256');
  }
  log(`[3] plan_sha256=${planSha.slice(0, 16)}…`);

  // Export and playable-audio regression guard (Phase 8G: natal soundtrack must be playable)
  const topExportId: string | undefined = composeRes.json?.export_id;
  const audioExportId: string | undefined = composeRes.json?.audio?.export_id || undefined;
  const exportId = topExportId ?? audioExportId;
  let hasPlayableArtifact = false;
  if (exportId) {
    log('[3a] GET /api/exports/:id');
    const exportRes = await getRaw(`/api/exports/${exportId}`);
    if (!exportRes.ok) {
      fail(`export GET failed status=${exportRes.status}`);
    }
    const buf = await exportRes.arrayBuffer();
    if (!buf || buf.byteLength === 0) {
      fail('export GET returned empty body');
    }
    hasPlayableArtifact = true;
  } else {
    const base64 = composeRes.json?.audio?.base64;
    hasPlayableArtifact = typeof base64 === 'string' && base64.length > 0;
    const audio = composeRes.json?.audio;
    const audioDebug = composeRes.json?.audio_debug;
    const hasUnavailableSignal =
      !!audioDebug?.export_failure ||
      typeof audio?.export_error === 'string' ||
      audio?.export_enabled === false;
    if (!hasPlayableArtifact && (!audio || !hasUnavailableSignal)) {
      log('[3a] SKIP export: no export_id and no explicit export-unavailable signal (treating as optional).');
    } else if (!hasPlayableArtifact) {
      log('[3a] SKIP export: export unavailable per audio_debug/export_error.');
    }
  }
  if (!hasPlayableArtifact && process.env.PHASE6_SMOKE_REQUIRE_PLAYABLE_AUDIO === '1') {
    fail('Regression guard: compose must return playable audio (audio.base64 or export_id). Set ENABLE_WAV_EXPORT=1 and ensure render path works.');
  }

  // 4) Determinism: re-run compose with same seed + snapshot
  log('[4] Determinism check — re-run compose with same seed/snapshot');
  const composeRes2 = await postJson('/api/compose', composeBody);
  if (composeRes2.status !== 200) {
    fail(`compose(2) status=${composeRes2.status} body=${JSON.stringify(composeRes2.json)}`);
  }
  const planSha2: string | undefined = composeRes2.json?.hashes?.plan_sha256;
  if (!planSha2 || typeof planSha2 !== 'string') {
    fail('compose(2) missing hashes.plan_sha256');
  }
  if (planSha2 !== planSha) {
    fail(`Determinism mismatch: plan_sha256(1)=${planSha} plan_sha256(2)=${planSha2}`);
  }
  log('[4] Determinism OK (plan_sha256 match).');

  // 5) Optional DB-backed compositions
  log('[5] Optional DB-backed /api/sandbox/compositions');
  try {
    const saveRes = await postJson('/api/sandbox/compositions', {
      sandbox_state: { birth, overrides, controls },
      vector_hash: combinedHash,
      seed: combinedHash,
      plan_hash: planSha,
      report: reportRes.json ?? {},
      provider: composeRes.json?.audio?.provider_used ?? null,
      provider_version: null,
      export_id: exportId ?? null,
    });
    if (saveRes.status === 503) {
      log('[5] SKIP compositions: database unavailable (503).');
    } else if (saveRes.status >= 400) {
      fail(`compositions POST status=${saveRes.status} body=${JSON.stringify(saveRes.json)}`);
    } else {
      const savedId: string | undefined = saveRes.json?.id;
      if (!savedId) {
        fail('compositions POST missing id');
      }
      const listRes = await getRaw('/api/sandbox/compositions?limit=10');
      if (!listRes.ok) {
        fail(`compositions list status=${listRes.status}`);
      }
      const listJson = await listRes.json().catch(() => []);
      if (!Array.isArray(listJson) || listJson.length === 0) {
        fail('compositions list empty after save');
      }
      const getRes = await getRaw(`/api/sandbox/compositions/${savedId}`);
      if (!getRes.ok) {
        fail(`compositions GET by id status=${getRes.status}`);
      }
      const getJson = await getRes.json().catch(() => ({}));
      if (!getJson || getJson.plan_hash !== planSha) {
        fail('compositions GET by id missing or mismatched plan_hash');
      }
      log('[5] Compositions save/list/get OK.');
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes('ECONNREFUSED')) {
      log('[5] SKIP compositions: database not reachable (connection refused).');
    } else {
      fail(`compositions check error: ${msg}`);
    }
  }

  log('PHASE6 SANDBOX SMOKE PASS');
  process.exit(0);
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
});

