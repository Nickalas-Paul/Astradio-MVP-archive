/**
 * One-off production sanitation: remove a single contaminated legacy test user and owned chart.
 *
 * Run from repo root with POSTGRES_URL set (e.g. Render external DB URL):
 *   npm run vnext:build && node dist/vnext/vnext/scripts/delete-test-user.js
 *
 * Fail-closed: aborts unless the astradio_users row matches EXPECTED_HANDLE.
 * No broad string deletes; only USER_ID / CHART_ID / owner_id scope.
 */

import * as path from 'path';
import { Pool } from 'pg';

import * as dotenv from 'dotenv';

/** Minimal typing for pooled client (avoids @types/pg PoolClient export mismatch). */
type SqlClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: unknown[] }>;
};

const USER_ID = 'usr_fa9366f1e4934d40';
const CHART_ID = 'chart_5242aed2b3877228';
const EXPECTED_HANDLE = 'Nickster43';

/** Post-delete checks (normalized email + handle) */
const VERIFY_EMAIL_NORMALIZED = 'nickalasbilotta@gmail.com';
const VERIFY_HANDLE_LOWER = 'nickster43';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function extractFkTable(msg: string): string | null {
  const m = /from table \"([^\"]+)\"/i.exec(msg);
  return m ? m[1] : null;
}

/** Targeted cleanup only for this USER_ID; keyed by referencing table name from FK errors. */
const SUPPLEMENTAL_BY_TABLE: Record<string, string> = {
  rpg_member_responses: 'DELETE FROM rpg_member_responses WHERE user_id = $1',
  astradio_sandbox_compositions: 'DELETE FROM astradio_sandbox_compositions WHERE owner_user_id = $1',
};

async function tableExists(client: SqlClient, name: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return (r.rowCount ?? 0) > 0;
}

async function delSafe(
  client: SqlClient,
  label: string,
  sql: string,
  params: string[]
): Promise<{ label: string; rows: number; skipped?: boolean }> {
  try {
    const r = await client.query(sql, params);
    return { label, rows: r.rowCount ?? 0 };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation .* does not exist/i.test(msg)) {
      return { label, rows: 0, skipped: true };
    }
    throw e;
  }
}

async function runCoreDeletes(client: SqlClient): Promise<{ label: string; rows: number; skipped?: boolean }[]> {
  const p = [USER_ID, CHART_ID];
  const out: { label: string; rows: number; skipped?: boolean }[] = [];

  out.push(await delSafe(client, 'astradio_user_primary_chart', 'DELETE FROM astradio_user_primary_chart WHERE user_id = $1', [p[0]]));
  out.push(await delSafe(client, 'user_profiles', 'DELETE FROM user_profiles WHERE user_id = $1', [p[0]]));
  out.push(await delSafe(client, 'rpg_profiles', 'DELETE FROM rpg_profiles WHERE user_id = $1', [p[0]]));
  out.push(
    await delSafe(
      client,
      'astradio_profile_projection_cache',
      'DELETE FROM astradio_profile_projection_cache WHERE user_id = $1',
      [p[0]]
    )
  );
  out.push(
    await delSafe(client, 'stage5_campaigns', 'DELETE FROM stage5_campaigns WHERE owner_user_id = $1', [p[0]])
  );

  if (await tableExists(client, 'rpg_campaigns')) {
    const r = await client.query('DELETE FROM rpg_campaigns WHERE user_id = $1', [p[0]]);
    out.push({ label: 'rpg_campaigns', rows: r.rowCount ?? 0 });
  }

  if (await tableExists(client, 'astradio_sandbox_compositions')) {
    const r = await client.query('DELETE FROM astradio_sandbox_compositions WHERE owner_user_id = $1', [p[0]]);
    out.push({ label: 'astradio_sandbox_compositions', rows: r.rowCount ?? 0 });
  }

  out.push(
    await delSafe(
      client,
      'astradio_charts',
      'DELETE FROM astradio_charts WHERE id = $2 OR owner_id = $1',
      [p[0], p[1]]
    )
  );

  const du = await client.query('DELETE FROM astradio_users WHERE id = $1', [p[0]]);
  out.push({ label: 'astradio_users', rows: du.rowCount ?? 0 });

  return out;
}

async function main(): Promise<void> {
  if (!process.env.POSTGRES_URL || !String(process.env.POSTGRES_URL).trim()) {
    console.error(JSON.stringify({ ok: false, error: 'POSTGRES_URL is required' }));
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    const pre = await client.query(
      `SELECT id, handle, display_name, email, email_normalized FROM astradio_users WHERE id = $1`,
      [USER_ID]
    );
    let supplemental: { table: string; rows: number }[] = [];
    let lastLogs: { label: string; rows: number; skipped?: boolean }[] = [];

    if (pre.rowCount === 0) {
      lastLogs = [{ label: 'delete_skipped', rows: 0, skipped: true }];
      console.log(JSON.stringify({ phase: 'preflight', note: 'user row already absent', userId: USER_ID }));
      const orphan = await client.query(
        'DELETE FROM astradio_charts WHERE id = $1 AND (owner_id IS NULL OR owner_id = $2)',
        [CHART_ID, USER_ID]
      );
      if ((orphan.rowCount ?? 0) > 0) {
        lastLogs.push({ label: 'astradio_charts_orphan_by_id', rows: orphan.rowCount ?? 0 });
      }
    } else {
      const row = pre.rows[0] as { handle: string | null };
      if (String(row.handle || '').toLowerCase() !== EXPECTED_HANDLE.toLowerCase()) {
        console.log(
          JSON.stringify({
            ok: false,
            phase: 'preflight',
            error: 'handle mismatch — refuse delete (fail closed)',
            expected: EXPECTED_HANDLE,
            actual: row.handle,
          })
        );
        process.exit(2);
      }

      const chartRow = await client.query(`SELECT id, owner_id FROM astradio_charts WHERE id = $1`, [CHART_ID]);
      if (chartRow.rowCount && chartRow.rows[0].owner_id != null && chartRow.rows[0].owner_id !== USER_ID) {
        console.log(
          JSON.stringify({
            ok: false,
            phase: 'preflight',
            error: 'chart owned by another user — refuse delete',
            chartId: CHART_ID,
            owner_id: chartRow.rows[0].owner_id,
          })
        );
        process.exit(2);
      }

      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          await client.query('BEGIN');
          lastLogs = await runCoreDeletes(client);
          await client.query('COMMIT');
          break;
        } catch (e: unknown) {
          await client.query('ROLLBACK');
          const err = e as { code?: string; message?: string };
          const msg = err.message || String(e);
          const tbl = extractFkTable(msg);
          if (err.code === '23503' && tbl && SUPPLEMENTAL_BY_TABLE[tbl]) {
            const sql = SUPPLEMENTAL_BY_TABLE[tbl];
            const r = await client.query(sql, [USER_ID]);
            supplemental.push({ table: tbl, rows: r.rowCount ?? 0 });
            console.error(JSON.stringify({ fk_retry: attempt, table: tbl, supplemental_rows: r.rowCount ?? 0 }));
            continue;
          }
          console.error(JSON.stringify({ ok: false, phase: 'transaction', attempt, code: err.code, message: msg }));
          process.exit(1);
        }
      }
    }

    const emailDup = await pool.query(`SELECT id FROM astradio_users WHERE email_normalized = $1`, [
      VERIFY_EMAIL_NORMALIZED,
    ]);
    const handleDup = await pool.query(`SELECT id FROM astradio_users WHERE lower(handle) = lower($1)`, [
      VERIFY_HANDLE_LOWER,
    ]);
    const userGone = await pool.query(`SELECT id FROM astradio_users WHERE id = $1`, [USER_ID]);
    const chartGone = await pool.query(`SELECT id FROM astradio_charts WHERE id = $1`, [CHART_ID]);

    console.log(
      JSON.stringify(
        {
          ok: true,
          phase: 'completed',
          userId: USER_ID,
          chartId: CHART_ID,
          deleted: lastLogs,
          supplemental_pre_retry: supplemental,
          verify: {
            email_rows: emailDup.rowCount ?? 0,
            handle_rows: handleDup.rowCount ?? 0,
            user_still_present: userGone.rowCount ?? 0,
            chart_still_present: chartGone.rowCount ?? 0,
          },
        },
        null,
        2
      )
    );

    if ((userGone.rowCount ?? 0) > 0 || (chartGone.rowCount ?? 0) > 0) {
      process.exit(1);
    }
    if ((emailDup.rowCount ?? 0) > 0 || (handleDup.rowCount ?? 0) > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
