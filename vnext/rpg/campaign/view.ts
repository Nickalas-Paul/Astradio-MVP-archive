// vnext/rpg/campaign/view.ts
// Stable view-model builder for campaign UI surfaces.

import type { RPGEffectsBundle, RPGDomainScore } from '../contracts';
import type { RPGCampaignState } from './state-machine';
import {
  getCampaignById,
  getBundleByHash,
  getAudioByTurnSeed,
  getLatestTurnForCampaign,
  listResponsesByTurn,
  getOutcomeByTurn,
  getProfileByUserAndBundle,
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

/** Audio classification for UI; distinct from raw status. */
export type RpgAudioClassification =
  | 'not_enabled'
  | 'no_record'
  | 'pending'
  | 'failed'
  | 'playable';

/** Optional diagnostics for UI and proof; not part of external API contract. */
export interface RpgCampaignViewDiagnostics {
  no_turn_reason?: string;
  no_audio_reason?: string;
  audio_status?: string;
  /** Resolved canonical ids (for proof and logs). */
  resolved_user_id?: string;
  resolved_chart_id?: string;
  resolved_natal_snapshot_hash?: string;
  resolved_bundle_hash?: string;
  resolved_campaign_id?: string;
  resolved_state_hash?: string;
  resolved_daily_turn_id?: string;
  resolved_turn_seed?: string;
  resolved_transit_snapshot_hash?: string;
  resolved_audio_provider?: string;
  /** Explicit classification for UI: not_enabled | no_record | pending | failed | playable. */
  audio_classification?: RpgAudioClassification;
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
  audio: {
    status: string;
    provider: string;
    audio_seed: string;
    artifact_url: string | null;
  } | null;
  /** Optional; for explicit UI messages when dependencies are missing. */
  _diagnostics?: RpgCampaignViewDiagnostics;
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

  const diagnostics: RpgCampaignViewDiagnostics = {};
  diagnostics.resolved_user_id = campaign.user_id;
  diagnostics.resolved_chart_id = campaign.chart_id;
  diagnostics.resolved_bundle_hash = campaign.bundle_hash;
  diagnostics.resolved_campaign_id = campaign.id;
  diagnostics.resolved_state_hash = campaign.state_hash;
  const natalSnapshotHash = (bundle as any).metadata?.natal_snapshot_hash;
  if (typeof natalSnapshotHash === 'string') {
    diagnostics.resolved_natal_snapshot_hash = natalSnapshotHash;
  }

  const latestTurn: RpgDailyTurnRow | null = await getLatestTurnForCampaign(campaign.id);
  let currentTurn: RpgTurnView | null = null;
  let outcomeView: RpgOutcomeView | null = null;
  let audioView: RpgCampaignView['audio'] = null;

  const audioProviderEnv = (process.env.RPG_AUDIO_PROVIDER || 'none').toLowerCase();

  if (latestTurn) {
    diagnostics.resolved_daily_turn_id = latestTurn.id;
    diagnostics.resolved_turn_seed = latestTurn.turn_seed;
    diagnostics.resolved_transit_snapshot_hash = latestTurn.transit_snapshot_hash;
    diagnostics.resolved_audio_provider = audioProviderEnv;

    const responses = await listResponsesByTurn(latestTurn.id);
    currentTurn = buildTurnView(
      latestTurn,
      userId,
      responses.map((r) => ({ user_id: r.user_id, choice_id: r.choice_id }))
    );

    const audio = await getAudioByTurnSeed(latestTurn.turn_seed);
    if (audio) {
      audioView = {
        status: audio.status,
        provider: audio.provider,
        audio_seed: audio.audio_seed,
        artifact_url: audio.artifact_url,
      };
      if (audio.status === 'failed') {
        diagnostics.audio_status = 'failed';
        diagnostics.no_audio_reason = 'Audio generation failed.';
        diagnostics.audio_classification = 'failed';
      } else if (audio.status === 'pending') {
        diagnostics.audio_status = 'pending';
        diagnostics.audio_classification = 'pending';
      } else if (audio.status === 'ready' && audio.artifact_url) {
        diagnostics.audio_classification = 'playable';
      } else {
        diagnostics.audio_classification = 'pending';
      }
    } else {
      diagnostics.no_audio_reason =
        'Request generation via GET /api/rpg/turn/{turnId}/audio, or audio may be disabled (RPG_AUDIO_PROVIDER=none).';
      diagnostics.audio_classification =
        audioProviderEnv === 'none' ? 'not_enabled' : 'no_record';
    }

    const outcome = await getOutcomeByTurn(latestTurn.id);
    if (outcome) {
      const newState = (outcome.new_state_json || state) as RPGCampaignState;
      outcomeView = {
        outcome_patch_id: (outcome.outcome_json as any)?.outcome_patch_id ?? '',
        chapter: newState.chapter,
        top_domains: stateTopDomains(newState),
      };
    }
  } else {
    diagnostics.no_turn_reason =
      'Daily turns are created when a transit snapshot is submitted (POST /api/rpg/campaign/.../turn).';
  }

  // Structured logging: resolved chain and missing dependencies (grep-friendly, no PII).
  // eslint-disable-next-line no-console
  console.log(
    `[rpg-campaign] resolved userId=${diagnostics.resolved_user_id} chartId=${diagnostics.resolved_chart_id} natalSnapshotHash=${diagnostics.resolved_natal_snapshot_hash ?? 'n/a'} bundleHash=${diagnostics.resolved_bundle_hash} campaignId=${diagnostics.resolved_campaign_id} stateHash=${diagnostics.resolved_state_hash}`
  );
  if (!latestTurn) {
    // eslint-disable-next-line no-console
    console.log(`[rpg-campaign] missing_dependency=daily_turn campaignId=${campaignId}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[rpg-campaign] resolved dailyTurnId=${diagnostics.resolved_daily_turn_id} turnSeed=${diagnostics.resolved_turn_seed} transitSnapshotHash=${diagnostics.resolved_transit_snapshot_hash} audio_classification=${diagnostics.audio_classification ?? 'n/a'}`
    );
    if (!audioView) {
      // eslint-disable-next-line no-console
      console.log(`[rpg-campaign] missing_dependency=audio turnId=${latestTurn.id} campaignId=${campaignId}`);
    }
    if (!outcomeView) {
      // eslint-disable-next-line no-console
      console.log(`[rpg-campaign] missing_dependency=outcome turnId=${latestTurn.id} campaignId=${campaignId}`);
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
    audio: audioView,
    _diagnostics: Object.keys(diagnostics).length > 0 ? diagnostics : undefined,
  };
}

