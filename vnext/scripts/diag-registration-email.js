#!/usr/bin/env node
/**
 * Registration email diagnostic: user lookup + optional Resend send test.
 * Usage: POSTGRES_URL=... node vnext/scripts/diag-registration-email.js [--send-test] [--email addr]
 */
require('dotenv').config();

const email = process.argv.includes('--email')
  ? process.argv[process.argv.indexOf('--email') + 1]
  : 'nico@astradio.io';
const sendTest = process.argv.includes('--send-test');

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error('POSTGRES_URL required');
    process.exit(1);
  }
  const { Pool } = require('pg');
  const needsSsl =
    process.env.PGSSLMODE === 'require' ||
    /render\.com|amazonaws\.com|rds\.amazonaws/i.test(url);
  const pool = new Pool({
    connectionString: url,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const userRes = await pool.query(
    `SELECT id, email, handle, display_name, email_verified, created_at,
            (password_hash IS NOT NULL) AS has_password
     FROM astradio_users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
        OR email_normalized = LOWER(TRIM($1))
     ORDER BY created_at DESC`,
    [email]
  );
  console.log('=== User lookup ===');
  console.log(JSON.stringify(userRes.rows, null, 2));

  if (userRes.rows[0]) {
    const uid = userRes.rows[0].id;
    const tokenRes = await pool.query(
      `SELECT email_verification_token IS NOT NULL AS has_token,
              email_verification_token_expires_at,
              updated_at
       FROM astradio_users WHERE id = $1`,
      [uid]
    );
    console.log('=== Verification token state ===');
    console.log(JSON.stringify(tokenRes.rows, null, 2));
  }

  console.log('=== Env (redacted) ===');
  const key = process.env.RESEND_API_KEY || '';
  console.log({
    RESEND_API_KEY: key
      ? `${key.slice(0, 6)}...${key.slice(-4)} (len=${key.length}, starts_re=${key.startsWith('re_')})`
      : 'MISSING',
    FRONTEND_URL: process.env.FRONTEND_URL || 'MISSING (defaults to https://astradio.io in code)',
    RESEND_FROM: 'Astradio <support@astradio.io> (hardcoded in lib/email.js)',
  });

  if (sendTest) {
    const emailUtil = require('../../lib/email');
    const result = await emailUtil.sendEmail({
      to: email,
      subject: 'Astradio email test',
      html: '<p>Test email from registration diagnostic.</p>',
    });
    console.log('=== Manual send test ===');
    console.log(JSON.stringify(result, null, 2));
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
