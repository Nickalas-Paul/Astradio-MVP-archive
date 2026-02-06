'use strict';
// Sets GOLDEN_UPDATE_BASELINE=1 and runs the golden runner so the latest results are copied to vnext/eval/baseline/results.json
const path = require('path');
process.env.GOLDEN_UPDATE_BASELINE = '1';
require(path.resolve(__dirname, '../dist/vnext/vnext/scripts/compose-golden-run.js'));
