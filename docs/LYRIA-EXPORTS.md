# Lyria, GCS exports & Render

## Render env vars (durable exports)

Set these on Render (or in `.env`) for Lyria + GCS-backed exports:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes (for durable exports) | PostgreSQL connection string. Run migrations (`node scripts/migrate.js`) so `astradio_export_jobs` has `storage_key` and `export_meta`. |
| `GOOGLE_CLOUD_PROJECT` | Yes (for Lyria) | GCP project ID. |
| `VERTEX_AI_LOCATION` | No | Region for Vertex AI; default `us-central1`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes (on Render) | **Full JSON key** of the service account (single line or minified). On boot the app writes it to a temp file and sets `GOOGLE_APPLICATION_CREDENTIALS` so ADC works. No `gcloud` login. |
| `GCS_BUCKET` | Yes (for durable exports on Render) | GCS bucket name. WAVs stored at `{GCS_PREFIX}{exportKey}.wav`. |
| `GCS_PREFIX` | No | Object prefix; default `exports/`. |
| `RENDER_PROVIDER` | No | `lyria` (default) or `local_wav`. Fail-closed: Lyria requested but unavailable → error, no fallback. |
| `ENABLE_WAV_EXPORT` | No | Set to `1` to enable WAV in compose and export id in responses. |

**Local dev (no GCS):** Use `RENDER_PROVIDER=local_wav` and omit `GCS_BUCKET`; exports go to disk (ephemeral). For Lyria locally, run `gcloud auth application-default login` and set `GOOGLE_CLOUD_PROJECT` (or use `GOOGLE_SERVICE_ACCOUNT_JSON`).

## Lyria (Vertex AI)

- Lyria predict endpoint: `https://{VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/{GOOGLE_CLOUD_PROJECT}/locations/{VERTEX_AI_LOCATION}/publishers/google/models/lyria-002:predict`.
- Auth: ADC. On Render, set `GOOGLE_SERVICE_ACCOUNT_JSON`; the app writes it to a temp file and sets `GOOGLE_APPLICATION_CREDENTIALS` before any GCP calls.

## Export store (GCS vs disk)

- When **`GCS_BUCKET`** is set: WAVs are stored in GCS at `{GCS_PREFIX}{exportKey}.wav`. GET `/api/exports/:id` streams from GCS. Survives restarts and multi-instance.
- When **`GCS_BUCKET`** is unset: WAVs are written to local disk under `EXPORT_ROOT/exports/`. On Render the filesystem is ephemeral; exports are lost on restart.

## Postgres

- Table `astradio_export_jobs`: `id` = exportKey, `storage_key` = `gs://bucket/prefix/exportKey.wav` (when GCS), `export_meta` (provider, modelVersion, promptHash, payload_hash, duration_s, sha256).
- Run migrations so the table has `storage_key` and `export_meta`: `POSTGRES_URL=... node scripts/migrate.js`.

## Smoke test

Creates an export then downloads it via `/api/exports/:id`:

```bash
# Engine must be running (ENABLE_WAV_EXPORT=1; for Lyria set GOOGLE_CLOUD_PROJECT and GOOGLE_SERVICE_ACCOUNT_JSON or ADC).
API_BASE_URL=http://localhost:4000 node scripts/smoke-lyria-export.js
```

For Render, use your service URL:

```bash
API_BASE_URL=https://your-service.onrender.com node scripts/smoke-lyria-export.js
```
