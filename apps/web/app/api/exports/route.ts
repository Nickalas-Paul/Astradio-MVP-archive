import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

// Proxy to backend /api/exports (Render). No queue/hash lib in web app.
export async function POST(request: NextRequest) {
  const backend = getEngineBaseUrl();
  try {
    const body = await request.json();
    const r = await fetch(`${backend}/api/exports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Export failed' }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const backend = getEngineBaseUrl();
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    const r = await fetch(`${backend}/api/exports?jobId=${encodeURIComponent(jobId)}`);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Export status failed' }, { status: 502 });
  }
}
