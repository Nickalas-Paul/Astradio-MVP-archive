'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchGameState,
  type GameStateResponse,
  GameApiError,
} from '@/lib/game-api';

export function useGameState(campaignId: string) {
  const [state, setState] = useState<GameStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGameState(campaignId);
      setState(data);
    } catch (e) {
      const msg =
        e instanceof GameApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to load game state';
      setError(msg);
      if (e instanceof GameApiError && e.status === 503) {
        setState(null);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, loading, error, refresh, setState };
}
