# Phase 8 Stage 5 — Implementation Report

**Campaign System Verification (Tri-Mode + Persistence)**

---

## 1. Files Changed

### Created
- `migrations/013_phase8_stage5_campaigns.sql` — Stage 5 campaign table and indexes
- `server/routes/stage5.js` — Tri-mode campaign router (create, list, get, enter)
- `apps/web/app/api/campaigns/create/route.ts` — Vercel proxy POST create
- `apps/web/app/api/campaigns/route.ts` — Vercel proxy GET list
- `apps/web/app/api/campaigns/[id]/route.ts` — Vercel proxy GET one
- `apps/web/app/api/campaigns/[id]/enter/route.ts` — Vercel proxy POST enter
- `scripts/stage5-verify.js` — Stage 5 smoke verification script
- `docs/STAGE5-IMPLEMENTATION-REPORT.md` — This report

### Modified
- `lib/pg-store.js` — Stage 5 helpers: `createStage5Campaign`, `getStage5CampaignById`, `getStage5CampaignByContextKey`, `listStage5CampaignsByOwnerOrParticipant`, `updateStage5CampaignState`, `canonicalSortIds`; `listCompositeArtifactsByBinding`, `getCompositeArtifactById` (or equivalent composite lookup used by GROUP/AUTO)
- `server/index.js` — Mount Stage 5 router at `/api` (routes under `/api/campaigns/*`)
- `vnext/rpg/store/rpg-store.ts` — `getCampaignById`: read from `stage5_campaigns` first, map to `RpgCampaignRow`; `updateCampaignState`: update `stage5_campaigns` when campaign is Stage 5; `finalizeTurnTransactional`: load campaign from `stage5_campaigns` when turn’s `campaign_id` exists there, update state in same table

---

## 2. Migration

- **Filename:** `migrations/013_phase8_stage5_campaigns.sql`
- **Schema:** Table `stage5_campaigns` with: `campaign_id` (PK), `context_key` (UNIQUE), `mode`, `owner_user_id`, `participant_user_ids` (TEXT[]), `participant_chart_ids` (TEXT[]), `group_id` (nullable, FK to `astradio_relational_groups`), `composite_artifact_id` (nullable, FK to `astradio_composite_artifacts`), `bundle_hash`, `state_json`, `state_hash`, `state_version`, `version_set_json`, `auto_resolution_signature`, `created_at`, `updated_at`.
- **Indexes:** Unique on `context_key`; index on `(owner_user_id, created_at DESC)`; GIN on `participant_user_ids` for participant-scoped list.
- **Other:** `rpg_daily_turns.campaign_id_fkey` dropped so `campaign_id` may reference either `rpg_campaigns` or `stage5_campaigns`.
- **Confirmation:** Migration was **not** applied in this session (local POSTGRES_URL not set / ECONNREFUSED). Apply in target environment with: `node scripts/migrate.js` (with `POSTGRES_URL` set).

---

## 3. Route Surface

- **Added:**  
  - `POST /api/campaigns/create` — Create campaign (solo/group/auto); identity from session (proxy sets query `userId`); concurrency-safe (unique `context_key`, insert then select or return existing).  
  - `GET /api/campaigns` — List campaigns for caller (owner or participant); DB filter.  
  - `GET /api/campaigns/:id` — Get one; 404 if not found or not owner/participant.  
  - `POST /api/campaigns/:id/enter` — Enter (binding); 404 if not found or not owner/participant.
- **Behavior:** Campaign lifecycle is only here; `/api/rpg/*` remains gameplay-only (no campaign creation or resolution). No dual truth.

---

## 4. Access Control

- **Session identity:** Engine receives caller via `x-caller-user-id` or query `userId` set by Vercel proxy. Proxy uses `getSessionUserId(req.cookies)`; body/query `userId` from client is never used for auth.
- **Owner/participant:** All campaign routes use `requireCaller(req, res)`; `GET /api/campaigns/:id` and `POST /api/campaigns/:id/enter` require `campaign.ownerUserId === callerUserId || campaign.participantUserIds.includes(callerUserId)`; else 404. List uses DB filter `WHERE owner_user_id = $1 OR $1 = ANY(participant_user_ids)`.

---

## 5. Determinism / Persistence

- **context_key:** SOLO: SHA-256(canonical JSON of mode, owner_user_id, resolved_owner_chart_id, version_set)). GROUP: SHA-256(mode, owner_user_id, group_id, sorted member chart_ids, composite_artifact_id, version_set). AUTO: SHA-256(mode, owner_user_id, candidate_pool_signature, sorted selected participant ids, composite_artifact_id, version_set). No request payload in key; arrays canonically ordered; SHA-256.
- **version_set:** Stored in `version_set_json` at create; used for context_key and vnext compatibility; not mutated post-create.
- **Concurrency:** Unique constraint on `context_key`; create uses INSERT with ON CONFLICT (context_key) DO NOTHING then SELECT by context_key; on 23505, fetch by context_key and return existing row so both callers get same campaign.

---

## 6. Smoke Results

Smoke was **not** run against a live DB in this session (no local Postgres). Verification script provided: `ENGINE_URL=<base> node scripts/stage5-verify.js [ownerUserId]`.

- **SOLO:** (Design) Create → enter → GET by id → list → same campaign_id on repeat create; identity/chart from resolved profile.
- **GROUP:** (Design) Uses persisted Stage 4 group; membership and composite from existing artifact; no composite recomputation; repeat create returns same campaign.
- **AUTO:** (Design) Pool from owner’s groups with vectors; first group (by sorted id) with composite; fixed party size; deterministic signature; no composite creation; reorder-invariant where applicable.
- **ISOLATION:** (Design) List and GET scoped to owner/participant; user B cannot see or enter user A’s campaign; no query/body userId override.
- **CONCURRENCY:** (Design) Two creates with same resolved context → one row, same campaign returned to both (unique context_key + conflict handling).
- **REGRESSION:** (Design) Stage 1–4 and `/api/rpg/*` unchanged; getCampaignById and updateCampaignState support both legacy and Stage 5 campaigns; finalizeTurnTransactional updates correct table.

---

## 7. Pass / Fail Matrix

| Requirement | Result | Evidence |
|-------------|--------|----------|
| DB schema + migration | Pass | `013_phase8_stage5_campaigns.sql` with table, indexes, FK drop |
| Migration applied in env | Pending | Run `node scripts/migrate.js` with POSTGRES_URL |
| Canonical context_key (solo/group/auto) | Pass | stage5.js: resolveSoloContext, resolveGroupContext, resolveAutoContext with SHA-256 and canonical JSON/ordering |
| AUTO: single source, deterministic, no composite create | Pass | resolveAutoContext: pool from groups+vectors; first group with composite; no creation path |
| Access: session only, owner/participant checks | Pass | requireCaller; GET/enter check membership; list by DB filter |
| Composite binding (group/auto): bind existing only | Pass | GROUP/AUTO require existing composite; 422 if missing |
| Routes: create, list, get, enter | Pass | stage5.js + Vercel proxy routes |
| Persistence: only create creates; repeat create same campaign | Pass | createStage5Campaign + conflict handling |
| Concurrency-safe create | Pass | Unique context_key; INSERT then SELECT; 23505 → return existing |
| Canonical ordering of participant arrays | Pass | pg-store canonicalSortIds; stored/returned sorted |
| Error policy 404/400/422 | Pass | notFound, badRequest, unprocessable used consistently |
| getCampaignById / updateCampaignState / finalize for Stage 5 | Pass | rpg-store.ts: stage5 first, then legacy; state updates correct table |
| SOLO smoke | Pending | Run stage5-verify.js with engine + DB |
| GROUP smoke | Pending | Manual with Stage 4 group + composite |
| AUTO smoke | Pending | Manual with groups + composites |
| ISOLATION smoke | Pending | stage5-verify.js covers list/get scope |
| CONCURRENCY smoke | Pending | Manual or script with concurrent create |
| REGRESSION smoke | Pending | Stage 1–4 + RPG flows after migration |

---

## 8. Commit

- **Hash:** `81e54b8`
- **Message:** `Phase 8 Stage 5: tri-mode campaign persistence (solo/group/auto), migration, routes, vnext integration, verification script and report`

---

## 9. Outstanding Issues

- **Migration and smoke:** Apply migration in target environment and run `scripts/stage5-verify.js` (and manual GROUP/AUTO/CONCURRENCY/REGRESSION checks) once POSTGRES_URL and engine are available. No code issues identified; outstanding work is environment-dependent execution and evidence capture.
