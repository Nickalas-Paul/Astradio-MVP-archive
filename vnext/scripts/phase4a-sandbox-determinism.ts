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

/** Normalize /api/sandbox/resolve response for deterministic checksum (compose projection only). */
function normalizeResolve(d: any): string {
  const ex = d?.compose?.explanation;
  const normalized = {
    canonical_input_hash: d?.canonical_input_hash || '',
    canonical_object_hash: d?.canonical_object_hash || '',
    explanation: ex
      ? {
          spec: ex.spec || '',
          sections: Array.isArray(ex.sections)
            ? ex.sections.map((s: any) => ({
                id: s.sectionId || s.id,
                title: s.title,
                text: s.text,
                bullets: s.bullets || [],
              }))
            : [],
        }
      : null,
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
    const SANDBOX_CONTROLS = {
      arc_shape: 0.5,
      density_level: 0.6,
      tempo_norm: 0.7,
      step_bias: 0.7,
      leap_cap: 5,
      rhythm_template_id: 3,
      syncopation_bias: 0.3,
      motif_rate: 0.6,
    };
    const payload = {
      schema_version: '1',
      slots: [{ ephemeris_birth: FIXED_BIRTH, overrides: FIXED_OVERRIDES }],
      active_slot_index: 0,
      compose_controls: SANDBOX_CONTROLS,
      output_kind: 'full',
      seed: 'phase4a-determinism-seed',
    };

    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${base}/api/sandbox/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.status !== 200) {
        console.error('FAIL: POST /api/sandbox/resolve returned', r.status);
        const text = await r.text();
        console.error('Response:', text);
        failed++;
        break;
      }
      const d = await r.json();
      results.push(normalizeResolve(d));
    }

    if (results.length === 3) {
      const c0 = sha256Hex(results[0]);
      if (results[0] === results[1] && results[1] === results[2]) {
        console.log('OK: sandbox resolve — 3 runs produced identical outputs');
        console.log('REPORT_CHECKSUM=' + c0);
      } else {
        console.error('FAIL: sandbox resolve not deterministic');
        console.error('Run 1:', results[0].substring(0, 200));
        console.error('Run 2:', results[1].substring(0, 200));
        console.error('Run 3:', results[2].substring(0, 200));
        failed++;
      }
    }
  } catch (e) {
    console.error('FAIL: sandbox resolve', e instanceof Error ? e.message : e);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('Phase 4A sandbox determinism check passed.');
  console.log('VERIFICATION=PASS');
}

main();
