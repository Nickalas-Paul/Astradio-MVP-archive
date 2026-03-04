import { NextRequest, NextResponse } from 'next/server';
import { buildCampaignView } from '../../../../../../../vnext/rpg/campaign/view';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: { campaignId: string } }) {
  try {
    const campaignId = ctx.params.campaignId;
    const userId = req.nextUrl.searchParams.get('userId');

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId query parameter required' }, { status: 400 });
    }

    const view = await buildCampaignView({ campaignId, userId });
    return NextResponse.json(view);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load campaign';
    console.error('[api/rpg/campaign/:campaignId] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

