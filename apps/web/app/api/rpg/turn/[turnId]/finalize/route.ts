import { NextRequest, NextResponse } from 'next/server';
import { finalizeTurnOutcome } from '../../../../../../../vnext/rpg/campaign/response-service';
import { getOutcomeByTurn } from '../../../../../../../vnext/rpg/store/rpg-store';

export async function POST(_req: NextRequest, ctx: { params: { turnId: string } }) {
  try {
    const turnId = ctx.params.turnId;
    if (!turnId || typeof turnId !== 'string') {
      return NextResponse.json({ error: 'turnId required' }, { status: 400 });
    }

    const outcome = await finalizeTurnOutcome({ turnId });
    const fresh = await getOutcomeByTurn(turnId);

    const row = fresh || outcome;
    return NextResponse.json({
      id: row.id,
      turn_id: row.turn_id,
      outcome_hash: row.outcome_hash,
      outcome_json: row.outcome_json,
      new_state_hash: row.new_state_hash,
      new_state_json: row.new_state_json,
      created_at: row.created_at,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to finalize outcome';
    console.error('[api/rpg/turn/:turnId/finalize] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

