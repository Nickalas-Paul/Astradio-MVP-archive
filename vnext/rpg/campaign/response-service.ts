// vnext/rpg/campaign/response-service.ts
// Deterministic response submission and outcome finalization.

import { hashCanonicalJson } from '../hash/json-hash';
import type { StateHash } from '../contracts';
import { applyOutcome, type RpgOutcome } from './state-machine';
import {
  getDailyTurnById,
  insertResponseIfMissing,
  type RpgMemberResponseRow,
  finalizeTurnTransactional,
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

  const existing = await insertResponseIfMissing({
    turnId,
    userId,
    choiceId,
    responseJson,
    responseHash,
  });

  if (existing.choice_id !== choiceId) {
    throw new Error(
      `[rpg-response] Response already submitted for turn; existing choice_id=${existing.choice_id}, requested=${choiceId}`
    );
  }

  return existing;
}

export async function finalizeTurnOutcome(params: {
  turnId: string;
}): Promise<RpgTurnOutcomeRow> {
  const { turnId } = params;

  const turn = await getDailyTurnById(turnId);
  if (!turn) {
    throw new Error(`[rpg-outcome] Turn not found: ${turnId}`);
  }

  return finalizeTurnTransactional({
    turnId,
    buildOutcomeAndState: ({ campaign, responses }) => {
      if (!responses || responses.length === 0) {
        throw new Error('[rpg-outcome] No responses available for turn (tx)');
      }
      if (responses.length > 1) {
        throw new Error('[rpg-outcome] Multiple responses for turn in solo mode (tx)');
      }

      const primary = responses[0];

      const prompt = turn.prompt_spec_json as any;
      const map = prompt?.outcome_patch_ids_by_choice as Record<string, string> | undefined;
      const outcomePatchId = map ? map[primary.choice_id] : undefined;

      if (!outcomePatchId) {
        const scenarioId = prompt?.scenario_id ?? 'unknown';
        throw new Error(
          `[rpg-outcome] Missing outcome_patch_id for turn=${turnId}, scenario_id=${scenarioId}, choice_id=${primary.choice_id}`
        );
      }

      const outcome: RpgOutcome = {
        turn_id: turnId,
        choice_id: primary.choice_id,
        outcome_patch_id: outcomePatchId,
      };

      const outcomeJson = {
        turn_id: outcome.turn_id,
        choice_id: outcome.choice_id,
        outcome_patch_id: outcome.outcome_patch_id,
      };
      const outcomeHash = hashCanonicalJson(outcomeJson);

      const newState = applyOutcome(campaign.state_json as any, outcome);
      const newStateHash = hashCanonicalJson(newState) as StateHash;

      return {
        outcomeJson,
        outcomeHash,
        newStateJson: newState,
        newStateHash,
      };
    },
  });
}

