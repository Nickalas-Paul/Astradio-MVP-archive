#!/usr/bin/env node
/**
 * Static migration verification: syntax sanity, table naming consistency, banned patterns.
 * Does not require DB. Does not execute migrations. Purely static checks.
 */
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

const EXPECTED_TABLES_003 = [
  'astradio_likes',
  'astradio_connection_intents',
  'astradio_chart_vectors',
  'astradio_lineages',
  'astradio_lineage_members',
  'astradio_analysis_sets',
  'astradio_analysis_artifact_manifests',
];

let ok = true;
for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filePath, 'utf8');
  if (file === '003_phase4_community.sql') {
    for (const table of EXPECTED_TABLES_003) {
      if (!sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
        console.error(`[verify-migration] Missing: CREATE TABLE IF NOT EXISTS ${table}`);
        ok = false;
      }
    }
    if (sql.includes('astradio_compatibility_scores')) {
      console.error('[verify-migration] Phase 4 must NOT include CompatibilityScore table');
      ok = false;
    }
  }
  if (sql.includes('DROP TABLE') && !sql.includes('IF EXISTS')) {
    console.error(`[verify-migration] ${file}: DROP TABLE without IF EXISTS may be destructive`);
    ok = false;
  }
  if (sql.includes('TRUNCATE ') && !sql.includes('CASCADE')) {
    console.error(`[verify-migration] ${file}: TRUNCATE without CASCADE may violate FK constraints`);
    ok = false;
  }
}
if (ok) {
  console.log('[verify-migration] Static checks passed');
} else {
  process.exit(1);
}
