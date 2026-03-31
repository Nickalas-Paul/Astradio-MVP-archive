/**
 * @import { test } from 'node:test';
 * @import assert from 'node:assert';
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  acceptMemberResponse,
  buildInitialResponseCollection,
  buildLockedParticipantRoster,
  orderedAcceptedResponses,
  resolveRosterMember,
} = require('../server/lib/campaign-group-resolve');

describe('campaign-group-resolve', () => {
  it('locks roster in canonical chart_id order', () => {
    const roster = buildLockedParticipantRoster([
      { user_id: 'user_b', chart_id: 'chart_b' },
      { user_id: 'user_a', chart_id: 'chart_a' },
    ]);
    assert.deepStrictEqual(roster, [
      { user_id: 'user_a', chart_id: 'chart_a', ordinal: 0 },
      { user_id: 'user_b', chart_id: 'chart_b', ordinal: 1 },
    ]);
  });

  it('accepts one response per member and treats exact replay as idempotent', () => {
    const roster = buildLockedParticipantRoster([
      { user_id: 'user_a', chart_id: 'chart_a' },
      { user_id: 'user_b', chart_id: 'chart_b' },
    ]);
    const initial = buildInitialResponseCollection(roster);
    const member = resolveRosterMember(roster, 'user_a').member;
    const choice = { id: 'choice_pause', patternTag: 'pause_observe' };

    const accepted = acceptMemberResponse({
      roster,
      collection: initial,
      member,
      choice,
      acceptedAt: '2026-03-31T00:00:00.000Z',
    });
    assert.strictEqual(accepted.status, 'accepted');
    assert.strictEqual(accepted.readiness.is_ready, false);

    const idempotent = acceptMemberResponse({
      roster,
      collection: accepted.collection,
      member,
      choice,
      acceptedAt: '2026-03-31T00:01:00.000Z',
    });
    assert.strictEqual(idempotent.status, 'idempotent');
    assert.deepStrictEqual(idempotent.collection, accepted.collection);
  });

  it('rejects conflicting second response from same member', () => {
    const roster = buildLockedParticipantRoster([
      { user_id: 'user_a', chart_id: 'chart_a' },
      { user_id: 'user_b', chart_id: 'chart_b' },
    ]);
    const initial = buildInitialResponseCollection(roster);
    const member = resolveRosterMember(roster, 'user_a').member;

    const accepted = acceptMemberResponse({
      roster,
      collection: initial,
      member,
      choice: { id: 'choice_pause', patternTag: 'pause_observe' },
      acceptedAt: '2026-03-31T00:00:00.000Z',
    });

    const conflict = acceptMemberResponse({
      roster,
      collection: accepted.collection,
      member,
      choice: { id: 'choice_push', patternTag: 'push_forward' },
      acceptedAt: '2026-03-31T00:01:00.000Z',
    });
    assert.strictEqual(conflict.status, 'conflict');
  });

  it('orders accepted responses by locked roster rather than arrival order', () => {
    const roster = buildLockedParticipantRoster([
      { user_id: 'user_b', chart_id: 'chart_b' },
      { user_id: 'user_a', chart_id: 'chart_a' },
    ]);
    const initial = buildInitialResponseCollection(roster);
    const acceptedB = acceptMemberResponse({
      roster,
      collection: initial,
      member: resolveRosterMember(roster, 'user_b').member,
      choice: { id: 'choice_b', patternTag: 'seek_counsel' },
      acceptedAt: '2026-03-31T00:00:00.000Z',
    });
    const acceptedA = acceptMemberResponse({
      roster,
      collection: acceptedB.collection,
      member: resolveRosterMember(roster, 'user_a').member,
      choice: { id: 'choice_a', patternTag: 'push_forward' },
      acceptedAt: '2026-03-31T00:01:00.000Z',
    });

    const ordered = orderedAcceptedResponses(roster, acceptedA.collection);
    assert.deepStrictEqual(ordered.map((entry) => entry.member_id), ['chart_a', 'chart_b']);
  });
});
