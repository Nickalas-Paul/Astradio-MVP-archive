# Phase 8C/8D Step 3 — Privacy / Discovery Hardening

## Privacy changes made

1. **Search does not expose all users by default**
   - **Backend** (`vnext/compat/directory.ts`): When query `q` is empty or shorter than 2 characters, return an empty list instead of all directory users. Discovery is not an open directory.
   - **Frontend** (`apps/web/src/core/social/hooks.ts`): `useUserSearch` only calls the API when trimmed query length >= 2. Otherwise it sets users to [] and does not fetch. No request on tab load or when the user has not typed at least 2 characters.

2. **Minimum query length**
   - Search requires at least 2 characters before any request. Backend enforces the same (empty or &lt; 2 chars → []). Reduces accidental “list everyone” and aligns with privacy-aware discovery.

3. **Blank results explain why**
   - **Search:** When query is 0–1 chars: “Enter at least 2 characters to search.” When query is valid and no results: “No users found. Results are limited to the directory; try a different query or check that you have a chart linked for comparison.”
   - **Matches** (from Step 1): “No eligible matches for your chart” + explanation (add chart in Profile; compatibility-driven; no candidates or directory empty).
   - No silent empty list without context.

4. **Copy alignment**
   - Search tab and UserSearchPanel state that results are “limited to eligible directory entries — not an open directory” and “Compare uses your stored chart only.” Aligns with the Astradio Community design brief (privacy-aware discovery, no open directory).

## Files changed

- `vnext/compat/directory.ts` — Empty or &lt; 2 char query → return []; only fetch directory users when query is 2+ chars.
- `apps/web/src/core/social/hooks.ts` — useUserSearch: run search only when trimmed q length >= 2; otherwise set users to [] and skip request.
- `apps/web/src/components/community/UserSearchPanel.tsx` — Require 2+ chars for search; placeholder and copy updated; “Enter at least 2 characters” when 0–1 chars; no-results message explains directory and chart.

## Before / after behavior

| Scenario | Before | After |
|----------|--------|--------|
| Open Search tab, no input | After debounce, API called with empty q; backend returned all directory users | No API call; users = []. Copy explains “min 2 characters” and “not an open directory.” |
| Type 1 character | API could be called with 1 char; backend returned all or filtered | No API call until 2 chars. Message: “Enter at least 2 characters to search.” |
| Backend GET /api/community/search?q= | Returned all directory users | Returns []. Empty/short query never returns a full list. |
| Search with 2+ chars, no results | “No users found.” | “No users found. Results are limited to the directory; try a different query or check that you have a chart linked for comparison.” |

## Commit

Step 3 commit hash: *(filled after commit)*
