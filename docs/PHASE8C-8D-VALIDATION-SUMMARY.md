# Phase 8C/8D Community + Compatibility Surface Repair — Validation Summary

## Summary of root causes addressed

1. **Stub chart presented as user’s natal**  
   Next `/api/profile` returned a stub user and stub primary chart when there was no session or on engine error. The UI could not distinguish “no session” from “session with default chart,” and showed “My Natal • 1990-01-15” as if it were the user’s chart. **Fix:** No session → `{ user: null, primaryChart: null }`; no stub chart. Profile/chart flow is fail-closed.

2. **Default chart treated as real chart**  
   After profile creation without birth data, the engine correctly set primary to `chart_profile_default`. The frontend displayed that as the user’s natal and used it for Matches/Compare/Intent. **Fix:** `chart_profile_default` is treated as “no real chart” everywhere; explicit “No chart linked” state and CTAs; Matches/Compare/Intent use only real chart id or show “add chart first.”

3. **No “no chart” state**  
   There was no clear state when the user had a profile but only the default chart. **Fix:** Profile shows “No chart linked” and link to Sandbox; create-profile form supports optional birth data so one-shot profile + chart is possible.

4. **Search exposed all users by default**  
   Opening Search with empty query (after debounce) called the API with no `q`; backend returned all directory users. **Fix:** Backend returns [] for empty or &lt; 2 char query; frontend only requests when query length >= 2; copy states “not an open directory.”

5. **Compare Charts raw-coordinates-only**  
   Compare used only date/time and lat/lon. **Fix:** Location search (city, region, address) added for Chart A and B via LocationFinder; manual coordinates still available.

6. **Ambiguous empty states**  
   Matches, Connections, Groups, and Search did not clearly explain why surfaces were empty. **Fix:** Explicit copy for each: no chart, no eligible matches, directory limits, and what to do next.

---

## List of commits

| Step | Commit | Description |
|------|--------|-------------|
| 1 | `a7899b7` | Truth/persistence repair — no fake chart as user natal; fail-closed profile/chart flow |
| 1 | `a14f30c` | docs: add Step 1 commit hash to PHASE8C-8D-STEP1-TRUTH-REPAIR |
| 2 | `e251b6f` | Community IA cleanup — location search on Compare, honest empty states, intro copy |
| 2 | `aad8b2e` | docs: add Step 2 commit hash |
| 3 | `0935a69` | Privacy hardening — no open directory; search requires 2+ chars; empty query returns [] |
| 3 | `c36c342` | docs: add Step 3 commit hash |

All pushed to `origin/beta-ui-vercel`.

---

## Verification checklist (targeted)

- **Profile creation:** No session → create form only; no chart shown. With birth data in form → real chart created and linked. Without birth data → “No chart linked” and link to Sandbox.
- **Real chart linkage:** Only non-default primary chart is shown as “your” chart; default triggers “No chart linked” state.
- **Compare flow:** Location search fills lat/lon; manual coords still work; intro copy explains purpose.
- **Matches flow:** Uses real chart id only; empty state when no chart or no eligible matches, with clear copy.
- **Search flow:** No request until 2+ characters; empty query returns no users; copy says “not an open directory” and “min 2 characters.”
- **Empty states:** Profile (no chart), Matches (no chart / no results), Groups, Connections, and Search all have explanatory copy.
- **Privacy:** Search does not list all users on load; backend does not return full directory for empty/short query.

---

## Remaining non-blocking issues

- **Linking Sandbox chart to profile:** There is no “set primary chart” API yet. Users can create profile with birth data in one shot, or build in Sandbox; linking an existing Sandbox composition to the Community profile is out of scope for this pass and can be Phase 9.
- **Visibility/intent flags:** Directory search is still “all seeded directory users when query matches”; there is no visibility or intent filter in the backend. Step 3 only gates “no query = no list.” Stricter “only show eligible compatibility results” or visibility flags can be Phase 9.
- **vnext build:** Backend change in `vnext/compat/directory.ts` requires `npm run vnext:build` before engine deploy so the compiled compat router uses the new behavior.

---

## Deferred to Phase 9

- Full “set primary chart” / link Sandbox composition to profile.
- Visibility or intent-based filtering of directory/search results.
- Compatibility-threshold gating for search (only show users above a score threshold).
- Any new social or discovery features beyond this repair and hardening pass.

---

## Suitability for Phase 8 closed beta

Community is **suitable for continued Phase 8 closed beta verification** with the following in place:

- No fake natal chart shown as the user’s real chart.
- No silent fallback masquerading as real persisted user data.
- No broad user directory exposure by default (search requires 2+ chars; empty query returns []).
- Deterministic compatibility contracts unchanged.
- Profile creation, chart linkage (via create form), Compare (with location search), Matches (real chart only), and Search (privacy-hardened) are aligned with the design brief and fail-closed where data is missing.

Run `npm run vnext:build` before deploying the engine so the directory search change is included.
