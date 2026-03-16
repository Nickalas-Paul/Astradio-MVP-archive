import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CanonicalLocation } from '@/types/location';
import { getEngineBaseUrl } from '@/lib/engine-base';

const CanonicalLocationSchema = z.object({
  source: z.literal('geofinder'),
  label: z.string().min(1).max(300),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(100),
  resolvedAt: z.string().min(1).max(100),
}) satisfies z.ZodType<CanonicalLocation>;

const SandboxBirthSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  location: CanonicalLocationSchema,
  houseSystem: z.string().min(1).max(50).optional(),
});

const SandboxReportRequestSchema = z.object({
  birth: SandboxBirthSchema,
  overrides: z.any(),
  seed: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = SandboxReportRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const { birth, overrides, seed } = parsed.data;
    const engineBirth = {
      date: birth.date,
      time: birth.time,
      lat: birth.location.lat,
      lon: birth.location.lon,
      tz: birth.location.timezone,
      houseSystem: birth.houseSystem ?? 'placidus',
    };

    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/sandbox/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birth: engineBirth, overrides, seed }),
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(json, { status: r.status });
    }
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'sandbox report failed' },
      { status: 500 },
    );
  }
}

