# Phase 8 Campaign Proof — PR/Commit Notes

## Summary

Campaign page now proves the stored-data → daily-challenge pipeline: dependency map is documented, missing dependencies are logged and surfaced in the UI, a debug-only seed endpoint creates a test campaign + turn for Preview, and a verification script guards against regression.

## Dependency map

- **Tables:** `rpg_campaigns`, `rpg_effects_bundles`, `rpg_daily_turns`, `rpg_member_responses`, `rpg_daily_audio_artifacts`, `rpg_turn_outcomes`.
- **Functions:** `getCampaignById`, `getBundleByHash`, `getLatestTurnForCampaign`, `listResponsesByTurn`, `getAudioByTurnSeed`, `getOutcomeByTurn` (all in `vnext/rpg/store/rpg-store.ts` and `vnext/rpg/campaign/view.ts`).
- **Required:** campaign row, bundle row. **Optional:** latest turn, responses, audio artifact, outcome.
- See [docs/PHASE8-CAMPAIGN-DEPENDENCY-MAP.md](PHASE8-CAMPAIGN-DEPENDENCY-MAP.md) for full table/function list and required inputs.

## Fixture vs stored user data

- **Campaign page** always reads from DB; no in-memory fixtures in the view path.
- **Stored user data:** profile + campaign + bundle (and optionally turn/outcome/audio) in Postgres. Character sheet comes from the stored bundle (derived from natal snapshot at profile creation). Daily turn is created by POST `/api/rpg/campaign/[campaignId]/turn` with a transit snapshot.

## How to reproduce proof in Preview

1. Set **PHASE8_DEBUG=1** and **POSTGRES_URL** in Vercel (Preview environment).
2. Call **GET** `/api/debug/phase8/seed-campaign` once (idempotent: creates test campaign + one daily turn if missing, or returns existing ids).
3. Use the returned `campaignId` and `userId` to open:
   - `/rpg/campaign/{campaignId}?userId={userId}`
   - Or set `RPG_BETA_CAMPAIGN_ID` and `RPG_BETA_USER_ID` to those values and open `/campaign`.
4. No terminal steps required.

## Changes in this commit

- **docs/PHASE8-CAMPAIGN-DEPENDENCY-MAP.md** — Dependency map and Preview reproduction steps.
- **vnext/rpg/campaign/view.ts** — Structured logging for missing dependencies; optional `_diagnostics` (no_turn_reason, no_audio_reason, audio_status) for UI.
- **apps/web/app/rpg/campaign/[campaignId]/page.tsx** — Explicit error copy for campaign not found / bundle not found; explicit reasons for no turn, no outcome, no audio (and audio failed/pending).
- **apps/web/app/api/debug/phase8/seed-campaign/route.ts** — GET endpoint (PHASE8_DEBUG=1 only), idempotent get-or-create test campaign + one daily turn; returns `{ campaignId, userId }`.
- **vnext/scripts/phase8-campaign-proof-verify.ts** — Verification script: seeds or reuses phase8_preview campaign, builds view, asserts character_sheet and (current_turn or no_turn_reason).
- **package.json** — `phase8:campaign:verify` script.

## Verification

- Run **npm run phase8:campaign:verify** with `POSTGRES_URL` set (and `CI=1` to fail if DB is missing).
