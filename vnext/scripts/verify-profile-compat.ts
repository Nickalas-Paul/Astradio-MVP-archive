/**
 * Verification: profile/chart and compat/matches endpoints.
 * Run against engine base URL (default http://localhost:3000).
 * - GET /api/compat/health returns 200
 * - GET /api/compat/matches returns envelope { chartId, mode, limit, matches, generatedAt, version } and stable sort
 * - GET /api/profile/chart returns explainer sections non-empty
 */

export {}; // Ensure module scope

const BASE = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000';

async function main() {
  const base = BASE.replace(/\/$/, '');
  let failed = 0;

  // 1) GET /api/compat/health
  try {
    const r = await fetch(`${base}/api/compat/health`);
    if (r.status !== 200) {
      console.error('FAIL: GET /api/compat/health returned', r.status);
      failed++;
    } else {
      const j = await r.json();
      if (j.status !== 'healthy') {
        console.error('FAIL: /api/compat/health status !== healthy', j);
        failed++;
      } else {
        console.log('OK: GET /api/compat/health returns 200');
      }
    }
  } catch (e) {
    console.error('FAIL: GET /api/compat/health', e);
    failed++;
  }

  // 2) GET /api/compat/matches — exact envelope and stable sort
  const chartId = 'chart_profile_default';
  try {
    const r1 = await fetch(`${base}/api/compat/matches?chartId=${chartId}&mode=friend&limit=3`);
    const r2 = await fetch(`${base}/api/compat/matches?chartId=${chartId}&mode=friend&limit=3`);
    if (r1.status !== 200 || r2.status !== 200) {
      console.error('FAIL: GET /api/compat/matches returned', r1.status, r2.status);
      failed++;
    } else {
      const d1 = await r1.json();
      const d2 = await r2.json();
      const required = ['chartId', 'mode', 'limit', 'matches', 'generatedAt', 'version'];
      for (const key of required) {
        if (!(key in d1)) {
          console.error('FAIL: matches response missing envelope field', key, Object.keys(d1));
          failed++;
          break;
        }
      }
      if (d1.chartId !== chartId || !Array.isArray(d1.matches)) {
        console.error('FAIL: envelope chartId or matches invalid', d1);
        failed++;
      }
      const order1 = (d1.matches || []).map((m: any) => m.chartId);
      const order2 = (d2.matches || []).map((m: any) => m.chartId);
      if (JSON.stringify(order1) !== JSON.stringify(order2)) {
        console.error('FAIL: match order not stable', order1, order2);
        failed++;
      }
      const scores1 = (d1.matches || []).map((m: any) => ({ chartId: m.chartId, score: m.score }));
      const scores2 = (d2.matches || []).map((m: any) => ({ chartId: m.chartId, score: m.score }));
      if (JSON.stringify(scores1) !== JSON.stringify(scores2)) {
        console.error('FAIL: match scores not stable', scores1, scores2);
        failed++;
      }
      if (failed === 0) {
        console.log('OK: GET /api/compat/matches returns envelope and stable results');
      }
    }
  } catch (e) {
    console.error('FAIL: GET /api/compat/matches', e);
    failed++;
  }

  // 3) GET /api/profile/chart returns explainer non-empty
  try {
    const r = await fetch(`${base}/api/profile/chart?chartId=${chartId}`);
    if (r.status !== 200) {
      console.error('FAIL: GET /api/profile/chart returned', r.status);
      failed++;
    } else {
      const j = await r.json();
      const sections = j?.explainer?.sections;
      if (!Array.isArray(sections) || sections.length === 0) {
        console.error('FAIL: explainer.sections missing or empty', j?.explainer);
        failed++;
      } else {
        const id = j?.identity;
        const hash = id?.object_identity_hash || j?.explainer?.meta?.canonical_object_hash;
        if (typeof hash !== 'string' || hash.length !== 64) {
          console.error('FAIL: profile/chart missing identity.object_identity_hash (64 hex)', id, j?.explainer?.meta);
          failed++;
        } else if (!id?.profile_natal_compose_anchor || id?.surface_kind !== 'profile_natal') {
          console.error('FAIL: profile/chart identity envelope incomplete', id);
          failed++;
        } else {
          console.log('OK: GET /api/profile/chart returns explainer with', sections.length, 'sections + identity');
        }
      }
    }
  } catch (e) {
    console.error('FAIL: GET /api/profile/chart', e);
    failed++;
  }

  // 4) POST /api/personality with seed must fail closed (unified anchor)
  try {
    const r = await fetch(`${base}/api/personality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartId, seed: 'legacy-should-reject' }),
    });
    if (r.status !== 400) {
      console.error('FAIL: POST /api/personality with seed expected 400 got', r.status);
      failed++;
    } else {
      const j = await r.json().catch(() => ({}));
      if (j.code !== 'SEED_NOT_SUPPORTED') {
        console.error('FAIL: personality seed rejection missing SEED_NOT_SUPPORTED', j);
        failed++;
      } else {
        console.log('OK: POST /api/personality rejects legacy seed');
      }
    }
  } catch (e) {
    console.error('FAIL: POST /api/personality seed check', e);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('All checks passed.');
}

main();
