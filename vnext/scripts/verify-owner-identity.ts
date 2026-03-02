#!/usr/bin/env node
/**
 * Phase 5 — Verify owner identity resolution is locked to session in non-dev.
 * When NODE_ENV != 'development', query/body userId must be ignored.
 */

const originalNodeEnv = process.env.NODE_ENV;
const originalAllow = process.env.ALLOW_DEV_USER_FALLBACK;

function assertCheck(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-owner-identity] FAIL: ${msg}`);
    process.exit(1);
  }
}

async function runVerify(): Promise<void> {
  console.log('[verify-owner-identity] Running owner identity verification...');

  // Load module after we set env (resolveOwnerId reads process.env at load time)
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DEV_USER_FALLBACK;

  const { resolveOwnerId } = await import('../relational/owner-resolve');

  // In production: req with query.userId but NO session => must return undefined
  const reqQueryUserId = {
    query: { userId: 'evil_from_query' },
    body: {},
    user: undefined,
  };
  const result1 = await resolveOwnerId(reqQueryUserId);
  assertCheck(result1 === undefined, `prod: query.userId must be ignored; got ${result1}`);

  // In production: req with body.userId but NO session => must return undefined
  const reqBodyUserId = {
    query: {},
    body: { userId: 'evil_from_body' },
    user: undefined,
  };
  const result2 = await resolveOwnerId(reqBodyUserId);
  assertCheck(result2 === undefined, `prod: body.userId must be ignored; got ${result2}`);

  // In production: req.user.id => must return it
  const reqSession = {
    query: { userId: 'evil_attempt' },
    body: { userId: 'evil_attempt' },
    user: { id: 'usr_legit' },
  };
  const result3 = await resolveOwnerId(reqSession);
  assertCheck(result3 === 'usr_legit', `prod: session must win; got ${result3}`);

  // Restore env for other tests
  process.env.NODE_ENV = originalNodeEnv ?? '';
  if (originalAllow !== undefined) process.env.ALLOW_DEV_USER_FALLBACK = originalAllow;
  else delete process.env.ALLOW_DEV_USER_FALLBACK;

  console.log('[verify-owner-identity] All checks passed.');
  process.exit(0);
}

runVerify().catch((e) => {
  process.env.NODE_ENV = originalNodeEnv ?? '';
  if (originalAllow !== undefined) process.env.ALLOW_DEV_USER_FALLBACK = originalAllow;
  console.error('[verify-owner-identity]', e);
  process.exit(1);
});

export {};
