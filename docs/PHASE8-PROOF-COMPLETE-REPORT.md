# Phase 8 Campaign Proof — Completion Report

## Exact canonical dependency chain

```
user identity (user_id, chart_id)
  → rpg_profiles (user_id, chart_id, natal_snapshot_hash, bundle_hash)     [stored; required for chain]
  → natal/snapshot canonical id = natal_snapshot_hash                        [stored in profile + bundle]
  → rpg_effects_bundles (bundle_hash, natal_snapshot_hash, bundle_json)     [stored; required]
  → character_sheet = buildCharacterSheet(bundle_json)                       [derived at read]
  → rpg_campaigns (id, user_id, chart_id, bundle_hash, state_json)          [stored; required]
  → rpg_daily_turns (id, campaign_id, turn_seed, transit_snapshot_hash, state_hash, prompt_spec_json)  [stored; optional]
  → rpg_daily_audio_artifacts (turn_seed, status, provider, ...)            [stored; optional]
```

**Row linkage:** Campaign.bundle_hash → rpg_effects_bundles.bundle_hash; bundle carries metadata.natal_snapshot_hash. Profile links (user_id, chart_id) to natal_snapshot_hash and bundle_hash. Turn is keyed by turn_seed = f(transit_hash, state_hash); state_hash from campaign.state_json (natal-derived via initialCampaignState(bundle)).

**Material derivation:** Character sheet from natal via bundle (planets, houses, aspects → classSlug, subclassSlug, risingModifierSlug, domainSummary, placements). Daily turn from natal-derived state_hash + daily transit_hash → turn_seed → prompt; see [PHASE8-CAMPAIGN-DEPENDENCY-MAP.md](PHASE8-CAMPAIGN-DEPENDENCY-MAP.md).

---

## What was still missing before this follow-up

1. **Canonical stored natal/snapshot dependency** — The dependency map named RPG tables but did not spell out the upstream chain: user/profile → natal_snapshot_hash → bundle → character sheet → campaign view. Profile table and row linkage were not explicit.

2. **Daily turn derivation proof** — It was not explicit which stored user/natal features are used in turn generation (state_hash from campaign.state_json, which comes from bundle/domainSummary) and that they materially affect the result. Not observable in diagnostics.

3. **Refresh stability / deterministic same-day behavior** — The verification script only asserted character_sheet and current_turn/no_turn_reason. It did not verify that same user + same date/seed returns the same turn identity and content on repeated read/build.

4. **Audio status copy** — UI did not distinctly show: not enabled for this phase vs no record vs pending vs failed vs playable.

---

## What is now proven in Preview

- **Canonical chain** — Documented in PHASE8-CAMPAIGN-DEPENDENCY-MAP.md with exact tables, row linkage, and function path. View diagnostics expose resolved_user_id, resolved_chart_id, resolved_natal_snapshot_hash, resolved_bundle_hash, resolved_campaign_id, resolved_state_hash, and when a turn exists: resolved_daily_turn_id, resolved_turn_seed, resolved_transit_snapshot_hash. Logs emit the same resolved keys for grep.
- **Daily turn derivation** — Documented: state_hash (natal-derived) + transit_hash → turn_seed; turn seed and transit/state hashes are in diagnostics and logs. Verification script asserts view resolves same profile/natal/bundle chain.
- **Same-day stability** — Verification script calls buildCampaignView twice and asserts same current_turn.id, same turn_seed, same scenario_id. Different transit (different day) creates a different turn and script asserts different turn_seed when a different turn is returned.
- **Audio** — UI classifies and displays exactly: not enabled for this phase (RPG_AUDIO_PROVIDER=none), no record, pending, failed, playable.

---

## Exact Preview URLs / env IDs path for verification

1. **Environment:** In Vercel Preview, set:
   - `PHASE8_DEBUG=1`
   - `POSTGRES_URL=<your Postgres connection string>`

2. **Seed (one-time, idempotent):**  
   **GET** `https://<your-preview-domain>/api/debug/phase8/seed-campaign`  
   Response: `{ "campaignId": "<id>", "userId": "phase8_preview" }`.

3. **Campaign page (proof):**  
   Open: `https://<your-preview-domain>/rpg/campaign/<campaignId>?userId=phase8_preview`  
   Or set env `RPG_BETA_CAMPAIGN_ID=<campaignId>` and `RPG_BETA_USER_ID=phase8_preview`, then open: `https://<your-preview-domain>/campaign`.

4. **No terminal steps** — All verification via browser and seed endpoint.

---

## Phase 8 proof-complete or remaining blocker?

**Campaign can be considered Phase 8 proof-complete** for the stored-data → daily-challenge pipeline:

- User/profile and canonical natal (natal_snapshot_hash) → bundle → character sheet is documented and exposed in diagnostics.
- Campaign → bundle → state_hash and daily turn (turn_seed from state_hash + transit_hash) is documented; diagnostics and logs prove resolved chain and keys.
- Same-day stability is asserted by the verification script (same turn id/seed/payload on repeated build).
- Different-day/different-input yields different turn per contract (script asserts).
- Missing dependencies produce explicit UI messages; audio has five distinct states.

**No single remaining blocker** for Phase 8 proof. Optional hardening: run `npm run phase8:campaign:verify` in CI with POSTGRES_URL to guard against regressions.
