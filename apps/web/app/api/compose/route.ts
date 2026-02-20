import { NextResponse } from 'next/server';
import { z } from 'zod';

// Input validation schema
const ComposeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().min(1).max(200).optional(),
  geo: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }).optional().nullable(),
});

type ComposeBody = z.infer<typeof ComposeSchema>;

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));

    // Pass through engine-shaped requests (sandbox, overlay) to backend as-is
    const isEngineShape = rawBody && (rawBody.mode === 'sandbox' || rawBody.mode === 'overlay');
    let bodyToSend: string;
    if (isEngineShape) {
      bodyToSend = JSON.stringify(rawBody);
    } else {
      const validationResult = ComposeSchema.safeParse(rawBody);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: validationResult.error.issues.map((issue) => ({
              field: issue.path.map(String).join('.'),
              message: issue.message
            }))
          },
          { status: 400 }
        );
      }
      const data = validationResult.data;
      const date = data.date || new Date().toISOString().split('T')[0];
      const time = data.time || '12:00';
      const latitude = data.geo?.lat ?? 40.7128;
      const longitude = data.geo?.lon ?? -74.0060;
      const datetime = `${date}T${time}:00Z`;
      bodyToSend = JSON.stringify({
        mode: 'sky' as const,
        skyParams: { latitude, longitude, datetime },
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
