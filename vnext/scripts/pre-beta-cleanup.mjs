/**
 * Pre-beta production DB cleanup. BACKUP FIRST, then phased cleanup.
 * Usage: node vnext/scripts/pre-beta-cleanup.mjs [--backup-only] [--execute]
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const DB_URL =
  process.env.POSTGRES_URL ||
  'postgresql://astradio:Yx8wVN4nVaNcxEpylt9MYDugQu2g1hYQ@dpg-d6jp4rea2pns73fon48g-a.virginia-postgres.render.com/astradio';

const BACKUP_PATH = path.resolve(
  process.cwd(),
  'astradio_pre_cleanup_backup_20260617.sql'
);

const NICKSTER_ID = 'usr_ff0e0495d46e1846';
const NICO_ID = 'usr_ff8ae4481100e66d';
const NICKLAUS_ID = 'usr_7219bff05e7de435';
const NICO_TEAM_ID = 'usr_35bffa77cbb8916e';
const NICKSTER_CHART_ID = 'chart_15bb1c43bf962c73';

const RETAINED_PROFILES = [
  {
    id: 'qa_compat_user_01',
    handle: 'astrid_wave',
    display_name: 'Astrid Waverly',
    bio: 'Pisces sun, Scorpio moon. Sound designer exploring how charts translate to music.',
  },
  {
    id: 'qa_compat_user_02',
    handle: 'sol_reyes',
    display_name: 'Sol Reyes',
    bio: "Aries rising with a Libra stellium. Balancing fire and air since '94.",
  },
  {
    id: 'qa_compat_user_03',
    handle: 'luna_maren',
    display_name: 'Luna Maren',
    bio: 'Cancer sun, Capricorn moon. Night owl, ocean lover, chart obsessive.',
  },
  {
    id: 'qa_compat_user_04',
    handle: 'jude_onyx',
    display_name: 'Jude Onyx',
    bio: 'Aquarius sun, Leo moon. Interested in group dynamics and composite charts.',
  },
  {
    id: 'qa_compat_user_05',
    handle: 'celeste_dao',
    display_name: 'Celeste Dao',
    bio: 'Virgo sun, Sagittarius rising. Analyzing every degree because someone has to.',
  },
  {
    id: 'qa_compat_user_06',
    handle: 'kai_ember',
    display_name: 'Kai Ember',
    bio: 'Scorpio sun, Aries moon. Here for the intensity, not the small talk.',
  },
  {
    id: 'qa_compat_user_07',
    handle: 'river_lux',
    display_name: 'River Lux',
    bio: 'Gemini sun, Taurus moon. Two minds, one steady heartbeat.',
  },
  {
    id: 'qa_compat_user_08',
    handle: 'nova_seln',
    display_name: 'Nova Seln',
    bio: 'Capricorn sun, Aquarius moon. Building systems that sound like something.',
  },
];

const KEEP_IDS = new Set([NICKSTER_ID, NICO_ID, ...RETAINED_PROFILES.map((p) => p.id)]);

const COUNT_TABLES = [
  'astradio_users',
  'astradio_charts',
  'astradio_relationships',
  'astradio_connection_intents',
  'astradio_signals',
  'astradio_sandbox_compositions',
  'community_posts',
  'community_comments',
  'community_likes',
  'community_user_settings',
  'astradio_community_relational_weather_daily_artifacts',
];

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

function escSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function tableCounts() {
  const counts = {};
  for (const t of COUNT_TABLES) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
      counts[t] = r.rows[0].n;
    } catch {
      counts[t] = null;
    }
  }
  return counts;
}

async function createBackup() {
  const lines = [
    '-- Astradio pre-cleanup backup',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Source: production Render Postgres`,
    'BEGIN;',
    '',
  ];

  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`);
  const tables = tablesRes.rows.map((r) => r.table_name);

  for (const table of tables) {
    const colsRes = await client.query(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    const cols = colsRes.rows.map((r) => r.column_name);
    const rowsRes = await client.query(`SELECT * FROM ${table}`);
    lines.push(`-- Table: ${table} (${rowsRes.rowCount} rows)`);
    if (rowsRes.rowCount === 0) {
      lines.push('');
      continue;
    }
    for (const row of rowsRes.rows) {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') return String(v);
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === 'object') {
          const udt = colsRes.rows.find((x) => x.column_name === c)?.udt_name;
          const json = JSON.stringify(v).replace(/'/g, "''");
          return udt === 'jsonb' ? `'${json}'::jsonb` : `'${json}'`;
        }
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }
    lines.push('');
  }
  lines.push('COMMIT;', '');
  fs.writeFileSync(BACKUP_PATH, lines.join('\n'), 'utf8');
  const stat = fs.statSync(BACKUP_PATH);
  return { path: BACKUP_PATH, size: stat.size, tables: tables.length };
}

function canonicalPair(a, b) {
  const sa = String(a);
  const sb = String(b);
  return sa.localeCompare(sb, 'en') <= 0 ? [sa, sb] : [sb, sa];
}

async function insertRelationship(ownerUserId, chartAId, chartBId, label = 'Friend') {
  const [chartIdLow, chartIdHigh] = canonicalPair(chartAId, chartBId);
  const idRes = await client.query(
    "SELECT 'rel_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16) AS id"
  );
  const id = idRes.rows[0].id;
  const ins = await client.query(
    `INSERT INTO astradio_relationships
      (id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NULL, NOW(), NOW())
     ON CONFLICT (owner_user_id, chart_id_low, chart_id_high, label) DO NOTHING
     RETURNING id`,
    [id, ownerUserId, chartIdLow, chartIdHigh, label]
  );
  return ins.rowCount === 1 ? ins.rows[0].id : null;
}

async function nicoConsolidationReport() {
  const rels = await client.query(
    `SELECT id, label, owner_user_id, created_at FROM astradio_relationships
     WHERE owner_user_id IN ($1, $2) ORDER BY created_at`,
    [NICKLAUS_ID, NICO_TEAM_ID]
  );
  const charts = await client.query(
    `SELECT id, owner_id, label, created_at FROM astradio_charts
     WHERE owner_id IN ($1, $2) ORDER BY created_at`,
    [NICKLAUS_ID, NICO_TEAM_ID]
  );
  const comps = await client.query(
    `SELECT id, owner_user_id, created_at FROM astradio_sandbox_compositions
     WHERE owner_user_id IN ($1, $2) ORDER BY created_at`,
    [NICKLAUS_ID, NICO_TEAM_ID]
  );
  const nicksterNico = await client.query(
    `SELECT r.id, r.label, r.owner_user_id
     FROM astradio_relationships r
     WHERE r.owner_user_id IN ($1, $2)
       AND EXISTS (
         SELECT 1 FROM astradio_charts c
         WHERE c.owner_id = CASE WHEN r.owner_user_id = $1 THEN $2 ELSE $1 END
           AND (c.id = r.chart_id_low OR c.id = r.chart_id_high)
       )`,
    [NICKSTER_ID, NICO_ID]
  );
  return { rels: rels.rows, charts: charts.rows, comps: comps.rows, nicksterNico: nicksterNico.rows };
}

async function seedNicksterConnections() {
  const seeded = [];
  const targets = RETAINED_PROFILES.slice(0, 4);
  for (const profile of targets) {
    const peerChart = await client.query(
      `SELECT id FROM astradio_charts WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [profile.id]
    );
    const chartId = peerChart.rows[0]?.id;
    if (!chartId) {
      seeded.push({ profile: profile.handle, status: 'skipped_no_chart' });
      continue;
    }
    const a = await insertRelationship(NICKSTER_ID, NICKSTER_CHART_ID, chartId, 'Friend');
    const b = await insertRelationship(profile.id, chartId, NICKSTER_CHART_ID, 'Friend');
    seeded.push({
      profile: profile.handle,
      user_id: profile.id,
      peer_chart: chartId,
      nickster_rel: a ? 'created' : 'exists',
      peer_rel: b ? 'created' : 'exists',
    });
  }
  return seeded;
}

async function cleanupOrphans() {
  const results = {};
  const checks = {
    orphan_charts_null_owner: `SELECT id FROM astradio_charts WHERE owner_id IS NULL`,
    orphan_relationships: `SELECT id FROM astradio_relationships WHERE owner_user_id NOT IN (SELECT id FROM astradio_users)`,
    orphan_signals: `SELECT id FROM astradio_signals WHERE recipient_user_id NOT IN (SELECT id FROM astradio_users)`,
    orphan_intents: `SELECT id FROM astradio_connection_intents WHERE from_user_id NOT IN (SELECT id FROM astradio_users) OR to_user_id NOT IN (SELECT id FROM astradio_users)`,
    orphan_compositions: `SELECT id FROM astradio_sandbox_compositions WHERE owner_user_id NOT IN (SELECT id FROM astradio_users)`,
    orphan_weather: `SELECT id FROM astradio_community_relational_weather_daily_artifacts
      WHERE created_by_user_id NOT IN (SELECT id FROM astradio_users)
         OR (seeker_chart_id IS NOT NULL AND seeker_chart_id NOT IN (SELECT id FROM astradio_charts))
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(chart_ids_ordered) elem
           WHERE elem NOT IN (SELECT id FROM astradio_charts)
         )`,
  };
  for (const [key, sql] of Object.entries(checks)) {
    const r = await client.query(sql);
    results[key] = { before: r.rowCount, ids: r.rows.map((x) => x.id) };
  }

  const deletes = [
    ['astradio_charts', `DELETE FROM astradio_charts WHERE owner_id IS NULL`],
    ['astradio_relationships', `DELETE FROM astradio_relationships WHERE owner_user_id NOT IN (SELECT id FROM astradio_users)`],
    ['astradio_signals', `DELETE FROM astradio_signals WHERE recipient_user_id NOT IN (SELECT id FROM astradio_users)`],
    ['astradio_connection_intents', `DELETE FROM astradio_connection_intents WHERE from_user_id NOT IN (SELECT id FROM astradio_users) OR to_user_id NOT IN (SELECT id FROM astradio_users)`],
    ['astradio_sandbox_compositions', `DELETE FROM astradio_sandbox_compositions WHERE owner_user_id NOT IN (SELECT id FROM astradio_users)`],
    [
      'astradio_community_relational_weather_daily_artifacts',
      `DELETE FROM astradio_community_relational_weather_daily_artifacts
       WHERE created_by_user_id NOT IN (SELECT id FROM astradio_users)
          OR (seeker_chart_id IS NOT NULL AND seeker_chart_id NOT IN (SELECT id FROM astradio_charts))
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(chart_ids_ordered) elem
            WHERE elem NOT IN (SELECT id FROM astradio_charts)
          )`,
    ],
  ];
  results.deleted = {};
  for (const [table, sql] of deletes) {
    const r = await client.query(sql);
    results.deleted[table] = r.rowCount;
  }
  return results;
}

const execute = process.argv.includes('--execute');
const backupOnly = process.argv.includes('--backup-only');

await client.connect();
const report = { execute, backupOnly };

try {
  report.beforeCounts = await tableCounts();

  const backup = await createBackup();
  report.backup = backup;
  if (backup.size < 10000) {
    throw new Error(`Backup suspiciously small (${backup.size} bytes). Aborting.`);
  }
  console.log('BACKUP_OK', JSON.stringify(backup));

  if (backupOnly) {
    console.log('BACKUP_ONLY_DONE');
    process.exit(0);
  }

  report.nicoBefore = await nicoConsolidationReport();
  if (report.nicoBefore.nicksterNico.length === 0) {
    throw new Error('Nickster <-> Nico relationship missing. Aborting Nico consolidation.');
  }

  if (!execute) {
    report.plannedKeep = [...KEEP_IDS];
    report.nicoBefore = report.nicoBefore;
    console.log('DRY_RUN', JSON.stringify(report, null, 2));
    process.exit(0);
  }

  await client.query('BEGIN');

  for (const p of RETAINED_PROFILES) {
    await client.query(
      `UPDATE astradio_users SET
        handle = $2, display_name = $3, bio = $4,
        email = $5, discoverable = true, discoverable_as = 'both',
        show_in_feed = true, avatar_url = NULL
       WHERE id = $1`,
      [p.id, p.handle, p.display_name, p.bio, `${p.handle}@testuser.astradio.dev`]
    );
  }
  report.profilesUpdated = RETAINED_PROFILES.length;

  const delNicklaus = await client.query(`DELETE FROM astradio_users WHERE id = $1`, [NICKLAUS_ID]);
  const delTeam = await client.query(`DELETE FROM astradio_users WHERE id = $1`, [NICO_TEAM_ID]);
  report.nicoDeleted = { nicklaus: delNicklaus.rowCount, team: delTeam.rowCount };

  const keepList = [...KEEP_IDS];
  const delRest = await client.query(
    `DELETE FROM astradio_users WHERE NOT (id = ANY($1::text[]))`,
    [keepList]
  );
  report.usersDeleted = delRest.rowCount;

  report.afterDeleteCounts = await tableCounts();
  report.orphans = await cleanupOrphans();
  report.connectionsSeeded = await seedNicksterConnections();

  report.finalUsers = (
    await client.query(
      `SELECT id, handle, display_name, bio, discoverable, avatar_url IS NOT NULL AS has_avatar
       FROM astradio_users ORDER BY created_at ASC`
    )
  ).rows;

  report.finalCounts = await tableCounts();

  await client.query('COMMIT');
  console.log('CLEANUP_DONE', JSON.stringify(report, null, 2));
} catch (err) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* ignore */
  }
  console.error('CLEANUP_FAILED', err.message);
  process.exit(1);
} finally {
  await client.end();
}
