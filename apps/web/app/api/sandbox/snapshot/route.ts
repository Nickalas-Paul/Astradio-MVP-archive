import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import {
  SandboxSnapshotRequestSchema,
  wireBirthToEngineBirth,
} from '@/lib/sandbox-bff-wire';

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = SandboxSnapshotRequestSchema.safeParse(raw);
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

    const { birth, overrides } = parsed.data;
    const engineBirth = wireBirthToEngineBirth(birth);

    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/sandbox/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birth: engineBirth, overrides }),
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(json, { status: r.status });
    }
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'sandbox snapshot failed' },
      { status: 500 },
    );
  }
}
