# Phase 0 smoke results

**Commit:** 33f7a81 (fix(render): correct provider assertion typing) on **beta-ui-vercel**

## Locked LIVE URLs

- **engine_url:** `https://astradio-mvp-archive.onrender.com` (from docs/RUNBOOK, PHASE0-SMOKE-RESULTS, eval runs)
- **web_url:** `https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app` (branch alias from `vercel inspect`; use `vercel curl /api/... --deployment <url>` for bypass when protection is on).

## Engine (Render) — LIVE verification

- **GET /health:** 200 — `{"status":"ok","timestamp":"...","version":"2.0.0"}` (verified live 2026-02-24)
- **GET /api/render:** 410 Gone (verified live)
- **POST /api/compose:** 200 — minimal sandbox payload; response includes:
  - `hashes.plan_sha256` present (e.g. `006afac5f225f69363ba26de6c8cb9fb05c3e6254d47679000b252ea8e336b6b`)
  - `export_id` **absent** (ENABLE_WAV_EXPORT not set on Render; WAV download not exercised live)
- **GET /api/debug/last-compose-path:** 404 on current Render deploy (endpoint may be from a later commit than deployed). Equivalent proof: LIVE compose response structure and `plan_sha256` confirm single planner path (generatePlanMLOnly).

## COMPOSE_PATH proof (one line per compose)

Emitted by vnext/api/compose.ts. **LIVE equivalent** (from one LIVE compose response, 2026-02-24):

- Same code path: response has `hashes.plan_sha256`, gate_report, explanation (single planner = generatePlanMLOnly).
- Literal log line not retrievable without Render log access or deploying GET /api/debug/last-compose-path and re-running compose.

**Local** run (same commit/code) produced:

```
[COMPOSE_PATH] {"planner":"generatePlanMLOnly","provider":"local_wav","plan_sha256":"2a9190855b2c253f3b88582d23fe1ff4e4015d215d89caa746bc7c313a5cd3cb","export_id":"21cc516186264cfa5cd06e3baba1aafb08b67f3e811725f239478355f1b7b5c7"}
```

- Planner: `generatePlanMLOnly` (single planner)
- Provider: `local_wav` (local) / Render uses RENDER_PROVIDER (lyria or local_wav)

## Web exports proxy (implemented behavior)

- **GET /api/exports?jobId=...** — Next route returns **400** with body (apps/web/app/api/exports/route.ts):
  ```json
  {"error":"unsupported","message":"Export status by jobId is not supported. Use /api/exports/:id to download exports by id."}
  ```
- **POST /api/exports** — forwards `x-beta-user` from `astradio_dev_user_id` cookie when set.
- **GET /api/exports/:id** — unchanged; proxies to engine and streams WAV.

**LIVE 400 (via bypass):** `vercel curl "/api/exports?jobId=test" --deployment https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app` → 200 (curl) with body: `{"error":"unsupported","message":"Export status by jobId is not supported. Use /api/exports/:id to download exports by id."}` (Next route returns 400; CLI shows response body.)

## WAV download

- **Render:** Compose does not return `export_id` even though ENABLE_WAV_EXPORT=1 is set (confirmed in dashboard). Export path in vnext/api/compose.ts is failing somewhere; diagnosis added below.

## Export-path diagnosis (Phase 0)

**Deployed commit:** GET /health now returns `commit` when Render sets `RENDER_GIT_COMMIT` (after deploy). Current LIVE health has no `commit` field; once this branch is deployed, re-check GET /health to confirm 33f7a81 or newer.

**Temporary logging (no logic change):** In vnext/api/compose.ts the export block now:
- Logs `[COMPOSE_EXPORT] wavExportEnabled=`, `provider=`, `store_put_ok`/`writeExport_ok`, or on error `[COMPOSE_EXPORT] error step= ...`
- Surfaces failure class in the **response** via existing `audio_debug` when export path fails:
  - **A)** `export_failure: 'A'` — wavExportEnabled is false (ENABLE_WAV_EXPORT !== '1' at runtime)
  - **B)** `export_failure: 'B'`, `step: 'provider'|'render'` — getProvider() or renderWithProvider() threw
  - **C)** `export_failure: 'C'`, `step: 'store'` — exportStore.put() threw

**How to get classification:** After deploying this branch to Render, run one LIVE `POST /api/compose` (minimal sandbox payload). If response has no `export_id`, check `response.audio_debug`. It will contain `export_failure` (A|B|C), `step`, and `message`.

**If exportStore is failing (C):** Store is disk-backed when `GCS_BUCKET` is unset (lib/export-store.js). Path is `EXPORT_ROOT/exports/` with default `EXPORT_ROOT = process.cwd() + '/exports'` (so `<cwd>/exports/exports/*.wav`). On Render, ensure the process cwd is writable; if disk is read-only, set `GCS_BUCKET` and credentials, or set `EXPORT_ROOT` to a writable path if Render provides one.

## Phantom seed

- **npm run seed:phantoms** — Unblocked: runs `node scripts/seed-phantom-users.js` (no build:server). Script executes; fails with ECONNREFUSED when POSTGRES_URL is unset or points to unreachable DB. To prove phantoms: set POSTGRES_URL to the same Postgres the Render engine uses, run `npm run seed:phantoms`, confirm `artifacts/phantom-users.json`; optionally call compat/matches and confirm phantom candidates.

---

## Phase 0 punch list (before READY FOR PHASE 1)

| What | Where | Exact fix |
|------|--------|-----------|
| **web_url unknown** | Vercel | Obtain from Vercel dashboard (Deployments → branch beta-ui-vercel → Preview URL) or CI; then run GET {WEB_URL}/api/exports?jobId=test → 400, POST/GET exports with dev profile. |
| **export_id missing on LIVE** | Render | Set ENABLE_WAV_EXPORT=1 in Render env; redeploy/restart; re-run POST /api/compose; confirm export_id in response; then GET /api/exports/:id → 200 WAV. |
| **LIVE COMPOSE_PATH log line** | Render | Either use Render dashboard logs after one compose, or ensure deploy includes GET /api/debug/last-compose-path and re-run compose then GET that endpoint. |
| **Phantom proof** | Build/seed | POSTGRES_URL to engine DB is required. Run `npm run seed:phantoms`; confirm artifacts/phantom-users.json; one compat/matches call or DB count to prove usage. |
