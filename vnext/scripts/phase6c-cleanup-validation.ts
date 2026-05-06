/**
 * Phase 6C-Cleanup — relationship mode normalization (soft-compat).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/phase6c-cleanup-validation.js
 *
 * See `vnext/compat/types.ts` for deprecation timeline (future hard 400 reject not implemented).
 */

import {
  RELATIONSHIP_MODES,
  coerceRelationshipModeFromStorage,
  parseRelationshipModeInput,
} from '../compat/types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[phase6c-cleanup-validation] ${msg}`);
}

function main(): void {
  assert(parseRelationshipModeInput('rivals') === 'friends', 'rivals → friends');
  assert(parseRelationshipModeInput('mentor') === 'friends', 'mentor → friends');
  assert(parseRelationshipModeInput('collaborator') === 'friends', 'collaborator → friends');
  assert(parseRelationshipModeInput('friends') === 'friends', 'friends passthrough');
  assert(parseRelationshipModeInput('lovers') === 'lovers', 'lovers passthrough');
  assert(parseRelationshipModeInput('neutral') === 'neutral', 'neutral passthrough');

  let threw = false;
  try {
    parseRelationshipModeInput('invalid_mode_xyz');
  } catch (e) {
    threw = true;
    assert(e instanceof Error && e.message.includes('Invalid relationship mode'), 'error message');
  }
  assert(threw, 'invalid mode throws');

  let threwRequired = false;
  try {
    parseRelationshipModeInput('');
  } catch {
    threwRequired = true;
  }
  assert(threwRequired, 'empty throws');

  assert(coerceRelationshipModeFromStorage('rivals') === 'friends', 'coerce rivals');
  assert(coerceRelationshipModeFromStorage('unknown') === 'friends', 'coerce unknown → friends');

  assert(RELATIONSHIP_MODES.length === 3 && RELATIONSHIP_MODES.includes('friends'), 'canonical list');

  console.log('[phase6c-cleanup-validation] OK');
}

main();
