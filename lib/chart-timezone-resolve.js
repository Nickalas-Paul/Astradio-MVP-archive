/**
 * Loads the canonical resolver from compiled vnext output (single implementation in vnext/compat/chart-timezone-resolve.ts).
 * Run `npm run vnext:build` before server/tests that hit pg-store or this module.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const compiled = path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'compat', 'chart-timezone-resolve.js');

if (!fs.existsSync(compiled)) {
  throw new Error(
    '[chart-timezone-resolve] Missing compiled module. Run `npm run vnext:build` first.\n' +
      'Expected: ' +
      compiled
  );
}

module.exports = require(compiled);
