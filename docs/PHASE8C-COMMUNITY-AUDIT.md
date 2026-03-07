# Phase 8C: Community Surface Audit Report

**Date:** 2026-03-06  
**Scope:** Community implementation verification and stabilization (no new features).  
**Outcome:** Community is Phase 8 verified for current contracts; minimal fixes applied for same-origin history access.

---

## 1. Community Endpoints

### 1.1 Engine (server)

**Compat router** (mounted when vnext compat + store available; `server/index.js` lines 1912–1920):

- **Profile / user:** `GET /api/profile?userId=`, `POST /api/profile`, `GET /api/profile/chart?chartId=`, `GET /api/profile/:handle`
- **Charts:** `POST /api/charts`, `GET /api/charts/:id`
- **Comparisons:** `POST /api/comparisons`, `GET /api/comparisons/:id`
- **Compat:** `GET /api/compat/health`, `GET /api/compat/matches`, `GET /api/community/search`, `POST /api/community/groups/profile`, `POST /api/compatibility/intent`

**Community router** (Phase 3A; `server/routes/community.js`):

- Feed, post, connect-intent, like, groups CRUD, members, posts, comments, report. Uses `lib/community-store.js` (delegates to pg-store when `POSTGRES_URL` set).

**User:**

- `GET /api/user/history` — present (engine only; requires beta; returns export dir list). **Now proxied by Next** (see Fixes below).

**Requested endpoints — status:**

- **GET /api/user/preferences** — **Not present.** Not implemented; no Phase 4/8 contract or UI requires them; no fake or fallback data.
- **PUT /api/user/preferences** — **Not present.** Same as above.
- **GET /api/user/history** — **Present** (engine); same-origin frontend now reaches it via Next proxy `GET /api/user/history`.

### 1.2 Next.js proxies

- `apps/web/app/api/profile/route.ts` — GET/POST → engine `/api/profile` (dev cookie `ASTRADIO_DEV_USER_ID`)
- `apps/web/app/api/profile/chart/route.ts` — GET → engine `/api/profile/chart`
- `apps/web/app/api/profile/[handle]/route.ts` — GET → engine `/api/profile/:handle`
- `apps/web/app/api/user/history/route.ts` — GET → engine `/api/user/history` (Phase 8C add)

---

## 2. Storage Schema (Postgres)

Applied via `scripts/migrate.js` (all `migrations/*.sql` in order):

| Data | Table(s) | Migration |
|------|----------|-----------|
| User identity | `astradio_users` | 001 |
| Primary chart linkage | `astradio_user_primary_chart` | 001 |
| Natal chart birth data | `astradio_charts` | 001 |
| Chart snapshots (hash only) | `astradio_charts.snapshot_hash` | 001 |
| Stored vectors (compat) | `astradio_chart_vectors` | 003 |
| Composition history (sandbox) | `astradio_sandbox_compositions` | 006 |
| Comparisons | `astradio_comparisons` | 001 |
| Export jobs | `astradio_export_jobs` | 001 |
| Community groups/posts/comments/likes | `astradio_groups`, `astradio_memberships`, `astradio_posts`, `astradio_comments`, `astradio_reports`, `astradio_likes`, `astradio_connection_intents` | 001, 003 |
| Campaign user/natal (Phase 8) | `user_profiles`, `rpg_profiles` (and bundles) | 010, 007 |

**Note:** `server/compat/schema.sql` defines `compat_profiles` and `compat_user_prefs` but is not in `migrations/` and is never applied. The live compatibility path uses `astradio_chart_vectors` (migration 003) and `lib/vector-store.js` → pg-store.

---

## 3. Persistence Verification

| Data | Stored | Retrieved |
|------|--------|-----------|
| User identity | pg-store `createUser` → `astradio_users` | `getUser`, `getUserByHandle` |
| Natal chart birth data | `createChart` → `astradio_charts` (date, time, lat, lon, timezone, label, snapshot_hash) | `getChart`, `listChartsByOwner` |
| Chart snapshots | Hash in `astradio_charts.snapshot_hash`; full snapshot from `/api/chart-snapshot` (Swiss) | Chart row + chart-snapshot API |
| Stored vectors | `upsertChartVector` → `astradio_chart_vectors` (on chart create via `vnext/compat/vector-cache.ts`) | `getChartVector`, `getChartVectorsByIds` (vector-store → pg-store) |
| Composition history | Sandbox: `astradio_sandbox_compositions`; exports: `astradio_export_jobs` + file dir | GET `/api/sandbox/compositions`, GET `/api/user/history` |
| Compatibility inputs | Charts + vectors in `astradio_charts` and `astradio_chart_vectors` | compat routes and `vnext/api/compatibility-intent.ts` via `getChartById` and matches |

---

## 4. Phase 4 Contract Verification

- **User profile creation:** `POST /api/profile` — creates user via storage, optional chart, sets primary chart; persists via pg-store when POSTGRES_URL set. **OK.**
- **User profile retrieval:** `GET /api/profile?userId=` and `GET /api/profile/:handle` — use storage getUser/getUserByHandle, getUserPrimaryChart, getChartById. **OK.**
- **User profile update:** No `PUT /api/profile`; only create. Documented as current state; no silent defaults.
- **User history retrieval:** `GET /api/user/history` returns export dir list (engine); sandbox uses `/api/sandbox/compositions` (separate table). **OK for current design.**

**Sandbox / Campaign vs Community:** Sandbox writes to `astradio_sandbox_compositions`; Campaign uses `user_profiles` and `rpg_profiles`. No bypass of Community contracts; different surfaces.

---

## 5. Compatibility Dependencies

- **Stored natal charts:** `astradio_charts`; resolved via `vnext/compat/chart-store.ts` → storage.getChart.
- **Stored vectors:** `astradio_chart_vectors`; single write path in `vnext/compat/vector-cache.ts` (chart create + optional explicit populate); read via `vnext/compat/matches.ts` / vector-store.
- **Deterministic feature encodings:** architecture-engine → 64-D vector; encoder_version and snapshot_hash stored; compat intent uses getChartById and scoreCompatibility. **Pipeline intact.**

---

## 6. Fail-Closed Behavior

- **GET /api/profile:** Missing `userId` → 400; user not found → 404. No silent default identity.
- **GET /api/profile/chart:** Chart not in directory allowlist → 403; chart not found → 404. No silent fallback chart.
- **POST /api/profile:** Missing `displayName` → 400. Required chart fields validated for optional inline chart.
- **POST /api/charts:** Missing/invalid label, date, time, lat, lon → 400.
- **POST /api/comparisons:** Missing chartAId or (chartBId/chartBInline) or invalid relationshipMode → 400; chart not found → 404.
- **Compatibility intent:** Missing intent → 400; invalid intent → 400; missing seekerChartId and chart → 400; scope=group without groupId → 400.

**Gaps (documented; do not block Phase 8):**

- When POSTGRES_URL is unset, compat router uses memory-store; missing user/chart still returns 404 once looked up.
- `GET /api/user/history` does not require user identity (only requireBeta); it returns global export dir list. Documented as current behavior.

---

## 7. Frontend Integration

- **Profile:** ProfilePanel and hooks use `/api/profile` (Next proxy → engine). With dev cookie, proxies to engine; without, returns stub. **OK.**
- **Stored chart data:** Loaded via GET `/api/profile` (primaryChart) and GET `/api/profile/chart?chartId=`. **OK.**
- **Saved compositions:** Sandbox uses `/api/sandbox/compositions` (list, POST save, GET by id) via sandbox page and `app/api/sandbox/[...path]/route.ts`. **OK.**
- **Connection to Sandbox/Campaign:** Profile/chart from Community/compat; Sandbox uses chart-snapshot and compose pipeline; Campaign uses user_profiles/rpg_profiles. Export history reachable from same-origin via GET `/api/user/history` (Next proxy).

---

## 8. Instability Addressed

1. **No Next proxy for `/api/user/*`** — Addressed: added Next route `GET /api/user/history` that proxies to the engine with optional `x-beta-user` from dev cookie.
2. **Preferences endpoints missing** — Documented: not implemented; no contract or UI requires them; no fake data.

---

## 9. Fixes Applied (Phase 8C)

- **Next.js proxy for GET /api/user/history**  
  - Added `apps/web/app/api/user/history/route.ts`: GET proxies to engine `GET /api/user/history`, forwards `x-beta-user` from cookie `astradio_dev_user_id` when present (same pattern as `/api/exports`). Same-origin frontend can now call `/api/user/history` without 404.

- **GET/PUT /api/user/preferences**  
  - Not implemented. Documented in this audit as out of scope for Phase 8; no fake or fallback data.

---

## 10. Commit and Push Confirmation

- **Files changed:** `docs/PHASE8C-COMMUNITY-AUDIT.md` (new), `apps/web/app/api/user/history/route.ts` (new).
- **Commit hash:** `33a24a6`
- **Confirmation:** Commit 33a24a6 pushed to `origin/beta-ui-vercel`. Report section 10 updated in 122eab2. Community is Phase 8 verified for current contracts; GET /api/user/history is reachable from same-origin via Next proxy.
