#!/usr/bin/env node
/**
 * Non-blocking advisory: ensure naming contract doc exists.
 * Does not scan code (no false positives). Optional: run in CI with `|| true` until stricter checks are approved.
 * See docs/NAMING-TAXONOMY.md — Appendix A.
 */
const fs = require('fs');
const path = require('path');

const doc = path.join(__dirname, '..', 'docs', 'NAMING-TAXONOMY.md');
if (!fs.existsSync(doc)) {
  console.error('[naming-taxonomy] Missing docs/NAMING-TAXONOMY.md');
  process.exit(1);
}
console.log('[naming-taxonomy] docs/NAMING-TAXONOMY.md present (axis: Product / Proj / Acct / Verify).');
process.exit(0);
