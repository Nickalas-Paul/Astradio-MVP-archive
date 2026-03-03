// vnext/rpg/campaign/view.ts
// Stable view-model builder for campaign UI surfaces.

import type { RPGEffectsBundle, RPGDomainScore } from '../contracts';
import type { RPGCampaignState } from './state-machine';
import {
  getCampaignById,
  getBundleByHash,
  getLatestTurnForCampaign,
  listResponsesByTurn,
  getOutcomeByTurn,
  type RpgCampaignRow,
  type RpgDailyTurnRow,
} from '../store/rpg-store';

export interface RpgCharacterSheetView {
  class_slug: string;
  subclass_slug: string;
  rising_modifier_slug: string;
  top_domains: Array<{ domain: string; score: number }>;
  placements: Array<{
    body: string;
    sign: string;
    house: number;
    domains: string[];
  }>;
}

export interface RpgTurnView {
  id: string;
  turn_seed: string;
  scenario_id: string;
  scenario_tags: string[];
  tone_tag: string;
  choice_ids: string[];
  choice_tags_by_id: Record<string, string[]>;
  has_responded: boolean;
  selected_choice_id: string | null;
}

export interface RpgOutcomeView {
  outcome_patch_id: string;
  chapter: number;
  top_domains: Array<{ domain: string; weight: number }>;
}

export interface RpgCampaignView {
  campaign: {
    id: string;
    user_id: string;
    chart_id: string;
    state_version: number;
    state_hash: string;
  };
  character_sheet: RpgCharacterSheetView;
  current_turn: RpgTurnView | null;
  outcome: RpgOutcomeView | null;
}

function pickTopDomains(domains: RPGDomainScore[], limit = 3): Array<{ domain: string; score: number }> {
  const sorted = [...domains].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.domain.localeCompare(b.domain);
  });
  return sorted.slice(0, limit).map((d) => ({ domain: d.domain, score: d.score }));
}

function stateTopDomains(state: RPGCampaignState, limit = 3): Array<{ domain: string; weight: number }> {
  const entries = Object.entries(state.domain_track || {});
  const sorted = entries
    .map(([domain, weight]) => ({ domain, weight }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.domain.localeCompare(b.domain);
    });
  return sorted.slice(0, limit);
}

function buildCharacterSheet(bundle: RPGEffectsBundle): RpgCharacterSheetView {
  return {
    class_slug: bundle.classSlug,
    subclass_slug: bundle.subclassSlug,
    rising_modifier_slug: bundle.risingModifierSlug,
    top_domains: pickTopDomains(bundle.domainSummary),
    placements: bundle.placements.map((p) => ({
      body: p.body,
      sign: p.sign,
      house: p.house,
      domains: [...p.domains].sort(),
    })),
  };
}

function buildTurnView(turn: RpgDailyTurnRow, userId: string, responses: { user_id: string; choice_id: string }[]): RpgTurnView {
  const prompt = turn.prompt_spec_json as any;
  const hasResponded = responses.some((r) => r.user_id === userId);
  const selected = responses.find((r) => r.user_id === userId) || null;

  const scenarioId: string = prompt?.scenario_id ?? '';
  const scenarioTags: string[] = Array.isArray(prompt?.scenario_tags) ? [...prompt.scenario_tags].sort() : [];
  const toneTag: string = prompt?.tone_tag ?? 'neutral';
  const choiceIds: string[] = Array.isArray(prompt?.choice_ids) ? prompt.choice_ids.slice() : [];
  const choiceTagsById: Record<string, string[]> = {};
  const srcTags: Record<string, string[]> = prompt?.choice_tags_by_id || {};
  for (const id of choiceIds) {
    const tags = Array.isArray(srcTags[id]) ? [...srcTags[id]].sort() : [];
    choiceTagsById[id] = tags;
  }

  return {
    id: turn.id,
    turn_seed: turn.turn_seed,
    scenario_id: scenarioId,
    scenario_tags: scenarioTags,
    tone_tag: toneTag,
    choice_ids: choiceIds,
    choice_tags_by_id: choiceTagsById,
    has_responded: hasResponded,
    selected_choice_id: selected ? selected.choice_id : null,
  };
}

export async function buildCampaignView(params: { campaignId: string; userId: string }): Promise<RpgCampaignView> {
  const { campaignId, userId } = params;

  const campaign: RpgCampaignRow | null = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error(`[rpg-ui] Campaign not found: ${campaignId}`);
  }

  const bundleRow = await getBundleByHash(campaign.bundle_hash);
  if (!bundleRow) {
    throw new Error(`[rpg-ui] Bundle not found for hash=${campaign.bundle_hash}`);
  }

  const bundle = bundleRow.bundle_json as RPGEffectsBundle;
  const state = (campaign.state_json || {}) as RPGCampaignState;

  const characterSheet = buildCharacterSheet(bundle);

  const latestTurn: RpgDailyTurnRow | null = await getLatestTurnForCampaign(campaign.id);
  let currentTurn: RpgTurnView | null = null;
  let outcomeView: RpgOutcomeView | null = null;

  if (latestTurn) {
    const responses = await listResponsesByTurn(latestTurn.id);
    currentTurn = buildTurnView(
      latestTurn,
      userId,
      responses.map((r) => ({ user_id: r.user_id, choice_id: r.choice_id }))
    );

    const outcome = await getOutcomeByTurn(latestTurn.id);
    if (outcome) {
      const newState = (outcome.new_state_json || state) as RPGCampaignState;
      outcomeView = {
        outcome_patch_id: (outcome.outcome_json as any)?.outcome_patch_id ?? '',
        chapter: newState.chapter,
        top_domains: stateTopDomains(newState),
      };
    }
  }

  return {
    campaign: {
      id: campaign.id,
      user_id: campaign.user_id,
      chart_id: campaign.chart_id,
      state_version: campaign.state_version,
      state_hash: campaign.state_hash,
    },
    character_sheet: characterSheet,
    current_turn: currentTurn,
    outcome: outcomeView,
  };
}

