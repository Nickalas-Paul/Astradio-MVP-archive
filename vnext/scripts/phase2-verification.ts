/**
 * Phase 2 verification: determinism for matches and compatibility intent.
 * - Fixed seeker input → POST /api/compatibility/intent 3 times → identical cluster outputs.
 * - Fixed chartIds → POST /api/community/groups/profile 3 times → identical featuresAgg.
 * Run against engine base URL (default http://localhost:3000).
 * Prints stable checksums (sha256 of canonical comparison payload) when PASS.
 */

export {};

const BASE = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000';

function sha256Hex(str: string): string {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function normalizeClusters(clusters: Array<{ id: string; label: string; band: string; members: unknown[] }>): string {
  return JSON.stringify(
    clusters.map((c) => ({
      id: c.id,
      label: c.label,
      band: c.band,
      memberChartIds: (c.members as Array<{ chartId: string }>).map((m) => m.chartId)
    }))
  );
}

async function main() {
  const base = BASE.replace(/\/$/, '');
  let failed = 0;

  // 1) POST /api/compatibility/intent — run 3 times, assert stable clusters
  const seekerChartId = 'chart_profile_default';
  try {
    const payload = { seekerChartId, intent: 'friendship' as const, limit: 10 };
    const r1 = await fetch(`${base}/api/compatibility/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const r2 = await fetch(`${base}/api/compatibility/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const r3 = await fetch(`${base}/api/compatibility/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r1.status !== 200 || r2.status !== 200 || r3.status !== 200) {
      console.error('FAIL: POST /api/compatibility/intent returned', r1.status, r2.status, r3.status);
      failed++;
    } else {
      const d1 = await r1.json();
      const d2 = await r2.json();
      const d3 = await r3.json();
      const s1 = normalizeClusters(d1.clusters || []);
      const s2 = normalizeClusters(d2.clusters || []);
      const s3 = normalizeClusters(d3.clusters || []);
      if (s1 !== s2 || s2 !== s3) {
        console.error('FAIL: compatibility intent clusters not deterministic', { s1, s2, s3 });
        failed++;
      } else {
        const intentChecksum = sha256Hex(s1);
        console.log('OK: POST /api/compatibility/intent — 3 runs produced identical clusters');
        console.log('INTENT_CHECKSUM=' + intentChecksum);
      }
    }
  } catch (e) {
    console.error('FAIL: POST /api/compatibility/intent', e);
    failed++;
  }

  // 2) POST /api/community/groups/profile — run 3 times, assert identical featuresAgg
  try {
    const chartId = 'chart_profile_default';
    const payload = { groupId: 'phase2_verify', chartIds: [chartId] };
    const r1 = await fetch(`${base}/api/community/groups/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const r2 = await fetch(`${base}/api/community/groups/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const r3 = await fetch(`${base}/api/community/groups/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r1.status !== 200 || r2.status !== 200 || r3.status !== 200) {
      console.error('FAIL: POST /api/community/groups/profile returned', r1.status, r2.status, r3.status);
      failed++;
    } else {
      const d1 = await r1.json();
      const d2 = await r2.json();
      const d3 = await r3.json();
      const f1 = JSON.stringify(d1.featuresAgg);
      const f2 = JSON.stringify(d2.featuresAgg);
      const f3 = JSON.stringify(d3.featuresAgg);
      if (f1 !== f2 || f2 !== f3) {
        console.error('FAIL: group profile featuresAgg not deterministic');
        failed++;
      } else {
        const groupChecksum = sha256Hex(f1);
        console.log('OK: POST /api/community/groups/profile — 3 runs produced identical featuresAgg');
        console.log('GROUP_PROFILE_CHECKSUM=' + groupChecksum);
      }
    }
  } catch (e) {
    console.error('FAIL: POST /api/community/groups/profile', e);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('Phase 2 determinism checks passed.');
  console.log('VERIFICATION=PASS');
}

main();
