# Phase 8C/8D Step 1 — Truth / Persistence Repair

## Root cause

1. **API returned stub user + default chart when no session**  
   `GET /api/profile` (Next) returned `{ user: STUB_USER, primaryChart: STUB_PRIMARY_CHART }` when the dev cookie was missing or when the engine returned 404/error. The UI could not tell “no session” from “session with default chart,” and showed “My Natal • 1990-01-15” as if it were the user’s real chart.

2. **Default chart treated as real chart**  
   After profile creation without birth data, the engine correctly set the user’s primary chart to `chart_profile_default`. The frontend displayed that default chart (label, date, time) as the user’s natal chart and used it for Matches/Compare/Intent, so compatibility was driven by placeholder data.

3. **No “no chart” state**  
   There was no explicit empty state when the user had a profile but only the default chart; the default was always shown as “your chart.”

## Files changed

- `apps/web/app/api/profile/route.ts` — No cookie or engine 404/error → `{ user: null, primaryChart: null }`; removed stub user/chart; clear cookie on 404/error.
- `apps/web/src/core/social/constants.ts` — New: `DEFAULT_PROFILE_CHART_ID`, `hasRealChart()`.
- `apps/web/src/components/community/ProfilePanel.tsx` — No session → create-profile form only (no chart). Session with default chart → “No chart linked” empty state and link to Sandbox. Optional birth-data fields in create form; POST chart when provided.
- `apps/web/app/community/CommunityClient.tsx` — Pass `hasRealChart(primaryChart) ? primaryChart.id : null` to CompatibilitySection.
- `apps/web/src/components/CompatibilitySection.tsx` — Clearer empty-state copy when no chart.
- `apps/web/app/compatibility/results/page.tsx` — Use `hasRealChart(primaryChart)` for seekerChartId; notice when no real chart.
- `apps/web/app/compatibility/intent/page.tsx` — Use `hasRealChart(primaryChart)` for seekerChartId; notice when no real chart.
- `apps/web/src/components/community/UserSearchPanel.tsx` — Compare only when `hasRealChart(primaryChart)`; error message updated.
- `apps/web/src/components/compatibility/CompatibilityLensModal.tsx` — No fallback to default chart; when seekerChartId is null, show “Add your birth chart in Profile first.”
- `apps/web/app/profile/[handle]/page.tsx` — Pass real seekerChartId only; show message when no real chart instead of lens button.
- `apps/web/app/community/group/[slug]/page.tsx` — Pass `hasRealChart(primaryChart) ? primaryChart.id : null` to MemberCard.

## Before / after behavior

| Scenario | Before | After |
|----------|--------|--------|
| No cookie | Stub user + “My Natal • 1990-01-15” | `user: null, primaryChart: null`; create-profile form only; no chart shown. |
| Profile created (no birth data) | Display name updated; “My Natal • 1990-01-15” still shown as user’s chart | Display name shown; “No chart linked” + link to Sandbox; no wheel/explainer. |
| Profile created with birth data | N/A (form had no chart fields) | Optional birth fields in create form; POST sends chart; real primary chart stored and shown. |
| Matches tab, no real chart | Matches used `chart_profile_default` | “Add your birth chart in Profile first” empty state; no default chart used. |
| Compare (Search), no real chart | “Set your primary chart in Profile first” | “Add your birth chart in Profile first. Matches use your stored chart only.” |
| Intent/Results, no real chart | Used default chart id | Notice to add chart; seekerChartId = null passed; no default chart. |
| Compatibility lens (profile by handle) | Used default if no primary | Button only when real chart; otherwise “Add your birth chart in Profile to run the lens.” |

## Intended chart path (Phase 8)

- **Create profile with chart:** Create profile form includes optional birth data (label, date, time, lat, lon). When provided, POST body includes `chart` and the engine creates the chart and sets it as primary. One-shot profile + chart.
- **Create profile without chart:** User gets “No chart linked”; can build a chart in Sandbox. Linking that chart to the profile later would require a future “set primary chart” or similar API (not in scope for this step).
- **Matches / Search / Compare / Intent:** All use `hasRealChart(primaryChart)`; only stored real chart id is used; no fake default.

## Commit

Step 1 commit hash: *(filled after commit)*
