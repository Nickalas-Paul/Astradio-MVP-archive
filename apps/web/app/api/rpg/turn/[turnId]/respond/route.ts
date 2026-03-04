import { NextRequest, NextResponse } from 'next/server';
import { submitResponse } from '../../../../../../../../vnext/rpg/campaign/response-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: { turnId: string } }) {
  try {
    const turnId = ctx.params.turnId;
    if (!turnId || typeof turnId !== 'string') {
      return NextResponse.json({ error: 'turnId required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = body?.userId as string | undefined;
    const choiceId = body?.choiceId as string | undefined;

    if (!userId || !choiceId) {
      return NextResponse.json({ error: 'userId and choiceId required' }, { status: 400 });
    }

    const row = await submitResponse({ turnId, userId, choiceId });

    return NextResponse.json({
      id: row.id,
      turn_id: row.turn_id,
      user_id: row.user_id,
      choice_id: row.choice_id,
      response_hash: row.response_hash,
      created_at: row.created_at,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to submit response';
    console.error('[api/rpg/turn/:turnId/respond] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

