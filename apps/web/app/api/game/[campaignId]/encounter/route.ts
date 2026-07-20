import { NextRequest } from 'next/server';
import { proxyGameRequest } from '@/lib/game-proxy';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  return proxyGameRequest(req, campaignId, '/encounter', 'GET');
}
