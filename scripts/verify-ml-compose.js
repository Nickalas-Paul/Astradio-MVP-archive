#!/usr/bin/env node
/**
 * Verify ML inference path end-to-end: ml_used=true, inference_ms > 0, outputs differ.
 *
 * Usage:
 *   npm run verify:ml        # server already running on 3000
 *   npm run proof:ml         # same as verify:ml (proof command)
 *   node scripts/verify-ml-compose.js [--start-dev]
 *
 * With --start-dev: spawns `npm run dev` (backend+ui), waits for /health, runs checks, kills children.
 * Without: expects server at BASE_URL (default http://localhost:3000).
 *
 * Outputs PASS or FAIL with exact reason. Exit 0 on PASS, 1 on FAIL.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const COMPOSE_URL = `${BASE_URL}/api/compose`;
const HEALTH_URL = `${BASE_URL}/health`;
const START_DEV = process.argv.includes('--start-dev');
const BACKEND_PORT = 3000;
const UI_PORT = 3001;

function killProcessesOnPort(port) {
  const { execSync } = require('child_process');
  const isWin = /^win/.test(process.platform);
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().split(/\s+/);
        const pid = m[m.length - 1];
        if (/^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        } catch (e) { /* ignore */ }
      }
    } else {
      const out = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      if (out) execSync(`kill -9 ${out.split(/\s+/).filter(Boolean).join(' ')}`, { stdio: 'pipe' });
    }
  } catch (e) { /* ignore */ }
}

const req1 = {
  mode: 'sky',
  skyParams: {
    latitude: 40.7128,
    longitude: -74.006,
    datetime: '2020-01-15T12:00:00Z',
  },
};

const req2 = {
  mode: 'sky',
  skyParams: {
    latitude: 34.0522,
    longitude: -118.2437,
    datetime: '2020-06-20T18:00:00Z',
  },
};

function fail(reason) {
  console.error('[verify-ml] FAIL:', reason);
  process.exit(1);
}

async function waitForHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(HEALTH_URL);
      if (r.ok) return true;
    } catch (e) {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function compose(body) {
  const r = await fetch(COMPOSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

async function main() {
  let devProc = null;
  if (START_DEV) {
    const { spawn } = require('child_process');
    const path = require('path');
    console.log('[verify-ml] Preflight: freeing ports 3000, 3001...');
    killProcessesOnPort(BACKEND_PORT);
    killProcessesOnPort(UI_PORT);
    await new Promise((r) => setTimeout(r, 2000));
    console.log('[verify-ml] Starting npm run dev (backend+ui)...');
    devProc = spawn('npm', ['run', 'dev'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    devProc.stdout?.on('data', (d) => process.stdout.write(d));
    devProc.stderr?.on('data', (d) => process.stderr.write(d));
    const ok = await waitForHealth();
    if (!ok) {
      devProc.kill();
      fail('Health check timeout. Backend did not become ready.');
    }
    console.log('[verify-ml] Backend healthy.');
  } else {
    const ok = await waitForHealth(15_000);
    if (!ok) fail(`Server not reachable at ${BASE_URL}. Start dev first or use --start-dev.`);
  }

  const r1 = await compose(req1);
  const r2 = await compose(req2);

  if (devProc) devProc.kill();

  if (!r1.ok) {
    const msg = r1.json?.error || r1.json?.code || `HTTP ${r1.status}`;
    fail(`Compose request 1 failed: ${msg} (status ${r1.status})`);
  }
  if (!r2.ok) {
    const msg = r2.json?.error || r2.json?.code || `HTTP ${r2.status}`;
    fail(`Compose request 2 failed: ${msg} (status ${r2.status})`);
  }

  const t1 = r1.json?.telemetry;
  const t2 = r2.json?.telemetry;

  if (!t1?.ml_used || !t2?.ml_used) {
    fail(`telemetry.ml_used not true: request1=${!!t1?.ml_used}, request2=${!!t2?.ml_used}`);
  }
  if (typeof t1.inference_ms !== 'number' || t1.inference_ms <= 0 ||
      typeof t2.inference_ms !== 'number' || t2.inference_ms <= 0) {
    fail(`telemetry.inference_ms not > 0: request1=${t1?.inference_ms}, request2=${t2?.inference_ms}`);
  }

  const h1 = r1.json?.hashes?.control;
  const h2 = r2.json?.hashes?.control;
  if (!h1 || !h2 || h1 === h2) {
    fail('Control hashes missing or identical across different inputs.');
  }

  console.log('[verify-ml] PASS: ml_used=true, inference_ms>0, outputs differ.');
  console.log('[verify-ml]', {
    inference_ms: [t1.inference_ms, t2.inference_ms],
    model_version: t1.model_version,
    tf_backend: t1.tf_backend,
    model_sha: t1.model_sha,
  });
  process.exit(0);
}

main().catch((e) => {
  console.error('[verify-ml] FAIL:', e.message || e);
  process.exit(1);
});
