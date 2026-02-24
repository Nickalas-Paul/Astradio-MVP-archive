import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

const DEV_USER_COOKIE = 'astradio_dev_user_id';

// Proxy to backend /api/exports (Render). No queue/hash lib in web app.
// When a dev profile cookie is present, forward it as x-beta-user so the
// engine's beta gate (requireBeta) can allow the request during testing.
export async function POST(request: NextRequest) {
  const backend = getEngineBaseUrl();
  try {
    const body = await request.json();
    const betaUser = request.cookies.get(DEV_USER_COOKIE)?.value || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (betaUser) {
      headers['x-beta-user'] = betaUser;
    }
    const r = await fetch(`${backend}/api/exports`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Export failed' }, { status: 502 });
  }
}

// Status-by-jobId is not implemented on the engine. Return a clear error
// instructing callers to use /api/exports/:id instead of proxying to a
// non-existent backend route.
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'unsupported',
      message: 'Export status by jobId is not supported. Use /api/exports/:id to download exports by id.',
    },
    { status: 400 },
  );
}
