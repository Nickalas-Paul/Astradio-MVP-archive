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

    // Proxy to unified vNext ComposeAPI on Express (engine of record)
    const engineBase = process.env.ENGINE_BASE_URL || 'http://localhost:3000';
    const r = await fetch(`${engineBase}/api/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validationResult.data)
    });

    // If engine is reachable, return its unified response (audio/text/viz)
    if (r.ok) {
      const json = await r.json();
      return NextResponse.json(json);
    }

    // Engine failure - return error, no silent fallback
    const errorCode = r.status >= 500 ? 'ENGINE_UNAVAILABLE' : 'ENGINE_ERROR';
    const errorMessage = r.status >= 500 
      ? 'Composition engine is temporarily unavailable' 
      : 'Composition engine error';
    
    return NextResponse.json({
      error: errorMessage,
      code: errorCode,
      status: r.status,
      timestamp: new Date().toISOString()
    }, { status: r.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'compose failed' }, { status: 500 });
  }
}
