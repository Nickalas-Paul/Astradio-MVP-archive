# Phase 8C/8D Step 2 — Community Surface Organization / IA Cleanup

## IA rationale

- **Compare:** Compare-related actions live under the Compare tab. Compare Charts now has location search first (city/region/address) then date/time and coordinates, so users are not forced into raw coordinates. Intro line clarifies purpose.
- **Search:** Search tab is clarified as “Search by name or handle. Compare uses your stored chart only. Results are compatibility- and visibility-aware — not an open directory.” Step 3 will gate actual results.
- **Matches:** Empty state explains “No eligible matches for your chart” and that results are compatibility-driven; no generic user listing.
- **Groups:** Empty state explains “No groups yet. Create a group above, or search by tag. Groups are shared spaces for discussion and compatibility by context.”
- **Connections:** Intro explains that Connections = circles and sessions; “No connections yet” means the feature is available but the user hasn’t added anyone — use Matches first.
- **Compare Charts:** Location search (LocationFinder) added for Chart A and Chart B; same geocode API as Sandbox. Manual lat/lon still available.

## Files changed

- `apps/web/src/components/community/CompareChartsPanel.tsx` — LocationFinder for Chart A and Chart B; locationA/locationB state; onSelect fills lat, lon, and optional label.
- `apps/web/app/community/CommunityClient.tsx` — Intro copy for Compare, Search, Connections; expanded Groups empty state; Compare tab intro line.
- `apps/web/src/components/CompatibilitySection.tsx` — Matches empty-state copy: “No eligible matches for your chart” and explanation.

## Before / after behavior

| Area | Before | After |
|------|--------|--------|
| Compare Charts | Raw date/time + lat/lon only | Location search (city, region, address) first; then date/time and coordinates. Intro line explains purpose. |
| Search tab | No explanation | Short line: search by name/handle; compare uses stored chart; results are compatibility/visibility-aware, not an open directory. |
| Matches empty | “No compatibility matches found” / “Create a compatibility profile” | “No eligible matches for your chart” + explanation (add chart in Profile; compatibility-driven; no candidates or directory empty). |
| Groups empty | “No groups yet. Create one to get started.” | Card with “No groups yet.” + “Create a group above, or search by tag. Groups are shared spaces for discussion and compatibility by context.” |
| Connections tab | No intro | Intro: “Connections: circles and sessions. Find people via Matches or join Groups…” and what “no connections yet” means. |

## Commit

Step 2 commit hash: *(filled after commit)*
