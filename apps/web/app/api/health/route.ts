import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const health = {
      status: 'ok' as const,
      build: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
