# Phase 8 — Stage 8: Campaign System Entry Verification Plan (Revised)

**Stage:** 8 — Campaign System Entry Verification  
**Phase:** 8 — Closed Beta Hardening  
**Ladder:** Locked (Stages 1–7 PASS). No new phases, subphases, or adjacent implementation tracks.

**Objective:** Verify that the Campaign system integrates correctly with the platform architecture. Campaign must behave as a **downstream consumer** of the deterministic platform—not as a parallel computation layer or identity silo.

**Scope:** Verification only. No RPG mechanic additions, narrative expansion, interpretation/chart/snapshot changes, engine refactoring, or router mounting (unless already present and strictly necessary for verification).

---

## A. Architectural Guardrails (Explicit)

These three guardrails are binding. Any violation is an automatic rejection condition for Stage 8.

### A.1 Campaign is a structured client of the platform chain

Campaign logic must sit **downstream** of the following canonical pipeline. Campaign may only **consume** outputs from these stages; it must not replace or bypass them.

1. **EphemerisSnapshot** (canonical chart state)
2. **Feature Encoding** (encodeFeatures → FeatureVec)
3. **Architecture Engine** (generateArchitectureFromSnapshot)
4. **ExplainSpec** (buildExplainSpec*, plan, guidance)
5. **Deterministic Renderer** (sections, text)
6. **Compose Pipeline** (plan, Lyria/narrative, audio)
7. **Campaign Systems** (bundle, character, state, turn, challenge, audio resolution)

Campaign is a **caller/client** of the established compose and chart pipeline. It does not own chart math, encoding, or plan generation.

### A.2 Campaign is not an alternate astrology engine

Campaign must **not** compute natal or transit chart state itself.

**Hard rule — snapshot-derived only:**

- Campaign logic must **only** consume canonical **EphemerisSnapshot-derived** data and downstream deterministic platform outputs.
- **Any** Stage 8 implementation or test harness path that **recomputes** placements, houses, aspects, or chart math **inside** campaign or RPG code is **out of bounds** and must be treated as a **failure condition**.
- All placements, houses, aspects, and character class/subclass/rising must come from: (1) an EphemerisSnapshot supplied to the platform, or (2) a bundle/architecture/output produced by the platform from such a snapshot. No alternate computation path is permitted.

### A.3 Campaign is not a parallel identity layer

Campaign must **inherit** identity from the platform. It must **not** introduce or maintain a separate identity system.

**Identity continuity chain (required):**

- **userId** → resolved by session/profile (Stages 4–6).
- **chartId** → resolved by profile primary chart / request (Stages 4–6).
- **campaignId** → resolved by `(userId, chartId, rpgMapVersion, rpgAlgoVersion)`; one canonical campaign per (user, chart, version).
- **characterId** → derived from character profile built from **natal snapshot via Architecture/Bundle**; no campaign-originated identity.

Stage 8 must **explicitly verify** that this chain holds and remains **stable** across:

- **Profile surface** (GET profile, GET profile/chart): same userId and chartId as used for campaign.
- **Compose surface** (POST compose, overlay/sandbox): chart identity comes from same snapshot/params; no campaign-introduced chart source.
- **Campaign surface** (GET campaign view, turn, audio): campaign.user_id = userId, campaign.chart_id = chartId; diagnostics resolved_* match profile/bundle; no alternate identity source.

The point is to **prove** that Campaign inherits identity guarantees already established in Stages 4–6, not to invent new testing scope.

---

## B. Compose-Pipeline Dependency for Campaign Audio (Hard Rule)

Campaign audio must use the **same** composition path already verified in Stage 3.

**Hard rule:**

- **Campaign audio/composition may not introduce or rely on an alternate generation pipeline.**
- Stage 8 must prove the path is: **campaign challenge → compose pipeline → deterministic audio plan/artifact**, with Campaign acting **only** as a caller/client of the established compose system.
- **If any alternate campaign-specific audio generation path exists** in the plan or implementation (e.g. a dedicated “campaign audio engine” that does not go through the compose pipeline), that is an **automatic rejection condition**.

Allowed: campaign resolves **context** (e.g. turn_seed, audio_seed, audioContextId) and then **invokes** the same compose/audio path used elsewhere. Not allowed: a separate code path that generates or plans audio solely for campaign without going through the verified compose pipeline.

---

## C. Test Lane: Minimal and Canonical

The **primary** verification lane is the smallest deterministic path necessary. Do not expand the matrix.

**Canonical lane (required):**

- **userId:** `phase8_real_user`
- **chartId:** `phase8_real_chart` (Phase 8 real user primary chart)
- **campaignId:** `rpg_camp_81ceacfa9caab6ab` (known Phase 8 fixture campaign id from existing bootstrap)

All mandatory checks must pass for this lane. HTTP checks (when API base is available) must use this userId and this campaignId as the primary input.

**Secondary/optional lanes** (if referenced at all):

- `phase8_preview` / `phase8_preview` (seed-campaign, in-process scripts only).
- `phase8_iso_user` / `phase8_iso_chart` (isolation fixture; optional).

These remain **explicitly secondary**. They must not replace or dilute the canonical lane.

---

## D. What Stage 8 Must Prove (Seven Outcomes)

| # | Outcome | Short proof |
|---|---------|-------------|
| 1 | Campaign creation resolves the correct user identity | For canonical lane, campaign.user_id = phase8_real_user and campaign.chart_id = phase8_real_chart; campaign row keyed by (userId, chartId). |
| 2 | Natal chart linkage resolves correctly | View diagnostics resolved_chart_id = phase8_real_chart; resolved_natal_snapshot_hash and resolved_bundle_hash present and consistent with profile/bundle. |
| 3 | Character generation derives from canonical chart snapshots only | character_sheet and characterId come from bundle/architecture built from EphemerisSnapshot only; no recomputation of placements/houses/aspects in campaign code. |
| 4 | Campaign state persists correctly | getCampaignById / buildCampaignView return consistent campaign, state_hash, and bundle linkage across sequential requests. |
| 5 | Campaign challenge routing resolves correctly | buildChallengeScene deterministic; daily-challenge path returns scene + characterId + audio mode for existing campaign; scene derived from snapshot/state only. |
| 6 | Campaign audio/composition integrates through the existing compose pipeline | Audio resolution (turn_seed → audio_seed → artifact) goes through the same compose path as Stage 3; no alternate campaign-only audio generation path. |
| 7 | Cross-surface identity remains stable | Same userId/chartId/campaignId yield same resolved identity on profile, compose, and campaign surfaces; identity continuity chain holds. |

---

## E. Endpoints and Surfaces (Unchanged Scope)

### E.1 Next.js API (primary)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/rpg/campaign/[campaignId]?userId=` | Campaign view. |
| POST | `/api/rpg/campaign/[campaignId]/turn` | Create/get daily turn. |
| GET | `/api/rpg/turn/[turnId]/audio` | Resolve/create audio artifact. |
| GET | `/api/debug/phase8/create-test-user` | Bootstrap Phase 8 real user + campaign (PHASE8_DEBUG=1). |
| GET | `/api/debug/phase8/seed-campaign` | Seed profile + campaign + turn (PHASE8_DEBUG=1; optional/secondary). |

### E.2 In-process only (engine campaign logic)

Verification may call vnext campaign/store/view/entry/challenge/audio **in-process** with the canonical fixture (phase8_real_user, phase8_real_chart, known natal snapshot). No requirement to mount the campaign router for Stage 8.

---

## F. Expected Outputs — Objective PASS/FAIL (Auditable)

Each check names: **input lane**, **identifiers that must stay stable**, **deterministic field or hash**, and **exact failure message**. No interpretation drift.

### F.1 Campaign view — identity and natal linkage

| Item | Value |
|------|--------|
| **Input lane** | GET `/api/rpg/campaign/rpg_camp_81ceacfa9caab6ab?userId=phase8_real_user` (or in-process: buildCampaignView({ campaignId: 'rpg_camp_81ceacfa9caab6ab', userId: 'phase8_real_user' })). |
| **Identifiers expected stable** | campaign.id = rpg_camp_81ceacfa9caab6ab; campaign.user_id = phase8_real_user; campaign.chart_id = phase8_real_chart. |
| **Deterministic field / hash** | _diagnostics.resolved_user_id = phase8_real_user; _diagnostics.resolved_chart_id = phase8_real_chart; _diagnostics.resolved_bundle_hash (non-empty string); _diagnostics.resolved_natal_snapshot_hash (non-empty string when bundle has metadata). |
| **Exact failure message** | `Stage 8 campaign view identity: expected campaign.user_id=phase8_real_user, campaign.chart_id=phase8_real_chart, and diagnostics resolved_* to match; got campaign.user_id=<actual> campaign.chart_id=<actual> resolved_user_id=<actual> resolved_chart_id=<actual>.` |

### F.2 Campaign view — character from snapshot only

| Item | Value |
|------|--------|
| **Input lane** | Same as F.1; response body character_sheet and (in-process) character profile from bundle. |
| **Identifiers expected stable** | character_sheet.class_slug, subclass_slug, rising_modifier_slug, placements (from bundle built from natal snapshot only). |
| **Deterministic field / hash** | For canonical natal snapshot, bundle_hash and character_sheet must be reproducible via buildRpgEffectsBundleFromSnapshot(natal) → buildCharacterProfile (no campaign-side placement/house/aspect computation). |
| **Exact failure message** | `Stage 8 character provenance: character_sheet or characterId must be derived from canonical EphemerisSnapshot via bundle/architecture only; missing class_slug/placements or detected campaign-side chart recomputation.` |

### F.3 Campaign view — state persistence

| Item | Value |
|------|--------|
| **Input lane** | Two sequential GETs (or two buildCampaignView calls) for same campaignId and userId. |
| **Identifiers expected stable** | campaign.id, campaign.user_id, campaign.chart_id, campaign.state_hash, _diagnostics.resolved_state_hash. |
| **Deterministic field / hash** | Second response campaign.state_hash and resolved_state_hash equal first response; current_turn.turn_seed unchanged if same turn. |
| **Exact failure message** | `Stage 8 state persistence: second request returned different campaign.state_hash or current_turn.turn_seed for same campaignId=<id>.` |

### F.4 Identity continuity across surfaces

| Item | Value |
|------|--------|
| **Input lane** | Profile: GET profile (or create-test-user) with phase8_real_user. Compose: (optional) same chart/snapshot used for campaign. Campaign: GET campaign view as in F.1. |
| **Identifiers expected stable** | userId = phase8_real_user; chartId = phase8_real_chart; campaignId = rpg_camp_81ceacfa9caab6ab; characterId from architecture/bundle (no parallel identity). |
| **Deterministic field / hash** | profile/chart and campaign view agree on user_id and chart_id; campaign view does not expose a different identity source. |
| **Exact failure message** | `Stage 8 identity continuity: profile/chart userId or chartId does not match campaign surface campaign.user_id or campaign.chart_id for phase8_real_user / rpg_camp_81ceacfa9caab6ab.` |

### F.5 Challenge routing and determinism

| Item | Value |
|------|--------|
| **Input lane** | In-process: getCampaignById(rpg_camp_81ceacfa9caab6ab), then buildChallengeScene(character, pressures, state, …) with canonical natal/transit and campaign state. |
| **Identifiers expected stable** | scene.id, scene.choices (order and ids); characterId from same character profile. |
| **Deterministic field / hash** | Same (campaignId, natalSnapshot, transitSnapshot, state) → same scene.id and same resolveCampaignAudioMode output. |
| **Exact failure message** | `Stage 8 challenge determinism: same campaign and snapshots produced different scene.id or audio mode; expected deterministic buildChallengeScene and resolveCampaignAudioMode.` |

### F.6 Campaign audio via compose pipeline only

| Item | Value |
|------|--------|
| **Input lane** | In-process: resolveCampaignAudioMode; turn → audio_seed → artifact resolution path (ensureDailyAudioArtifactForTurn or equivalent) must invoke same compose/audio path as Stage 3. |
| **Identifiers expected stable** | audio.mode, audioContextId (when paid); audio_seed from turn_seed + audio_algo_version. |
| **Deterministic field / hash** | Same turn_seed → same audio_seed; artifact creation/retrieval goes through established compose pipeline, not an alternate campaign-only path. |
| **Exact failure message** | `Stage 8 campaign audio: audio must be produced via compose pipeline only; alternate campaign-specific audio generation path detected or audio_seed/turn_seed mismatch.` |

### F.7 Entry normalization (in-process)

| Item | Value |
|------|--------|
| **Input lane** | normalizeCampaignEntrySelection({ userId: 'phase8_real_user', mode: 'solo' }). |
| **Identifiers expected stable** | entry.userId = phase8_real_user; entry.seedMemberUserIds = ['phase8_real_user']; entry.mode = 'solo'. |
| **Deterministic field / hash** | Same input → same output; no randomness. |
| **Exact failure message** | `Stage 8 entry normalization: expected entry.userId=phase8_real_user, seedMemberUserIds=[phase8_real_user], mode=solo; got <actual>.` |

---

## G. Failure Detection Strategy (Exact Messages)

| Check | Exact failure message (abbrev) | Exit |
|-------|--------------------------------|------|
| Campaign view identity (F.1) | `Stage 8 campaign view identity: expected campaign.user_id=phase8_real_user, campaign.chart_id=phase8_real_chart, and diagnostics resolved_* to match; got ...` | 1 |
| Character provenance (F.2) | `Stage 8 character provenance: character_sheet or characterId must be derived from canonical EphemerisSnapshot via bundle/architecture only; ...` | 1 |
| State persistence (F.3) | `Stage 8 state persistence: second request returned different campaign.state_hash or current_turn.turn_seed for same campaignId=...` | 1 |
| Identity continuity (F.4) | `Stage 8 identity continuity: profile/chart userId or chartId does not match campaign surface ...` | 1 |
| Challenge determinism (F.5) | `Stage 8 challenge determinism: same campaign and snapshots produced different scene.id or audio mode; ...` | 1 |
| Campaign audio compose-only (F.6) | `Stage 8 campaign audio: audio must be produced via compose pipeline only; ...` | 1 |
| Entry normalization (F.7) | `Stage 8 entry normalization: expected entry.userId=phase8_real_user, seedMemberUserIds=[phase8_real_user], mode=solo; got ...` | 1 |
| Snapshot-derived rule (A.2) | `Stage 8 snapshot-derived: campaign/RPG code must not recompute placements, houses, aspects, or chart math; recomputation detected.` | 1 |
| Alternate audio pipeline (B) | `Stage 8 campaign audio: alternate campaign-specific audio generation path detected; must use compose pipeline only.` | 1 |
| HTTP bootstrap/view | `Stage 8 http: <path> status <code> or body invalid; <detail>.` | 1 |

---

## H. Verification Methodology (Minimal)

1. **Canonical lane only for PASS:** All required checks use **userId = phase8_real_user**, **campaignId = rpg_camp_81ceacfa9caab6ab** (and chartId = phase8_real_chart). Bootstrap via GET `/api/debug/phase8/create-test-user` when doing HTTP; or use existing DB fixture when in-process.
2. **In-process:** Call buildCampaignView, getCampaignById, buildRpgEffectsBundleFromSnapshot, buildCharacterProfile, buildChallengeScene, resolveCampaignAudioMode with canonical fixture. Assert F.1–F.7 and guardrails A.2, B (no recomputation; audio via compose only).
3. **HTTP (when base URL available):** GET campaign view for rpg_camp_81ceacfa9caab6ab?userId=phase8_real_user; assert F.1, F.3, F.4. Optionally GET profile and compare identity (F.4).
4. **Reuse existing scripts** where they already cover the same checks (e.g. phase8-campaign-proof-verify, campaign-entry-determinism, campaign-audio-determinism, challenge-generation-determinism). Extend or add one Stage 8 script that applies the **exact** failure messages above and the canonical lane.

---

## I. Deliverables (Post–Final Approval)

- **Harness:** Verification script(s) that run the checks in F.1–F.7 and enforce A.2 and B, using the canonical lane only for PASS decision.
- **Results:** Structured PASS/FAIL per check; overall Stage 8 PASS only if all required checks pass.
- **Commit:** Phase 8 Stage 8 label; minimal file scope; no RPG/compose/interpretation/sandbox changes; no router mounting unless already present and necessary for verification.

---

## J. Stage Boundary Discipline (No Change)

Stage 8 is **verification only**. Out of scope:

- RPG mechanic additions or narrative expansion.
- Interpretation, chart math, or sandbox logic changes.
- Engine refactoring or new identity system.
- Router mounting as part of Stage 8 unless already present and strictly necessary for verification.
- E2E UI or manual playthrough (Stage 9).

---

**Status:** Revised plan for final sign-off. No implementation until final approval.
