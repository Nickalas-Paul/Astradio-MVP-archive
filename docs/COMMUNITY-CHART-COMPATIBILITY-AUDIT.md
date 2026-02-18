# Community & Chart Comparison Mapping — Audit

**Date:** 2026-02-15  
**Goal:** Clarify where the repo stands for community and chart-comparison infrastructure before building **social media community user matching by chart compatibility metrics**.

---

## 1. Executive summary

| Area | Status | Notes |
|------|--------|------|
| **Community feed** | Implemented (mock) | Feed API and UI exist; no chart or compatibility linkage. |
| **Chart comparison (A + B → one composition)** | Implemented (V1) | Design doc + vnext/compat + CompareChartsPanel; in-memory only. |
| **User matching by chart compatibility** | Designed, not wired | Schema + matcher + cache exist; **API not mounted**; Matches tab will 404. |
| **Mapping: community ↔ charts ↔ compatibility** | Missing | Feed, users, and charts are not connected for “match users by chart”. |

---

## 2. Community infrastructure

### 2.1 Feed and social API

- **Route:** `GET /api/community/feed` (Next.js: `apps/web/app/api/community/feed/route.ts`).
- **Backing:** `SocialAPI.getFeed()` in `apps/web/src/core/social/mock-api.ts` (cursor/since; fixed mock items).
- **Hook:** `useSocialFeed()` in `apps/web/src/core/social/hooks.ts` → calls `/api/community/feed`.
- **UI:** Community page → “Feed” tab → `SocialFeed` + `TrendingSection`.

Feed items are **composition-centric** (e.g. “published”, “liked”) with `userId`, `userName`, `compositionId`, `compositionTitle`, `genre`, `at`. There are **no chart or compatibility fields** and no link to a user’s “chart used for matching”.

### 2.2 Social data model (mock)

- **Types:** `apps/web/src/core/social/types.ts` — `User`, `Circle`, `LibraryItem` (composition | pair | chart), `Playlist`, `Session`, `Favorite`, `UserActivity`, etc.
- **Mock:** `mock-api.ts` — `MOCK.users`, `MOCK.friends`, `MOCK.circles`, `MOCK.library` (per-user, can include `t: 'chart'`), `MOCK.playlists`, `MOCK.sessions`, `MOCK.activities`, `getFeed()`, `getTrending()`.
- **Gap:** No notion of “user’s primary chart for compatibility” or “chart visibility for matching”. Library has charts by id/label but no connection to the compatibility pipeline.

### 2.3 Community page tabs

- **File:** `apps/web/app/community/CommunityClient.tsx`.
- **Tabs:** Feed, Compare Charts, Matches, Connections, Saved, Search (and when `ENABLE_SOCIAL`: Circles, Sessions).
- **Components:** `SocialFeed`, `TrendingSection`, `CompareChartsPanel`, `CompatibilitySection` (Matches), `LibraryPanel`, `AtlasSearch`, `CirclesPanel`, `SessionsPanel`.

---

## 3. Chart comparison infrastructure (two charts → one composition)

### 3.1 Design

- **Doc:** `docs/COMMUNITY-COMPATIBILITY-V1-DESIGN.md` (User, Chart, Comparison; fusion; no change to encoder/planner).
- **Flow:** Chart A + Chart B → snapshots → `encodeFeatures` (A, B) → `mergeFeatureVectors` → one 64-D vector → existing compose path → one plan + 60s composition.
- **APIs:** `POST/GET /api/charts`, `POST/GET /api/comparisons`.

### 3.2 Implementation

- **Backend (vnext):**
  - **Storage:** `vnext/compat/storage.ts` — in-memory `Map`s for users, charts, comparisons (no DB).
  - **Fusion:** `vnext/compat/fusion.ts` — weighted blend of two feature vectors.
  - **Service:** `vnext/compat/comparison-service.ts` — resolve charts → fetch snapshots → encode → merge → `composeAPI.composeFromFeatures` → persist comparison in memory.
  - **Routes:** `vnext/compat/routes.ts` — `createCompatRouter()` → `POST/GET /api/charts`, `POST/GET /api/comparisons`.
- **Server:** `server/index.js` mounts vnext compat router:  
  `if (compatMod?.createCompatRouter) app.use("/api", compatMod.createCompatRouter());`
- **Next.js:** Proxies to backend:
  - `apps/web/app/api/charts/route.ts` → POST backend `/api/charts`
  - `apps/web/app/api/charts/[id]/route.ts` → GET backend `/api/charts/:id`
  - `apps/web/app/api/comparisons/route.ts` → POST backend `/api/comparisons`
  - `apps/web/app/api/comparisons/[id]/route.ts` → GET backend `/api/comparisons/:id`
- **UI:** `CompareChartsPanel` — create Chart A/B via `/api/charts`, run comparison via `/api/comparisons` (chartAId, chartBId or chartBInline, relationshipMode), show compatibility text, planHash, optional audio.

### 3.3 Limitations

- **Persistence:** All chart/comparison data is in-memory; server restart loses it.
- **Identity:** No real auth; `ownerId` on Chart is optional; no link to “community user” in the social mock.

---

## 4. User matching by chart compatibility (the “Matches” path)

### 4.1 Intended behavior

- **Input:** A chart (e.g. “my natal”).
- **Output:** Ranked list of **other users/charts** by compatibility score (and optionally facets/rationale).
- **Use case:** “Find community users whose charts are compatible with mine.”

### 4.2 Back-end design (not fully wired)

- **Schema:** `server/compat/schema.sql`  
  - `compat_profiles` (user_id, chart_id, features64, prefs, visibility, encoder_version)  
  - `compat_cache` (chart_id, facet, rank, target_user_id, target_chart_id, score, rationale)  
  - `compat_pairs`, `compat_user_prefs`, `compat_interactions`, `compat_blocks`  
  - Views/functions for public/friends profiles and cache invalidation.
- **Matcher:** `server/compat/matcher.ts` — `generateMatches({ chartId, facets, limit })`  
  - Uses `getChartFeatures(chartId)` and `getMultipleChartFeatures(availableCharts)`  
  - Mock user list (e.g. natal-1, natal-2, today-1, …) and mock synastry; scores via `scoreCompatibility()`.
- **Features:** `server/compat/features.ts` — **mock** 64-D vectors per chart (no call to vnext `encodeFeatures`).
- **Cache:** `server/compat/cache.ts` — in-memory cache for matches (chartId + facet).
- **Routes:** `server/routes/compat.ts` —  
  - `GET /api/compat/matches` (chartId, facets, limit, cursor) — cache or on-demand `generateMatches`.  
  - `GET /api/compat/health`.  
  - Deprecated (410): POST/GET profile, POST generate, GET rationale.

### 4.3 Critical gap: compat routes not mounted

- **server/index.js** only mounts **vnext** compat:  
  `app.use("/api", compatMod.createCompatRouter());`  
  That router only exposes `/api/charts` and `/api/comparisons`.  
- **server/routes/compat.ts** (Express) is **never** mounted in `server/index.js`.  
- So **GET /api/compat/matches** and **GET /api/compat/health** do **not** exist at runtime.

### 4.4 Front-end

- **CompatibilitySection:** `apps/web/src/components/CompatibilitySection.tsx`  
  - Uses `useCompat({ goal: 'friend', pageSize: limit })` and hardcodes `chartId="natal-1"`.
  - Renders matches (userId, chartId, score, facets, rationale) and “Play Mix” / “Details”.
- **useCompat:** `apps/web/src/core/social/hooks.ts`  
  - Calls `GET ${getApiBaseUrl()}/api/compat/matches?goal=…&pageSize=…`  
  - `getApiBaseUrl()` is `''` in browser → request goes to **Next.js** at `/api/compat/matches`.
- **Next.js:** There is **no** route under `apps/web/app/api/compat/`.  
- **Result:** The Matches tab issues a request that **404s** (Next.js has no handler; Express compat router is not mounted).

### 4.5 Type/contract notes

- **Front-end:** `apps/web/src/core/compat/types.ts` — `CompatMatch`: userId, chartId, score, facets, rationale, lastUpdated.
- **Server compat cache:** Uses `targetUserId` / `targetChartId` in cache entries; matcher returns `CompatMatch[]` with userId/chartId. Query params in compat route use `chartId` and `facets` (e.g. `['overall']`), while the hook sends `goal` and `pageSize` (no `chartId`) — so even if the route were mounted, the contract would need alignment.

---

## 5. Other relevant pieces

- **API contract:** `docs/API_CONTRACT.md` lists Express routes `GET /api/compat/matches` and `GET /api/compat/health` as active; in code they are **not** mounted.
- **Chart API (single-chart):** `GET /api/chart` (Next.js) — chart data retrieval; separate from vnext `POST/GET /api/charts` (compatibility charts).
- **Compose:** Compatibility flow uses `composeFromFeatures(merged, payload)`; no separate “compatibility” entry in the main compose route contract for the Matches “Play Mix” path (CompatibilitySection calls `/api/compose` with mode `compatibility`, chartId1, chartId2 — separate from the comparison-service path).

---

## 6. Mapping: community ↔ charts ↔ compatibility

Today there is **no** end-to-end mapping that connects:

- **Community users** (mock User / feed / library)
- **Charts** used for matching (vnext in-memory Chart vs client store vs future DB)
- **Compatibility** (scores, facets, rationale) and **comparisons** (A+B → composition)

Concretely:

1. **Feed ↔ charts:** Feed items do not reference a chart or a “matching profile”; they reference compositions and users.
2. **User ↔ chart for matching:** No “primary chart” or “chart visibility for matching” in the social mock or in vnext User/Chart. vnext Chart has optional `ownerId` but no link to social User.
3. **Compat profiles ↔ community:** `compat_profiles` (schema) and matcher are built for “chart → list of (user, chart) matches”, but the compat API is not mounted and features are mock; no real encoder or DB.
4. **Single source of truth for charts:**  
   - vnext/compat/storage (in-memory, for comparisons),  
   - server/compat schema (DB-ready, for profiles/cache),  
   - client `useChartsStore` (client-side).  
   No unified “user’s charts” that both community and compatibility use.

---

## 7. Recommendations before “social community user matching by chart compatibility”

1. **Wire compat matching API**
   - Mount `server/routes/compat.ts` in `server/index.js` under `/api/compat` (or equivalent) so `GET /api/compat/matches` and `GET /api/compat/health` are live.
   - Add a **Next.js proxy** for `GET /api/compat/matches` (and optionally health) to the Express backend if the app is served by Next and API_BASE_URL points to Express, so the Matches tab works.

2. **Align contracts**
   - Unify query params: e.g. `chartId` (required), `facets`, `limit`, `cursor` for matches.
   - Ensure hook sends `chartId` (e.g. from selected chart or “primary” chart) and server response shape matches `CompatMatch` (userId, chartId, score, facets, rationale).

3. **Connect matching to real encoder**
   - Replace mock in `server/compat/features.ts` with resolution of chart → snapshot (e.g. from vnext storage or from chart-snapshot API) and call vnext `encodeFeatures(snapshot)` so matching uses the same 64-D space as comparison/compose.

4. **Define user–chart–visibility for matching**
   - Decide where “user’s chart(s) for matching” and “visibility” live (vnext storage vs DB vs social mock).
   - Implement or stub compat_profiles (create/update) and feed them from “saved chart” or “primary chart” + visibility so the matcher can discover “other users’ charts” by visibility.

5. **Unify chart storage (medium term)**
   - Single place for “user’s charts” (DB or agreed service) so community feed, library, and compatibility all reference the same chart store; then link compat_profiles to that store.

6. **Optional: link feed to compatibility**
   - Add optional fields to feed items (e.g. “chartId used for matching”, “compatibilityScore” for suggested matches) so the product can surface “compatible users” in the community feed.

---

## 8. File reference

| Purpose | Location |
|--------|----------|
| Community feed API | `apps/web/app/api/community/feed/route.ts` |
| Social mock & types | `apps/web/src/core/social/mock-api.ts`, `types.ts` |
| Social hooks (feed, compat) | `apps/web/src/core/social/hooks.ts` |
| Community page | `apps/web/app/community/CommunityClient.tsx` |
| Compare two charts UI | `apps/web/src/components/community/CompareChartsPanel.tsx` |
| Matches UI | `apps/web/src/components/CompatibilitySection.tsx` |
| V1 design (charts + comparisons) | `docs/COMMUNITY-COMPATIBILITY-V1-DESIGN.md` |
| Vnext chart/comparison storage | `vnext/compat/storage.ts` |
| Vnext comparison service | `vnext/compat/comparison-service.ts` |
| Vnext compat routes (charts, comparisons) | `vnext/compat/routes.ts` |
| Server mount of vnext compat | `server/index.js` (createCompatRouter) |
| Next proxy for charts/comparisons | `apps/web/app/api/charts/*`, `apps/web/app/api/comparisons/*` |
| Compat schema (profiles, cache, pairs) | `server/compat/schema.sql` |
| Compat matcher & features | `server/compat/matcher.ts`, `server/compat/features.ts` |
| Compat cache | `server/compat/cache.ts` |
| Express compat routes (not mounted) | `server/routes/compat.ts` |
| Front-end compat types | `apps/web/src/core/compat/types.ts` |
| API contract | `docs/API_CONTRACT.md` |
