import { useCallback, useEffect, useState } from 'react';
import { fetchTodayScreenData } from '../lib/today-fetch';
import { formatApiError } from '../lib/format-api-error';
import { useAuthStore } from '../store/auth';
import type { TodayScreenData } from '../types/today';

export function useTodayData() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [data, setData] = useState<TodayScreenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchTodayScreenData(userId);
      setData(next);
    } catch (err) {
      setError(formatApiError(err, 'Could not load today'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
