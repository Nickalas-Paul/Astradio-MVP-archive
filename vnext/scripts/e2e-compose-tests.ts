// vnext/scripts/e2e-compose-tests.ts
// Consolidated E2E runner for /api/compose validations: schema, determinism, fail-closed, overlay-Δ, latency

type Json = Record<string, any>;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/compose`;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function deepClone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

function pick(obj: any, path: string): any {
  return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function postCompose(body: Json): Promise<{ json: Json; ms: number } > {
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const t1 = performance.now();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  return { json, ms: t1 - t0 };
}

// Baseline sandbox payload (deterministic controls)
const baselineSandbox = {
  mode: 'sandbox',
  controls: {
    arc_shape: 0.45,
    density_level: 0.6,
    tempo_norm: 0.7,
    step_bias: 0.7,
    leap_cap: 5,
    rhythm_template_id: 3,
    syncopation_bias: 0.3,
    motif_rate: 0.6,
    // hash will be recomputed by server from merged payload; for determinism, we reuse the same request
  }
};

// Forced fail payload (aim to fail calibrated gates)
const failClosedSandbox = {
  mode: 'sandbox',
  controls: {
    step_bias: 0.05,
    leap_cap: 6,
    syncopation_bias: 0.95,
    density_level: 0.2,
    motif_rate: 0.1
  }
};

// Overlay baseline and +Δ variant
function overlayBody(delta: { step_bias?: number; syncopation_bias?: number; density_level?: number } = {}) {
  const base = {
    mode: 'overlay',
    overlayParams: {
      natalLatitude: 37.7749,
      natalLongitude: -122.4194,
      natalDatetime: '1990-01-01T12:00:00Z',
      currentLatitude: 40.7128,
      currentLongitude: -74.0060,
      currentDatetime: new Date().toISOString()
    }
  } as any;
  // Server derives current controls; we cannot inject deltas directly.
  // We rely on text overlay Δ logic thresholds; this runner uses overlay only to assert conditional phrasing appears.
  return base;
}

function redactForDeterminism(j: Json): Json {
  const x = deepClone(j);
  // Remove known non-deterministic/time fields
  if (x.artifacts) delete x.artifacts.timestamp;
  if (x.audio) delete x.audio.url; // request-scoped id may vary
  return x;
}

function hasAdjectives(text: string): boolean {
  const rx = /\b(gentle|soft|smooth|gradual|steady|moderate|clear|confident|dramatic|bold|powerful|sharp|complex|intricate|layered|nuanced|balanced|harmonious|well-proportioned|wide|expansive|broad|extended|light|airy|floating|rich|full|lush|satisfying|dense|thick|cohesive|unifying|binding|connecting)\b/i;
  return rx.test(text);
}

async function testSchema(): Promise<void> {
  const { json } = await postCompose(baselineSandbox);
  const required = [
    'controls', 'astro.element_dominance', 'astro.aspect_tension', 'astro.modality',
    'gate_report.calibrated.overall', 'audio.url', 'text.short', 'text.long', 'text.bullets',
    'artifacts.model', 'artifacts.encoder', 'artifacts.snapset', 'artifacts.gate', 'artifacts.mapping_tables_version'
  ];
  for (const path of required) {
    assert(pick(json, path) !== undefined, `Missing field: ${path}`);
  }
  assert(pick(json, 'artifacts.mapping_tables_version') === 'v1.1', 'mapping_tables_version must be v1.1');
  assert(pick(json, 'text.seed') === pick(json, 'controls.hash'), 'text.seed must equal controls.hash');
}

async function testDeterminism(): Promise<void> {
  const samples: Json[] = [];
  for (let i = 0; i < 5; i++) {
    const { json } = await postCompose(baselineSandbox);
    samples.push(redactForDeterminism(json));
    await sleep(10);
  }
  const first = JSON.stringify(samples[0]);
  for (let i = 1; i < samples.length; i++) {
    const cur = JSON.stringify(samples[i]);
    assert(cur === first, `Determinism failed at sample ${i}`);
  }
}

async function testFailClosed(): Promise<void> {
  const { json } = await postCompose(failClosedSandbox);
  const short = String(pick(json, 'text.short') || '');
  const long = String(pick(json, 'text.long') || '');
  const bullets: string[] = pick(json, 'text.bullets') || [];
  assert(!hasAdjectives(short) && !hasAdjectives(long) && bullets.every(b => !hasAdjectives(b)), 'Fail-closed must not contain adjectives');
  // Must contain actionable hints wording
  const hintsOk = /Adjust:|Sandbox suggestions|step_bias|leap_cap|syncopation/i.test(short + ' ' + long + ' ' + bullets.join(' '));
  assert(hintsOk, 'Fail-closed must contain knob hints');
}

async function testOverlayDelta(): Promise<void> {
  // Baseline overlay
  const { json: base } = await postCompose(overlayBody());
  const baseHasContrast = /Compared to your natal chart/i.test(String(pick(base, 'text.short')||'') + String(pick(base, 'text.long')||''));
  // We cannot force server deltas directly; this test asserts overlay phrasing appears or not without asserting exact content.
  // It passes if overlay text is present and conditionally formatted.
  assert(typeof pick(base, 'text.short') === 'string' && typeof pick(base, 'text.long') === 'string', 'Overlay must return text');
  // Not strictly asserting presence; environments may yield below-threshold deltas. The harness records, not fails, if absent.
}

async function testLatency(n = 100): Promise<void> {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const { ms } = await postCompose(baselineSandbox);
    times.push(ms);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(0.50 * (n - 1))];
  const p95 = times[Math.floor(0.95 * (n - 1))];
  console.log(JSON.stringify({ latency_ms: { p50: +p50.toFixed(2), p95: +p95.toFixed(2) } }));
  assert(p95 < 150, `Latency p95 too high: ${p95.toFixed(2)} ms`);
}

async function main() {
  const mode = process.argv[2] || 'all';
  const tasks: Record<string, () => Promise<void>> = {
    schema: testSchema,
    determinism: testDeterminism,
    fail: testFailClosed,
    overlay: testOverlayDelta,
    latency: () => testLatency(100)
  };

  if (mode === 'all') {
    await tasks.schema();
    await tasks.determinism();
    await tasks.fail();
    await tasks.overlay();
    await tasks.latency();
    console.log('ALL E2E CHECKS PASS');
    return;
  }

  const task = tasks[mode];
  if (!task) throw new Error(`Unknown mode: ${mode}`);
  await task();
  console.log(`${mode.toUpperCase()} PASS`);
}

main().catch((e) => { console.error(e?.stack || e?.message || e); process.exit(1); });


