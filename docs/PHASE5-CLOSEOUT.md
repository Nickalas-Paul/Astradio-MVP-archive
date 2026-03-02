# Phase 5 — Closeout

**Status:** Complete. Smoke + docs in place. Ready for Phase 6 (Sandbox Composition).

---

## Goal

Phase 5 delivered a **relational compatibility and group layer** under `/api/relational/*`: intent-weighted scoring, phantom transforms, constellation eligibility, private relational groups, non-platform charts, multi-chart compatibility, group reports, and group composition — all using **stored vectors only**, no `generateArchitecture` in match/score paths, deterministic outputs, and fail-closed behavior.

---

## Final API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/relational/intent-profiles | List intent profiles (id, slug, label, version, algorithm_version, profile_hash) |
| GET | /api/relational/constellations | List constellation centroid metadata |
| POST | /api/relational/constellations/eligibility | Chart eligibility vs centroids (body: `chartId`) |
| POST | /api/relational/compatibility | 1:1 compatibility score (body: chartIdA, chartIdB, intentProfileId) |
| POST | /api/relational/compatibility/multi | Multi-chart matrix + aggregates (body: chartIds, intentProfileId) |
| POST | /api/relational/charts | Create non-platform chart; single vector write path; rollback on vectorize failure |
| POST | /api/relational/groups | Create group |
| GET | /api/relational/groups | List groups by owner |
| GET | /api/relational/groups/:id | Get group (owner-only) |
| PATCH | /api/relational/groups/:id | Update group (owner-only) |
| DELETE | /api/relational/groups/:id | Delete group (owner-only) |
| POST | /api/relational/groups/:id/members | Add member (owner-only) |
| GET | /api/relational/groups/:id/members | List members (owner-only) |
| DELETE | /api/relational/groups/:id/members/:memberId | Remove member (owner-only) |
| GET | /api/relational/groups/:id/chart-ids | Resolve chart IDs for group (owner-only; chart_id ASC) |
| POST | /api/relational/reports/group | Build group compatibility report (body: groupId or chartIds, intentProfileId, title?) |
| POST | /api/relational/compose/group | Group composition via composeFromFeatures (body: groupId or chartIds, title?) |

All owner-scoped routes use session-only `ownerId` in production; dev overrides gated by `NODE_ENV=development` and `ALLOW_DEV_USER_FALLBACK=true`.

---

## Data model (migrations 004 + 005)

- **004:** `astradio_charts.is_non_platform`; tables: `astradio_compatibility_intent_profiles`, `astradio_compatibility_results`, `astradio_phantom_profiles`, `astradio_constellation_centroids`, `astradio_relational_groups`, `astradio_relational_group_members` (with indexes and owner/slug unique).
- **005:** `astradio_relational_group_members.member_type` (platform | non_platform), CHECK for platform vs non-platform, UNIQUE(group_id, chart_id).

Additive only; no destructive changes to existing tables beyond adding columns.

---

## Determinism and isolation invariants

- **Untouched:** `vnext/core/architecture-engine.ts`, `vnext/api/compose.ts`, `vnext/feature-encode.ts`, `vnext/compat/matches.ts`.
- **Stored vectors only:** No `generateArchitecture` in relational scoring/match/compose paths; single vector write path remains `populateChartVector` (vector-cache).
- **Deterministic:** Scoring, aggregates, eligibility, report, group compose (seed from chart_ids + vector hashes). No randomness, no recommender logic.
- **Fail-closed:** Missing vectors → explicit error (422 with `missing_chart_ids`); no partial matrix.

---

## Error contract

| Condition | Status | Body |
|-----------|--------|------|
| Missing vectors | 422 | `{ error: "missing_vectors", missing_chart_ids: string[], message }` |
| Validation (bad/missing body) | 400 | `{ error: "validation_error", message }` |
| Not owner / unauthorized | 403 | `{ error: "forbidden", message }` |
| Resource not found | 404 | `{ error: "not_found", message }` |
| No session (owner required) | 401 | `{ error: "owner_id required (authenticated session)" }` or similar |

---

## How to run smoke

```bash
npm run phase5:smoke
```

Runs full Phase 5 verification chain (guard + all verify-* scripts) in order; fail-fast. No Postgres or network required. On success prints: `PHASE5 SMOKE PASS`.

---

## Known intentional omissions

- **GET /api/relational/compatibility/multi?groupId=...&intentProfileId=...** — Not implemented. Multi-chart is exposed only via **POST** with body `{ chartIds, intentProfileId }`; callers can resolve `chartIds` via GET `/api/relational/groups/:id/chart-ids` then POST to compatibility/multi.
