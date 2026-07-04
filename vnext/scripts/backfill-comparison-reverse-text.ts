/**
 * Backfill compatibility_text_reverse for legacy astradio_comparisons rows.
 *
 * Usage:
 *   POSTGRES_URL=... npx ts-node --project vnext/tsconfig.json vnext/scripts/backfill-comparison-reverse-text.ts
 *
 * Safe to re-run: only processes rows where compatibility_text_reverse IS NULL.
 */

import path from 'path';
import { setStorage } from '../compat/storage';
import { composeComparisonAggregateReading } from '../compat/comparison-service';
import { compatibilityTextFromComposeResult } from '../compat/comparison-viewer-orientation';
import { coerceRelationshipModeFromStorage } from '../compat/types';

const ROW_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error('POSTGRES_URL or DATABASE_URL is required');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // Path from compiled dist/vnext/vnext/scripts/ -> repo root lib
  const pgStore = require('../../../../lib/pg-store');
  setStorage(pgStore);

  const batchLimit = Number(process.env.BACKFILL_REVERSE_BATCH_LIMIT || 500);
  let totalProcessed = 0;
  let totalOk = 0;
  let totalFail = 0;

  for (;;) {
    const rows = await pgStore.listComparisonsMissingReverseText(batchLimit);
    if (!rows.length) break;

    console.log(`[backfill-comparison-reverse-text] batch size=${rows.length}`);

    for (const row of rows) {
      const id = String(row.id || '').trim();
      const chartAId = String(row.chart_a_id || '').trim();
      const chartBId = String(row.chart_b_id || '').trim();
      const relationshipMode = coerceRelationshipModeFromStorage(row.relationship_mode);

      if (!id || !chartAId || !chartBId) {
        console.warn(`[backfill-comparison-reverse-text] skip invalid row ${id}`);
        totalFail += 1;
        continue;
      }

      totalProcessed += 1;
      try {
        const reverseCore = await composeComparisonAggregateReading({
          chartAId: chartBId,
          chartBId: chartAId,
          relationshipMode,
          seekerChartId: chartBId,
          targetChartId: chartAId,
          generateAudio: false,
        });

        const reverseText = compatibilityTextFromComposeResult(reverseCore.compose.text);
        await pgStore.updateComparisonReverseText(id, reverseText);
        totalOk += 1;
        console.log(`[backfill-comparison-reverse-text] ok ${id}`);
      } catch (err) {
        totalFail += 1;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[backfill-comparison-reverse-text] fail ${id}: ${msg}`);
      }

      await sleep(ROW_DELAY_MS);
    }
  }

  console.log(
    JSON.stringify(
      {
        totalProcessed,
        totalOk,
        totalFail,
        done: true,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('[backfill-comparison-reverse-text]', error);
  process.exit(1);
});
