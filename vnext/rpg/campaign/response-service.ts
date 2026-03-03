// vnext/rpg/campaign/response-service.ts
// Deterministic response submission and outcome finalization.

import { hashCanonicalJson } from '../hash/json-hash';
import type { StateHash } from '../contracts';
import { applyOutcome, type RpgOutcome } from './state-machine';
import {
  getDailyTurnById,
  insertResponseIfMissing,
  listResponsesByTurn,
  getOutcomeByTurn,
  insertOutcomeIfMissing,
  getCampaignById,
  updateCampaignState,
  type RpgMemberResponseRow,
  type RpgTurnOutcomeRow,
} from '../store/rpg-store';

export async function submitResponse(params: {
  turnId: string;
  userId: string;
  choiceId: string;
}): Promise<RpgMemberResponseRow> {
  const { turnId, userId, choiceId } = params;

  const turn = await getDailyTurnById(turnId);
  if (!turn) {
    throw new Error(`[rpg-response] Turn not found: ${turnId}`);
  }

  const prompt = turn.prompt_spec_json as any;
  const choiceIds: string[] = Array.isArray(prompt.choice_ids) ? prompt.choice_ids : [];
  if (!choiceIds.includes(choiceId)) {
    throw new Error(`[rpg-response] Invalid choiceId for turn: ${choiceId}`);
  }

  const responseJson = { choice_id: choiceId };
  const responseHash = hashCanonicalJson(responseJson);

  const row = await insertResponseIfMissing({
    turnId,
    userId,
    choiceId,
    responseJson,
    responseHash,
  });

  return row;
}

export async function finalizeTurnOutcome(params: {
  turnId: string;
}): Promise<RpgTurnOutcomeRow> {
  const { turnId } = params;

  const existing = await getOutcomeByTurn(turnId);
  if (existing) {
    return existing;
  }

  const turn = await getDailyTurnById(turnId);
  if (!turn) {
    throw new Error(`[rpg-outcome] Turn not found: ${turnId}`);
  }

  const campaign = await getCampaignById(turn.campaign_id);
  if (!campaign) {
    throw new Error(`[rpg-outcome] Campaign not found: ${turn.campaign_id}`);
  }

  const responses = await listResponsesByTurn(turnId);
  if (!responses || responses.length === 0) {
    throw new Error('[rpg-outcome] No responses available for turn');
  }

  const primary = responses[0];
  const prompt = turn.prompt_spec_json as any;
  const outcomePatchId: string | undefined =
    (prompt.outcome_patch_ids_by_choice && prompt.outcome_patch_ids_by_choice[primary.choice_id]) || undefined;

  const outcome: RpgOutcome = {
    turn_id: turnId,
    choice_id: primary.choice_id,
    outcome_patch_id: outcomePatchId || 'generic',
  };

  const outcomeJson = {
    turn_id: outcome.turn_id,
    choice_id: outcome.choice_id,
    outcome_patch_id: outcome.outcome_patch_id,
  };
  const outcomeHash = hashCanonicalJson(outcomeJson);

  const newState = applyOutcome(campaign.state_json as any, outcome);
  const newStateHash = hashCanonicalJson(newState) as StateHash;

  const row = await insertOutcomeIfMissing({
    turnId,
    outcomeJson,
    outcomeHash,
    newStateJson: newState,
    newStateHash,
  });

  await updateCampaignState({
    campaignId: campaign.id,
    newStateJson: newState,
    newStateHash,
  });

  return row;
}

