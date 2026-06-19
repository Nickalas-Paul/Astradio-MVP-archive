import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatApiError } from '../lib/format-api-error';

export type ApiQueryMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type UseApiQueryOptions = {
  method?: ApiQueryMethod;
  body?: unknown;
  enabled?: boolean;
};

export function useApiQuery<T>(path: string | null, options: UseApiQueryOptions = {}) {
  const { method = 'GET', body, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled && path));
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  const refetch = useCallback(async () => {
    if (!path || !enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const requestBody = bodyRef.current;
      const result = await api<T>(path, {
        method,
        body: requestBody !== undefined ? JSON.stringify(requestBody) : undefined,
      });
      setData(result);
    } catch (err) {
      setError(formatApiError(err, 'Request failed'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [path, method, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
