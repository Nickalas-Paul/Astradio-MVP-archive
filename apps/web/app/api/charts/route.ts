/**
 * Proxy to backend POST /api/charts (Community Compatibility V1).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export async function POST(req: NextRequest) {
  try {
    const backend = getEngineBaseUrl();
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${backend}/api/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Charts unavailable' },
      { status: 502 }
    );
  }
}
