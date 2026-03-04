import { NextRequest, NextResponse } from 'next/server';
import { getDailyTurnById } from '../../../../../../../../vnext/rpg/store/rpg-store';
import { ensureDailyAudioArtifactForTurn } from '../../../../../../../../vnext/rpg/campaign/audio-service';

// GET is idempotent and may create a pending audio row for this turn.
// It never generates audio; it only records deterministic metadata and status.
export async function GET(_req: NextRequest, ctx: { params: { turnId: string } }) {
  try {
    const turnId = ctx.params.turnId;
    if (!turnId || typeof turnId !== 'string') {
      return NextResponse.json({ error: 'turnId required' }, { status: 400 });
    }

    const turn = await getDailyTurnById(turnId);
    if (!turn) {
      return NextResponse.json({ error: `Turn not found: ${turnId}` }, { status: 404 });
    }

    const row = await ensureDailyAudioArtifactForTurn({ turnId });

    return NextResponse.json({
      turn_id: row.turn_id,
      turn_seed: row.turn_seed,
      audio_algo_version: row.audio_algo_version,
      audio_seed: row.audio_seed,
      provider: row.provider,
      status: row.status,
      artifact_url: row.artifact_url,
      artifact_meta_json: row.artifact_meta_json,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to get daily audio artifact';
    console.error('[api/rpg/turn/:turnId/audio] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

