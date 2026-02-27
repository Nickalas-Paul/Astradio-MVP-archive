/**
 * Phase 4 schema presence check. Run only when POSTGRES_URL is set.
 * Fail-closed: if Phase 4 tables are missing, throw (caller should exit).
 * Does not auto-run migrations.
 */
const PHASE4_TABLES = ['astradio_chart_vectors', 'astradio_likes', 'astradio_connection_intents'];

async function verifyPhase4Schema() {
  if (!process.env.POSTGRES_URL) return;
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  try {
    const res = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [PHASE4_TABLES]
    );
    const found = new Set((res.rows || []).map((r) => r.table_name));
    const missing = PHASE4_TABLES.filter((t) => !found.has(t));
    if (missing.length > 0) {
      const msg = `Phase 4 migration not applied. Missing tables: ${missing.join(', ')}. Run: node scripts/migrate.js`;
      console.error(`[PHASE4_SCHEMA] ${msg}`);
      throw new Error(msg);
    }
    console.log('[PHASE4_SCHEMA] Phase 4 tables present');
  } finally {
    await pool.end();
  }
}

module.exports = { verifyPhase4Schema };
