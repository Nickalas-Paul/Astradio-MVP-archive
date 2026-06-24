import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { normalizeSandboxCompositionBodyForEngine } from '@/lib/sandbox-bff-wire';
import { getSessionUserId } from '@/lib/session';

/**
 * Named route: normalizes wire ephemeris_birth (nested location) to engine SandboxBirth
 * before forwarding to the engine. Static segment wins over sandbox/[...path] for /resolve.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({}));
    const normalized = normalizeSandboxCompositionBodyForEngine(raw);
    const wantsAudio =
      (raw && typeof raw === 'object' && (raw as { generateAudio?: boolean }).generateAudio === true) ||
      (normalized &&
        typeof normalized === 'object' &&
        (normalized as { generateAudio?: boolean }).generateAudio === true);

    const sessionUserId = getSessionUserId(req.cookies);
    if (wantsAudio && !sessionUserId) {
      return NextResponse.json({ error: 'Sign in to hear audio' }, { status: 401 });
    }

    const base = getEngineBaseUrl();
    const proxyHeaders = sessionUserId
      ? engineProxySessionHeaders(sessionUserId, { 'Content-Type': 'application/json' })
      : engineProxyHeaders({ 'Content-Type': 'application/json' });
    const r = await fetch(`${base}/api/sandbox/resolve`, {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify(normalized),
    });

    const json = await r.json().catch(() => ({}));
    return NextResponse.json(json, { status: r.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'sandbox resolve failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
