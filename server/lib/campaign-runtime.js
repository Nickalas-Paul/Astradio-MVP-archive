/**
 * Active Campaign runtime boundary.
 * The executable server path stays on compiled dist, but only after parity checks
 * confirm the Campaign dist modules are present and not older than current source.
 */

const fs = require('fs');
const path = require('path');

const DIST_VNEXT_ROOT = path.join(__dirname, '..', '..', 'dist', 'vnext', 'vnext');
const SOURCE_VNEXT_ROOT = path.join(__dirname, '..', '..', 'vnext');
const CAMPAIGN_DAILY_ENGINE_VERSION = 'campaign_daily_phase1_v1';

const ACTIVE_CAMPAIGN_RUNTIME_FILES = [
  ['campaign/phase1/index.js', 'campaign/phase1/index.ts'],
  ['campaign/materialize-daily.js', 'campaign/materialize-daily.ts'],
  ['campaign/transit-chart-input.js', 'campaign/transit-chart-input.ts'],
  ['core/architecture-engine.js', 'core/architecture-engine.ts'],
  ['relational/resolve-relational-connection-context.js', 'relational/resolve-relational-connection-context.ts'],
  ['rpg/campaign/state-machine.js', 'rpg/campaign/state-machine.ts'],
  ['rpg/reflection-mapper.js', 'rpg/reflection-mapper.ts'],
  ['rpg/hash/json-hash.js', 'rpg/hash/json-hash.ts'],
  ['compat/chart-store.js', 'compat/chart-store.ts'],
  ['rpg/store/rpg-store.js', 'rpg/store/rpg-store.ts'],
];

function fileMtimeMs(filePath) {
  return fs.statSync(filePath).mtimeMs;
}

function formatParityMessage(issues) {
  const detail = issues.map((issue) => `${issue.kind}:${issue.dist}`).join(', ');
  return `Campaign runtime parity check failed (${detail}). Run npm run vnext:build.`;
}

function ensureCampaignRuntimeParity() {
  const issues = [];

  for (const [distRel, sourceRel] of ACTIVE_CAMPAIGN_RUNTIME_FILES) {
    const distPath = path.join(DIST_VNEXT_ROOT, distRel);
    const sourcePath = path.join(SOURCE_VNEXT_ROOT, sourceRel);

    if (!fs.existsSync(distPath)) {
      issues.push({ kind: 'missing_dist', dist: distRel });
      continue;
    }
    if (!fs.existsSync(sourcePath)) {
      issues.push({ kind: 'missing_source', dist: distRel });
      continue;
    }
    if (fileMtimeMs(distPath) + 1 < fileMtimeMs(sourcePath)) {
      issues.push({ kind: 'stale_dist', dist: distRel });
    }
  }

  if (issues.length > 0) {
    const err = new Error(formatParityMessage(issues));
    err.code = 'CAMPAIGN_RUNTIME_PARITY_FAILED';
    err.issues = issues;
    throw err;
  }

  return DIST_VNEXT_ROOT;
}

function requireCampaignRuntimeModule(relPath) {
  const runtimeRoot = ensureCampaignRuntimeParity();
  return require(path.join(runtimeRoot, relPath));
}

module.exports = {
  CAMPAIGN_DAILY_ENGINE_VERSION,
  DIST_VNEXT_ROOT,
  ACTIVE_CAMPAIGN_RUNTIME_FILES,
  ensureCampaignRuntimeParity,
  requireCampaignRuntimeModule,
};
