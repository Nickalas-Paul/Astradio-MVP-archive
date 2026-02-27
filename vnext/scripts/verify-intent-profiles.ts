#!/usr/bin/env node
/**
 * Phase 5 — Verify intent profiles config.
 * Lightweight validation script: loads config, asserts validations pass, weights sum to 1.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/verify-intent-profiles.js
 */

import {
  listIntentProfiles,
  getIntentProfileById,
  getIntentProfileBySlug,
} from '../relational/intent-profiles';

const REQUIRED_SLUGS = [
  'romantic',
  'friendship',
  'creative_collaboration',
  'growth_mirror',
  'oppositional_catalyst',
  'study_partner',
];

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-intent-profiles] FAIL: ${msg}`);
    process.exit(1);
  }
}

function main(): void {
  console.log('[verify-intent-profiles] Loading intent profiles...');
  const profiles = listIntentProfiles();
  assert(profiles.length > 0, 'At least one profile required');
  assert(profiles.length >= REQUIRED_SLUGS.length, `Expected at least ${REQUIRED_SLUGS.length} profiles`);

  for (const p of profiles) {
    const sum =
      p.facet_weights.overall +
      p.facet_weights.elemental +
      p.facet_weights.tension +
      p.facet_weights.preference;
    assert(Math.abs(sum - 1) < 1e-6, `Profile ${p.slug}: facet_weights must sum to 1.0 (got ${sum})`);
    assert(p.profile_hash.length === 64, `Profile ${p.slug}: profile_hash must be 64-char hex`);
  }

  for (const slug of REQUIRED_SLUGS) {
    const p = getIntentProfileBySlug(slug);
    assert(p.slug === slug, `getIntentProfileBySlug(${slug}) returned wrong slug`);
    const byId = getIntentProfileById(p.id);
    assert(byId.id === p.id, 'getIntentProfileById returned different profile');
  }

  try {
    getIntentProfileBySlug('nonexistent_slug_xyz');
    assert(false, 'getIntentProfileBySlug must throw for missing slug');
  } catch {
    /* expected */
  }

  console.log('[verify-intent-profiles] All validations passed.');
  process.exit(0);
}

main();
