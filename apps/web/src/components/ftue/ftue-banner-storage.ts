export type FtueImpressionResult = 'hidden' | 'visible';

/** Advance FTUE impression counter; returns whether the banner should render this visit. */
export function advanceFtueImpression(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  storageKey: string,
  maxImpressions: number,
): FtueImpressionResult {
  const raw = storage.getItem(storageKey);
  if (raw === 'dismissed') return 'hidden';
  if (raw === null) {
    storage.setItem(storageKey, '1');
    return 'visible';
  }
  const count = Number.parseInt(raw, 10);
  if (!Number.isFinite(count) || count < 1) {
    storage.setItem(storageKey, '1');
    return 'visible';
  }
  const next = count + 1;
  if (next > maxImpressions) {
    storage.setItem(storageKey, 'dismissed');
    return 'hidden';
  }
  storage.setItem(storageKey, String(next));
  return 'visible';
}

export function dismissFtueBanner(storage: Pick<Storage, 'setItem'>, storageKey: string): void {
  storage.setItem(storageKey, 'dismissed');
}
