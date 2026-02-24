## Astradio Testing Checklist — Exports & Profiles

This checklist covers three test modes and a single **golden path**:

- **Mode A:** `local_wav` + disk export (no Lyria, no GCS)
- **Mode B:** `lyria` + disk export (Lyria enabled, disk-backed exports)
- **Mode C:** `lyria` + GCS export (Lyria + durable GCS exports)

The goal is to verify that you can:

- **Create a user profile**
- **Persist data (Postgres-backed)**
- **Create an audio artifact (compose → export_id)**
- **Download the WAV via `/api/exports/:id`**

---

### 1. Common prerequisites (all modes)

- **Postgres (durable storage)**
  - `POSTGRES_URL` set in the engine environment.
  - Run migrations: `npm run db:migrate`.

- **Next ↔ Engine wiring**
  - `API_BASE_URL` or `ENGINE_BASE_URL` points from web to engine (e.g. Render URL).

- **Exports beta gate**
  - Engine `requireBeta` protects `POST /api/exports`.
  - Next `POST /api/exports` now forwards `x-beta-user` **from the `astradio_dev_user_id` cookie**.
  - For testing:
    - Create a profile first (which sets `astradio_dev_user_id`), **or**
    - Configure beta to allow anon/empty users via env (e.g. `BETA_ENABLED=1` and `BETA_ALLOW` empty to allow all).

---

### 2. Mode A — `local_wav` + disk export

**Engine env vars:**

- `POSTGRES_URL` — required for durable users/charts/exports metadata.
- `RENDER_PROVIDER=local_wav`
- `ENABLE_WAV_EXPORT=1`
- **Do not set** `GCS_BUCKET` (disk export only).

**Behavior:**

- Audio is rendered with the local WAV renderer.
- WAV files are written to disk under `EXPORT_ROOT/exports/` (or `<cwd>/exports/` if unset).
- `POST /api/compose` returns `export_id` when `ENABLE_WAV_EXPORT=1`.
- `GET /api/exports/:id` streams from disk via `export-store`.

---

### 3. Mode B — `lyria` + disk export

**Engine env vars:**

- `POSTGRES_URL`
- `RENDER_PROVIDER=lyria`
- `ENABLE_WAV_EXPORT=1`
- `GOOGLE_CLOUD_PROJECT` — Vertex AI project ID.
- `VERTEX_AI_LOCATION` — e.g. `us-central1` (optional; default is `us-central1`).
- One of:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` (Render/hosted) — full JSON key as a single env value, **or**
  - Application Default Credentials (local dev) via `gcloud auth application-default login`.
- **Do not set** `GCS_BUCKET` (disk export only).

**Behavior:**

- Audio is rendered by Vertex AI `lyria-002:predict`.
- WAV files are still stored on disk (ephemeral in many PaaS environments).
- `export_id` and `/api/exports/:id` behave the same as Mode A.

---

### 4. Mode C — `lyria` + GCS export

**Engine env vars:**

- `POSTGRES_URL`
- `RENDER_PROVIDER=lyria`
- `ENABLE_WAV_EXPORT=1`
- `GOOGLE_CLOUD_PROJECT`
- `VERTEX_AI_LOCATION` (optional)
- `GOOGLE_SERVICE_ACCOUNT_JSON` (service account key with GCS + Vertex permissions)
- `GCS_BUCKET` — target bucket name.
- `GCS_PREFIX` — optional object prefix, e.g. `exports/` (defaults to `exports/`).

**Behavior:**

- Lyria renders WAV buffers.
- `export-store` writes WAVs to `gs://$GCS_BUCKET/$GCS_PREFIX$exportKey.wav`.
- `astradio_export_jobs` rows contain `storage_key` and `export_meta` for each export.
- `GET /api/exports/:id` streams directly from GCS via the export store.

---

### 5. Golden path — end-to-end test

Use any of the three modes above (A/B/C). For Lyria-specific testing, use Mode B or C.

1. **Start engine and web**
   - Engine: `npm run engine:dev` (or your production process) with the chosen env vars.
   - Web: `npm run web:dev` (or your deployed Next app).

2. **Create a dev profile (sets `astradio_dev_user_id`)**
   - From the UI: open the Community/Profile flow and submit a profile form, **or**
   - Call `POST /api/profile` on the Next app with basic `displayName` and optional natal chart data.
   - Verify:
     - Response includes `user.id` and a `primaryChart`.
     - Browser has a cookie `astradio_dev_user_id=<user.id>`.

3. **Verify profile persistence (Postgres)**
   - Restart the engine process.
   - Call `GET /api/profile` again (with the same cookie) and confirm the same `user.id` and `primaryChart` are returned.

4. **Compose music and obtain `export_id`**
   - From the UI:
     - Use any entry point: Landing, Sandbox, Sandbox Builder, or Overlay.
     - Trigger a composition (e.g. pick a location/date or use sandbox controls) and wait for the result.
   - Verify in the network tab or response payload that the compose response contains:
     - `export_id` (64 hex chars)
     - `hashes.plan_sha256` and control hashes (for determinism)
   - Confirm that the UI shows a **“Download WAV (30s)”** button or link.

5. **Download WAV via `/api/exports/:id`**
   - Click the “Download WAV” UI element, which calls the Next route:
     - `GET /api/exports/:id` → proxies to engine `GET /api/exports/:id`.
   - Verify:
     - The response status is `200` and the browser downloads a `.wav` file (e.g. `${export_id}-30s.wav`).
     - In Modes A/B (disk), the corresponding file exists under `EXPORT_ROOT/exports/` on the engine host.
     - In Mode C (GCS), the object exists in `gs://$GCS_BUCKET/$GCS_PREFIX$export_id.wav` and `astradio_export_jobs` has a row for that id.

6. **(Optional) Seed phantom users for compat testing**
   - Ensure `POSTGRES_URL` is set and migrations have run.
   - Run: `npm run seed:phantoms`.
   - Behavior:
     - Writes one row per phantom to `astradio_users`.
     - Writes one row per phantom to `astradio_charts` (owned by that user).
     - Writes one row per phantom to `astradio_user_primary_chart` linking `user_id → chart_id`.
     - Emits progress logs for each created user/chart pair.
     - Writes a manifest at `artifacts/phantom-users.json` (or `PHANTOM_OUTPUT` env) with:
       - `{ count, createdAt, records: [{ userId, chartId }, ...] }`.
   - Usage:
     - **Compatibility:** compat/matches resolves charts via the same storage layer (pg-store); phantom charts participate in similarity bands (ease/spark/growth/complex) exactly like real users.
     - **Community (optional):** phantom users will not appear as group members or post authors unless you explicitly create memberships/posts for them via the community APIs.
     - **Manual testing:** you can plug any `{ userId, chartId }` pair from the manifest into compat, personality, or community profile flows for deterministic, reproducible tests.

---

### 6. Verifying single planner / provider (no duplicates)

Use this section to confirm there is **one planner** and **one provider path** at runtime.

- **Verify planner call sites**
  - From repo root:
    - `rg "generatePlanMLOnly" vnext`  
      Expect matches only in:
      - `vnext/api/compose.ts` (main production compose and comparison helper `composeFromFeatures`).
      - `vnext/plan-generator.ts` (implementation).
      - Test scripts under `vnext/scripts/` (verification only).
  - There should be **no** other production route calling a different planner for `/api/compose`.

- **Verify legacy planner is gated**
  - Legacy endpoint:
    - `server/index.js` defines `/api/render` only when **both**:
      - `DEPRECATE_LEGACY_ROUTES === "false"`, and
      - `LEGACY_PLANNER_ENABLED === "1"`.
  - In normal testing/production, leave `DEPRECATE_LEGACY_ROUTES` at its default (deprecated) and **do not set** `LEGACY_PLANNER_ENABLED`, so the old planner path is unreachable.

- **Verify provider selection**
  - From repo root:
    - `rg "RENDER_PROVIDER" vnext/render`  
      Confirm that:
      - `vnext/render/index.ts` is the **only** place that interprets `RENDER_PROVIDER`.
      - Allowed values are exactly `{ "lyria", "local_wav" }`; any other value causes a hard error.
  - Fallback:
    - If `RENDER_PROVIDER=lyria` and `ALLOW_RENDER_FALLBACK=1`, failures in the Lyria provider will fall back **once** to `local_wav` inside `renderWithProvider`.

- **Check browser engine is playback-only**
  - `apps/web/src/core/audio/browser-performance-engine.ts`:
    - Consumes `plan` and `seed` only; it does **not** call `/api/compose` or run any server-side planner.
    - This ensures there is no second hidden compose path on playback.

- **Runtime log line (guardrail)**
  - Every successful compose call emits a single structured log line from `vnext/api/compose.ts`:
    - Format (JSON payload in one line):
      - `"[COMPOSE_PATH] {\"planner\":\"generatePlanMLOnly\",\"provider\":\"lyria\",\"plan_sha256\":\"<hash>\",\"export_id\":\"<id-or-null>\"}"`
    - A **correct** runtime line has:
      - `planner: "generatePlanMLOnly"`
      - `provider: "lyria"` or `"local_wav"` (or `"none"` when WAV export is disabled or unavailable)
      - `plan_sha256`: the canonical plan hash
      - `export_id`: the export key when `ENABLE_WAV_EXPORT=1`, otherwise `null`
  - To inspect:
    - Grep logs for `COMPOSE_PATH` and confirm each request produces exactly **one** such line with a single planner and provider.

