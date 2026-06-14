/**
 * Run: npx tsx apps/web/src/components/ftue/ftue-banner-storage.test.ts
 */
import assert from 'node:assert';
import { advanceFtueImpression, dismissFtueBanner } from './ftue-banner-storage';

function mockStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => Object.fromEntries(map),
  };
}

{
  const s = mockStorage();
  assert.strictEqual(advanceFtueImpression(s, 'k', 1), 'visible');
  assert.strictEqual(s.dump().k, '1');
  assert.strictEqual(advanceFtueImpression(s, 'k', 1), 'hidden');
  assert.strictEqual(s.dump().k, 'dismissed');
}

{
  const s = mockStorage();
  assert.strictEqual(advanceFtueImpression(s, 'k', 2), 'visible');
  assert.strictEqual(s.dump().k, '1');
  assert.strictEqual(advanceFtueImpression(s, 'k', 2), 'visible');
  assert.strictEqual(s.dump().k, '2');
  assert.strictEqual(advanceFtueImpression(s, 'k', 2), 'hidden');
  assert.strictEqual(s.dump().k, 'dismissed');
}

{
  const s = mockStorage({ k: 'dismissed' });
  assert.strictEqual(advanceFtueImpression(s, 'k', 2), 'hidden');
}

{
  const s = mockStorage({ k: '1' });
  dismissFtueBanner(s, 'k');
  assert.strictEqual(s.dump().k, 'dismissed');
}

console.log('ftue-banner-storage.test.ts: ok');
