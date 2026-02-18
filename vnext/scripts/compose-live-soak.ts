/**
 * Live HTTP soak runner: POSTs a fixed deterministic request to /api/compose N times.
 * Targets a live service (ASTRADIO_BASE_URL, e.g. Render). No mocks; asserts 200, audio.sha256, gate pass, sha256 identical.
 * The npm script runs vnext:build first so this script has type safety and parity with the repo; the soak itself hits the live backend.
 *
 * Preflight: GET /health then one POST /api/compose; prints rate limit headers, audio_export_available, audio.size_bytes/sha256, soak_bypass_active.
 * Fails fast if audio export disabled (set ENABLE_WAV_EXPORT=1 on Render) or limiter too low without SOAK_TOKEN.
 *
 * Default runs: 8 (fits 10/15min limit); when SOAK_TOKEN is set, 30 runs and X-Soak-Token header sent (soak bypass).
 * HTTP 429: waits (retryAfter+250 ms from JSON body, or LIVE_SOAK_DELAY_MS or 1000), retries same run without counting;
 * per-run retries capped by LIVE_MAX_429_RETRIES (default 5). Other non-200 responses fail immediately.
 */

const FIXED_DATE = '2025-01-15';
const FIXED_TIME = '12:00';
const FIXED_LAT = 40.7128;
const FIXED_LON = -74.006;

const DEFAULT_RUNS_NO_TOKEN = 8;
const DEFAULT_RUNS_WITH_TOKEN = 30;
const DEFAULT_DELAY_MS = 750;
const DEFAULT_MAX_429_RETRIES = 5;
const DEFAULT_429_WAIT_MS = 1000;

function liveSoakDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse 429 body for retryAfter (ms). Returns undefined if missing or invalid. */
function parseRetryAfterMs(text: string): number | undefined {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const v = data?.retryAfter;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Deterministic request body: explicit date, time, lat, lon. */
function liveSoakRequestBody(debugAudio: boolean): Record<string, unknown> {
  return {
    mode: 'sandbox',
    chartData: { date: FIXED_DATE, time: FIXED_TIME, lat: FIXED_LAT, lon: FIXED_LON },
    controls: {
      arc_shape: 0.45,
      density_level: 0.6,
      tempo_norm: 0.7,
      step_bias: 0.7,
      leap_cap: 5,
      rhythm_template_id: 3,
      syncopation_bias: 0.3,
      motif_rate: 0.6,
      element_dominance: 'air',
      aspect_tension: 0.5,
      modality: 'mutable',
    },
    ...(debugAudio && { debug_audio: true }),
  };
}

/** Headers for compose requests: optional X-Soak-Token when SOAK_TOKEN env is set. */
function liveSoakHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = process.env.SOAK_TOKEN;
  if (typeof token === 'string' && token.length > 0) h['X-Soak-Token'] = token;
  return h;
}

async function runLiveSoak(): Promise<void> {
  const baseUrl = process.env.ASTRADIO_BASE_URL;
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    console.error('FAIL: ASTRADIO_BASE_URL is required (e.g. https://your-app.onrender.com)');
    process.exit(1);
  }
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/compose`;
  const hasSoakToken = typeof process.env.SOAK_TOKEN === 'string' && process.env.SOAK_TOKEN.length > 0;
  const defaultRuns = hasSoakToken ? DEFAULT_RUNS_WITH_TOKEN : DEFAULT_RUNS_NO_TOKEN;
  const n = Math.max(1, parseInt(process.env.LIVE_SOAK_RUNS || String(defaultRuns), 10) || defaultRuns);
  const delayMs = Math.max(0, parseInt(process.env.LIVE_SOAK_DELAY_MS || String(DEFAULT_DELAY_MS), 10) || DEFAULT_DELAY_MS);
  const max429Retries = Math.max(0, parseInt(process.env.LIVE_MAX_429_RETRIES || String(DEFAULT_MAX_429_RETRIES), 10) || DEFAULT_MAX_429_RETRIES);
  const debugAudio = process.env.LIVE_DEBUG_AUDIO === '1';

  const body = liveSoakRequestBody(debugAudio);
  const headers = liveSoakHeaders();

  // Preflight: health then one compose; print rate limit + audio status; fail fast if can't run soak
  const healthUrl = `${base}/health`;
  const healthRes = await fetch(healthUrl);
  if (!healthRes.ok) {
    console.error(`FAIL: Preflight health check failed. GET ${healthUrl} returned ${healthRes.status}.`);
    process.exit(1);
  }
  const preflightRes = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (preflightRes.status === 429) {
    const limit = preflightRes.headers.get('x-ratelimit-limit') ?? '?';
    const remaining = preflightRes.headers.get('x-ratelimit-remaining') ?? '?';
    console.error(
      `FAIL: Preflight compose returned 429 (rate limited). x-ratelimit-limit=${limit} x-ratelimit-remaining=${remaining}. ` +
        (hasSoakToken
          ? 'SOAK_TOKEN is set but server may not have SOAK_TOKEN configured or token mismatch.'
          : `You requested ${n} runs. Set SOAK_TOKEN on Render and locally to use soak bypass, or set LIVE_SOAK_RUNS to ≤${limit}.`)
    );
    process.exit(1);
  }
  if (!preflightRes.ok) {
    const text = await preflightRes.text().catch(() => '');
    console.error(`FAIL: Preflight compose failed. POST /api/compose returned ${preflightRes.status} ${text.slice(0, 200)}`);
    process.exit(1);
  }
  const preflightData = (await preflightRes.json()) as Record<string, unknown>;
  const limitHeader = preflightRes.headers.get('x-ratelimit-limit');
  const remainingHeader = preflightRes.headers.get('x-ratelimit-remaining');
  const resetHeader = preflightRes.headers.get('x-ratelimit-reset');
  const audioExport = preflightData?.audio_export_available;
  const audio = preflightData?.audio as Record<string, unknown> | undefined;
  const sizeBytes = audio && typeof audio.size_bytes === 'number' ? audio.size_bytes : 0;
  const sha256Pre = audio && typeof audio.sha256 === 'string' ? audio.sha256 : '';
  console.log(
    `Preflight: x-ratelimit-limit=${limitHeader ?? '?'} x-ratelimit-remaining=${remainingHeader ?? '?'} x-ratelimit-reset=${resetHeader ?? '?'} ` +
      `audio_export_available=${audioExport} audio.size_bytes=${sizeBytes} audio.sha256=${sha256Pre ? sha256Pre.slice(0, 16) + '...' : '?'} soak_bypass_active=${hasSoakToken}`
  );
  if (audioExport !== true) {
    console.error(
      'FAIL: Audio export is disabled; cannot test audio determinism. Set ENABLE_WAV_EXPORT=1 on Render and redeploy.'
    );
    process.exit(1);
  }
  // Lightweight WAV validity: RIFF....WAVE header (soak-script only; no server change)
  const base64Audio = audio && typeof (audio as { base64?: string }).base64 === 'string' ? (audio as { base64: string }).base64 : '';
  if (base64Audio) {
    try {
      const decoded = Buffer.from(base64Audio, 'base64');
      const len = decoded.length;
      const hasRiff = len >= 4 && decoded[0] === 0x52 && decoded[1] === 0x49 && decoded[2] === 0x46 && decoded[3] === 0x46;
      const hasWave = len >= 12 && decoded[8] === 0x57 && decoded[9] === 0x41 && decoded[10] === 0x56 && decoded[11] === 0x45;
      if (!hasRiff || !hasWave) {
        console.error(
          'FAIL: Audio export enabled but WAV validation failed (corrupt or invalid file). Expected RIFF....WAVE header.'
        );
        process.exit(1);
      }
      console.log(`Preflight: WAV decoded byte length=${len}`);
    } catch {
      console.error(
        'FAIL: Audio export enabled but WAV validation failed (corrupt or invalid file).'
      );
      process.exit(1);
    }
  }
  const preflightGate = (preflightData?.gate_report as Record<string, unknown> | undefined)?.calibrated as Record<string, unknown> | undefined;
  if (preflightGate?.overall !== true) {
    console.error('FAIL: Preflight gate_report.calibrated.overall not true.');
    process.exit(1);
  }
  const limitNum = limitHeader ? parseInt(limitHeader, 10) : 10;
  if (!hasSoakToken && n > limitNum) {
    console.error(
      `FAIL: Compose rate limit is ${limitNum} per window; you requested ${n} runs. ` +
        'Set SOAK_TOKEN on Render and locally to use soak bypass, or set LIVE_SOAK_RUNS to ≤' +
        String(limitNum) +
        '.'
    );
    process.exit(1);
  }

  const sha256s: string[] = [sha256Pre];
  const latencies: number[] = [0];
  const sizes: number[] = [sizeBytes];
  let totalRateLimited = 0;

  for (let i = 1; i < n; i++) {
    let run429Count = 0;

    for (;;) {
      const start = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const elapsed = Date.now() - start;

      if (res.status === 429) {
        run429Count++;
        totalRateLimited++;
        if (run429Count > max429Retries) {
          console.error(
            `FAIL run ${i + 1}: HTTP 429 rate limit exceeded after ${max429Retries} retries (LIVE_MAX_429_RETRIES=${max429Retries})`
          );
          process.exit(1);
        }
        const text = await res.text().catch(() => '');
        const retryAfterMs = parseRetryAfterMs(text) ?? 0;
        const configuredDelayMs = parseInt(process.env.LIVE_SOAK_DELAY_MS ?? '750', 10);
        const baseWaitMs = Math.max(retryAfterMs + 250, configuredDelayMs, 1000);
        const waitMs = Math.min(10000, Math.round(baseWaitMs * (1 + 0.5 * (run429Count - 1))));
        console.warn(
          `run ${i + 1} attempt ${run429Count}: HTTP 429 | retryAfterMs=${retryAfterMs} configuredDelayMs=${configuredDelayMs} waitMs=${waitMs}`
        );
        await liveSoakDelay(waitMs);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`FAIL run ${i + 1}: HTTP ${res.status} ${text.slice(0, 200)}`);
        process.exit(1);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const audio = data?.audio as Record<string, unknown> | undefined;
      if (!audio || typeof audio.sha256 !== 'string') {
        console.error(`FAIL run ${i + 1}: missing audio.sha256`);
        process.exit(1);
      }
      const gateReport = data?.gate_report as Record<string, unknown> | undefined;
      const calibrated = gateReport?.calibrated as Record<string, unknown> | undefined;
      const overall = calibrated?.overall;
      if (overall !== true) {
        console.error(`FAIL run ${i + 1}: gate_report.calibrated.overall not true`);
        process.exit(1);
      }

      sha256s.push(audio.sha256 as string);
      latencies.push(elapsed);
      sizes.push((audio.size_bytes as number) ?? 0);
      break;
    }

    if (i < n - 1 && delayMs > 0) await liveSoakDelay(delayMs);
  }

  const first = sha256s[0];
  for (let i = 1; i < sha256s.length; i++) {
    if (sha256s[i] !== first) {
      console.error(`FAIL: sha256 mismatch run 1 vs run ${i + 1}`);
      process.exit(1);
    }
  }

  const minMs = Math.min(...latencies);
  const maxMs = Math.max(...latencies);
  const avgMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const avgSizeBytes = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
  console.log(
    `OK: compose live soak | count=${n} sha256=${first.slice(0, 16)}... minMs=${minMs.toFixed(0)} avgMs=${avgMs.toFixed(0)} maxMs=${maxMs.toFixed(0)} avgSizeBytes=${avgSizeBytes.toFixed(0)} rateLimited=${totalRateLimited}`
  );
}

runLiveSoak().catch((e) => {
  console.error(e);
  process.exit(1);
});
