// vnext/rpg/campaign-state.ts
// Pass 2 — Canonical campaign container and deterministic retrieval contract.
// No gameplay logic; stabilizes ownership and duplicate-prevention semantics.
//
// Relationship to CampaignEntryContext (campaign-entry.ts):
//   CampaignEntryContext — describes how a user entered Campaign (mode, formationMode, seedMemberUserIds).
//   CampaignStateContainer — identifies the persistent campaign instance for that user/chart (campaignId, ownership, timestamps).
// Pipeline: entry (POST /campaign/entry) → resolve (POST /campaign/resolve) yields container → character/challenge use campaignId.

import type { RpgCampaignRow } from './store/rpg-store';

/**
 * Canonical campaign container for API and pipeline use.
 * Solo campaigns are owned by entry.userId; group campaigns anchor to the initiating user.
 */
export interface CampaignStateContainer {
  campaignId: string;
  userId: string;
  chartId: string;
  createdAt: string;
  /** Last activity (store updated_at); use for "last played" semantics. */
  lastPlayedAt: string;
}

/**
 * Map a store row to the stable container contract.
 */
export function rowToCampaignStateContainer(row: RpgCampaignRow): CampaignStateContainer {
  return {
    campaignId: row.id,
    userId: row.user_id,
    chartId: row.chart_id,
    createdAt: row.created_at,
    lastPlayedAt: row.updated_at,
  };
}

/**
 * Deterministic campaign retrieval rule (implemented in rpg-store):
 *
 *   IF a campaign exists for (userId, chartId, rpg_map_version, rpg_algo_version)
 *     THEN return it
 *   ELSE
 *     create one and return it
 *
 * Duplicate prevention: DB UNIQUE(user_id, chart_id, rpg_map_version, rpg_algo_version)
 * and INSERT ... ON CONFLICT DO NOTHING + SELECT by same key. So (userId, chartId) for a
 * given algo version yields exactly one campaign. Multiple calls with the same (userId, chartId)
 * reuse the same campaign.
 */
