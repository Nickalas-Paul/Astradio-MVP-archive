/**
 * Verification: GET /api/community/search (directory search).
 * Run against engine base URL (default http://localhost:3000).
 * - /api/community/search?q=Demo returns >= 1 user and stable ordering across two calls
 * - Searching for a known seeded displayName substring returns that user
 */

export {}; // Ensure module scope

const BASE = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000';

async function main() {
  const base = BASE.replace(/\/$/, '');
  let failed = 0;

  // 1) GET /api/community/search?q=Demo — at least one user, stable order (call twice)
  try {
    const r1 = await fetch(`${base}/api/community/search?q=Demo&limit=10`);
    const r2 = await fetch(`${base}/api/community/search?q=Demo&limit=10`);
    if (r1.status !== 200 || r2.status !== 200) {
      console.error('FAIL: GET /api/community/search?q=Demo returned', r1.status, r2.status);
      failed++;
    } else {
      const d1 = await r1.json();
      const d2 = await r2.json();
      const users1 = Array.isArray(d1.users) ? d1.users : [];
      const users2 = Array.isArray(d2.users) ? d2.users : [];
      if (users1.length < 1) {
        console.error('FAIL: search?q=Demo returned < 1 user', users1.length);
        failed++;
      }
      const order1 = users1.map((u: { userId: string }) => u.userId);
      const order2 = users2.map((u: { userId: string }) => u.userId);
      if (JSON.stringify(order1) !== JSON.stringify(order2)) {
        console.error('FAIL: search order not stable', order1, order2);
        failed++;
      }
      const required = ['q', 'limit', 'users', 'generatedAt', 'version'];
      for (const key of required) {
        if (!(key in d1)) {
          console.error('FAIL: response missing field', key, Object.keys(d1));
          failed++;
          break;
        }
      }
      if (failed === 0) {
        console.log('OK: GET /api/community/search?q=Demo returns >= 1 user and stable ordering');
      }
    }
  } catch (e) {
    console.error('FAIL: GET /api/community/search?q=Demo', e);
    failed++;
  }

  // 2) Known seeded displayName substring — "User" matches "Demo User 1", etc.
  try {
    const r = await fetch(`${base}/api/community/search?q=User&limit=10`);
    if (r.status !== 200) {
      console.error('FAIL: GET /api/community/search?q=User returned', r.status);
      failed++;
    } else {
      const d = await r.json();
      const users = Array.isArray(d.users) ? d.users : [];
      if (users.length === 0) {
        console.error('FAIL: search?q=User returned 0 users (seeded directory has "Demo User N")');
        failed++;
      } else {
        const withUser = users.filter(
          (u: { displayName?: string }) => (u.displayName || '').toLowerCase().includes('user')
        );
        if (withUser.length === 0) {
          console.error('FAIL: search?q=User did not return any user with "User" in displayName', users);
          failed++;
        } else {
          console.log('OK: Known seeded displayName substring returns expected user(s)');
        }
      }
    }
  } catch (e) {
    console.error('FAIL: GET /api/community/search?q=User', e);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log('All community search checks passed.');
}

main();
