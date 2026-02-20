#!/usr/bin/env node
/**
 * Restart test: seed data, then (after manual server restart) verify same data is returned.
 * Usage:
 *   1. POSTGRES_URL=... node scripts/migrate.js
 *   2. POSTGRES_URL=... node scripts/restart-test.js seed
 *   3. Start server (npm start), use it, then stop and start again (restart).
 *   4. POSTGRES_URL=... node scripts/restart-test.js verify
 *
 * Verify step fetches users/charts/groups/posts from DB and asserts expected shape and linkage.
 */

require('dotenv').config();
const path = require('path');

if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL required');
  process.exit(1);
}

const store = require(path.join(__dirname, '..', 'lib', 'pg-store'));

async function seed() {
  const user = await store.createUser({ displayName: 'Restart Test User', email: 'restart@test' });
  const chart = await store.createChart({
    ownerId: user.id,
    label: 'Test Natal',
    date: '1990-06-15',
    time: '14:30',
    lat: 40.7128,
    lon: -74.006,
  });
  await store.setUserPrimaryChart(user.id, chart.id);
  const group = await store.createGroup({
    slug: 'restart-test-group',
    name: 'Restart Test Group',
    description: 'Created for restart test',
    tags: ['test'],
  });
  await store.createMembership({ groupId: group.id, userId: user.id, role: 'mod' });
  const post = await store.createPost({
    groupId: group.id,
    userId: user.id,
    title: 'Restart test post',
    body: 'Must persist after server restart.',
  });
  await store.ensureDefaultProfileChart();
  await store.ensureMatchCandidateCharts();
  console.log('Seeded:', { userId: user.id, chartId: chart.id, groupId: group.id, postId: post.id });
  console.log('\nRestart the server, then run: node scripts/restart-test.js verify\n');
}

async function verify() {
  const slug = 'restart-test-group';
  const group = await store.getGroupBySlug(slug);
  if (!group) {
    console.error('FAIL: Group "restart-test-group" not found after restart');
    process.exit(1);
  }
  const members = await store.getMembershipsByGroup(group.id);
  if (!members.length) {
    console.error('FAIL: No members in group after restart');
    process.exit(1);
  }
  const posts = await store.listPostsByGroup(group.id, { limit: 10 });
  const testPost = posts.find((p) => p.title === 'Restart test post');
  if (!testPost) {
    console.error('FAIL: Test post not found after restart');
    process.exit(1);
  }
  const user = await store.getUser(members[0].userId);
  if (!user) {
    console.error('FAIL: User not found after restart');
    process.exit(1);
  }
  const primaryChartId = await store.getUserPrimaryChart(user.id);
  const chart = primaryChartId ? await store.getChart(primaryChartId) : null;
  if (!chart || chart.label !== 'Test Natal') {
    console.error('FAIL: Primary chart not found or wrong after restart');
    process.exit(1);
  }
  console.log('PASS: Same data returned after restart');
  console.log('  User:', user.id, user.displayName);
  console.log('  Primary chart:', chart.id, chart.label);
  console.log('  Group:', group.id, group.name);
  console.log('  Post:', testPost.id, testPost.title);
}

const cmd = process.argv[2] || 'seed';
if (cmd === 'seed') seed().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'verify') verify().catch((e) => { console.error(e); process.exit(1); });
else {
  console.error('Usage: node scripts/restart-test.js [seed|verify]');
  process.exit(1);
}
