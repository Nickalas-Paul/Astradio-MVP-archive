/**
 * Run: npx tsx apps/web/src/components/shared/identity-markdown.test.ts
 */
import assert from 'node:assert';
import { prepareIdentityMarkdown } from './IdentityMarkdown';

const sample = `### Sun in Taurus, 10th House

**Archetypal Expression**

Your Sun in Taurus means your sense of purpose is organized around building something lasting.

---

### Moon in Taurus, 10th House

**Observable Patterns**

You work steadily and commit thoroughly.`;

const prepared = prepareIdentityMarkdown(sample);
assert.ok(prepared.includes('### Sun in Taurus'), 'h3 heading line preserved for markdown parse');
assert.ok(!prepared.includes('---'), 'horizontal rules stripped');
assert.ok(prepared.includes('**Archetypal Expression**'), 'field label block preserved');
assert.ok(prepared.includes('Your Sun in Taurus means'), 'body prose preserved');

console.log('OK: identity-markdown tests passed');
