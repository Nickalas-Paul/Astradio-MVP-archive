#!/usr/bin/env node
/**
 * One-off: activate requested DM threads + ensure nico@astradio.io can log in.
 * Usage: POSTGRES_URL=... node vnext/scripts/setup-nico-and-dm.js
 */
require('dotenv').config();

const EMAIL = 'nico@astradio.io';
const PASSWORD = 'TestPassword123!';

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error('POSTGRES_URL required');
    process.exit(1);
  }
  const argon2 = require('argon2');
  const { Pool } = require('pg');
  const needsSsl =
    process.env.PGSSLMODE === 'require' ||
    /render\.com|amazonaws\.com|rds\.amazonaws/i.test(url);
  const pool = new Pool({
    connectionString: url,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const dmBefore = await pool.query(
    `SELECT id, status, participant_a, participant_b FROM dm_conversations`
  );
  console.log('DM before:', JSON.stringify(dmBefore.rows, null, 2));

  const dmUp = await pool.query(
    `UPDATE dm_conversations
     SET status = 'active', updated_at = NOW()
     WHERE status = 'requested'
     RETURNING id, status`
  );
  console.log('DM updated:', JSON.stringify(dmUp.rows, null, 2));

  const existing = await pool.query(
    `SELECT id, email, email_verified FROM astradio_users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
        OR email_normalized = LOWER(TRIM($1))`,
    [EMAIL]
  );

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });

  if (existing.rows.length === 0) {
    const { nanoid } = require('nanoid');
    const id = `usr_${nanoid()}`;
    const t = new Date().toISOString();
    await pool.query(
      `INSERT INTO astradio_users
         (id, handle, display_name, email, email_normalized, password_hash,
          email_verified, discoverable, show_in_feed, discoverable_as, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, true, true, 'both', $7, $7)`,
      [id, 'nico', 'Nico', EMAIL, EMAIL.toLowerCase(), passwordHash, t]
    );
    console.log('Created user:', id);
  } else {
    const uid = existing.rows[0].id;
    await pool.query(
      `UPDATE astradio_users
       SET email_verified = true, password_hash = $2, updated_at = NOW()
       WHERE id = $1`,
      [uid, passwordHash]
    );
    console.log('Updated user:', uid);
  }

  const verify = await pool.query(
    `SELECT id, email, email_verified, (password_hash IS NOT NULL) AS has_password
     FROM astradio_users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
    [EMAIL]
  );
  console.log('User verify:', JSON.stringify(verify.rows, null, 2));

  const pgStore = require('../../lib/pg-store');
  const founderId = 'usr_ff0e0495d46e1846';
  const nicoId = verify.rows[0].id;
  const connected = await pgStore.areUsersConnected(founderId, nicoId);
  console.log('areUsersConnected(founder, nico):', connected);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
