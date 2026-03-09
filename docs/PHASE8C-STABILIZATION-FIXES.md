# Phase 8C Community Surface Stabilization — Fixes

## 1. Root cause of the 403 chart retrieval error

**Cause:** The engine `GET /api/profile/chart` only allowed chart IDs that were in the **directory allowlist** (`isDirectoryChartId`). The directory is the default profile chart plus seeded match-candidate charts (e.g. `chart_profile_default`, `chart_match_1`, …). When a user created a profile **with birth data**, the engine created a **new chart** with a generated id (e.g. `chart_xxxxxxxx`) and set it as primary. That id is not in the directory allowlist, so a request for `GET /api/profile/chart?chartId=chart_xxx` returned **403 "Chart not in public directory"**.

**Fix:** Allow access when the chart is either (a) in the directory allowlist, or (b) **exists in storage** (`getChartById(chartId)` returns a chart). User-created charts are stored in `astradio_charts`, so they are now allowed. No change to the Next proxy or cookies; the engine logic was updated only.

---

## 2. Code changes applied

| File | Change |
|------|--------|
| `vnext/compat/routes.ts` | GET /api/profile/chart: allow if `isDirectoryChartId(chartId)` **or** `getChartById(chartId)` is truthy; otherwise 403. |
| `apps/web/src/components/community/ProfilePanel.tsx` | Birth chart **required**: copy set to "Astradio profiles are based on your natal chart. Enter your birth details to create your profile." Birth section always visible (no &lt;details&gt;). Replaced lat/lon inputs with **LocationFinder** ("Birth place"). Create button disabled until displayName + date + time + location (lat/lon from LocationFinder) are set. Chart is always sent in POST body. |
| `apps/web/src/components/community/CompareChartsPanel.tsx` | **Removed** visible latitude/longitude inputs for Chart A and Chart B. LocationFinder only; copy: "Coordinates are set from your place selection." |
| `apps/web/app/community/CommunityClient.tsx` | Compare tab intro: "Use location search and date/time for each chart; coordinates are set from your place selection." Matches tab: pass `onSwitchToProfile={() => setActiveTab('profile')}` to CompatibilitySection. |
| `apps/web/src/components/CompatibilitySection.tsx` | When `ENABLE_COMPAT` is false: render a card with explanatory text instead of **null** (so Matches tab is not blank). When no chartId: instructional empty state with "Create a profile with your natal chart first…" and **"Go to Profile to create one"** button (if `onSwitchToProfile` provided). Chart-but-no-matches state unchanged (compatibility empty state). |

---

## 3. Updated UI behavior

- **Profile creation:** Birth chart is required. User must enter display name, birth date, time, and **birth place via location search** (no raw lat/lon). Create is disabled until all are set. Copy explains that Astradio profiles are chart-based.
- **Profile chart after creation:** Chart created at profile creation is stored and allowed by the engine; GET /api/profile/chart?chartId=&lt;id&gt; returns 200 and the UI can load the chart.
- **Compare Charts:** Only location search + date/time + label for each chart; no visible lat/lon fields. Coordinates are internal after geocoding.
- **Matches tab:** Never blank. If feature off: card with compat-enable hint. If no chart: instructional card + "Go to Profile to create one" button. If chart but no matches: existing compatibility empty state.

---

## 4. Commit hashes

- **Phase 8C stabilization:** `990a59b` — fix(community): Phase 8C stabilization - chart 403, required birth data, LocationFinder, Matches empty state  
- **Doc update:** `5de462c` — docs: add Phase 8C commit hash to stabilization report

---

## 5. Verification notes (chart retrieval after profile creation)

- Create a profile with display name + birth date, time, and birth place (location search). Submit.
- After creation, the profile should show the new chart (wheel/explainer). Network: `GET /api/profile/chart?chartId=<new-chart-id>` should return **200** and JSON (snapshot, explainer), not 403.
- If the engine has been rebuilt (`npm run vnext:build`), the route change is active; no proxy or cookie change was required.
