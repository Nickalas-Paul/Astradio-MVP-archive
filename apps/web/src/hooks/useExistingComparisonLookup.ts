'use client';

import { useEffect, useState } from 'react';
import {
  fetchComparisonPairLookup,
  type ComparisonPairLookupResult,
} from '@/lib/pair-comparison-lookup';

export type ExistingComparisonLookup = ComparisonPairLookupResult & { exists: true };

/**
 * When both chart IDs are stored charts, checks for a materialized connection comparison.
 */
export function useExistingComparisonLookup(
  chartAId: string | null | undefined,
  chartBId: string | null | undefined
): ExistingComparisonLookup | null {
  const [match, setMatch] = useState<ExistingComparisonLookup | null>(null);

  useEffect(() => {
    const a = typeof chartAId === 'string' ? chartAId.trim() : '';
    const b = typeof chartBId === 'string' ? chartBId.trim() : '';
    if (!a || !b) {
      setMatch(null);
      return;
    }

    let cancelled = false;
    void fetchComparisonPairLookup(a, b)
      .then((result) => {
        if (cancelled) return;
        if (result.exists) {
          setMatch(result as ExistingComparisonLookup);
        } else {
          setMatch(null);
        }
      })
      .catch(() => {
        if (!cancelled) setMatch(null);
      });

    return () => {
      cancelled = true;
    };
  }, [chartAId, chartBId]);

  return match;
}
