import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim() || '';
    const backend = getEngineBaseUrl();
    const url = new URL(`${backend}/api/auth/verify-email`);
    if (token) url.searchParams.set('token', token);
    const r = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification unavailable' },
      { status: 502 },
    );
  }
}
