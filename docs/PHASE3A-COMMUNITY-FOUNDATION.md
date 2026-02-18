# Phase 3A: Public Community Foundation + Group Surfaces

## Overview

Minimal viable public community layer with light guardrails. No swiping, no percentage grids, no ranked lists. Compatibility is a lens (Phase 3B), not the entry point. One engine; no synthetic snapshots; GroupProfile remains an honest aggregate.

## Schema summary (in-memory)

Persistence is in-memory in `lib/community-store.js` (can be swapped for Postgres later).

| Entity      | Fields |
|------------|--------|
| **User**   | id, handle, displayName, createdAt |
| **Chart**  | id, ownerId, label, date, time, lat, lon, tz, createdAt (compat-shaped) |
| **Group**  | id, slug, name, description, tags[], visibility ('public'), createdAt |
| **Membership** | id, groupId, userId, role ('member' \| 'mod'), chartId?, createdAt |
| **Post**   | id, groupId, userId, title, body, createdAt |
| **Comment**| id, postId, userId, body, createdAt |
| **Report** | id, targetType, targetId, reason, note, createdAt |

- Public groups by default. No DMs, no follower graph.
- Optional `chartId` on membership: used when computing group profile (members’ charts → GroupProfile).

## API endpoints

All under `/api/community/*`. Proxied from Next.js to engine when using the web app.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/community/guidance | Static banner text (guardrails) |
| GET | /api/community/groups | List groups (query: `tag`, `q`) |
| POST | /api/community/groups | Create group (body: name, slug?, description?, tags?) |
| GET | /api/community/groups/:slugOrId | Group detail (by slug or id) |
| POST | /api/community/groups/:groupId/join | Join group (body: userId?, chartId?) |
| GET | /api/community/groups/:groupId/posts | List posts (query: limit?) |
| POST | /api/community/groups/:groupId/posts | Create post (body: title, body) — rate limited |
| GET | /api/community/posts/:postId | Post detail + comments |
| POST | /api/community/posts/:postId/comments | Add comment (body: body) — rate limited |
| POST | /api/community/groups/:groupId/profile | Compute GroupProfile from members’ chartIds (reuses Phase 2 logic; no compose/music/gates) |
| POST | /api/community/report | Create report (body: targetType, targetId, reason, note?) |

Existing Phase 2 endpoint (unchanged):

- POST /api/community/groups/profile — body: `{ groupId, chartIds }` or `{ groupId, featureVecs }` (GroupProfile on demand).

## Guardrails implemented

1. **Content guidance (static)**  
   Banner text on /community and group page:  
   *"Public space. No harassment. No hate. No exclusionary or inflammatory topics."*

2. **Server-side validation**  
   - Length limits: title 200, body 5000, report note 500.  
   - Blocklist: configurable via `COMMUNITY_BLOCKLIST` (comma-separated). No list by default.  
   - Blocked content returns 400 "Content not allowed".

3. **Rate limiting**  
   - Post/comment: 30 requests per minute per IP (express-rate-limit on POST groups/:id/posts and POST posts/:id/comments).

4. **Reporting stub**  
   - POST /api/community/report stores in Report table. No admin UI; no ML or external moderation.

## UI surfaces

- **/community** — Tabs include "Groups". Groups tab: list groups, search (q), filter by tag, "Create group". Chronological; no feed algorithm.
- **/community/group/[slug]** — Group header, guidance banner, GroupProfile summary (POST groups/:id/profile), posts list, "Join group" button.
- **/community/post/[id]** — Post, comments list, add comment form.

No compatibility match scores or rankings on group/member list. "Compatibility Lens" on user card deferred to Phase 3B.

## Verification / invariants

- **Build**: `npm run vnext:build` — PASS.
- **Phase 2 determinism**: `node dist/vnext/vnext/scripts/phase2-verification.js` — PASS (unchanged checksums).
- GroupProfile route (POST /api/community/groups/:groupId/profile) does not call compose, music, or gates; it reuses `createGroupProfile` from vnext (member chartIds → aggregate only).
- Community CRUD endpoints do not touch compose.

## Known limitations

- **No admin UI** for reports or moderation.
- **No auth**: single dev user stubbed; auth can be swapped in later.
- **Public by default**: all groups public; no private groups in this phase.
- **Persistence**: in-memory only; restart clears data. Replace with Postgres (e.g. lib/database.js) when ready.

## Files touched

- **Data**: `lib/community-store.js`
- **API**: `server/routes/community.js`, `server/index.js` (mount), `apps/web/app/api/community/[...path]/route.ts` (proxy)
- **UI**: `apps/web/app/community/CommunityClient.tsx` (Groups tab + GroupsList), `apps/web/app/community/group/[slug]/page.tsx`, `apps/web/app/community/post/[id]/page.tsx`
