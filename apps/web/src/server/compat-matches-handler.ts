/**
 * In-process GET /api/compat/matches (same logic as vnext/compat/routes.ts).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  ensureVnextCompatBoot,
  getVnextRoot,
  loadCompatMatchesModule,
  loadDeployMetaModule,
} from './vnext-runtime';

const COMPAT_RESPONSE_VERSION = 'v1';

function parseMode(rawMode: string): string {
  const vnextReq = createRequire(path.join(getVnextRoot(), 'compat', 'matches.js'));
  const { RELATIONAL_INTENTS, mapLegacyIntentToRelational } = vnextReq(
    '../compatibility/relational-intent'
  ) as {
    RELATIONAL_INTENTS: readonly string[];
    mapLegacyIntentToRelational: (m: string) => string | null;
  };
  const mode = rawMode.trim().toLowerCase();
  if ((RELATIONAL_INTENTS as readonly string[]).includes(mode)) return mode;
  return mapLegacyIntentToRelational(mode) ?? 'friend';
}

export type CompatMatchesResponse = {
  chartId: string;
  mode: string;
  limit: number;
  matches: unknown[];
  generatedAt: string;
  version: string;
  synastryEnabled: boolean;
  matchesMock: boolean;
  _meta: ReturnType<ReturnType<typeof loadDeployMetaModule>['getDeployMeta']>;
};

export async function handleCompatMatchesInProcess(
  searchParams: URLSearchParams
): Promise<{ status: number; body: CompatMatchesResponse | { error: string } }> {
  const chartId = searchParams.get('chartId')?.trim();
  if (!chartId) {
    return { status: 400, body: { error: 'chartId is required' } };
  }

  const mode = parseMode(String(searchParams.get('mode') || ''));
  const limit = Math.min(50, Math.max(1, parseInt(String(searchParams.get('limit') || '10'), 10) || 10));
  ensureVnextCompatBoot();
  const { getCompatMatches, toPublicCompatMatch } = loadCompatMatchesModule();
  const { getDeployMeta } = loadDeployMetaModule();

  const matches = await getCompatMatches(chartId, mode as 'friend' | 'lover', limit);
  const publicMatches = matches.map((m) => toPublicCompatMatch(m));

  if (process.env.MATCHES_BULLET_DEBUG === '1' && matches.length > 0) {
    const ep0 = (matches[0] as { explanationProfile?: Record<string, unknown> })?.explanationProfile;
    console.log(
      '[API_RESPONSE_DEBUG] first match explanationProfile.synastryBullets:',
      JSON.stringify(ep0?.synastryBullets ?? null, null, 2)
    );
  }

  return {
    status: 200,
    body: {
      chartId,
      mode,
      limit,
      matches: publicMatches,
      generatedAt: new Date().toISOString(),
      version: COMPAT_RESPONSE_VERSION,
      synastryEnabled: true,
      matchesMock: process.env.VNEXT_MATCHES_MOCK === '1',
      _meta: getDeployMeta(),
    },
  };
}
