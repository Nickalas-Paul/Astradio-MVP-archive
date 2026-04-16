/**
 * Campaign daily theme lead: sourced from DailyPressureState + PressureEvent, not natal projection lead.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('campaign daily theme source', () => {
  it('buildCampaignDailyThemeLead is deterministic for identical inputs', async () => {
    const { buildCampaignDailyThemeLead } = await import('../dist/vnext/vnext/campaign/campaign-daily-theme-lead.js');
    const narration = makeNarrationFixture({ interaction: 'none', supportingCount: 0 });
    const seed = 'dps_test|2026-04-21|ch1';
    const a = buildCampaignDailyThemeLead({ narration, seed });
    const b = buildCampaignDailyThemeLead({ narration, seed });
    assert.strictEqual(a, b);
  });

  it('theme lead reflects primary geometry and domain (present-tense daily truth)', async () => {
    const { buildCampaignDailyThemeLead } = await import('../dist/vnext/vnext/campaign/campaign-daily-theme-lead.js');
    const narration = makeNarrationFixture({ interaction: 'none', supportingCount: 0 });
    const t = buildCampaignDailyThemeLead({ narration, seed: 'dps_geom|2026-04-21|ch1' }).toLowerCase();
    assert.ok(t.includes('mars'), 'primary transit body');
    assert.ok(t.includes('venus'), 'primary natal body');
    assert.ok(t.includes('square'), 'primary aspect');
    assert.ok(t.includes('partnership') || t.includes('reciprocity'), 'primary domain human label');
    assert.ok(t.includes('conflict'), 'primary pressure family');
  });

  it('includes distinct supporting pressures beyond a count', async () => {
    const { buildCampaignDailyThemeLead } = await import('../dist/vnext/vnext/campaign/campaign-daily-theme-lead.js');
    const narration = makeNarrationFixture({ interaction: 'none', supportingCount: 2 });
    const t = buildCampaignDailyThemeLead({ narration, seed: 'dps_sup|2026-04-21|ch1' }).toLowerCase();
    assert.ok(t.includes('communication') || t.includes('wording'), 'first supporting domain');
    assert.ok(t.includes('community') || t.includes('belonging'), 'second supporting domain');
    assert.ok(t.includes('mercury'), 'supporting transit body');
    assert.ok(t.includes('saturn'), 'second supporting transit body');
  });

  it('includes interaction_type when pooled relation is not none', async () => {
    const { buildCampaignDailyThemeLead } = await import('../dist/vnext/vnext/campaign/campaign-daily-theme-lead.js');
    const narration = makeNarrationFixture({ interaction: 'cross_pressuring', supportingCount: 1 });
    const t = buildCampaignDailyThemeLead({ narration, seed: 'dps_ix|2026-04-21|ch1' }).toLowerCase();
    assert.ok(t.includes('cross'), 'interaction narration');
  });

  it('materialized daily theme does not use projection fallback paragraph', async () => {
    const { materializeCampaignDaily } = await import('../dist/vnext/vnext/campaign/materialize-daily.js');
    const { CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH } = await import(
      '../dist/vnext/vnext/campaign/moment-level3-validation.js'
    );
    const natal = {
      ts: '1990-01-01T12:00:00Z',
      tz: 'UTC',
      lat: 40.7128,
      lon: -74.006,
      houseSystem: 'placidus',
      planets: [
        { name: 'Sun', lon: 15 },
        { name: 'Moon', lon: 45 },
        { name: 'Mercury', lon: 60 },
        { name: 'Venus', lon: 75 },
        { name: 'Mars', lon: 90 },
        { name: 'Jupiter', lon: 105 },
        { name: 'Saturn', lon: 120 },
        { name: 'Uranus', lon: 135 },
        { name: 'Neptune', lon: 150 },
        { name: 'Pluto', lon: 165 },
      ],
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
      aspects: [],
      moonPhase: 0.5,
      dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
    };
    const transit = { ...natal, ts: '2026-03-15T12:00:00Z' };
    const resolution = makeResolutionForMaterialize();
    const state = { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] };
    const m = await materializeCampaignDaily({ resolution, state, natalSnapshot: natal, transitSnapshot: transit });
    const theme = m.challenge.theme;
    assert.notStrictEqual(theme, CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH);
    assert.ok(!theme.includes('Saturn meets Sun through a square, with house 1 carrying the contact'));
    assert.ok(theme.toLowerCase().includes("today") || theme.toLowerCase().includes('lead pressure'));
  });
});

function makeNarrationFixture({ interaction, supportingCount }) {
  const primaryEvent = {
    pressure_event_id: 'pe_primary',
    source_mode: 'solo',
    campaign_id: 'camp_theme',
    date: '2026-04-21',
    transit_body: 'mars',
    natal_body: 'venus',
    aspect_type: 'square',
    natal_house: 7,
    domain_id: 'partnership',
    pressure_family: 'conflict',
    pressure_polarity: 'frictional',
    interaction_hint: 'none',
    actual_orb_deg: 1.2,
    allowed_orb_deg: 8,
    aspect_weight: 0.5,
    orb_score: 0.8,
    source_weight: 0.9,
    recurrence_weight: 1,
    emphasis_weight: 1,
    intensity_score: 0.72,
    intensity_band: 'high',
    exactness_score: 0.8,
    target_priority_score: 0.5,
    activated_trait_ids: ['t1'],
    identity_modifier_ids: [],
    mechanic_tags: [],
    provenance: {
      transit_snapshot_hash: 't',
      natal_snapshot_hash: 'n',
      cross_aspect_hash: 'x',
      engine_version: 'campaign_phase1_v1',
      rules_version: 'campaign_contract_v1',
    },
  };
  const supportingEvents = [];
  if (supportingCount >= 1) {
    supportingEvents.push({
      ...primaryEvent,
      pressure_event_id: 'pe_sup_a',
      transit_body: 'mercury',
      natal_body: 'moon',
      aspect_type: 'opposition',
      natal_house: 3,
      domain_id: 'communication',
      pressure_family: 'cognitive',
      pressure_polarity: 'frictional',
      intensity_band: 'moderate',
      intensity_score: 0.5,
    });
  }
  if (supportingCount >= 2) {
    supportingEvents.push({
      ...primaryEvent,
      pressure_event_id: 'pe_sup_b',
      transit_body: 'saturn',
      natal_body: 'jupiter',
      aspect_type: 'square',
      natal_house: 11,
      domain_id: 'community',
      pressure_family: 'constraint',
      pressure_polarity: 'binding',
      intensity_band: 'high',
      intensity_score: 0.68,
    });
  }
  const supporting_pressures = supportingEvents.map((e) => ({
    pressure_event_id: e.pressure_event_id,
    intensity_score: e.intensity_score,
    pressure_family: e.pressure_family,
    domain_id: e.domain_id,
    natal_body: e.natal_body,
    natal_house: e.natal_house,
    aspect_type: e.aspect_type,
    pressure_polarity: e.pressure_polarity,
    intensity_band: e.intensity_band,
  }));
  const dailyState = {
    daily_pressure_state_id: 'dps_theme_src',
    campaign_id: 'camp_theme',
    mode: 'solo',
    date: '2026-04-21',
    primary_pressure_event_id: primaryEvent.pressure_event_id,
    primary_transit_body: primaryEvent.transit_body,
    primary_natal_body: primaryEvent.natal_body,
    primary_natal_house: primaryEvent.natal_house,
    primary_aspect_type: primaryEvent.aspect_type,
    primary_pressure_family: primaryEvent.pressure_family,
    primary_pressure_polarity: primaryEvent.pressure_polarity,
    primary_domain_id: primaryEvent.domain_id,
    primary_intensity_score: primaryEvent.intensity_score,
    primary_intensity_band: primaryEvent.intensity_band,
    supporting_pressures,
    interaction_type: interaction,
    activated_trait_ids: ['t1'],
    identity_modifier_ids: [],
    mechanic_tags: [],
    carryover_bias: 0,
    uncertainty_modifier: 0,
    event_count: 1 + supportingCount,
    eligible_event_count: 1 + supportingCount,
    ranking_trace: {
      candidate_pressure_event_ids: [primaryEvent.pressure_event_id],
      filtered_out_event_ids: [],
      merged_cluster_ids: [],
      tie_break_rule_applied: 'none',
    },
    provenance: {
      pressure_event_set_hash: 'set',
      engine_version: 'campaign_phase1_v1',
      rules_version: 'campaign_contract_v1',
    },
  };
  return { dailyState, primaryEvent, supportingEvents };
}

function makeResolutionForMaterialize() {
  const primaryEvent = {
    pressure_event_id: 'pe_mat',
    source_mode: 'solo',
    campaign_id: 'camp_mat',
    date: '2026-04-22',
    transit_body: 'mars',
    natal_body: 'venus',
    aspect_type: 'square',
    natal_house: 7,
    domain_id: 'partnership',
    pressure_family: 'conflict',
    pressure_polarity: 'frictional',
    interaction_hint: 'none',
    actual_orb_deg: 1.0,
    allowed_orb_deg: 8,
    aspect_weight: 0.5,
    orb_score: 0.8,
    source_weight: 0.9,
    recurrence_weight: 1,
    emphasis_weight: 1,
    intensity_score: 0.72,
    intensity_band: 'high',
    exactness_score: 0.8,
    target_priority_score: 0.5,
    activated_trait_ids: ['t1'],
    identity_modifier_ids: [],
    mechanic_tags: [],
    provenance: {
      transit_snapshot_hash: 't',
      natal_snapshot_hash: 'n',
      cross_aspect_hash: 'x',
      engine_version: 'campaign_phase1_v1',
      rules_version: 'campaign_contract_v1',
    },
  };
  return {
    campaign_id: 'camp_mat',
    mode: 'solo',
    date: '2026-04-22',
    character_sheet_id: 'char_sheet_test',
    state_hash_before: 'state_before',
    trait_derivation_mode: 'phase1_synthetic_v1',
    pressure_events: [primaryEvent],
    daily_pressure_state: {
      daily_pressure_state_id: 'dps_mat',
      campaign_id: 'camp_mat',
      mode: 'solo',
      date: '2026-04-22',
      primary_pressure_event_id: primaryEvent.pressure_event_id,
      primary_transit_body: primaryEvent.transit_body,
      primary_natal_body: primaryEvent.natal_body,
      primary_natal_house: primaryEvent.natal_house,
      primary_aspect_type: primaryEvent.aspect_type,
      primary_pressure_family: primaryEvent.pressure_family,
      primary_pressure_polarity: primaryEvent.pressure_polarity,
      primary_domain_id: primaryEvent.domain_id,
      primary_intensity_score: primaryEvent.intensity_score,
      primary_intensity_band: primaryEvent.intensity_band,
      supporting_pressures: [],
      interaction_type: 'none',
      activated_trait_ids: ['t1'],
      identity_modifier_ids: [],
      mechanic_tags: [],
      carryover_bias: 0,
      uncertainty_modifier: 0,
      event_count: 1,
      eligible_event_count: 1,
      ranking_trace: {
        candidate_pressure_event_ids: [primaryEvent.pressure_event_id],
        filtered_out_event_ids: [],
        merged_cluster_ids: [],
        tie_break_rule_applied: 'none',
      },
      provenance: {
        pressure_event_set_hash: 'set_mat',
        engine_version: 'campaign_phase1_v1',
        rules_version: 'campaign_contract_v1',
      },
    },
    provenance: {
      engine_version: 'campaign_phase1_v1',
      rules_version: 'campaign_contract_v1',
      transit_snapshot_hash: 't',
    },
  };
}
