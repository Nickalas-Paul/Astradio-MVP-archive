import { NextRequest, NextResponse } from 'next/server';
import { getCampaignById } from '../../../../../../../../vnext/rpg/store/rpg-store';
import { getOrCreateDailyTurn } from '../../../../../../../../vnext/rpg/campaign/turn-service';
import { validateTransitSnapshot } from '../../../../../../../../vnext/rpg/validate-transit-snapshot';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: { campaignId: string } }) {
  try {
    const campaignId = ctx.params.campaignId;
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const transitSnapshot = body?.transitSnapshot;
    if (!transitSnapshot) {
      return NextResponse.json({ error: 'transitSnapshot required' }, { status: 400 });
    }

    try {
      validateTransitSnapshot(transitSnapshot);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid transitSnapshot';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: `Campaign not found: ${campaignId}` }, { status: 404 });
    }

    const turn = await getOrCreateDailyTurn({
      campaignId,
      transitSnapshot,
      stateJson: campaign.state_json,
    });

    return NextResponse.json({
      id: turn.id,
      campaign_id: turn.campaign_id,
      turn_seed: turn.turn_seed,
      transit_snapshot_hash: turn.transit_snapshot_hash,
      state_hash: turn.state_hash,
      prompt_spec: turn.prompt_spec_json,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create daily turn';
    console.error('[api/rpg/campaign/:campaignId/turn] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

