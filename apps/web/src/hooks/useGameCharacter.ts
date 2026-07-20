'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchGameCharacter, type CharacterResponse } from '@/lib/game-api';

export function useGameCharacter(campaignId: string, enabled = true) {
  const [character, setCharacter] = useState<CharacterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGameCharacter(campaignId);
      setCharacter(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load character');
    } finally {
      setLoading(false);
    }
  }, [campaignId, enabled]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { character, loading, error, refresh };
}
