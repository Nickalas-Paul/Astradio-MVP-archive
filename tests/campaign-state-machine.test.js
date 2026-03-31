/**
 * @import { test } from 'node:test';
 * @import assert from 'node:assert';
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('campaign state-machine attribution', () => {
  it('preserves shared mutation behavior and adds member attribution under one state object', async () => {
    const { applyOutcome } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

    const initial = {
      tone_track: { neutral: 1 },
      domain_track: {},
      chapter: 1,
      flags: [],
      history: [],
    };

    const next = applyOutcome(initial, {
      turn_id: 'camp:2026-03-31:chart_a',
      choice_id: 'choice_push',
      outcome_patch_id: 'patch_increase_identity_resolve',
      tone_tag: 'conflict',
      actor_chart_id: 'chart_a',
    });

    assert.strictEqual(next.chapter, 2);
    assert.strictEqual(next.domain_track.identity_heat, 0.2);
    assert.strictEqual(next.tone_track.conflict, 0.5);
    assert.ok(next.flags.includes('seen:patch_increase_identity_resolve'));
    assert.ok(next.members);
    assert.deepStrictEqual(Object.keys(next.members), ['chart_a']);
    assert.strictEqual(next.members.chart_a.domain_track.identity_heat, 0.2);
    assert.strictEqual(next.members.chart_a.tone_track.conflict, 0.5);
    assert.ok(next.members.chart_a.flags.includes('seen:patch_increase_identity_resolve'));
  });

  it('applies bounded domain-aware patch directions without introducing a second mutation path', async () => {
    const { applyOutcome } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

    const initial = {
      tone_track: { neutral: 1 },
      domain_track: {},
      chapter: 1,
      flags: [],
      history: [],
      members: {},
    };

    const next = applyOutcome(initial, {
      turn_id: 'camp:2026-03-31:chart_a',
      choice_id: 'choice_assert',
      outcome_patch_id: 'patch_assert_define_partnership',
      tone_tag: 'conflict',
      actor_chart_id: 'chart_a',
    });

    assert.strictEqual(next.domain_track['domain:partnership:clarity'], 0.2);
    assert.strictEqual(next.domain_track['domain:partnership:agency'], 0.2);
    assert.strictEqual(next.domain_track['domain:partnership:pressure'], 0.1);
    assert.ok(next.flags.includes('direction:assert_define'));
    assert.ok(next.flags.includes('domain:partnership'));
    assert.strictEqual(next.members.chart_a.domain_track['domain:partnership:clarity'], 0.2);
  });

  it('remains deterministic for the same attributed input sequence', async () => {
    const { applyOutcome } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

    const initial = {
      tone_track: { neutral: 1 },
      domain_track: {},
      chapter: 1,
      flags: [],
      history: [],
      members: {},
    };

    const sequence = [
      {
        turn_id: 'camp:2026-03-31:chart_a',
        choice_id: 'choice_a',
        outcome_patch_id: 'patch_strengthen_bond',
        tone_tag: 'invitation',
        actor_chart_id: 'chart_a',
      },
      {
        turn_id: 'camp:2026-03-31:chart_b',
        choice_id: 'choice_b',
        outcome_patch_id: 'patch_defer_decision',
        tone_tag: 'confusion',
        actor_chart_id: 'chart_b',
      },
    ];

    const run = () => sequence.reduce((state, outcome) => applyOutcome(state, outcome), initial);
    assert.deepStrictEqual(run(), run());
  });
});
