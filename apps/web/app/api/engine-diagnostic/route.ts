/**
 * Runtime diagnostic: which engine base URL the Next.js API proxies use.
 * For Vercel preview: set ENGINE_BASE_URL or API_BASE_URL in project env.
 */
import { NextResponse } from 'next/server';
import { getEngineBaseUrl, shouldUseInProcessCompatApi } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = getEngineBaseUrl();
  const source = process.env.API_BASE_URL
    ? 'API_BASE_URL'
    : process.env.ENGINE_BASE_URL
      ? 'ENGINE_BASE_URL'
      : 'default';
  return NextResponse.json({
    engineBaseUrl: url,
    source,
    compatMatches: shouldUseInProcessCompatApi() ? 'in-process-vnext' : 'proxy',
    vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    hint:
      shouldUseInProcessCompatApi()
        ? 'compat/matches runs in-process on this deployment (unified commit)'
        : url === 'http://localhost:4000' && process.env.VERCEL
          ? 'Set ENGINE_BASE_URL for other API routes, or USE_IN_PROCESS_VNEXT=1 for unified compat'
          : null,
  });
}
