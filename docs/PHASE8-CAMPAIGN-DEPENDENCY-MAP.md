# Phase 8 — Campaign View Dependency Map (Canonical Chain)

**Purpose:** Exact tables, row linkage, and function path from user/profile → natal/snapshot → bundle/character sheet → campaign view → daily turn, so stored-data → daily-challenge is auditable.

## Canonical dependency chain

```
user identity (user_id, chart_id)
  → rpg_profiles (user_id, chart_id, natal_snapshot_hash, bundle_hash)  [required; stored]
  → natal/snapshot canonical id = natal_snapshot_hash                   [required; stored in profile + bundle]
  → rpg_effects_bundles (bundle_hash, natal_snapshot_hash, bundle_json)  [required; stored]
  → character_sheet = buildCharacterSheet(bundle_json)                   [derived at read; from bundle]
  → rpg_campaigns (id, user_id, chart_id, bundle_hash, state_json)       [required; stored]
  → rpg_daily_turns (id, campaign_id, turn_seed, transit_snapshot_hash, state_hash, prompt_spec_json)  [optional; stored]
  → rpg_daily_audio_artifacts (turn_seed, status, provider, ...)         [optional; stored]
```

**Row linkage:**

- **Campaign → Bundle:** `rpg_campaigns.bundle_hash` → `rpg_effects_bundles.bundle_hash`. Bundle row also has `natal_snapshot_hash` (in table and in `bundle_json.metadata.natal_snapshot_hash`).
- **Profile → User/Natal/Bundle:** `rpg_profiles` has `(user_id, chart_id, natal_snapshot_hash, bundle_hash)`. One profile row per (user, chart, natal_snapshot_hash). Profile links identity to canonical natal id and bundle.
- **Campaign → Profile:** Same `(user_id, chart_id)`; campaign’s `bundle_hash` matches one profile’s `bundle_hash` for that user/chart.
- **Turn → Campaign:** `rpg_daily_turns.campaign_id` → `rpg_campaigns.id`. Turn is deterministic by `turn_seed = makeTurnSeed(transitHash, stateHash, RPG_ALGO_VERSION)`; `state_hash` from campaign’s `state_json` (natal-derived).

## Tables and functions (buildCampaignView)

| Dependency       | Table                       | Function                                      | Required? | Stored / derived / debug-seeded | Read-only / create-if-missing |
|-----------------|-----------------------------|-----------------------------------------------|-----------|----------------------------------|--------------------------------|
| User identity   | (from campaign)             | `campaign.user_id`, `campaign.chart_id`       | Yes       | Stored (rpg_campaigns)           | Read                           |
| Profile         | `rpg_profiles`              | `getProfileByUserAndBundle(user_id, chart_id, bundle_hash)` | No (for diagnostics) | Stored | Read |
| Natal snapshot id | (from bundle metadata)   | `bundle_json.metadata.natal_snapshot_hash`     | Yes       | Stored (rpg_effects_bundles)     | Read                           |
| Bundle          | `rpg_effects_bundles`       | `getBundleByHash(campaign.bundle_hash)`        | Yes       | Stored                           | Read                           |
| Character sheet | —                           | `buildCharacterSheet(bundle)`                  | N/A       | Derived from bundle at read      | Read                           |
| Campaign        | `rpg_campaigns`             | `getCampaignById(campaignId)`                  | Yes       | Stored (or debug-seeded)         | Read                           |
| Latest turn     | `rpg_daily_turns`           | `getLatestTurnForCampaign(campaign.id)`        | No        | Stored (or debug-seeded)         | Read                           |
| Responses       | `rpg_member_responses`      | `listResponsesByTurn(latestTurn.id)`           | No        | Stored                           | Read                           |
| Audio           | `rpg_daily_audio_artifacts` | `getAudioByTurnSeed(latestTurn.turn_seed)`      | No        | Stored                           | Read (create-if-missing via GET /api/rpg/turn/:turnId/audio) |
| Outcome         | `rpg_turn_outcomes`         | `getOutcomeByTurn(latestTurn.id)`              | No        | Stored                           | Read                           |

## Material derivation (proof that stored data drives output)

**Character sheet** (from natal via bundle):

- **Source:** `rpg_effects_bundles.bundle_json` (built at profile creation from natal `EphemerisSnapshot`).
- **Functions:** `buildRpgEffectsBundleFromSnapshot(natal)` in `vnext/rpg/effects/bundle-from-snapshot.ts` uses: `snapshot.planets` (name, lon) → sign/house; `snapshot.houses` (cusps); `snapshot.aspects`; Sun sign → `classSlug`; Moon sign → `subclassSlug`; Ascendant sign → `risingModifierSlug`; placements and aspects → `domainSummary`, `placements`. So **natal features used:** planets (lon, name), houses, aspects → class_slug, subclass_slug, rising_modifier_slug, top_domains, placements.

**Daily turn** (from natal-derived state + daily transit):

- **Source:** `turn_seed = makeTurnSeed(transitHash, stateHash, RPG_ALGO_VERSION)` in `vnext/rpg/hash/seeds.ts`. `stateHash = hashCanonicalJson(campaign.state_json)`. Campaign `state_json` was set at campaign creation from `initialCampaignState(bundle)` in `vnext/rpg/campaign/state-machine.ts`, which seeds `domain_track` from `bundle.domainSummary` (natal-derived). So **state_hash is materially derived from natal** (bundle → initial state → state_hash).
- **Transit:** `transitHash = hashSnapshot(transitSnapshot)`; transit snapshot (date/planets/houses/aspects) is the daily input. So **turn_seed = f(transit_hash, state_hash)**; same campaign + same contract day (same transit + same state) → same turn_seed → same turn row (idempotent getOrCreateDailyTurn).
- **Prompt:** `projectNarrativeFromDomains(seed, domains)` where `domains` come from `translateSignalsToDomains(detectTransitSignals(transitSnapshot))` (transit-only). The **seed** (hence state_hash) affects which template is chosen. So both natal-derived state and transit-derived domains materially affect the daily turn.

## Fixture vs stored

- **Stored user data:** `rpg_profiles`, `rpg_effects_bundles`, `rpg_campaigns`, and optionally `rpg_daily_turns`, `rpg_daily_audio_artifacts`, `rpg_turn_outcomes`. Campaign page reads only from DB.
- **Debug-seeded:** When `PHASE8_DEBUG=1`, GET `/api/debug/phase8/seed-campaign` can create profile + campaign + one turn with fixed (user_id, chart_id) and known natal/transit snapshots; same IDs returned on repeat (idempotent).

## How to reproduce proof in Preview

1. Set `PHASE8_DEBUG=1` and `POSTGRES_URL` in Vercel (Preview).
2. Call **GET** `/api/debug/phase8/seed-campaign` once.
3. Open `/rpg/campaign/{campaignId}?userId={userId}` (or set `RPG_BETA_CAMPAIGN_ID` / `RPG_BETA_USER_ID` and open `/campaign`).
4. No terminal steps required.
