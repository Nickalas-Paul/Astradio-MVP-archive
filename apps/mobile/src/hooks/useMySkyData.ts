import { useCallback, useEffect, useState } from 'react';
import { fetchMySkyScreenData } from '../lib/my-sky-fetch';
import { formatApiError } from '../lib/format-api-error';
import { useAuthStore } from '../store/auth';
import type { MySkyScreenData } from '../types/my-sky';

export function useMySkyData() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [data, setData] = useState<MySkyScreenData | null>(null);
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
      const next = await fetchMySkyScreenData();
      setData(next);
    } catch (err) {
      setError(formatApiError(err, 'Could not load My Sky'));
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
