# Phase 8 — Gravity-Based Verification Plan (Post-Enhancement)

**Scope:** Closed Beta hardening only. No Phase 9 feature work, refactors for elegance, or UI polish.  
**Context:** Concentrated enhancement pass touching Campaign Tab, Lyria music pipeline, shared music/text engine logic, text engine (snapshot-driven reports), and math/determinism across all chart wheel surfaces.  
**Goal:** Audit → risk map → invariants → staged testing order → test-user strategy → minimal implementation steps before manual testing.

---

## A. Audit Summary

### Systems Touched by the Enhancement Pass

1. **Campaign Tab**  
   - `buildCampaignView` and dependencies: profile → bundle → campaign → latest turn → audio artifact. Character sheet from `buildRpgEffectsBundleFromSnapshot(natal)`; turn from `getOrCreateDailyTurn` (transit + state_hash); audio from `ensureDailyAudioArtifactForTurn` (turn_seed → audio_seed). All consume canonical snapshot/bundle/state contracts.

2. **Lyria Music Pipeline**  
   - Single path: `generateArchitecture` / `generateArchitectureFromSnapshot` → `encodeFeatures(snapshot)` → `generatePlanMLOnly(featureVec, payload)` → `buildCompositionNarrativePlan(snapshot, featureVec, …)` → `buildLyriaPrompt(payload, plan, narrativePlan)` → `renderWithProvider`. No silent fallbacks; Lyria-only contract (see `PHASE8-LYRIA-ONLY-AUDIO.md`).

3. **Shared Logic (Music + Text)**  
   - **Canonical source:** `ArchitectureOutput` (snapshot, features, guidance, relationalContext, semanticProfile).  
   - **Music path:** architecture → plan → gates → narrative plan → Lyria prompt → WAV.  
   - **Text path:** same architecture → ExplainSpec (`buildExplainSpecSingle` / `buildExplainSpecOverlay`) → `renderExplainSpecToSections` → sections (signatures, significance, musical). Both use `astroSummaryFromSnapshot(snapshot, featureVec)`, `guidanceSummaryFromFeatureVec(featureVec)`, `buildPlanSummary(plan)`, and `buildRelationalChartContext(snapshot)` where needed. Complementary output structure: ExplainSpec mirrors plan/signatures/psychology/music; rendering is deterministic and seed-driven.

4. **Text Engine (Snapshot-Driven Reports)**  
   - ExplainSpec is built from **architecture output** (snapshot, featureVec, guidanceSummary, plan, planSummary, gateReport). No mock astro for single-chart compose: `astroSummaryFromSnapshot(architecture.snapshot, architecture.features)` and dominant planets from snapshot. Profile/prominence from `buildAstroProfile(snapshot)` and `selectProminentFactors(snapshot, featureVec)`. Relational reporting uses `buildRelationalChartContext(snapshot)` (bodies, aspects, topAspects via `topRankedAspects`). Optional vNext daily text (`VNEXT_TEXT_ENGINE=v1`) uses `buildTextAnalysis` with snapshot + relationalContext.

5. **Math and Determinism (Chart Wheels)**  
   - **Canonical chart:** `EphemerisSnapshot` (contracts.ts); produced by `/api/chart-snapshot`, `/api/sandbox/snapshot`, and `generateArchitectureFromSnapshot`.  
   - **Relational layer:** `buildRelationalChartContext(snapshot)` uses `aspect-priority.ts` (`topRankedAspects`, `compareAspects`) and `canonical-bodies.ts` (`SUPPORTED_BODIES`, `BODY_DISPLAY_ORDER`).  
   - **Wheel surfaces:** All geometry from snapshot: `normalizeChartForWheel(snapshot)` in `apps/web/src/core/chart-adapter.ts` accepts `{ planets, houses }` or `{ positions, cusps }`; Hero, Sandbox, Overlay, Profile/Community, Viz use this or equivalent snapshot-derived data. No UI aspect recomputation; aspect lines from `snapshot.aspects` only (see `CHART-CONTRACTS.md`).

### Key Integration Seams (Where One Bug Can Masquerade as Another)

- **Snapshot → Encode → Plan → Text:** If `encodeFeatures` or snapshot shape changes, featureVec indices 27–33 (elements, moonPhase, tension, cluster) drift; both plan/guidance and ExplainSpec (elementBlend, tensionBucket, clusteringBucket) are affected. A “wrong text” bug could be upstream (snapshot/encoder) or downstream (ExplainSpec/renderer).
- **RelationalContext → ExplainSpec / buildTextAnalysis:** `buildRelationalChartContext` depends on `aspect-priority` and snapshot.aspects. If aspect ranking or body order changes, topAspects and any prominence/factor map change; text and report sections that use relationalContext can regress without a change in the “text engine” itself.
- **Campaign → Bundle → Natal Snapshot:** Campaign view and daily turn depend on bundle built from natal snapshot. If `buildRpgEffectsBundleFromSnapshot` or snapshot schema changes, character sheet and state_hash change; turn_seed and audio_seed change, so “campaign audio missing” could be bundle/snapshot provenance, not audio-service.
- **normalizeChartForWheel:** All wheel surfaces share this adapter. If it starts dropping bodies or cusps (e.g. strict 12-cusp check), every surface (Hero, Sandbox, Overlay, Profile, Viz) can show empty or wrong wheels; bugs would appear as “chart not loading” on multiple pages.

### Findings vs. Pre-Enhancement Audits

- **TEXT-EXPLAINER-EPHEMERIS-AUDIT.md:** Described legacy flow where text used only payload (mock astro). **Current state:** Single-chart compose uses ExplainSpec built from **architecture.snapshot** and **architecture.features**; `astroSummaryFromSnapshot(snapshot, featureVec)` is used; text and audio now share the same canonical snapshot/features for single-chart. Overlay still has separate natal/current fetch and ExplainSpec overlay path.
- **CHART-CONTRACTS.md:** Still accurate. All chart surfaces must derive from EphemerisSnapshot; no UI aspect math; `normalizeChartForWheel` and BODY_DISPLAY_ORDER are the adapters.

---

## B. Touched Systems and File Map

### Core / Shared (highest gravity)

| File | Role |
|------|------|
| `vnext/contracts.ts` | EphemerisSnapshot, SnapshotAspect, Plan, FeatureVec |
| `vnext/canonical-bodies.ts` | SUPPORTED_BODIES, BODY_DISPLAY_ORDER, bodyOrderIndex |
| `vnext/feature-encode.ts` | encodeFeatures(snapshot) → FeatureVec (64); indices 27–33 for elements/tension/cluster |
| `vnext/aspect-priority.ts` | compareAspects, topRankedAspects; used by report-context and ExplainSpec prominence |
| `vnext/report-context.ts` | buildRelationalChartContext(snapshot) → RelationalChartContext |
| `vnext/core/architecture-engine.ts` | generateArchitecture, generateArchitectureFromSnapshot; single entry for snapshot → features → guidance → relationalContext → semanticProfile |

### Compose Pipeline (music + text)

| File | Role |
|------|------|
| `vnext/api/compose.ts` | generateControlPayload, architecture, plan, gates, ExplainSpec build + render, Lyria prompt, WAV export |
| `vnext/plan-generator.ts` | generatePlanMLOnly(featureVec, payload) |
| `vnext/astro/guidance.ts` | guidanceFromFeatures(features, snapshot, seed) |
| `vnext/explainer/astro-summary-from-snapshot.ts` | astroSummaryFromSnapshot(snapshot, featureVec?, payloadModality?) |
| `vnext/explainer/text-generation-engine.ts` | buildExplainSpecSingle, buildExplainSpecOverlay; uses snapshot, featureVec, guidanceSummary, planSummary |
| `vnext/explainer/spec-contracts.ts` | ExplainSpec, ExplainSpecSingleInputs, SignatureFacts, MusicFacts, etc. |
| `vnext/explainer/renderers/deterministic.ts` | renderExplainSpecToSections(spec) |
| `vnext/explainer/plan-summary.ts` | buildPlanSummary(plan) |
| `vnext/explainer/guidance-atoms.ts` | guidanceSummaryFromFeatureVec(featureVec) |
| `vnext/explainer/prominence.ts` | selectProminentFactors(snapshot, featureVec) |
| `vnext/audio/composition-narrative.ts` | buildCompositionNarrativePlan(snapshot, featureVec, …); uses astroSummaryFromSnapshot |
| `vnext/render/prompt-from-controls.ts` | buildLyriaPrompt(payload, plan, narrativePlan) |
| `vnext/astro/profile-from-snapshot.ts` | buildAstroProfile(snapshot); used by ExplainSpec profile/prominence |

### Chart / Wheel Surfaces

| File | Role |
|------|------|
| `apps/web/src/core/chart-adapter.ts` | normalizeChartForWheel(raw) → ChartForWheel \| null |
| `apps/web/src/components/WheelCanvas.tsx` | Consumes normalizeChartForWheel, BODY_DISPLAY_ORDER |
| `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` | Snapshot → normalizeChartForWheel; aspect lines from snapshot.aspects |
| `apps/web/app/page.tsx` | Hero: snapshot from compose/chart-snapshot → normalizeChartForWheel |
| `apps/web/app/sandbox/page.tsx` | Sandbox: snapshot from sandbox/snapshot API |
| `apps/web/app/overlay/page.tsx` | Overlay: two snapshots → wheel geometry |
| `vnext/viz/payload.ts` | buildVizPayload(snapshotLike, plan, …); snapshot-derived geometry and aspects |

### Campaign / RPG

| File | Role |
|------|------|
| `vnext/rpg/campaign/view.ts` | buildCampaignView(campaignId, userId?); character_sheet, current_turn, outcome, audio, _diagnostics |
| `vnext/rpg/campaign/audio-service.ts` | ensureDailyAudioArtifactForTurn({ turnId }); turn_seed → audio_seed, createAudioIfMissing |
| `vnext/rpg/campaign/turn-service.ts` | getOrCreateDailyTurn(campaignId, transitSnapshot, …); turn_seed = makeTurnSeed(transitHash, stateHash, RPG_ALGO_VERSION) |
| `vnext/rpg/effects/bundle-from-snapshot.ts` | buildRpgEffectsBundleFromSnapshot(natal) → bundle_json; character class/subclass/placements from snapshot |
| `vnext/rpg/campaign/state-machine.ts` | initialCampaignState(bundle); state_hash from state_json |
| `vnext/rpg/store/rpg-store.ts` | getCampaignById, getBundleByHash, getLatestTurnForCampaign, getAudioByTurnSeed, createAudioIfMissing, etc. |
| `vnext/phase8/resolve-real-user-campaign.ts` | getOrCreatePhase8RealUserCampaign(); fixed natal + transit snapshot for test user |
| `apps/web/app/api/rpg/campaign/[campaignId]/route.ts` | GET campaign view |
| `apps/web/app/api/rpg/turn/[turnId]/audio/route.ts` | GET audio artifact (ensureDailyAudioArtifactForTurn) |
| `apps/web/app/campaign/page.tsx`, `apps/web/app/rpg/campaign/[campaignId]/page.tsx` | Campaign UI |

### Text / Reporting (additional)

| File | Role |
|------|------|
| `vnext/text/analysis/buildTextAnalysis.ts` | buildTextAnalysis(surface, chartInput); uses snapshot, relationalContext |
| `vnext/interpretation/chart-semantic-profile.ts` | buildChartSemanticProfile; uses astroSummaryFromSnapshot, relationalContext |
| `vnext/api/personality.ts` | ExplainSpec-based personality report (no plan/gates) |
| `vnext/api/sandbox-routes.ts` | Sandbox report: architecture.relationalContext |
| `vnext/compat/profile-chart.ts` | Profile chart: architecture.relationalContext |

---

## C. Risk Matrix by Layer

| Layer | Risk | Reason |
|-------|------|--------|
| **EphemerisSnapshot / contracts** | High | Every chart surface and both pipelines depend on shape (planets, houses, aspects, moonPhase, dominantElements). Schema drift or optional-field handling breaks encode, relationalContext, and wheels. |
| **feature-encode.ts** | High | Single source for FeatureVec. Index or formula change affects plan, guidance, ExplainSpec (elementBlend, buckets), and composition narrative. |
| **aspect-priority.ts** | Medium–High | Deterministic ranking drives topAspects in RelationalChartContext; used by ExplainSpec prominence and any report that shows “top aspects.” Tie-break or body-order change shifts text and sandbox summaries. |
| **architecture-engine.ts** | High | Single entry point for snapshot → features, guidance, relationalContext, semanticProfile. Bug here affects both music and text and all reporting. |
| **compose.ts** | High | Orchestrates payload, architecture, plan, gates, ExplainSpec build/render, Lyria prompt, export. Mode branches (sandbox/sky/overlay) and fallbacks (e.g. overlay legacy explainer) add surface. |
| **ExplainSpec build (text-generation-engine.ts)** | High | Builds spec from snapshot/featureVec/guidance/plan; shared with overlay. Input contract drift (e.g. missing fields in snapshot) can throw or produce wrong sections. |
| **ExplainSpec render (deterministic.ts)** | Medium | Pure function of spec; if spec shape or section IDs change, compose response shape (signatures, significance, musicalBullets) breaks. |
| **normalizeChartForWheel** | High | Single adapter for all wheels. Stricter validation or different handling of planets/houses breaks every surface at once. |
| **Campaign view + audio-service** | Medium–High | View depends on profile → bundle → campaign → turn → audio. Bundle from natal snapshot; turn from transit + state_hash. Any change in bundle-from-snapshot or turn_seed/audio_seed logic can make “no audio” or “wrong character sheet” look like a UI bug. |
| **RPG store (rpg-store.ts)** | Medium | Idempotency by turn_seed and bundle_hash; schema or unique constraints affect createIfMissing and view resolution. |
| **Lyria/render** | Medium | buildLyriaPrompt and renderWithProvider; narrative plan from buildCompositionNarrativePlan. Contract changes affect export and campaign playback only where Lyria is used. |

---

## D. Must-Hold Invariants for Phase 8 Closed Beta

1. **Determinism**  
   - Same (chart input or snapshot + payload hash) → same architecture output (snapshot, featureVec, guidance, relationalContext).  
   - Same architecture + payload + plan → same ExplainSpec and same rendered sections (seed-driven variation only).  
   - Same (transit_snapshot_hash, state_hash, RPG_ALGO_VERSION) → same turn_seed; same turn_seed + audio_algo_version → same audio_seed and idempotent audio row.

2. **Fail-closed / no silent fallbacks**  
   - No fallback to mock astro for single-chart ExplainSpec when architecture is available; if ExplainSpec build throws, compose must fail or surface error, not return legacy mock text.  
   - Lyria-only audio: no Tone.js or sample fallback; missing/invalid Lyria artifact → explicit “Audio unavailable” (or equivalent), not silent skip.  
   - Invalid or missing snapshot for a wheel → normalizeChartForWheel returns null and UI shows no chart or explicit error, not a partial/wrong chart.

3. **Single source of truth**  
   - Chart geometry and aspect data for all surfaces come from EphemerisSnapshot (or architecture output that contains it). No UI recomputation of aspects; no alternate body lists for wheels (BODY_DISPLAY_ORDER / SUPPORTED_BODIES).  
   - RelationalChartContext is always built via buildRelationalChartContext(snapshot); reporting and ExplainSpec prominence use it, not ad hoc aspect lists.

4. **Campaign chain**  
   - buildCampaignView resolves campaign → bundle (by bundle_hash) → character sheet from bundle_json; latest turn by campaign_id; audio by turn_seed.  
   - Character sheet and state_hash are materially derived from natal snapshot (bundle-from-snapshot); turn_seed is materially derived from transit_snapshot_hash and state_hash.

5. **ExplainSpec ↔ Plan alignment**  
   - ExplainSpec’s music section (tempo, key, density, arc) and planSummary must reflect the same plan used for Lyria prompt and WAV. No drift between “what we say” and “what we play.”

6. **Session/identity (Phase 8H)**  
   - Profile and campaign resolution use resolved userId (session or legacy cookie); exports/history forward x-beta-user; no cross-user data leakage.

---

## E. Recommended Staged Test Plan

Order: **root-cause and shared layers first**, then integration seams, then surfaces. Minimize blast radius and surface the most important bugs first.

### Stage 1 — Contracts and shared math (no server/DB)

1. **Snapshot and feature-encode**  
   - Run existing or add: given a fixed EphemerisSnapshot (e.g. from `resolve-real-user-campaign` or a golden JSON), assert `encodeFeatures(snapshot)` output shape (length 64), indices 27–30 sum ≈ 1, indices 32–33 in [0,1], no NaN/Inf.  
   - Assert same snapshot → same FeatureVec every time.  
   - **Risk surfaced:** encoder or snapshot shape bugs that would affect both music and text.

2. **RelationalContext and aspect priority**  
   - From same snapshot, call `buildRelationalChartContext(snapshot)`; assert bodies length, aspects length, topAspects length ≤ N, hasAspectData consistent with aspects.length, houses length 12.  
   - Assert topRankedAspects order is deterministic (e.g. compare two calls).  
   - **Risk surfaced:** aspect-priority or report-context bugs that would affect ExplainSpec and any report using topAspects.

3. **normalizeChartForWheel**  
   - With snapshot-shaped object (planets + houses), assert normalizeChartForWheel returns non-null, positions keys include expected bodies, cusps.length === 12.  
   - With minimal invalid input (e.g. empty planets), assert null and no throw.  
   - **Risk surfaced:** adapter bugs that would break every wheel surface.

### Stage 2 — Architecture and ExplainSpec (single-chart, no Lyria call)

4. **Architecture from snapshot**  
   - `generateArchitectureFromSnapshot(snapshot, seed)` with fixed snapshot; assert output has snapshot, features, guidance, relationalContext, semanticProfile; featureVec matches encodeFeatures(snapshot).  
   - **Risk surfaced:** architecture-engine bugs before any compose or UI.

5. **ExplainSpec build + render**  
   - From same architecture output + mock plan + mock gateReport, call `buildExplainSpecSingle({ seed, snapshot, featureVec, guidanceSummary, plan, planSummary, gateReport })` then `renderExplainSpecToSections(spec)`.  
   - Assert sections (signatures, significance, musical) present and non-empty; template_id or section ids stable.  
   - Assert same inputs → same sections (determinism).  
   - **Risk surfaced:** text-generation-engine or deterministic renderer bugs; wrong or missing sections.

6. **Composition narrative**  
   - buildCompositionNarrativePlan(snapshot, featureVec, …) with fixed inputs; assert shape (primaryElement, arcShape, etc.) and no throw.  
   - **Risk surfaced:** narrative/plan mismatch with ExplainSpec or Lyria prompt.

### Stage 3 — Compose path (sandbox or controlled sky)

7. **Compose single-chart (sandbox)**  
   - POST compose with mode sandbox and overriddenSnapshot (fixed snapshot); no need for real Lyria.  
   - Assert 200, response has text (signatures, significance, musicalBullets) and audio stub or placeholder; assert text matches ExplainSpec-rendered sections.  
   - Optionally assert plan hash and feature hash in response for provenance.  
   - **Risk surfaced:** compose orchestration, payload generation, or gate/ExplainSpec wiring.

8. **Compose overlay (if enabled)**  
   - If VNEXT_OVERLAY_EXPLAINSPEC=1, run overlay compose with two chart inputs; assert overlay text sections and no fallback to legacy explainer when spec path is used.  
   - **Risk surfaced:** overlay ExplainSpec and natal/current snapshot handling.

### Stage 4 — Campaign and RPG

9. **Campaign view resolution**  
   - With PHASE8_DEBUG=1 and DB seeded (seed-campaign or create-test-user), GET campaign by id + userId; assert view has character_sheet, current_turn, audio (or explicit no_record/pending), and diagnostics where expected.  
   - Assert turn_seed and audio_seed stable on repeated GET.  
   - **Risk surfaced:** view assembly, store idempotency, or missing dependency (bundle/turn/audio).

10. **Turn and audio idempotency**  
    - GET /api/rpg/turn/:turnId/audio twice; assert same turn_seed, audio_seed, status.  
    - **Risk surfaced:** createAudioIfMissing or store conflict handling.

11. **Campaign → bundle → natal provenance**  
    - For a known campaign, verify bundle_json.metadata.natal_snapshot_hash and character_sheet class/subclass/placements consistent with that natal snapshot (e.g. run bundle-from-snapshot with same snapshot and compare).  
    - **Risk surfaced:** bundle-from-snapshot or campaign linkage.

### Stage 5 — Surfaces (manual or E2E)

12. **Wheel surfaces**  
    - Hero, Sandbox, Overlay, Profile (if available): load page with known snapshot or chart; assert wheel renders, no console errors from normalizeChartForWheel, and (where applicable) aspect lines only where snapshot.aspects exist.  
    - **Risk surfaced:** UI-specific wiring or adapter usage.

13. **End-to-end flow**  
    - One full flow: create profile (or use test user) → open campaign → see character sheet and current turn → request audio (if provider enabled) → play or see explicit “unavailable.”  
    - **Risk surfaced:** integration across session, API, and UI.

---

## F. Persistent Test-User Proposal

### Primary: One persistent real test user

- **Purpose:** Reproducible cross-surface behavior; session persistence; campaign → turn → audio; profile/chart ownership.  
- **Implementation:** Reuse or formalize the Phase 8 “real user” from `resolve-real-user-campaign.ts`: fixed `userId` (e.g. `phase8_real_user`), fixed `chartId` (e.g. `phase8_real_chart`), fixed birth data (e.g. 1990-01-01, 12:00, New York), deterministic natal snapshot from `generateNatalSnapshot`, one campaign linked to that profile, and one deterministic daily turn (fixed transit snapshot in `getPhase8RealUserTransitSnapshot()`).  
- **Persistence:** Stored in real DB (user_profiles, rpg_profiles, rpg_effects_bundles, rpg_campaigns, rpg_daily_turns, optionally rpg_daily_audio_artifacts). Not re-seeded on every run; idempotent get-or-create so the same user/campaign/turn are reused.  
- **What this user validates:**  
  - Session cookie → userId → GET profile → primaryChart and campaign entry.  
  - Campaign tab loads with correct character sheet and current turn.  
  - Turn and audio artifact ids and seeds stable across refreshes and GET /api/rpg/turn/:turnId/audio.  
  - No cross-user leakage (second browser/incognito has no access to this user’s data without knowing userId/campaignId).

### Additional fixture users (optional but recommended)

- **Compatibility / legacy:** One user created with legacy cookie only (no signed session), to confirm GET profile and campaign still resolve when only `astradio_dev_user_id` is present.  
- **Community / discoverability:** One or two additional users with discoverability enabled and known chart/bundle hashes, to validate community search and “other profile” view without touching the primary test user.  
- **Campaign variety:** If multiple campaigns are needed (e.g. different bundle versions or states), a second fixture campaign for the same or a second user, so campaign list and “current campaign” behavior can be checked.

### Continuity behaviors to validate with persistent user(s)

- **Profile:** After “create profile” or first load with session, refresh and reopen tab → same user and primary chart.  
- **Campaign:** From campaign entry (e.g. /campaign or /rpg/campaign/:id), refresh → same campaign, same character sheet, same current turn and turn_seed.  
- **Audio:** Request audio for current turn (GET turn/audio) → same audio_seed and status on repeat; if provider is Lyria and artifact is generated, playback or download uses same artifact.  
- **Wheel:** Profile/chart and campaign context load chart from snapshot; wheel should match snapshot (positions/cusps) and not change between loads for same snapshot.

---

## G. Minimal Recommended Next Implementation Steps Before Manual Testing

1. **Add or run existing script: snapshot → encodeFeatures → buildRelationalChartContext**  
   - Input: one fixed EphemerisSnapshot (e.g. from `getPhase8RealUserTransitSnapshot()` or a golden file).  
   - Assert: FeatureVec length 64, key indices in range, no NaN; RelationalChartContext bodies/aspects/houses/topAspects present and deterministic.  
   - No new features; only assertions on existing functions.  
   - **Purpose:** Stage 1 automated check; run in CI or pre-manual.

2. **Add or run: architecture from snapshot → ExplainSpec build → render**  
   - Input: same snapshot + seed + mock plan + mock gateReport.  
   - Assert: ExplainSpec has single.signatures, single.psychology, single.music; render produces sections with ids signatures, significance, musical; same input → same output.  
   - **Purpose:** Stage 2; catches text-generation-engine and renderer regressions.

3. **Add or run: normalizeChartForWheel(snapshot-shaped object)**  
   - Input: object with planets (array of { name, lon }) and houses (12 numbers).  
   - Assert: non-null result, 12 cusps, positions for each planet; with empty planets assert null.  
   - **Purpose:** Stage 1; single place to catch adapter regressions.

4. **Document and pin Phase 8 test user**  
   - In docs or runbook: how to create/resolve the primary test user (GET debug/phase8/create-test-user or seed-campaign when PHASE8_DEBUG=1), and the expected userId, chartId, campaignId (and optionally turnId, turn_seed) for the environment.  
   - **Purpose:** So manual testers and scripts always target the same persistent user and campaign.

5. **Optional: small audit helper**  
   - A script that, given a campaignId (and optionally userId), fetches campaign view, then fetches bundle by bundle_hash, and checks that bundle’s natal_snapshot_hash and bundle_json.metadata.natal_snapshot_hash match, and that character_sheet class/subclass/placements are consistent with decode(bundle_json). No DB writes; read-only consistency check for Stage 4.

Do **not** add: new features, UI polish, refactors for elegance, or Phase 9 work. Do **not** introduce parallel logic where shared logic (architecture, ExplainSpec, normalizeChartForWheel) should remain authoritative.

---

## Summary

- **Audit:** Five enhancement areas (Campaign, Lyria, shared music/text, text snapshot-driven reports, chart math/determinism) share canonical snapshot, feature-encode, architecture, ExplainSpec, relationalContext, and wheel adapter.  
- **Risk:** Highest at contracts, feature-encode, architecture, compose, ExplainSpec build, and normalizeChartForWheel; one upstream change can manifest as “wrong text,” “no audio,” or “chart broken” on multiple surfaces.  
- **Invariants:** Determinism, fail-closed, single source of truth for chart and aspects, campaign chain provenance, ExplainSpec–plan alignment, session/identity.  
- **Test order:** Contracts and shared math → architecture and ExplainSpec → compose → campaign/RPG → surfaces.  
- **Test user:** One persistent real user (Phase 8 real user) for cross-surface and continuity; optional fixture users for compatibility and community.  
- **Next steps:** Minimal automated checks for encode + relationalContext, ExplainSpec build + render, and normalizeChartForWheel; document and pin test user; optional read-only campaign/bundle consistency script.

---

## H. Stage 6 — Cross-Surface Consistency Verification (Final Result)

- **Stage:** Phase 8 — Stage 6 (Cross-Surface Consistency Verification)  
- **Result:** **PASS**  
- **Execution commit:** `21fdb8061132f1635bc6c645a9b3fd306888af1e` (`beta-ui-vercel`)  
- **Deployed API base:**  
  `https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app`  
- **Bypass header:** `x-vercel-protection-bypass` = `VERCEL_AUTOMATION_BYPASS_SECRET` (automation-only; not user-facing)

### H.1 Surfaces and Endpoints Exercised

- Profile: `GET /api/profile?userId=phase8_real_user`  
- Profile chart: `GET /api/profile/chart?chartId=phase8_real_chart`  
- Campaign view:  
  - `GET /api/rpg/campaign/rpg_camp_81ceacfa9caab6ab?userId=phase8_real_user`  
  - Verified shape:  
    - `campaign.user_id = phase8_real_user`  
    - `campaign.chart_id = phase8_real_chart`  
    - `_diagnostics.resolved_user_id = phase8_real_user`  
    - `_diagnostics.resolved_chart_id = phase8_real_chart`  
- Sandbox snapshot: `POST /api/sandbox/snapshot` (birth/overrides derived from profile-chart birth)  
- Sandbox report: `POST /api/sandbox/report` (same birth/overrides)  
- Overlay compose: `POST /api/compose` (mode `overlay`, `overlayParams` derived from profile-chart birth + current datetime)  
- History: `GET /api/user/history?userId=phase8_real_user`

### H.2 Invariant Outcomes (I1–I7)

- **I1 — Same-session userId continuity:** **PASS**  
  - `phase8_real_user` resolved via `/api/debug/phase8/create-test-user`, preserved across `/api/profile`, sandbox, overlay, and history routes.

- **I2 — primaryChart.id continuity:** **PASS**  
  - `/api/profile` and `/api/profile/chart` agree on `primaryChart.id = phase8_real_chart` and remain stable across the Stage 6 sequence.

- **I3 — Campaign chart provenance alignment:** **PASS**  
  - `/api/rpg/campaign/[campaignId]` invoked as  
    `GET /api/rpg/campaign/rpg_camp_81ceacfa9caab6ab?userId=phase8_real_user`.  
  - View confirmed `campaign.user_id = phase8_real_user` and `campaign.chart_id = phase8_real_chart`, with diagnostics mirroring those ids.

- **I4 — Sandbox identity continuity:** **PASS**  
  - Sandbox birth strictly derived from profile-chart birth (`1990-01-01`, `12:00`, `40.7128`, `-74.006`);  
  - `/api/sandbox/snapshot` + `/api/sandbox/report` succeed;  
  - `/api/profile?userId=phase8_real_user` after sandbox still reports `user.id = phase8_real_user`, `primaryChart.id = phase8_real_chart`.

- **I5 — Overlay identity continuity:** **PASS**  
  - Overlay natal/source chart built from profile-chart birth; comparison chart from explicit current datetime and same lat/lon;  
  - `POST /api/compose` (mode `overlay`) succeeds;  
  - `/api/profile?userId=phase8_real_user` after overlay remains `phase8_real_user` / `phase8_real_chart`.

- **I6 — Compose identity continuity:** **PASS**  
  - `POST /api/compose` uses only the explicitly supplied overlay `overlayParams` as chart identity;  
  - No evidence of implicit chart substitution;  
  - No mutation of `primaryChart.id` in `/api/profile` after compose.

- **I7 — History identity continuity (fixture-scoped):** **PASS**  
  - For `GET /api/user/history?userId=phase8_real_user`, history items remained scoped to the Phase 8 real user and canonical chart for this fixture.  
  - This is recorded as a **fixture-level Stage 6 assertion**, not a generalized invariant for future multi-chart users.
