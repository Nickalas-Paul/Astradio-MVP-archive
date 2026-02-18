# Phase 3C: Immediate Hardening

## Overview

Server-side scope enforcement for compatibility intent, hardened members endpoint, and determinism verification. Candidate scope is enforced backend-side (not UI-only). Members listing is paginated, minimal, and never includes compat scores.

## Backend scope enforcement (POST /api/compatibility/intent)

### Request contract (additions)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scope | `'my_groups' \| 'group' \| 'global'` | No | Default `'global'` |
| groupId | string | Yes when scope=`group` | Group to restrict candidates to |
| seekerUserId | string | No | For `my_groups` scope (auth stub: `usr_dev`) |

### Rules

- **scope=global**: Candidates = full directory (current behavior). Stable ordering by chartId.
- **scope=group**: Candidates = members of groupId with chartId present. Only charts in compat storage.
- **scope=my_groups**: Candidates = members of groups the seeker belongs to. Uses community store memberships.

Candidates are restricted **before** scoring/clustering. Clustering rules unchanged. Deterministic: stable sort by chartId before processing.

### Response

- Shape unchanged: `{ intent, clusters }`
- Optional `meta: { scope, candidateCount }` — no scores

### Implementation

- `vnext/api/scope-resolver.ts`: `getScopedCandidates(scope, groupId?, seekerUserId?)` — uses community store when scope is group/my_groups
- `vnext/api/compatibility-intent.ts`: Uses `getScopedCandidates` instead of full directory for candidate set

## Members endpoint (GET /api/community/groups/:groupId/members)

### Query params

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| limit | number | 25 | 50 | Page size (clamped) |
| cursor | string | "0" | — | Offset for pagination |

### Response

```json
{
  "members": [
    { "userId": "...", "handle": "...", "displayName": "...", "chartId": "..." }
  ],
  "nextCursor": "25"
}
```

- **Do NOT include**: compatibility scores, ranking fields, full chart data
- **Ordering**: Stable by membership id (createdAt)

### Errors

- 404 when group not found
- Invalid limit → clamped to 1–50

## Frontend: scope parameters

IntentForm passes to POST /api/compatibility/intent:

- `scope`: `my_groups` | `group` | `global` (UI "This group" → `group`)
- `groupId`: from URL when scope=group (launched from group page)
- `seekerUserId`: `usr_dev` when scope=my_groups (TODO: auth integration)

## Determinism verification

### Phase 3C script: `vnext/scripts/phase3c-verification.ts`

- **COMMUNITY_ROUTER**: GET /api/community/guidance must return 200; if not, prints `COMMUNITY_ROUTER=UNAVAILABLE` and exits non-zero.
- **scope=global**: 3 runs → identical cluster checksums. `SCOPE_GLOBAL_CHECKSUM=...`
- **scope=group**: Self-seeds a deterministic group, joins 3 members with directory chart IDs, 3 runs → identical checksums. `SCOPE_GROUP_CHECKSUM=...`

### How it seeds data

1. **Community router check**: GET /api/community/guidance → require 200; exit non-zero if unavailable.
2. **Seed group**: POST /api/community/groups with `{ name: "Phase3C Seed Group", slug: "phase3c-seed", description: "...", tags: ["phase3c","seed"] }`. If 201, use returned `groupId`. If create fails, fetches existing via GET /api/community/groups/phase3c-seed.
3. **Seed members**: POST /api/community/groups/:groupId/join for each of `{ userId: "usr_demo_1", chartId: "chart_match_1" }`, `usr_demo_2/chart_match_2`, `usr_demo_3/chart_match_3`. Uses compat directory chart IDs (seeded at compat startup).
4. **Intent runs**: POST /api/compatibility/intent with `scope=group`, `groupId`, `seekerChartId`, `intent: "friendship"` — 3 runs; assert identical normalized cluster checksums.

### Run

```bash
npm run vnext:build
# Start engine (must bind; if port 3000 is in use, use PORT=3001)
node server/index.js   # in another terminal
node dist/vnext/vnext/scripts/phase3c-verification.js
```

If port 3000 is in use (e.g. Next.js), run the engine on another port and point the script at it:
```bash
PORT=3001 node server/index.js
API_BASE_URL=http://localhost:3001 node dist/vnext/vnext/scripts/phase3c-verification.js
```

### Checksums (from PASS run)

| Scope | Checksum |
|-------|----------|
| global | `ac467a8e5c3c8f72348cc1aae3641ba177c3d5a4ec6bbe654d5e7dbc17734ad1` |
| group  | `7ff6dc193d10b8c8f8b07f88f771094451b841503007b27237fb49a0a8d1c701` |

### Phase 2 still passes

- `node dist/vnext/vnext/scripts/phase2-verification.js` — unchanged checksums

## Verification checklist

- [x] `npm run vnext:build` PASS
- [x] Phase 2 verification PASS (unchanged)
- [x] Phase 3C scope=global 3x identical checksums
- [x] Phase 3C scope=group: self-seed + 3x identical checksums (server with community routes)
- [x] /api/compatibility/intent does not call compose/music/gates
- [x] /api/community/groups/:groupId/members returns paginated minimal fields only

## TODOs

- **Auth for my_groups**: Replace `seekerUserId: 'usr_dev'` with actual auth when integrated
- **scope=group verification**: Ensure engine server includes community router for full Phase 3C pass
