# Phase 8 — Campaign View Dependency Map

**Purpose:** Document tables and code paths used by `buildCampaignView` so stored-data → daily-challenge pipeline is auditable and missing dependencies can be diagnosed.

## Tables and code paths (buildCampaignView)

| Dependency      | Table                       | Function                                    | Required? | On missing |
|----------------|-----------------------------|---------------------------------------------|-----------|------------|
| Campaign       | `rpg_campaigns`             | `getCampaignById(campaignId)`               | Yes       | Throws `[rpg-ui] Campaign not found` |
| Bundle         | `rpg_effects_bundles`       | `getBundleByHash(campaign.bundle_hash)`     | Yes       | Throws `[rpg-ui] Bundle not found for hash=...` |
| Character sheet| —                           | Derived from `bundle_json` (no extra fetch) | N/A       | — |
| Latest turn    | `rpg_daily_turns`           | `getLatestTurnForCampaign(campaign.id)`     | No        | `current_turn` = null |
| Responses      | `rpg_member_responses`      | `listResponsesByTurn(latestTurn.id)`        | No (when turn exists) | — |
| Audio          | `rpg_daily_audio_artifacts` | `getAudioByTurnSeed(latestTurn.turn_seed)`  | No        | `audio` = null |
| Outcome        | `rpg_turn_outcomes`         | `getOutcomeByTurn(latestTurn.id)`           | No        | `outcome` = null |

## Required inputs and sources

- **campaignId, userId:** From URL (page: `params.campaignId`, `searchParams.userId`; API: route params + query). In production flow, from env: `RPG_BETA_CAMPAIGN_ID`, `RPG_BETA_USER_ID`.
- **Campaign row:** DB only (no fixture in view path).
- **Bundle:** DB only, keyed by `campaign.bundle_hash` (derived from natal snapshot at profile creation).
- **Daily turn:** DB only; created by **POST** `/api/rpg/campaign/[campaignId]/turn` with `transitSnapshot`. Deterministic via `makeTurnSeed(transitHash, stateHash, RPG_ALGO_VERSION)` in `vnext/rpg/campaign/turn-service.ts`.

## Fixture vs stored

- **Fixture-like:** Only in tests (e.g. `phase7-rpg-campaign-ui-test.ts`, `phase8-rpg-lifecycle-proof.ts`) where scripts create profile + campaign + turn in DB. The Campaign page itself never uses in-memory fixtures; it always reads from DB.
- **Stored user data:** Campaign + bundle + (optional) turn/outcome/audio in Postgres. Character sheet = stored bundle (from natal at profile creation). Daily turn = stored row from `getOrCreateDailyTurn` (transit snapshot + campaign state → deterministic prompt).

## How to reproduce proof in Preview

1. Set `PHASE8_DEBUG=1` and `POSTGRES_URL` in Vercel (Preview).
2. Call **GET** `/api/debug/phase8/seed-campaign` once (idempotent: creates test campaign + one daily turn if missing, or returns existing).
3. Use returned `campaignId` and `userId` to open `/rpg/campaign/{campaignId}?userId={userId}`.
   - Or set `RPG_BETA_CAMPAIGN_ID` and `RPG_BETA_USER_ID` to those values and open `/campaign`.
4. No terminal steps required.
