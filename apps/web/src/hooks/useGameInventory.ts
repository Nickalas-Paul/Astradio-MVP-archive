'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  discardItem,
  equipItem,
  fetchGameInventory,
  unequipSlot,
  useConsumable,
  type ConsumableUseResult,
  type InventoryResponse,
} from '@/lib/game-api';

export function useGameInventory(campaignId: string) {
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGameInventory(campaignId);
      setInventory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equip = useCallback(
    async (instanceId: string) => {
      setMutating(true);
      setError(null);
      try {
        const data = await equipItem(campaignId, instanceId);
        setInventory(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Equip failed');
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [campaignId]
  );

  const unequip = useCallback(
    async (slot: string) => {
      setMutating(true);
      setError(null);
      try {
        const data = await unequipSlot(campaignId, slot);
        setInventory(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unequip failed');
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [campaignId]
  );

  const useItem = useCallback(
    async (instanceId: string): Promise<ConsumableUseResult> => {
      setMutating(true);
      setError(null);
      try {
        const result = await useConsumable(campaignId, instanceId);
        await refresh();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Use failed');
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [campaignId, refresh]
  );

  const discard = useCallback(
    async (instanceId: string) => {
      setMutating(true);
      setError(null);
      try {
        await discardItem(campaignId, instanceId);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Discard failed');
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [campaignId, refresh]
  );

  return {
    inventory,
    loading,
    error,
    mutating,
    equip,
    unequip,
    useConsumable: useItem,
    discard,
    refresh,
  };
}
