/**
 * Phase 3C — Determinism verification for scoped compatibility intent.
 * - COMMUNITY_ROUTER: GET /api/community/guidance must return 200 (exit non-zero if not)
 * - scope=global: 3 runs → identical checksums
 * - scope=group: optional; set PHASE3C_RELATIONAL_GROUP_ID (+ PHASE3C_SEEKER_USER_ID) — 3 runs → identical checksums
 * Run against engine base URL (default http://localhost:3000).
 * Requires server with community routes mounted.
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

const SEEKER_CHART_ID = 'chart_profile_default';

async function main() {
  const base = BASE.replace(/\/$/, '');
  let failed = 0;

  // --- Step 1: Detect community router availability ---
  try {
    const guidanceRes = await fetch(`${base}/api/community/guidance`);
    if (guidanceRes.status !== 200) {
      console.error('COMMUNITY_ROUTER=UNAVAILABLE');
      console.error(`GET /api/community/guidance returned ${guidanceRes.status}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('COMMUNITY_ROUTER=UNAVAILABLE');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log('COMMUNITY_ROUTER=OK');

  // --- Step 2: scope=global — 3 runs, identical checksums (unchanged) ---
  let scopeGlobalChecksum = '';
  try {
    const payload = { seekerChartId: SEEKER_CHART_ID, intent: 'friendship', scope: 'global', limit: 20 };
    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${base}/api/compatibility/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.status !== 200) {
        console.error('FAIL: POST /api/compatibility/intent scope=global returned', r.status);
        failed++;
        break;
      }
      const d = await r.json();
      results.push(normalizeClusters(d.clusters || []));
    }
    if (results.length === 3) {
      scopeGlobalChecksum = sha256Hex(results[0]);
      if (results[0] === results[1] && results[1] === results[2]) {
        console.log('OK: scope=global — 3 runs produced identical clusters');
      } else {
        console.error('FAIL: scope=global clusters not deterministic', results);
        failed++;
      }
    }
  } catch (e) {
    console.error('FAIL: scope=global', e);
    failed++;
  }

  // --- Step 3: scope=group — requires an existing relational group id (legacy community-store seeding removed) ---
  let groupId = process.env.PHASE3C_RELATIONAL_GROUP_ID?.trim() || '';
  let scopeGroupChecksum = '';

  if (!groupId) {
    console.log(
      'SKIP: scope=group — set PHASE3C_RELATIONAL_GROUP_ID to a relational group the seeker can access (owner or member).'
    );
  } else {
    try {
      const groupPayload = {
        seekerChartId: SEEKER_CHART_ID,
        intent: 'friendship',
        scope: 'group',
        groupId,
        seekerUserId: process.env.PHASE3C_SEEKER_USER_ID?.trim() || 'usr_dev',
        limit: 12,
      };

      const results: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await fetch(`${base}/api/compatibility/intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(groupPayload),
        });
        if (r.status !== 200) {
          console.error('FAIL: POST /api/compatibility/intent scope=group returned', r.status);
          failed++;
          break;
        }
        const d = await r.json();
        results.push(normalizeClusters(d.clusters || []));
      }

      if (results.length === 3) {
        scopeGroupChecksum = sha256Hex(results[0]);
        if (results[0] === results[1] && results[1] === results[2]) {
          console.log('OK: scope=group — 3 runs produced identical clusters');
        } else {
          console.error('FAIL: scope=group clusters not deterministic', results);
          failed++;
        }
      }
    } catch (e) {
      console.error('FAIL: scope=group', e instanceof Error ? e.message : e);
      failed++;
    }
  }

  // --- Final output ---
  if (groupId) console.log('GROUP_ID=' + groupId);
  console.log('SCOPE_GLOBAL_CHECKSUM=' + scopeGlobalChecksum);
  if (scopeGroupChecksum) console.log('SCOPE_GROUP_CHECKSUM=' + scopeGroupChecksum);

  if (failed > 0) {
    process.exit(1);
  }
  console.log('Phase 3C determinism checks passed.');
  console.log('VERIFICATION=PASS');
}

main();
