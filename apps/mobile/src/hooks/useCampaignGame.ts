import { useCallback, useEffect, useState } from 'react';
import {
  composeCampaignDaily,
  fetchGameCharacter,
  fetchGameEncounter,
  fetchGameInventory,
  fetchGameState,
  gameErrorMessage,
  type CharacterResponse,
  type DailyResolveMeta,
  type EncounterResponse,
  type GameStateResponse,
  type InventoryResponse,
} from '../lib/game-api';

export function useCampaignGame(campaignId: string) {
  const [state, setState] = useState<GameStateResponse | null>(null);
  const [encounter, setEncounter] = useState<EncounterResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [character, setCharacter] = useState<CharacterResponse | null>(null);
  const [resolveMeta, setResolveMeta] = useState<DailyResolveMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!campaignId) return;
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const [nextState, nextInventory, nextCharacter, meta] = await Promise.all([
          fetchGameState(campaignId),
          fetchGameInventory(campaignId),
          fetchGameCharacter(campaignId),
          composeCampaignDaily(campaignId),
        ]);
        const nextEncounter = await fetchGameEncounter(campaignId);
        setState(nextState);
        setInventory(nextInventory);
        setCharacter(nextCharacter);
        setResolveMeta(meta);
        setEncounter(nextEncounter);
      } catch (err) {
        setError(gameErrorMessage(err, 'Could not load today’s encounter.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [campaignId],
  );

  const refreshStateAndInventory = useCallback(async () => {
    const [nextState, nextInventory] = await Promise.all([
      fetchGameState(campaignId),
      fetchGameInventory(campaignId),
    ]);
    setState(nextState);
    setInventory(nextInventory);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    state,
    setState,
    encounter,
    setEncounter,
    inventory,
    setInventory,
    character,
    resolveMeta,
    loading,
    refreshing,
    error,
    setError,
    load,
    refreshStateAndInventory,
  };
}
