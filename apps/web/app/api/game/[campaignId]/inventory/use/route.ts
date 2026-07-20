import { NextRequest } from 'next/server';
import { proxyGameRequest } from '@/lib/game-proxy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  return proxyGameRequest(req, campaignId, '/inventory/use', 'POST');
}
