/**
 * Run: npx tsx apps/web/src/components/DiscoveryCarousel.test.ts
 */
import assert from 'node:assert';
import {
  calculateDiscoveryRequestsRemaining,
  formatRefreshCountdown,
} from './DiscoveryCarousel';

assert.strictEqual(calculateDiscoveryRequestsRemaining(0), 3);
assert.strictEqual(calculateDiscoveryRequestsRemaining(2), 1);
assert.strictEqual(calculateDiscoveryRequestsRemaining(5), 0);

const noon = new Date('2026-05-18T12:00:00');
const countdown = formatRefreshCountdown(noon);
assert.match(countdown, /^\d+h \d+m$/);

console.log('DiscoveryCarousel helpers: ok');
