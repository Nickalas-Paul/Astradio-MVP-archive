/**
 * Opt-in: exposes whether test session resume is enabled (no secrets).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = process.env.ENABLE_TEST_SESSION_RESUME === '1';
  return NextResponse.json({ enabled });
}
