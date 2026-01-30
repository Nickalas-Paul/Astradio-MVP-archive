import { NextResponse } from 'next/server';
import crypto from 'crypto';
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

const PLANETS = [
  'sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto',
] as const;

function hnum(seed: string, mod: number) {
  const n = parseInt(crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);
  return n % mod;
}

function makeSnapshot(seed: string) {
  // seed influences asc + positions
  const base = hnum(`${seed}:base`, 360);
  const asc = (base + hnum(`${seed}:asc`, 360)) % 360;

  const positions: Record<string, number> = {};
  PLANETS.forEach((p, i) => {
    const jitter = hnum(`${seed}:${p}`, 53); // small prime spread
    positions[p] = (base + i * 31 + jitter) % 360;
  });

  const houses = Array.from({ length: 12 }, (_ , i) => (asc + i * 30) % 360);
  return { positions, houses, asc };
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));

    // Validate basic shape before proxying
    const validationResult = ComposeSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Convert simplified input to "sky" mode format for ComposeAPI
    // Default to current time and New York if not provided
    const date = data.date || new Date().toISOString().split('T')[0];
    const time = data.time || '12:00';
    const latitude = data.geo?.lat ?? 40.7128; // Default to New York
    const longitude = data.geo?.lon ?? -74.0060;

    const sanitized = {
      date,
      time,
      location: data.location ?? undefined,
      geo: data.geo ? { lat: data.geo.lat, lon: data.geo.lon } : undefined,
    };
    console.log('[COMPOSE_API] Request body (sanitized):', JSON.stringify(sanitized));
    console.log('[COMPOSE_API] Interpreted coords:', { latitude, longitude, from_geo: !!data.geo });

    // Construct ISO 8601 datetime string
    const datetime = `${date}T${time}:00Z`;

    // Build sky mode request for ComposeAPI
    const composeRequest = {
      mode: 'sky' as const,
      skyParams: {
        latitude,
        longitude,
        datetime
      }
    };

    // Proxy to unified vNext ComposeAPI on Express (engine of record)
    const engineBase = process.env.ENGINE_BASE_URL || 'http://localhost:3000';
    const r = await fetch(`${engineBase}/api/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(composeRequest)
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
