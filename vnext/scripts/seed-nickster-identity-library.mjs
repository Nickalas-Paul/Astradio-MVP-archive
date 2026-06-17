import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('localhost') ? undefined : { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(`
INSERT INTO astradio_sandbox_compositions
  (id, owner_user_id, source, export_id, composition_type, object_identity_hash, sandbox_state, report, vector_hash, seed, plan_hash, created_at, updated_at)
SELECT
  'clib_identity_' || SUBSTRING(c.id FROM 7),
  c.owner_id,
  'profile_identity',
  c.identity_export_id,
  'A',
  'seed_' || c.id,
  jsonb_build_object('kind', 'profile_identity', 'chartId', c.id),
  jsonb_build_object('savedFrom', 'identity_audio_seed', 'at', NOW()::text),
  'seed_' || c.id,
  'profile_identity_' || c.id,
  'seed_' || c.id,
  NOW(),
  NOW()
FROM astradio_charts c
WHERE c.owner_id = 'usr_ff0e0495d46e1846'
  AND c.identity_export_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM astradio_sandbox_compositions
    WHERE owner_user_id = c.owner_id AND source = 'profile_identity'
  )
RETURNING id, owner_user_id, export_id
`);
const verify = await client.query(`
SELECT c.id, c.identity_export_id,
  (SELECT COUNT(*)::int FROM astradio_sandbox_compositions s
   WHERE s.owner_user_id = c.owner_id AND s.source = 'profile_identity') AS lib_count
FROM astradio_charts c
WHERE c.owner_id = 'usr_ff0e0495d46e1846'
`);
console.log(JSON.stringify({ inserted: r.rowCount, rows: r.rows, verify: verify.rows }, null, 2));
await client.end();
