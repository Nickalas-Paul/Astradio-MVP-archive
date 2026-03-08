# Phase 8F — Community UX Refinement

## Summary

- **Issue 1 — Chart audio:** Natal baseline player is shown under the profile chart when a ready job exists in composition history for that chart (`request.chartA === chartId`, `id.startsWith('natal_')`). Uses existing job URL; no new generation.
- **Issue 2 — Matches logic:** Compatibility section now follows four states: (1) no profile → create profile CTA; (2) profile but no real chart → “Add your natal chart”; (3) chart but compat off → “You’re set up with a natal chart. Compatibility matching will be enabled in a future update.”; (4) chart and compat on → match UI. Uses `hasProfile` and `hasRealChart()`.
- **Issue 3 — Tabs:** Tabs are Profile, Feed, Groups, Connections, Compare, Saved Tracks, Search. Matches removed. Connections is the compatibility hub with: (1) Intent selector (Friendship, Dating, Creative collaboration, Study partners, Shadow work partners, Campaign party) mapping to compat mode; (2) Compatibility finder (same component with controlled mode); (3) Your connections (description; list in context rail). Compare tab is chart-only; group/composite callout unchanged.

## Files changed

- `apps/web/src/components/community/ProfilePanel.tsx` — `useNatalBaselineJob`, `NatalBaselinePlayer` under chart; prop `onSwitchToConnections`, button “Find connections”.
- `apps/web/src/components/CompatibilitySection.tsx` — New `hasProfile`; optional `mode`/`onModeChange`; four-state logic and copy.
- `apps/web/app/community/CommunityClient.tsx` — Tab list and type; Connections tab with intent selector, CompatibilitySection, connections blurb; context rail for Connections; ProfilePanel `onSwitchToConnections`.
- `apps/web/app/overlay/page.tsx` — `CompatibilitySection` given `hasProfile={true}`.

## Commits

- **44bd6c0** — fix(community): Phase 8F - chart audio under profile, compat 4-state logic, tab consolidation, Connections hub
- **Phase 8F follow-up** — natal player lookup fallback; intent selection visible and reflected in finder

---

## Phase 8F follow-up fixes (natal player + Connections intent)

**Root cause — Natal player missing under profile:** (1) Lookup required both `request.chartA === chartId` and `id.startsWith('natal_')`; after persist/rehydrate or across sessions, `request.chartA` could be missing or differ. (2) Player was only rendered inside the wheel branch, so it didn’t show when the wheel wasn’t in the “snapshot safe” state. **Fix:** Match by `request.chartA === chartId` or by job id prefix `natal_${chartId}_`; render `NatalBaselinePlayer` whenever `realChart?.id` exists and `!noRealChart`, below the left column (not only under the wheel).

**Root cause — Connections intent buttons inert:** Intent state did update, but when the finder was in a blocked state (no profile, no chart, or compat off), the section didn’t show the selection, so clicks looked like they did nothing. **Fix:** (1) Show “Selected: [label]” under the intent chips so the selection is always visible. (2) In CompatibilitySection, when in controlled mode, show “Looking for: {modeLabel}” in all blocked states so the finder reflects the chosen intent.
