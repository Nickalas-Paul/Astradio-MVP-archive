# Durable persistence (Postgres)

When `POSTGRES_URL` is set, Astradio uses PostgreSQL for users, charts, primary chart mapping, comparisons, community (groups, posts, memberships, comments, reports), and export job metadata. Without it, the app falls back to in-memory storage (lost on restart).

## Schema and migrations

- **Migrations:** `migrations/001_astradio_schema.sql`, `migrations/002_export_storage_key.sql` (adds `storage_key`, `export_meta` for GCS).
- **Run migrations:** `npm run db:migrate` (or `node scripts/migrate.js`)
- **Tables:** `astradio_users`, `astradio_charts`, `astradio_user_primary_chart`, `astradio_comparisons`, `astradio_groups`, `astradio_memberships`, `astradio_posts`, `astradio_comments`, `astradio_reports`, `astradio_export_jobs`

## Storage layer

- **Compat (vnext):** `lib/pg-store.js` implements the same async API as the in-memory store. The server injects it into vnext compat via `setStorage(pgStore)` when `POSTGRES_URL` is set.
- **Community:** `lib/community-store.js` delegates to `lib/pg-store.js` when `POSTGRES_URL` is set; all methods are async.
- **Exports:** When an export is created (POST /api/exports), a row is written to `astradio_export_jobs`. When `GCS_BUCKET` is set, WAVs are stored in Google Cloud Storage and GET /api/exports/:id streams from GCS (durable across restarts). Otherwise WAVs are on local disk (ephemeral on Render).

## Restart test

1. Set `POSTGRES_URL` and run migrations:  
   `npm run db:migrate`
2. Seed test data:  
   `node scripts/restart-test.js seed`
3. Start the server, then stop and start it again (restart).
4. Verify data:  
   `node scripts/restart-test.js verify`

The verify step asserts that the same user, primary chart, group, and post are returned after restart.

## Acceptance (summary)

- **Create user profile + attach natal chart:** Persisted in `astradio_users`, `astradio_charts`, and `astradio_user_primary_chart`; survives restart and redeploy.
- **Community groups and posts:** Persisted in `astradio_groups`, `astradio_memberships`, `astradio_posts`, etc.; survives restart.
- **Compatibility matches:** Use stored charts; feature vectors are computed on demand from chart data (no separate vector table in V1).
- **Exports:** When GCS_BUCKET is set, WAVs in GCS and `storage_key` in `astradio_export_jobs`; GET streams from GCS. Otherwise filesystem + DB path; GET streams from store (GCS or disk).
