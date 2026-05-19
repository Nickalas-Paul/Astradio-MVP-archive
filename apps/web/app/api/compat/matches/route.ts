/**
 * GET /api/compat/matches — in-process vnext on Vercel (unified deploy), else proxy to engine.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl, shouldUseInProcessCompatApi } from '@/lib/engine-base';
import { handleCompatMatchesInProcess } from '@/server/compat-matches-handler';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (shouldUseInProcessCompatApi()) {
    try {
      const { status, body } = await handleCompatMatchesInProcess(searchParams);
      return NextResponse.json(body, { status });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[api/compat/matches] in-process error:', message);
      if (process.env.FORCE_IN_PROCESS_VNEXT === '1') {
        return NextResponse.json({ error: message }, { status: 500 });
      }
      console.warn('[api/compat/matches] falling back to engine proxy');
    }
  }

  try {
    const qs = searchParams.toString();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/compat/matches${qs ? `?${qs}` : ''}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/compat/matches] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Compat matches unavailable' },
      { status: 502 }
    );
  }
}
