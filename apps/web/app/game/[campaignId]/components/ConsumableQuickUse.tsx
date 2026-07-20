'use client';

import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import type { InventoryBagItem } from '@/lib/game-api';

export interface ConsumableQuickUseProps {
  item: InventoryBagItem | null;
  onUse: (instanceId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function ConsumableQuickUse({ item, onUse, disabled, loading }: ConsumableQuickUseProps) {
  if (!item) return null;
  return (
    <Card elevation="resting" size="sm" className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-caption uppercase text-text-muted">Prepared</p>
        <p className="truncate font-medium text-text-primary">
          {item.name}
          {item.quantity > 1 ? ` (×${item.quantity})` : ''}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || loading}
        loading={loading}
        onClick={() => onUse(item.instanceId)}
      >
        Use
      </Button>
    </Card>
  );
}
