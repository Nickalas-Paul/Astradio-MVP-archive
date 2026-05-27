import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CanonicalLocation } from '../../../src/types/location';

// Canonical client-side compose payload for sky mode (home page)
const CanonicalLocationSchema = z.object({
  source: z.enum(['browser_geo', 'geofinder']),
  label: z.string().min(1).max(300),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(100),
  resolvedAt: z.string().min(1).max(100),
});

const SkyClientComposeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  location: CanonicalLocationSchema,
  generateAudio: z.boolean().optional(),
});

type SkyClientComposeBody = z.infer<typeof SkyClientComposeSchema>;

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));

    if (rawBody && typeof rawBody.mode === 'string' && rawBody.mode === 'compatibility') {
      return NextResponse.json(
        {
          error: 'mode=\"compatibility\" is not supported via /api/compose. Use /api/comparisons for dual-profile compatibility.',
          code: 'UNSUPPORTED_COMPOSE_MODE_COMPATIBILITY',
        },
        { status: 400 },
      );
    }

    // Pass through engine-shaped requests (sandbox, overlay) to backend as-is
    const isEngineShape = rawBody && (rawBody.mode === 'sandbox' || rawBody.mode === 'overlay');
    let bodyToSend: string;
    if (isEngineShape) {
      bodyToSend = JSON.stringify(rawBody);
    } else {
      const validationResult = SkyClientComposeSchema.safeParse(rawBody);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: validationResult.error.issues.map((issue) => ({
              field: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          },
          { status: 400 },
        );
      }
      const data: SkyClientComposeBody = validationResult.data;
      const { date, time, location, generateAudio } = data;
      // Wall-clock calendar + time in the client's canonical IANA zone (same contract as Profile active-state / Campaign transit).
      const datetime = `${date}T${time}:00`;
      const latitude = location.lat;
      const longitude = location.lon;
      bodyToSend = JSON.stringify({
        mode: 'sky' as const,
        skyParams: {
          latitude,
          longitude,
          datetime,
          timezone: location.timezone,
        },
        locationMeta: location as CanonicalLocation,
        generateAudio: generateAudio === true,
      });
    }

    const { getEngineBaseUrl } = await import('@/lib/engine-base');
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyToSend,
    });

    // If engine is reachable, return its unified response (audio/text/viz)
    if (r.ok) {
      const json = await r.json();
      return NextResponse.json(json);
    }

    // Engine failure - return error, no silent fallback. Forward engine body when present.
    const engineBody = await r.json().catch(() => ({}));
    const code = engineBody?.code ?? (r.status >= 500 ? 'ENGINE_UNAVAILABLE' : 'ENGINE_ERROR');
    const error = engineBody?.error ?? (r.status >= 500
      ? 'Composition engine is temporarily unavailable'
      : 'Composition engine error');
    return NextResponse.json({
      error,
      code,
      status: r.status,
      timestamp: engineBody?.timestamp ?? new Date().toISOString()
    }, { status: r.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'compose failed' }, { status: 500 });
  }
}
