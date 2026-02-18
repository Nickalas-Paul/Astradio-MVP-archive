/**
 * Phase 4A — Sandbox determinism verification.
 * Fixed birth input + fixed overrides → 3 runs → identical report checksums.
 * Run against engine base URL (default http://localhost:3000).
 */

export {};

const BASE = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000';

function sha256Hex(str: string): string {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Normalize report JSON for deterministic checksum.
 * Sorts nested objects/arrays and removes non-deterministic fields.
 */
function normalizeReport(report: any): string {
  // Extract key fields
  const normalized = {
    personality: report.personality ? {
      traits: report.personality.traits ? Object.keys(report.personality.traits).sort().map(k => ({
        key: k,
        value: report.personality.traits[k]
      })) : [],
      summary: report.personality.summary || ''
    } : null,
    guidance: report.guidance ? {
      themes: report.guidance.themes || [],
      advice: report.guidance.advice || ''
    } : null,
    explanation: report.explanation ? {
      summary: report.explanation.summary || '',
      factors: report.explanation.factors ? report.explanation.factors.map((f: any) => ({
        name: f.name,
        description: f.description
      })).sort((a: any, b: any) => a.name.localeCompare(b.name)) : []
    } : null,
    meta: report.meta || {}
  };
  return JSON.stringify(normalized);
}

const FIXED_BIRTH = {
  date: '1990-01-15',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
  tz: 'UTC',
  houseSystem: 'placidus'
};

const FIXED_OVERRIDES = {
  planets: {
    sun: { lonDeg: 123.4 },
    moon: { lonDeg: 210.0 }
  }
};

async function main() {
  const base = BASE.replace(/\/$/, '');
  let failed = 0;

  try {
    const payload = {
      birth: FIXED_BIRTH,
      overrides: FIXED_OVERRIDES,
      seed: 'phase4a-determinism-seed'
    };

    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${base}/api/sandbox/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.status !== 200) {
        console.error('FAIL: POST /api/sandbox/report returned', r.status);
        const text = await r.text();
        console.error('Response:', text);
        failed++;
        break;
      }
      const d = await r.json();
      results.push(normalizeReport(d));
    }

    if (results.length === 3) {
      const c0 = sha256Hex(results[0]);
      if (results[0] === results[1] && results[1] === results[2]) {
        console.log('OK: sandbox report — 3 runs produced identical outputs');
        console.log('REPORT_CHECKSUM=' + c0);
      } else {
        console.error('FAIL: sandbox report not deterministic');
        console.error('Run 1:', results[0].substring(0, 200));
        console.error('Run 2:', results[1].substring(0, 200));
        console.error('Run 3:', results[2].substring(0, 200));
        failed++;
      }
    }
  } catch (e) {
    console.error('FAIL: sandbox report', e instanceof Error ? e.message : e);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('Phase 4A sandbox determinism check passed.');
  console.log('VERIFICATION=PASS');
}

main();
