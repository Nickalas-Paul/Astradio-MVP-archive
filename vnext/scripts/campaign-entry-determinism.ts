#!/usr/bin/env node
/**
 * Pass 1 — Deterministic guard for campaign entry normalization.
 * Single case: chosen group with duplicate and unsorted members → unique lexicographic seedMemberUserIds.
 */

import { normalizeCampaignEntrySelection } from '../rpg/campaign-entry';

function main(): void {
  const entry = normalizeCampaignEntrySelection({
    userId: 'leader_1',
    mode: 'group',
    formationMode: 'chosen',
    selectedMemberUserIds: ['leader_1', 'member_b', 'member_a', 'member_a'],
  });

  const expected = ['leader_1', 'member_a', 'member_b'];
  const ok =
    Array.isArray(entry.seedMemberUserIds) &&
    entry.seedMemberUserIds.length === expected.length &&
    entry.seedMemberUserIds.every((id, i) => id === expected[i]);

  if (!ok) {
    // eslint-disable-next-line no-console
    console.error('FAIL: expected seedMemberUserIds', expected, 'got', entry.seedMemberUserIds);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('OK: campaign entry normalization is deterministic (chosen group → lexicographic order)');
}

main();
