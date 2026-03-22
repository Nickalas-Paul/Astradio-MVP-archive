#!/usr/bin/env node
/**
 * @deprecated Legacy localhost smoke (pre–Unified Spec v1.1 controlSurface shape).
 * Do not use. Run instead:
 *   node scripts/stage7-postdeploy-smoke.js
 * with RENDER_BASE / optional VERCEL_PREVIEW + VERCEL_BYPASS_SECRET.
 */
console.error(
  '[DEPRECATED] scripts/smoke-test.js is removed from support.\n' +
    'Use: node scripts/stage7-postdeploy-smoke.js\n' +
    'See script header for environment variables.'
);
process.exit(1);
