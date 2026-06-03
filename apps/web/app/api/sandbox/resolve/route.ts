import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { normalizeSandboxCompositionBodyForEngine } from '@/lib/sandbox-bff-wire';

/**
 * Named route: normalizes wire ephemeris_birth (nested location) to engine SandboxBirth
 * before forwarding to the engine. Static segment wins over sandbox/[...path] for /resolve.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const normalized = normalizeSandboxCompositionBodyForEngine(raw);

    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/sandbox/resolve`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(normalized),
    });

    const json = await r.json().catch(() => ({}));
    return NextResponse.json(json, { status: r.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'sandbox resolve failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
