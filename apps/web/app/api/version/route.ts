/**
 * Deployment version — always served from the Vercel deployment (same commit as UI).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { loadDeployMetaModule } = await import('@/server/vnext-runtime');
    const { getDeployMeta } = loadDeployMetaModule();
    return NextResponse.json(getDeployMeta());
  } catch {
    return NextResponse.json({
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
      deployTarget: process.env.VERCEL ? 'vercel' : 'local',
      bulletSystem: 'library-feed' as const,
      timestamp: new Date().toISOString(),
      vnextDist: false,
    });
  }
}
