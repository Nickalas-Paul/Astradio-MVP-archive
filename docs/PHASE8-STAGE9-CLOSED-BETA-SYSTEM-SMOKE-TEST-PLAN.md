# Phase 8 — Stage 9: Closed Beta System Smoke Test Plan (Revised Proposal)

**Stage:** 9 — Closed Beta System Smoke Test  
**Phase:** 8 — Closed Beta Hardening  
**Ladder:** Stages 1–8 PASS. This document is **planning only**; no implementation until the revised proposal is reviewed and approved.

**Objective:** Validate that the entire Astradio platform operates correctly as a **complete system**. This is the final **system coherence smoke test** for Phase 8. It must verify that major Astradio surfaces function together as one deterministic platform without identity drift, persistence drift, or cross-surface contradictions.

**Scope:** Verification only. No new features, gameplay mechanics, architectural refactors, interpretation engine changes, or snapshot math changes. Strictly verification of the existing platform.

---

## 1. Revised approval summary

The required corrections are understood and incorporated below. **No implementation is being performed yet.** This revised plan:

- Adds **explicit identity continuity** assertions and an identity continuity matrix.
- Adds a **compose determinism repeat check** (two identical sandbox compose requests; same `hashes.plan_sha256`).
- Replaces the weak history check with a **real persistence assertion** using current history contracts only.
- Adds a **campaign turn-audio repeat check** for seed stability when the route returns seeds.
- Uses the **revised flow order** (14 steps including repeat checks).
- Defines **fail-fast vs best-effort** and when downstream steps are skipped.

Implementation will begin only after explicit approval of this revised proposal.

---

## 2. Revised flow list

| # | Flow name | Description |
|---|-----------|-------------|
| 1 | **Health** | GET health → 200, status ok. |
| 2 | **Identity bootstrap** | GET create-test-user (when PHASE8_DEBUG=1) → 200; body has userId, campaignId, chartId. Capture for continuity. |
| 3 | **Profile** | GET profile (by bootstrap userId or canonical) → 200; user.id and primaryChart.id present. Capture and assert continuity. |
| 4 | **Profile chart** | GET profile/chart by chartId from profile → 200; chart.id and snapshot/explainer present. Assert chart.id === profile.primaryChart.id. |
| 5 | **Sandbox snapshot** | POST sandbox/snapshot (birth from profile-chart) → 200; snapshot shape. |
| 6 | **Sandbox report** | POST sandbox/report (same birth/overrides) → 200; features length 64. |
| 7 | **Compose sandbox** | POST compose mode=sandbox (fixed payload from profile birth) → 200; hashes.plan_sha256 and explanation.sections. Capture plan_sha256 and export_id. |
| 8 | **Compose sandbox repeat** | Second POST compose with **identical** sandbox payload → 200; hashes.plan_sha256 **exactly equal** to step 7. |
| 9 | **Compose overlay** | POST compose mode=overlay (overlayParams from profile birth + current datetime) → 200; overlay shape. Optionally capture export_id. |
| 10 | **Campaign view** | GET rpg/campaign/[campaignId]?userId= → 200; campaign.user_id, campaign.chart_id, character_sheet or current_turn; diagnostics. Capture campaignId, turnId from current_turn. |
| 11 | **Turn audio** | GET rpg/turn/[turnId]/audio → 200; body has turn_seed, audio_seed. Capture for repeat. |
| 12 | **Turn audio repeat** | Second GET rpg/turn/[turnId]/audio → 200; turn_seed and audio_seed **unchanged** from step 11. |
| 13 | **Export** | GET exports/[export_id] using export_id from compose (step 7 or 9) → 200 or 202; binary or status; no 5xx. |
| 14 | **History** | GET user/history?userId= → 200; array; **persistence assertion** per § 5 below. |

**Skip rules (downstream steps skipped when upstream data is missing):**

- If **bootstrap** fails or is skipped: use hardcoded canonical `userId`, `chartId`, `campaignId` for profile, profile chart, campaign view; continue. If profile then fails (no primaryChart.id), skip profile chart, sandbox (no birth), compose sandbox/repeat, overlay, export; campaign view and turn audio still run with canonical ids.
- If **profile** fails: skip profile chart (no chartId), sandbox snapshot/report (no birth), compose sandbox/repeat/overlay (no chart context), export (no export_id); campaign view and turn audio run with bootstrap or canonical campaignId/turnId if available.
- If **profile chart** fails: sandbox/compose use fallback birth (e.g. canonical 1990-01-01 12:00 NY) if defined; otherwise skip sandbox and compose flows.
- If **campaign view** fails or has no `current_turn`: skip turn audio and turn audio repeat (no turnId).
- If **compose sandbox** returns no `export_id`: export step is skipped or asserted as “no export_id to check”; history still runs with persistence assertion.

---

## 3. Identity continuity matrix

| Identifier | Where captured | Where propagated | Assertion |
|------------|----------------|-------------------|-----------|
| **userId** | Bootstrap response `body.userId`; or canonical `phase8_real_user`. | All subsequent requests that need user scope (profile, campaign, history). | Profile: `body.user.id === bootstrap.userId` (or canonical). Campaign: `body.campaign.user_id === userId`. History: every item with `userId` has `item.userId === userId`. |
| **chartId** | Bootstrap `body.chartId`; or profile `body.primaryChart.id`; or canonical `phase8_real_chart`. | Profile chart URL, campaign diagnostics, history items. | Profile: `body.primaryChart.id === chartId`. Profile chart: `body.chart.id === profile.primaryChart.id`. Campaign: `body.campaign.chart_id === chartId` and `_diagnostics.resolved_chart_id === chartId`. History: every item with `chartId` has `item.chartId === chartId`. |
| **campaignId** | Bootstrap `body.campaignId`; or canonical `rpg_camp_81ceacfa9caab6ab`. | Campaign view URL. | Campaign view: `body.campaign.id === campaignId`; request URL uses this campaignId. |
| **turnId** | Campaign view `body.current_turn.id`. | Turn audio and turn audio repeat URLs. | Turn audio: request uses same turnId; response `body.turn_id` matches turnId. |
| **exportId** | Compose sandbox (or overlay) response `body.export_id`. | Export step GET URL. | Export: GET `/api/exports/${export_id}` uses the export_id from compose; 200 or 202, no 5xx. |

Continuity is enforced by: (1) capturing the identifier from the first response that provides it (bootstrap or profile), (2) using that value in all downstream requests that require it, (3) asserting in each response that any returned id field matches the captured value where the contract guarantees it (e.g. campaign.user_id === userId).

---

## 4. Determinism checks

**Compose repeat (required):**  
Two identical `POST /api/compose` requests with the same sandbox payload (same mode, chartData or overriddenSnapshot, controls). Both must return HTTP 200 and a non-empty `hashes.plan_sha256`. The two `plan_sha256` values must be **exactly equal**. This is a smoke-level determinism confirmation for the compose pipeline.

**Campaign audio repeat (recommended; included):**  
Two sequential `GET /api/rpg/turn/[turnId]/audio` requests with the same turnId (from campaign view). The existing route returns `turn_seed`, `audio_seed`, `status`, etc. **Assertion:** the second response’s `turn_seed` and `audio_seed` must be identical to the first response’s. If the route ever returns only a status/pending shape without seeds, the strongest non-drifting assertion from the current contract is: second response status is 200 and (if present) `turn_id` unchanged; no contradictory values between the two responses.

---

## 5. Persistence assertion (history)

**Exact assertion using current contracts only:**

- **Request:** `GET /api/user/history?userId=<canonical userId>` (or session-scoped when applicable).
- **Response:** HTTP 200; body is an array (or body.items is an array); no 5xx.

**Real persistence proof (what will be checked):**

1. **User-scoped consistency:** For every item in the history array that has a `userId` property, assert `item.userId === canonical userId`. For every item that has a `chartId` property, assert `item.chartId === canonical chartId`. (This matches Stage 6 and Phase 8 identity verification behavior.)
2. **Persistence signal:** After compose activity in this smoke run (steps 7 and/or 9), assert at least one of:
   - **Option A:** At least one history entry exists such that `item.userId === canonical userId` (proving user-scoped persistence of history for this user), **or**
   - **Option B:** If the history API returns items with an `id` field that corresponds to export ids, at least one item has `item.id === export_id` from the compose response in this run.

If the deployed history contract does not attach `userId` or `chartId` to items (e.g. engine returns only `{ id, ts, model_id }`), the **minimal persistence assertion** is: (1) HTTP 200, body is an array; (2) no 5xx; (3) optionally, after compose that returned an export_id, the array length is ≥ 1 or at least one entry has a recent `ts` / identifiable linkage, as the strongest available signal from the existing response shape without changing the API.

The harness will implement the strongest of the above that the actual response shape supports (userId/chartId per item first; then export id match; then array + length/recency as fallback).

---

## 6. Fail-fast and best-effort

**Fail-fast (stop run on first failure):**

- Health  
- Bootstrap (or canonical identity resolution when bootstrap skipped)  
- Profile  
- Profile chart  
- Campaign view  

**Best-effort (run all, record pass/fail per step; do not stop):**

- Sandbox snapshot  
- Sandbox report  
- Compose sandbox  
- Compose sandbox repeat  
- Compose overlay  
- Turn audio  
- Turn audio repeat  
- Export  
- History  

**Skip rules:** As in § 2: when an upstream step fails or does not produce required data (e.g. no turnId from campaign view), downstream steps that depend on that data are **skipped** and reported as “skipped (no turnId)” etc., not as FAIL. Only steps that were **executed** are required to PASS for overall Stage 9 PASS.

---

## 7. Expected outputs / PASS indicators (summary)

| Flow | PASS condition |
|------|-----------------|
| 1 Health | 200; body.status === 'ok'. |
| 2 Bootstrap | 200; body.userId, body.campaignId present; chartId when available. |
| 3 Profile | 200; body.user.id === canonical userId; body.primaryChart.id === canonical chartId. |
| 4 Profile chart | 200; body.chart.id === profile.primaryChart.id; snapshot or explainer present. |
| 5–6 Sandbox | 200; snapshot shape; features.length === 64. |
| 7 Compose sandbox | 200; hashes.plan_sha256 non-empty; explanation.sections present. |
| 8 Compose repeat | 200; hashes.plan_sha256 === step 7 plan_sha256. |
| 9 Overlay | 200; overlay response shape. |
| 10 Campaign view | 200; campaign.user_id and campaign.chart_id match canonical; diagnostics; character_sheet or current_turn. |
| 11 Turn audio | 200; body.turn_seed, body.audio_seed present. |
| 12 Turn audio repeat | 200; body.turn_seed and body.audio_seed unchanged from step 11. |
| 13 Export | 200 or 202; no 5xx. |
| 14 History | 200; array; persistence assertion per § 5. |

**Overall Stage 9 PASS:** All **executed** (non-skipped) steps pass. Skipped steps do not cause FAIL.

---

## 8. Harness implementation recommendation

**Recommendation:** Add a **dedicated** `vnext/scripts/phase8-stage9-system-smoke.ts`.

**Rationale:**

- Stage 9 has **14 flows**, explicit **identity capture/propagation/assertion**, **determinism repeats**, and a **structured persistence assertion**. That logic (shared types, HTTP helpers, identity state, skip rules) fits a single TypeScript script better than stretching beta-smoke (PS1/bash), which would become large and harder to maintain.
- Existing **Stage 6** script already provides: `httpRequest`, profile/campaign/history types, `withPinnedUser`, bootstrap and profile/chart/campaign assertions. Reusing or mirroring that pattern in a Stage 9 script keeps behavior consistent and avoids duplicating engine/Next contract knowledge.
- A dedicated script can **output structured PASS/FAIL per flow** and **skip reasons** without cluttering the generic beta-smoke, which should remain a quick backbone smoke (health, compose, sandbox report, etc.) for other contexts.
- No new endpoints; script only calls existing APIs.

---

## 9. Approval request

This revised Stage 9 proposal incorporates:

- Explicit identity continuity assertions and the identity continuity matrix  
- Compose determinism repeat check (identical sandbox compose → same plan_sha256)  
- Real persistence assertion for history (user-scoped and/or export linkage per current contract)  
- Campaign turn-audio repeat check for seed stability  
- Revised 14-step flow order and defined fail-fast vs best-effort and skip rules  

**I request approval to implement** the Stage 9 smoke test according to this revised plan (single harness: `vnext/scripts/phase8-stage9-system-smoke.ts`). No code or patches will be produced until approval is given.

---

**Status:** Implemented. Harness: `vnext/scripts/phase8-stage9-system-smoke.ts`. Run: `API_BASE_URL=<app-url> npm run phase8:stage9:smoke` (or with `npx ts-node --project vnext/tsconfig.json vnext/scripts/phase8-stage9-system-smoke.ts` before build). Optional: `PHASE8_SKIP_BOOTSTRAP=1` to use canonical ids without create-test-user.
