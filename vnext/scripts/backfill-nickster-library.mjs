import 'dotenv/config';
import pg from 'pg';

const UID = 'usr_ff0e0495d46e1846';
const IDENTITY_EXPORT = '101c49fe8de6834026730d7ede4dd1d11a8b292d22ce2d4c817b199408b164d2';

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('localhost') ? undefined : { rejectUnauthorized: false },
});

await client.connect();

const backfill = await client.query(
  `UPDATE astradio_sandbox_compositions
   SET export_id = $1, updated_at = NOW()
   WHERE id = (
     SELECT id FROM astradio_sandbox_compositions
     WHERE owner_user_id = $2 AND source = 'profile_identity'
     ORDER BY created_at DESC LIMIT 1
   )
   RETURNING id, source, export_id`,
  [IDENTITY_EXPORT, UID]
);

const dedupe = await client.query(
  `DELETE FROM astradio_sandbox_compositions
   WHERE owner_user_id = $1
     AND source = 'profile_identity'
     AND id != (
       SELECT id FROM astradio_sandbox_compositions
       WHERE owner_user_id = $1 AND source = 'profile_identity'
       ORDER BY created_at DESC LIMIT 1
     )
   RETURNING id`,
  [UID]
);

const cleanDead = await client.query(
  `UPDATE astradio_sandbox_compositions
   SET export_id = NULL, updated_at = NOW()
   WHERE owner_user_id = $1
     AND export_id IS NOT NULL
     AND source != 'profile_identity'
     AND created_at < '2026-06-15T00:00:00Z'
   RETURNING id, source, created_at`,
  [UID]
);

const verifyIdentity = await client.query(
  `SELECT id, source, export_id FROM astradio_sandbox_compositions
   WHERE owner_user_id = $1 AND source = 'profile_identity'`,
  [UID]
);

const verifyCount = await client.query(
  `SELECT COUNT(*)::int AS cnt FROM astradio_sandbox_compositions
   WHERE owner_user_id = $1 AND source = 'profile_identity'`,
  [UID]
);

const verifyDead = await client.query(
  `SELECT COUNT(*)::int AS cnt FROM astradio_sandbox_compositions
   WHERE owner_user_id = $1
     AND export_id IS NOT NULL
     AND source != 'profile_identity'
     AND created_at < '2026-06-15T00:00:00Z'`,
  [UID]
);

const withExport = await client.query(
  `SELECT id, source, export_id FROM astradio_sandbox_compositions
   WHERE owner_user_id = $1 AND export_id IS NOT NULL
   ORDER BY created_at DESC`,
  [UID]
);

console.log(
  JSON.stringify(
    {
      backfillUpdated: backfill.rowCount,
      backfillRows: backfill.rows,
      dedupeDeleted: dedupe.rowCount,
      dedupeIds: dedupe.rows.map((r) => r.id),
      deadExportRowsNulled: cleanDead.rowCount,
      deadExportSample: cleanDead.rows.slice(0, 5),
      verifyIdentity: verifyIdentity.rows,
      profileIdentityCount: verifyCount.rows[0]?.cnt,
      preS3NonIdentityWithExport: verifyDead.rows[0]?.cnt,
      remainingWithExport: withExport.rows,
    },
    null,
    2
  )
);

await client.end();
