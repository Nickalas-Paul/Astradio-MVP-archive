/**
 * Golden set evaluation runner: POSTs each canonical case from vnext/eval/golden-set.json
 * to the live /api/compose endpoint. Produces versioned results + report and diffs against baseline.
 * No runtime changes; side-car tooling only. Reuses WAV header check (RIFF/WAVE) from soak script.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const EVAL_DIR = path.join(process.cwd(), 'vnext', 'eval');
const GOLDEN_SET_PATH = path.join(EVAL_DIR, 'golden-set.json');
const BASELINE_PATH = path.join(EVAL_DIR, 'baseline', 'results.json');
const RUNS_DIR = path.join(EVAL_DIR, 'runs');

interface GoldenCase {
  id: string;
  name: string;
  body: Record<string, unknown>;
}

interface CaseResult {
  case_id: string;
  name?: string;
  http_status: number;
  elapsed_ms: number;
  audio_export_available?: boolean;
  audio_size_bytes?: number;
  audio_sha256?: string;
  wav_valid?: boolean;
  model_sha?: string;
  model_version?: string;
  tf_backend?: string;
  controls_hash?: string;
  error?: string;
}

interface RunMeta {
  timestamp: string;
  git_sha: string;
  base_url: string;
  total: number;
  passed: number;
  failed: number;
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'nogit';
  }
}

/** Headers for compose requests: optional X-Soak-Token when SOAK_TOKEN env is set. */
function composeHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = process.env.SOAK_TOKEN;
  if (typeof token === 'string' && token.length > 0) h['X-Soak-Token'] = token;
  return h;
}

/** Lightweight WAV validity: RIFF at 0-3, WAVE at 8-11 (same as soak script). */
function isWavValid(base64Audio: string): boolean {
  try {
    const decoded = Buffer.from(base64Audio, 'base64');
    const len = decoded.length;
    const hasRiff = len >= 4 && decoded[0] === 0x52 && decoded[1] === 0x49 && decoded[2] === 0x46 && decoded[3] === 0x46;
    const hasWave = len >= 12 && decoded[8] === 0x57 && decoded[9] === 0x41 && decoded[10] === 0x56 && decoded[11] === 0x45;
    return hasRiff && hasWave;
  } catch {
    return false;
  }
}

/** SHA256 of base64-decoded audio (Node built-in). */
function sha256FromBase64(base64Audio: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(Buffer.from(base64Audio, 'base64')).digest('hex');
}

function loadGoldenSet(): GoldenCase[] {
  const raw = fs.readFileSync(GOLDEN_SET_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('golden-set.json must be an array');
  return data as GoldenCase[];
}

function loadBaseline(): CaseResult[] | null {
  try {
    if (fs.existsSync(BASELINE_PATH)) {
      const raw = fs.readFileSync(BASELINE_PATH, 'utf8');
      const obj = JSON.parse(raw);
      return Array.isArray(obj.results) ? (obj.results as CaseResult[]) : null;
    }
  } catch {
    // ignore
  }
  return null;
}

async function runOne(
  url: string,
  headers: Record<string, string>,
  case_: GoldenCase
): Promise<CaseResult> {
  const start = Date.now();
  const result: CaseResult = {
    case_id: case_.id,
    name: case_.name,
    http_status: 0,
    elapsed_ms: 0,
  };
  let res: Response;
  let bodyText: string;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(case_.body),
    });
    bodyText = await res.text();
  } catch (e) {
    result.elapsed_ms = Date.now() - start;
    result.http_status = 0;
    result.error = e instanceof Error ? e.message : String(e);
    return result;
  }
  result.elapsed_ms = Date.now() - start;
  result.http_status = res.status;

  if (!res.ok) {
    result.error = bodyText.slice(0, 200);
    return result;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    result.error = 'Invalid JSON response';
    return result;
  }

  result.audio_export_available = data?.audio_export_available === true;
  const audio = data?.audio as Record<string, unknown> | undefined;
  if (audio) {
    result.audio_size_bytes = typeof audio.size_bytes === 'number' ? audio.size_bytes : undefined;
    result.audio_sha256 = typeof audio.sha256 === 'string' ? audio.sha256 : undefined;
    const base64 = typeof audio.base64 === 'string' ? audio.base64 : '';
    if (base64 && !result.audio_sha256) result.audio_sha256 = sha256FromBase64(base64);
    result.wav_valid = base64 ? isWavValid(base64) : undefined;
  }

  const telemetry = data?.telemetry as Record<string, unknown> | undefined;
  if (telemetry) {
    result.model_sha = typeof telemetry.model_sha === 'string' ? telemetry.model_sha : undefined;
    result.model_version = typeof telemetry.model_version === 'string' ? telemetry.model_version : undefined;
    result.tf_backend = typeof telemetry.tf_backend === 'string' ? telemetry.tf_backend : undefined;
  }
  const controls = data?.controls as Record<string, unknown> | undefined;
  if (controls && typeof controls.hash === 'string') result.controls_hash = controls.hash;

  return result;
}

function diffAgainstBaseline(current: CaseResult[], baseline: CaseResult[]): { changedAudioSha: string[]; changedWavValid: string[]; changedStatus: string[]; changedExport: string[]; sizeDelta: string[]; elapsedRegressions: string[] } {
  const byId = (arr: CaseResult[]) => {
    const m = new Map<string, CaseResult>();
    arr.forEach((r) => m.set(r.case_id, r));
    return m;
  };
  const curMap = byId(current);
  const baseMap = byId(baseline);
  const changedAudioSha: string[] = [];
  const changedWavValid: string[] = [];
  const changedStatus: string[] = [];
  const changedExport: string[] = [];
  const sizeDelta: string[] = [];
  const elapsedRegressions: string[] = [];
  const SIZE_DELTA_THRESHOLD = 1000;
  const ELAPSED_REGRESSION_MS = 500;

  curMap.forEach((cur, id) => {
    const base = baseMap.get(id);
    if (!base) return;
    if (cur.audio_sha256 !== undefined && base.audio_sha256 !== undefined && cur.audio_sha256 !== base.audio_sha256) {
      changedAudioSha.push(id);
    }
    if (cur.wav_valid !== base.wav_valid) changedWavValid.push(id);
    if (cur.http_status !== base.http_status) changedStatus.push(id);
    if (cur.audio_export_available !== base.audio_export_available) changedExport.push(id);
    if (
      cur.audio_size_bytes !== undefined &&
      base.audio_size_bytes !== undefined &&
      Math.abs(cur.audio_size_bytes - base.audio_size_bytes) > SIZE_DELTA_THRESHOLD
    ) {
      sizeDelta.push(id);
    }
    if (
      cur.elapsed_ms !== undefined &&
      base.elapsed_ms !== undefined &&
      cur.elapsed_ms > base.elapsed_ms + ELAPSED_REGRESSION_MS
    ) {
      elapsedRegressions.push(id);
    }
  });
  return { changedAudioSha, changedWavValid, changedStatus, changedExport, sizeDelta, elapsedRegressions };
}

async function main(): Promise<void> {
  const baseUrl = process.env.ASTRADIO_BASE_URL;
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    console.error('FAIL: ASTRADIO_BASE_URL is required (e.g. https://astradio-mvp-archive.onrender.com)');
    process.exit(1);
  }
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/api/compose`;
  const healthUrl = `${base}/health`;

  const healthRes = await fetch(healthUrl);
  if (!healthRes.ok) {
    console.error(`FAIL: Health check failed. GET ${healthUrl} returned ${healthRes.status}.`);
    process.exit(1);
  }

  const cases = loadGoldenSet();
  const headers = composeHeaders();
  const results: CaseResult[] = [];
  const delayMs = Math.max(0, parseInt(process.env.GOLDEN_RUN_DELAY_MS || '200', 10) || 200);

  for (let i = 0; i < cases.length; i++) {
    const r = await runOne(url, headers, cases[i]);
    results.push(r);
    if (i < cases.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const gitSha = getGitSha();
  const runDirName = `${timestamp}_${gitSha}`;
  const runDir = path.join(RUNS_DIR, runDirName);
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });

  const passed = results.filter((r) => r.http_status === 200).length;
  const failed = results.length - passed;
  const runMeta: RunMeta = {
    timestamp: new Date().toISOString(),
    git_sha: gitSha,
    base_url: base,
    total: results.length,
    passed,
    failed,
  };
  const payload = { meta: runMeta, results };
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(payload, null, 2), 'utf8');

  const status4xx = results.filter((r) => r.http_status >= 400 && r.http_status < 500).length;
  const status5xx = results.filter((r) => r.http_status >= 500).length;
  const wavInvalid = results.filter((r) => r.audio_export_available === true && r.wav_valid === false).length;
  const audioMissingWhenExport = results.filter((r) => r.http_status === 200 && r.audio_export_available === false).length;
  const elapsedValues = results.filter((r) => r.http_status === 200).map((r) => r.elapsed_ms);
  const avgMs = elapsedValues.length ? elapsedValues.reduce((a, b) => a + b, 0) / elapsedValues.length : 0;
  const sorted = [...elapsedValues].sort((a, b) => a - b);
  const p95Ms = sorted.length ? sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)] : 0;

  const baselineResults = loadBaseline();
  let diffSection = '';
  if (baselineResults && baselineResults.length > 0) {
    const diff = diffAgainstBaseline(results, baselineResults);
    const changedAudioN = diff.changedAudioSha.length;
    diffSection = `
## Diff vs baseline

- **Changed audio sha:** ${changedAudioN} cases${changedAudioN ? '\n  - ' + diff.changedAudioSha.join(', ') : ''}
- **Changed wav_valid:** ${diff.changedWavValid.length} cases${diff.changedWavValid.length ? '\n  - ' + diff.changedWavValid.join(', ') : ''}
- **Changed http_status:** ${diff.changedStatus.length} cases${diff.changedStatus.length ? '\n  - ' + diff.changedStatus.join(', ') : ''}
- **Changed audio_export_available:** ${diff.changedExport.length} cases${diff.changedExport.length ? '\n  - ' + diff.changedExport.join(', ') : ''}
- **Large audio size delta (>1KB):** ${diff.sizeDelta.length} cases${diff.sizeDelta.length ? '\n  - ' + diff.sizeDelta.join(', ') : ''}
- **Elapsed regressions (>500ms):** ${diff.elapsedRegressions.length} cases${diff.elapsedRegressions.length ? '\n  - ' + diff.elapsedRegressions.join(', ') : ''}
`;
  } else {
    diffSection = '\n## Diff vs baseline\nNo baseline found at `vnext/eval/baseline/results.json`. Run `npm run test:compose-golden-baseline` to set.\n';
  }

  const report = `# Golden set evaluation report

**Run:** ${runDirName}  
**Base URL:** ${base}  
**Git SHA:** ${gitSha}

## Summary

| Metric | Value |
|--------|--------|
| Total | ${results.length} |
| Passed (200) | ${passed} |
| Failed | ${failed} |
| 4xx | ${status4xx} |
| 5xx | ${status5xx} |
| WAV invalid (export on) | ${wavInvalid} |
| Audio missing when export available | ${audioMissingWhenExport} |
| Avg elapsed_ms (200 only) | ${avgMs.toFixed(0)} |
| P95 elapsed_ms | ${p95Ms.toFixed(0)} |
${diffSection}

## Artifacts

- \`results.json\` — full case results in this run directory.
- Baseline: \`vnext/eval/baseline/results.json\` (update with \`npm run test:compose-golden-baseline\`).
`;
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  if (process.env.GOLDEN_UPDATE_BASELINE === '1') {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Baseline updated: ${BASELINE_PATH}`);
  }

  console.log(`Golden run complete: ${runDirName}`);
  console.log(`  passed=${passed} failed=${failed} 4xx=${status4xx} 5xx=${status5xx} wav_invalid=${wavInvalid} avg_ms=${avgMs.toFixed(0)} p95_ms=${p95Ms.toFixed(0)}`);
  console.log(`  results: ${path.join(runDir, 'results.json')}`);
  console.log(`  report:  ${path.join(runDir, 'report.md')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
