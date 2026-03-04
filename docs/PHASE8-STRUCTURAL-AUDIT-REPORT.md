# Phase 8 — Closed Beta Hardening: Structural Audit Report

**Date:** 2026-03-04  
**Scope:** Read-only structural audit + determinism lock. No code changes.  
**North Star:** Deterministic, fail closed, no silent fallbacks, no cross-layer duplication, no seed computation outside `vnext`, no state mutation in UI, no protected-table contamination, one source of truth for identity.

---

## 1. Duplicate Logic Scan

Searched repo for secondary implementations or shadow logic.

### 1.1 Core RPG functions

| Symbol | Location | Role | Risk |
|--------|----------|------|------|
| `makeTurnSeed` | `vnext/rpg/hash/seeds.ts` | **Canonical** | none |
| | `vnext/rpg/campaign/turn-service.ts` | Consumer (import) | none |
| | `vnext/scripts/phase7-rpg-transit-test.ts`, `phase7-rpg-hash-test.ts` | Test only | none |
| `makeAudioSeedFromTurnSeed` | `vnext/rpg/hash/seeds.ts` | **Canonical** | none |
| | `vnext/rpg/campaign/audio-service.ts` | Consumer | none |
| | `vnext/scripts/phase7-rpg-audio-test.ts` | Test only | none |
| `applyOutcome` | `vnext/rpg/campaign/state-machine.ts` | **Canonical** | none |
| | `vnext/rpg/campaign/response-service.ts` | Consumer | none |
| `detectTransitSignals` | `vnext/rpg/transit/signal-detection.ts` | **Canonical** | none |
| | `vnext/rpg/campaign/turn-service.ts`, `phase7-rpg-transit-test.ts` | Consumer / test | none |
| `translateSignalsToDomains` | `vnext/rpg/transit/domain-translation.ts` | **Canonical** | none |
| | `vnext/rpg/campaign/turn-service.ts`, `phase7-rpg-transit-test.ts` | Consumer / test | none |

**Finding:** No duplicate implementations. Single source of truth under `vnext/rpg`.

### 1.2 Canonical JSON and hashing

| Location | Role | Risk |
|----------|------|------|
| `vnext/rpg/hash/json-hash.ts` | **Canonical** for RPG: `canonicalJsonString`, `hashCanonicalJson`, `sha256Hex` | none |
| `vnext/relational/intent-profiles.ts` | Local `canonicalJson` for intent profiles (different domain) | **moderate** — different algorithm; ensure no RPG code imports this |
| `lib/hash/chartHash.ts` | `stableStringify` + sha256 for chart hashing (compose/sandbox) | none — not used by RPG |
| `apps/web/src/core/hash.ts` / `hash.js` | `stableStringify` (client) | none — not used by RPG |
| `vnext/viz/payload.ts` | Canonical JSON for viz payload | none — not used by RPG |
| `scripts/smoke-lyria-export.js` | Ad-hoc `canonicalJson` | none — script only |
| `server/index.js` | `sha256Str`, manifest canonical (integrity) | none — not RPG path |

**Finding:** RPG uses only `vnext/rpg/hash/json-hash.ts`. Other canonical/stable stringify implementations exist in other subsystems; no cross-layer duplication in RPG path. **Recommendation:** Guard or review any future imports into `vnext/rpg` from `vnext/relational` or `lib/hash` to avoid accidental use of a different canonical form.

### 1.3 Provider resolution

| Location | Role | Risk |
|----------|------|------|
| `vnext/rpg/campaign/audio-service.ts` | `resolveAudioProvider()` — reads `RPG_AUDIO_PROVIDER`, allows `none` / `lyria` / `local_wav`, else throws | **Canonical**, fail-closed | none |

**Finding:** Single provider resolution path; no silent fallback (invalid value throws).

### 1.4 Seed computation

- **Turn seed:** Computed only in `vnext/rpg/campaign/turn-service.ts` via `makeTurnSeed(transitHash, stateHash, RPG_ALGO_VERSION)` (using `vnext/rpg/hash/seeds.ts`). No seed computation at API route layer.
- **Audio seed:** Computed only in `vnext/rpg/campaign/audio-service.ts` via `makeAudioSeedFromTurnSeed(turnSeed, AUDIO_ALGO_VERSION)`. No seed computation in routes.

**Finding:** No seed computation outside `vnext`; no duplication.

### 1.5 State mutation

- **Store layer:** `rpg-store.ts` mutates `state_json` only in `finalizeTurnTransactional` and `updateCampaignState` (both intended).
- **UI layer:** `apps/web/app/rpg/campaign/[campaignId]/page.tsx` only calls `buildCampaignView` and renders; no `state_json` or `state_version` writes.

**Finding:** No state mutation in UI; single mutation path in store.

### 1.6 Domain resolution

- Domain translation: **Canonical** in `vnext/rpg/transit/domain-translation.ts`; used only from `turn-service.ts` and tests.

**Finding:** No duplicate domain resolution logic.

---

## 2. API Surface Verification (`/api/rpg/*`)

| Route | Method | Input validation | Silent fallback? | Seed at route? | Heavy logic in vnext? | Business logic in UI? |
|-------|--------|------------------|------------------|----------------|------------------------|----------------------|
| `/api/rpg/campaign/[campaignId]` | GET | `campaignId` required; `userId` required (query) | No | No | Yes (`buildCampaignView`) | No |
| `/api/rpg/campaign/[campaignId]/turn` | POST | `campaignId`; `transitSnapshot` required in body | No | No | Yes (`getOrCreateDailyTurn`) | No |
| `/api/rpg/turn/[turnId]/respond` | POST | `turnId`; `userId`, `choiceId` required in body | No | No | Yes (`submitResponse`) | No |
| `/api/rpg/turn/[turnId]/finalize` | POST | `turnId` | No | No | Yes (`finalizeTurnOutcome`) | No |
| `/api/rpg/turn/[turnId]/audio` | GET | `turnId` | No | No | Yes (`ensureDailyAudioArtifactForTurn`) | No (GET-as-ensure documented) |

**Deviations:**

1. **POST `/api/rpg/campaign/[campaignId]/turn`:** Validates presence of `transitSnapshot` but does not validate shape (e.g. `EphemerisSnapshot` schema). Invalid payload may fail later in `hashSnapshot` or downstream. **Recommendation:** Add explicit schema/type validation or document that invalid snapshot fails fast in vnext (current behavior is fail-closed but error may be less clear).
2. **POST `/api/rpg/turn/[turnId]/finalize`:** Route does `const row = fresh || outcome` where `fresh = await getOutcomeByTurn(turnId)` and `outcome = await finalizeTurnOutcome({ turnId })`. `finalizeTurnOutcome` already returns the row from the DB (from `finalizeTurnTransactional`). So `fresh` is a redundant fetch; if both exist they refer to the same outcome. Not a silent fallback; minor redundancy. **Recommendation:** Return `outcome` only, or keep for extra consistency check and document.

No implicit creation except documented GET-as-ensure for `/api/rpg/turn/[turnId]/audio`. No seed computation at route layer. Heavy logic delegated to vnext. No business logic in UI layer.

---

## 3. Determinism Sweep

### 3.1 `vnext/rpg/`

- **phase7-guard** already forbids `Math.random` and `Date.now` in `vnext/rpg/`. Grep found **no** occurrences in `vnext/rpg/` (only in `vnext/scripts/phase7-guard.ts` as a comment). **Status:** Clean.

### 3.2 UUID / ID generation

| File | Context | Verdict |
|------|---------|--------|
| `vnext/rpg/store/rpg-store.ts` | `nanoid()` = `crypto.randomBytes(8).toString('hex')` for DB row IDs (campaign, turn, response, outcome, audio) | **Acceptable** — DB id creation; not used for seeds. |
| `vnext/scripts/phase7-rpg-*.ts` | `crypto.randomBytes(4).toString('hex')` for test `userId` / `chartId` | **Acceptable** — test isolation. |

No UUID/random ID generation in RPG path for business identity; turn_seed and audio_seed are deterministic.

### 3.3 Other code (outside vnext/rpg)

Findings for awareness; not in RPG critical path:

- `server/routes/compat.ts`: `Date.now()` and `Math.random()` for request IDs — acceptable (request tagging).
- `apps/web/src/core/atlas/telemetry.ts`: `Date.now()`, `Math.random()` — client telemetry; acceptable.
- `vnext/compat/routes.ts`, `vnext/compat/memory-store.ts`, etc.: `new Date()` for timestamps — acceptable.
- `apps/web/app/sandbox/page.tsx`, `CompatibilitySection.tsx`: Documented use of `Date.now()` for compose seed in some paths — outside RPG; see PRE-SOUND-DESIGN-STABILIZATION-AUDIT for sandbox determinism recommendations.
- `vnext/api/compose.ts`: `Date.now().toString(36)` for session/request IDs — acceptable (non-seed identifiers).

**Summary:** No determinism violations in `vnext/rpg`. Non-RPG code uses time/random for IDs and telemetry only.

---

## 4. Database Schema Integrity Review

### 4.1 Migrations audited

- `007_phase7_rpg_bundles_profiles.sql` — bundles + profiles
- `008_phase7_rpg_campaigns.sql` — campaigns, daily turns, responses, outcomes
- `009_phase7_rpg_daily_audio.sql` — daily audio artifacts

### 4.2 Additive and isolation

- All `rpg_*` tables are additive. No DROP or ALTER of existing core tables.
- No references to `astradio_charts`, `astradio_chart_vectors`, `astradio_compat`, `astradio_relational`, `astradio_groups`, `astradio_memberships`, `astradio_community` in these migrations. **phase7:guard** enforces this for any migration whose name includes "rpg".

### 4.3 Uniqueness and constraints

| Requirement | Migration | Status |
|-------------|-----------|--------|
| `turn_seed` unique | 008: `rpg_daily_turns.turn_seed` UNIQUE | ✅ |
| `(turn_id, user_id)` unique | 008: `rpg_member_responses` UNIQUE (turn_id, user_id) | ✅ |
| `turn_id` unique in outcomes | 008: `rpg_turn_outcomes.turn_id` UNIQUE | ✅ |
| `turn_seed` in audio | 009: `rpg_daily_audio_artifacts` UNIQUE (turn_seed) | ✅ |
| Provider check | 009: CHECK (provider IN ('none', 'lyria', 'local_wav')) | ✅ |
| Status check | 009: CHECK (status IN ('pending', 'ready', 'failed')) | ✅ |

### 4.4 Indexes

- `rpg_effects_bundles`: PRIMARY KEY (`bundle_hash`); `idx_rpg_effects_bundles_lookup` (natal_snapshot_hash, rpg_map_version).
- `rpg_profiles`: PRIMARY KEY (`id`); UNIQUE (user_id, chart_id, rpg_map_version, natal_snapshot_hash); `idx_rpg_profiles_user_chart`.
- `rpg_daily_turns`: PRIMARY KEY (`id`); UNIQUE (`turn_seed`); `idx_rpg_daily_turns_campaign_created` (campaign_id, created_at DESC) — supports `getLatestTurnForCampaign`.
- `rpg_member_responses`: UNIQUE (turn_id, user_id) supports `listResponsesByTurn(turn_id)`.
- `rpg_turn_outcomes`: UNIQUE (turn_id) supports `getOutcomeByTurn(turn_id)`.
- `rpg_daily_audio_artifacts`: UNIQUE (turn_seed); `idx_rpg_daily_audio_turn_id`; `idx_rpg_daily_audio_status`.

No overlapping or redundant index definitions identified. High-frequency lookups (by id, turn_seed, campaign_id, turn_id) are covered.

**Drift/gaps:** None identified. Schema matches store usage.

---

## 5. Performance Surface Scan

### 5.1 `buildCampaignView`

- **Flow:** `getCampaignById` → `getBundleByHash` → `getLatestTurnForCampaign`; if latestTurn then `listResponsesByTurn`, `getAudioByTurnSeed`, `getOutcomeByTurn`. Total up to **6 queries** per view (no loop).
- **N+1:** None; no per-item queries in a loop.
- **Redundant fetches:** None within the same request for the same entity.
- **JSON:** Uses store JSONB as-is; no extra stringify/parse cycles in the view builder.

### 5.2 Campaign lifecycle / turn creation

- `getOrCreateDailyTurn`: `getDailyTurnBySeed(seed)` then, if missing, `createDailyTurnIfMissing` (single INSERT + SELECT). No N+1.
- Turn creation path: one round-trip for existing, or one insert+select for new.

### 5.3 Finalize path

- `finalizeTurnOutcome` → `finalizeTurnTransactional`: single transaction with multiple SELECTs (outcome, turn, campaign FOR UPDATE, responses), one INSERT (outcome), one UPDATE (campaign state), one SELECT (outcome). No N+1; transaction scope is correct.

### 5.4 Audio ensure path

- `ensureDailyAudioArtifactForTurn`: `getDailyTurnById` then `createAudioIfMissing` (INSERT ON CONFLICT + getAudioByTurnSeed). Two queries; no N+1.

### 5.5 Risks flagged (no optimization requested)

- **Finalize route:** Redundant `getOutcomeByTurn` after `finalizeTurnOutcome` (same row returned) — minor extra round-trip.
- **buildCampaignView:** Sequential queries; could be batched or parallelized in future if needed (not required for beta).

---

## 6. Guardrail Expansion Review (phase7:guard)

**Current guards:**

- Under `vnext/rpg/`: no imports of `core/architecture-engine`, `feature-encode`; no `generateArchitecture`; no `Math.random` or `Date.now`; no lyria or @google-cloud imports.
- RPG-named migrations: no references to protected tables (astradio_*, compat, community).

**Proposed guard additions (rationale only; no implementation):**

| Guard | Rationale |
|-------|-----------|
| **No audio generation in vnext/rpg** | Ensure no code in `vnext/rpg` invokes Lyria or local WAV generation (only metadata/seed/artifact row). Could grep for `lyria`, `renderWav`, `generateAudio`, or similar. Partially covered by forbidden lyria/google-cloud imports; could add explicit symbol checks. |
| **Provider enum stability** | Fail if new provider is used before being added to `RPG_AUDIO_PROVIDER` check and migration CHECK. Optional: guard that any string literal matching a provider in code appears in the CHECK list. |
| **Cross-layer imports** | Optionally forbid `vnext/rpg` from importing `vnext/relational`, `vnext/compat`, or `lib/` (except shared types/contracts) to avoid accidental use of non-RPG canonical JSON or hashing. |
| **Core table contamination** | Already covered by migration guard. Could extend to any SQL in `vnext/rpg` (e.g. store) containing protected table names. |
| **New seed sources** | Consider requiring that any function named `*Seed*` or calling `sha256Hex` for business logic in `vnext/rpg` is either in `hash/seeds.ts` or explicitly allowed list. Reduces accidental new seed formulas. |
| **Randomness reintroduction** | Current `Math.random`/`Date.now` check is sufficient. Optional: add `crypto.randomBytes` check limited to id-generation sites (e.g. only in `rpg-store.ts` for `nanoid`) so no new randomness is added elsewhere in `vnext/rpg`. |

---

## 7. Step 2 — Controlled Deterministic Verification

### 7.1 Phase 7 gates run

| Gate | Status | Notes |
|------|--------|------|
| **phase7:guard** | ✅ Passed | RPG isolation and migration checks. |
| **phase7:slice1:test** (hash) | ✅ Passed | Canonical JSON, snapshot hash, turn_seed, audio_seed. |
| **phase7:slice2:test** (bundle) | ⏳ Not re-run this session | Requires vnext build; run manually. |
| **phase7:slice3:test** (store) | ⏳ Requires POSTGRES_URL | DB-dependent; run with live DB. |
| **phase7:slice4:test** (transit) | ⏳ Not re-run this session | Run manually. |
| **phase7:slice5:test** (campaign) | ⏳ Requires POSTGRES_URL | DB-dependent. |
| **phase7:slice5_5:test** (campaign UI) | ⏳ Requires POSTGRES_URL | DB-dependent. |
| **phase7:slice6:test** (audio) | ⏳ Requires POSTGRES_URL | DB-dependent. |

**Recommendation:** With `POSTGRES_URL` set, run in order:

```bash
npm run phase7:guard
npm run phase7:slice1:test
npm run phase7:slice2:test
npm run phase7:slice4:test
npm run phase7:slice3:test
npm run phase7:slice5:test
npm run phase7:slice5_5:test
npm run phase7:slice6:test
```

### 7.2 Manual simulation (operator)

To be run by operator with server and DB up:

1. Create campaign (via store or API as per your flow).
2. Create turn (POST `/api/rpg/campaign/:campaignId/turn` with valid `transitSnapshot`).
3. Submit response (POST `/api/rpg/turn/:turnId/respond` with `userId`, `choiceId`).
4. Finalize (POST `/api/rpg/turn/:turnId/finalize`).
5. Ensure audio (GET `/api/rpg/turn/:turnId/audio`).
6. Fetch campaign view (GET `/api/rpg/campaign/:campaignId?userId=...`).

**Confirm:** No duplicate rows; idempotency where specified; no race conditions; state_version increments exactly once per finalize; no unexpected inserts; audio binds to `turn_seed`; no nondeterministic behavior in seeds or state.

---

## 8. Beta Readiness Score and Summary

### 8.1 Beta readiness score: **8/10**

- **Strengths:** Single source of truth for seeds and core logic; no RPG logic in UI; no determinism violations in vnext/rpg; schema and constraints aligned; phase7:guard and slice1 verified; API routes thin and delegated to vnext.
- **Deductions:** (1) No schema validation on `transitSnapshot` at API boundary. (2) Finalize route has redundant fetch. (3) Slice tests 3, 5, 5_5, 6 not run in this audit (DB-dependent). (4) Manual simulation not run in this session.

### 8.2 Recommendations (prioritized, no implementation)

1. **High:** Run full Phase 7 slice suite (slice2–slice6) with `POSTGRES_URL` and document results; run manual create → turn → respond → finalize → audio → view flow once and confirm idempotency and determinism.
2. **Medium:** Add explicit validation for `transitSnapshot` (shape or type) on POST `/api/rpg/campaign/:campaignId/turn` so invalid input fails fast with a clear error.
3. **Medium:** Simplify finalize route response (e.g. return only `outcome` from `finalizeTurnOutcome`) or document why `fresh || outcome` is kept.
4. **Low:** Expand phase7:guard with optional checks (e.g. no audio generation in vnext/rpg, or allowlist for `crypto.randomBytes` usage).
5. **Low:** Consider batching or parallelizing `buildCampaignView` queries later if campaign view latency becomes an issue.

---

**Audit complete.** No code changes were made. Prioritize remediation after review.

---

## Phase 8 Step 1 Completion (2026-03-04)

### Changes made

1. **1A — transitSnapshot validation (fail-closed)**  
   - Added `vnext/rpg/validate-transit-snapshot.ts`: structural validation for `EphemerisSnapshot` (required keys and types; no coercion).  
   - POST `/api/rpg/campaign/[campaignId]/turn` now calls `validateTransitSnapshot(transitSnapshot)` before delegating; invalid payloads return **400** with a clear message.  
   - No seed computation or heavy logic in the route.  
   - Validation tests added to `phase7-rpg-transit-test.ts` (slice4): `validateTransitSnapshot(null)` and `validateTransitSnapshot({})` reject; `validateTransitSnapshot(valid)` accepts.

2. **1B — Finalize route**  
   - Removed redundant `getOutcomeByTurn` after `finalizeTurnOutcome`.  
   - Route now returns the row from `finalizeTurnOutcome` directly.

3. **Guard hardening (phase7-guard)**  
   - **crypto.randomBytes:** Forbidden under `vnext/rpg/` except in the allowlisted file `rpg-store` (nanoid for DB ids).  
   - **Imports:** Forbidden imports from path segments `/relational` and `/compat` into `vnext/rpg/` (patterns use path segment to avoid false positives e.g. "compatible" in comments).

### Phase 7 suite results (this run)

| Gate / Slice | Result | Notes |
|--------------|--------|--------|
| phase7:guard | ✅ Pass | Isolation + migrations + randomness + import boundaries |
| phase7:slice1:test | ✅ Pass | Hash, canonical JSON, turn_seed, audio_seed |
| phase7:slice2:test | ✅ Pass | Bundle determinism |
| phase7:slice4:test | ✅ Pass | Transit + **validateTransitSnapshot** tests |
| phase7:slice3:test | ⏭️ Skip | DB not available (connection refused). In CI set `POSTGRES_URL` and run; script exits 1 if DB unavailable when `CI` is set. |
| phase7:slice5:test | ⏭️ Skip | Same as slice3. |
| phase7:slice5_5:test | ⏭️ Skip | Same as slice3. |
| phase7:slice6:test | ⏭️ Skip | Non-DB assertions passed; DB-dependent part skipped. |

**CI:** For a full pass with DB, set `POSTGRES_URL` (and optionally `CI=1` so DB-unavailable fails the run). Run order: guard → slice1 → slice2 → slice4 → slice3 → slice5 → slice5_5 → slice6.
