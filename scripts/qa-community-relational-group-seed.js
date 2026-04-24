#!/usr/bin/env node
/**
 * QA: relational group for Community feed + Connections (pg-store semantics, not Stage 4 owner-only members).
 * Idempotent: same owner + slug; adds missing platform members only.
 *
 * Requires: POSTGRES_URL or DATABASE_URL
 *   node scripts/qa-community-relational-group-seed.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const OWNER_ID = 'usr_ff0e0495d46e1846';
const SLUG = 'qa-community-relational-group-v1';
const GROUP_NAME = 'QA Community relational group';

/** Same chart ids as scripts/link-test-user-qa-relationships.js */
const ROSTER = [
  { userId: OWNER_ID, chartId: 'chart_15bb1c43bf962c73' },
  { userId: 'qa_compat_user_10', chartId: 'qa_compat_chart_10' },
  { userId: 'qa_compat_user_11', chartId: 'qa_compat_chart_11' },
  { userId: 'qa_compat_user_12', chartId: 'qa_compat_chart_12' },
  { userId: 'qa_compat_user_14', chartId: 'qa_compat_chart_14' },
];

async function main() {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!pgUrl) {
    console.error('[qa-community-relational-group-seed] POSTGRES_URL or DATABASE_URL is required.');
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = pgUrl;
  }

  const pgStore = require(path.join(__dirname, '..', 'lib', 'pg-store.js'));

  const owned = await pgStore.listRelationalGroupsByOwner(OWNER_ID);
  let group = owned.find((g) => g.slug === SLUG);
  if (!group) {
    group = await pgStore.createRelationalGroup({
      ownerId: OWNER_ID,
      slug: SLUG,
      name: GROUP_NAME,
      description: 'Seeded for Community relational feed QA (multi-member).',
    });
    console.log('[qa-community-relational-group-seed] Created group', group.id, SLUG);
  } else {
    console.log('[qa-community-relational-group-seed] Using existing group', group.id, SLUG);
  }

  const existing = (await pgStore.listRelationalGroupMembers(group.id, OWNER_ID)) || [];
  const chartIds = new Set(existing.map((m) => m.chartId));

  for (const row of ROSTER) {
    if (chartIds.has(row.chartId)) {
      console.log('[qa-community-relational-group-seed] Skip (already member)', row.userId, row.chartId);
      continue;
    }
    await pgStore.addRelationalGroupMember({
      groupId: group.id,
      memberType: 'platform',
      userId: row.userId,
      chartId: row.chartId,
      role: 'member',
    });
    chartIds.add(row.chartId);
    console.log('[qa-community-relational-group-seed] Added member', row.userId, row.chartId);
  }

  console.log('[qa-community-relational-group-seed] Complete.');
}

main().catch((err) => {
  console.error('[qa-community-relational-group-seed] Failed:', err);
  process.exit(1);
});
