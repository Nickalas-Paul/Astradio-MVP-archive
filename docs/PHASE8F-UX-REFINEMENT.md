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

*(See commit hashes after push.)*
