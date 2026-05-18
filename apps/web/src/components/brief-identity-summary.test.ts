/**
 * Run: npx tsx apps/web/src/components/brief-identity-summary.test.ts
 */
import assert from 'node:assert';
import { extractSunEssence, toThirdPersonVoice } from './BriefIdentitySummary';

const input =
  'Your Sun in Capricorn means your sense of purpose is organized around building lasting structures, earning authority through competence, and achieving goals that require sustained discipline.';

const output = toThirdPersonVoice(input);
assert.ok(output.includes('Their Sun'), `expected Their Sun, got: ${output}`);
assert.ok(output.includes('their sense'), `expected their sense, got: ${output}`);
assert.ok(!output.includes('Your Sun'), 'should not contain Your Sun');
assert.ok(!/\byour\b/.test(output), 'should not contain your');

const messy = `The Foundation of Self
### Sun in Capricorn, 11th House
Archetypal Expression
${input}
More text about growth.`;

const essence = extractSunEssence([{ id: 'core_identity', title: 'Core', text: messy }]);
assert.ok(essence.startsWith('Their Sun in Capricorn'), `essence: ${essence}`);
assert.ok(essence.endsWith('.'), `essence should end with period: ${essence}`);
assert.ok(essence.split('.').filter(Boolean).length <= 2, 'should be one sentence');
assert.ok(essence.length < 400, `essence too long: ${essence.length} chars`);

console.log('OK: brief-identity-summary tests passed');
console.log('Sample essence:', essence);
