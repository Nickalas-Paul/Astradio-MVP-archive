/**
 * Founder connection seed: bidirectional Friend link when a new user registers.
 * Non-blocking; never throws — registration must always succeed.
 */

import path from 'path';

type FounderPgStore = {
  createRelationship: (input: {
    ownerUserId: string;
    chartAId: string;
    chartBId: string;
    label: string;
    comparisonId: string | null;
  }) => Promise<unknown>;
};

function getPgStore(): FounderPgStore | null {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = require(path.join(process.cwd(), 'lib', 'pg-store.js')) as Partial<FounderPgStore>;
    return typeof mod.createRelationship === 'function' ? (mod as FounderPgStore) : null;
  } catch {
    return null;
  }
}

/**
 * Create bidirectional Friend relationship rows between a new user and the founder account.
 * Bypasses intent/accept workflow (same pattern as QA seed scripts).
 */
export async function seedFounderConnection(userId: string, chartId: string): Promise<void> {
  try {
    const founderUserId = process.env.FOUNDER_USER_ID?.trim();
    const founderChartId = process.env.FOUNDER_CHART_ID?.trim();

    if (!founderUserId || !founderChartId) {
      console.warn('[compat] founder connection: FOUNDER_USER_ID or FOUNDER_CHART_ID not set; skipping');
      return;
    }

    const newUserId = String(userId || '').trim();
    const newChartId = String(chartId || '').trim();
    if (!newUserId || !newChartId) {
      console.warn('[compat] founder connection: missing userId or chartId; skipping');
      return;
    }

    if (newUserId === founderUserId) {
      return;
    }

    const pgStore = getPgStore();
    if (!pgStore) {
      console.warn('[compat] founder connection: pg-store unavailable; skipping');
      return;
    }

    const label = 'Friend';
    await pgStore.createRelationship({
      ownerUserId: newUserId,
      chartAId: newChartId,
      chartBId: founderChartId,
      label,
      comparisonId: null,
    });
    await pgStore.createRelationship({
      ownerUserId: founderUserId,
      chartAId: newChartId,
      chartBId: founderChartId,
      label,
      comparisonId: null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[compat] founder connection seed failed (non-fatal):', msg);
  }
}
