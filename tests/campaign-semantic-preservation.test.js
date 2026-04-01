const { describe, it } = require('node:test');
const assert = require('node:assert');

function makeSnapshot(ts, offset = 0) {
  const names = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  return {
    ts,
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: names.map((name, index) => ({ name, lon: (index * 30 + 5 + offset) % 360 })),
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function makePressureEvent(overrides = {}) {
  return {
    pressure_event_id: overrides.pressure_event_id || `ev_${Math.random().toString(16).slice(2)}`,
    source_mode: 'solo',
    campaign_id: 'camp_semantic',
    date: '2026-04-01',
    transit_body: 'moon',
    natal_body: 'mars',
    aspect_type: 'square',
    natal_house: 7,
    domain_id: 'partnership',
    pressure_family: 'emotional',
    pressure_polarity: 'frictional',
    interaction_hint: 'none',
    actual_orb_deg: 1,
    allowed_orb_deg: 6,
    aspect_weight: 0.9,
    orb_score: 0.9,
    source_weight: 0.9,
    recurrence_weight: 1,
    emphasis_weight: 1.15,
    intensity_score: 0.7,
    intensity_band: 'high',
    exactness_score: 0.9,
    target_priority_score: 0.8,
    activated_trait_ids: ['eligibility_trait_phase1_v1:mars:7:cardinal'],
    identity_modifier_ids: ['identity:natal_body:mars', 'identity:natal_house:7', 'identity:domain:partnership'],
    mechanic_tags: [
      'aspect_type:square',
      'domain:partnership',
      'intensity:high',
      'natal_body:mars',
      'natal_house:7',
      'polarity:frictional',
      'source_mode:solo',
      'transit_body:moon',
    ],
    provenance: {
      transit_snapshot_hash: 'transit_hash',
      natal_snapshot_hash: 'natal_hash',
      cross_aspect_hash: 'cross_hash',
      engine_version: 'campaign_phase1_v1',
      rules_version: 'campaign_contract_v1',
    },
    ...overrides,
  };
}

async function buildSemanticCore(snapshot) {
  const { encodeFeatures } = await import('../dist/vnext/vnext/feature-encode.js');
  const { guidanceFromFeatures } = await import('../dist/vnext/vnext/astro/guidance.js');
  const { buildCanonicalReportForSnapshotSurface } = await import('../dist/vnext/vnext/canonical/build-from-compose-context.js');
  const { interpretCanonicalReportObject } = await import('../dist/vnext/vnext/semantic/semantic-authority.js');

  const featureVec = encodeFeatures(snapshot);
  const guidance = guidanceFromFeatures(featureVec, snapshot, 'semantic-preservation-test');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['semantic-preservation-test'],
    snapshot,
    featureVec,
    control_surface_hash: 'semantic-preservation-test',
    compose_seed: 'semantic-preservation-test',
    guidance,
  });
  return interpretCanonicalReportObject(canonical);
}

describe('campaign semantic preservation', () => {
  it('preserves required primary and supporting semantics in daily pressure state', async () => {
    const { buildDailyPressureState } = await import('../dist/vnext/vnext/campaign/phase1/build-daily-pressure-state.js');

    const primary = makePressureEvent({
      pressure_event_id: 'primary',
      transit_body: 'moon',
      natal_body: 'mars',
      natal_house: 7,
      aspect_type: 'square',
      pressure_polarity: 'frictional',
      intensity_score: 0.81,
      intensity_band: 'critical',
      domain_id: 'partnership',
    });
    const support = makePressureEvent({
      pressure_event_id: 'support',
      transit_body: 'saturn',
      natal_body: 'venus',
      natal_house: 11,
      aspect_type: 'trine',
      pressure_polarity: 'binding',
      intensity_score: 0.62,
      intensity_band: 'high',
      pressure_family: 'constraint',
      domain_id: 'community',
      activated_trait_ids: ['eligibility_trait_phase1_v1:venus:11:fixed'],
      identity_modifier_ids: ['identity:natal_body:venus', 'identity:natal_house:11', 'identity:domain:community'],
    });

    const result = buildDailyPressureState({
      campaign_id: 'camp_semantic',
      mode: 'solo',
      date: '2026-04-01',
      events: [support, primary],
    });

    assert.strictEqual(result.ok, true);
    const state = result.state;
    assert.strictEqual(state.primary_pressure_event_id, 'primary');
    assert.strictEqual(state.primary_transit_body, 'moon');
    assert.strictEqual(state.primary_natal_body, 'mars');
    assert.strictEqual(state.primary_natal_house, 7);
    assert.strictEqual(state.primary_aspect_type, 'square');
    assert.strictEqual(state.primary_pressure_polarity, 'frictional');
    assert.strictEqual(state.supporting_pressures[0].natal_body, 'venus');
    assert.strictEqual(state.supporting_pressures[0].natal_house, 11);
    assert.strictEqual(state.supporting_pressures[0].aspect_type, 'trine');
    assert.strictEqual(state.supporting_pressures[0].pressure_polarity, 'binding');
    assert.strictEqual(state.supporting_pressures[0].intensity_band, 'high');
  });

  it('keeps primary pressure consistent during materialization even when support is stronger', async () => {
    const { materializeCampaignDaily } = await import('../dist/vnext/vnext/campaign/materialize-daily.js');

    const primary = makePressureEvent({
      pressure_event_id: 'primary_consistent',
      transit_body: 'venus',
      natal_body: 'mars',
      natal_house: 7,
      aspect_type: 'trine',
      pressure_polarity: 'constructive',
      pressure_family: 'value',
      domain_id: 'partnership',
      intensity_score: 0.52,
      intensity_band: 'moderate',
    });
    const support = makePressureEvent({
      pressure_event_id: 'support_stronger',
      transit_body: 'saturn',
      natal_body: 'saturn',
      natal_house: 10,
      aspect_type: 'square',
      pressure_polarity: 'frictional',
      pressure_family: 'constraint',
      domain_id: 'career',
      intensity_score: 0.93,
      intensity_band: 'critical',
    });

    const resolution = {
      campaign_id: 'camp_semantic',
      mode: 'solo',
      date: '2026-04-01',
      character_sheet_id: 'char_sheet_test',
      pressure_events: [primary, support],
      daily_pressure_state: {
        daily_pressure_state_id: 'daily_semantic',
        campaign_id: 'camp_semantic',
        mode: 'solo',
        date: '2026-04-01',
        primary_pressure_event_id: 'primary_consistent',
        primary_transit_body: primary.transit_body,
        primary_natal_body: primary.natal_body,
        primary_natal_house: primary.natal_house,
        primary_aspect_type: primary.aspect_type,
        primary_pressure_family: primary.pressure_family,
        primary_pressure_polarity: primary.pressure_polarity,
        primary_domain_id: primary.domain_id,
        primary_intensity_score: primary.intensity_score,
        primary_intensity_band: primary.intensity_band,
        supporting_pressures: [
          {
            pressure_event_id: 'support_stronger',
            member_chart_id: undefined,
            intensity_score: support.intensity_score,
            pressure_family: support.pressure_family,
            domain_id: support.domain_id,
            natal_body: support.natal_body,
            natal_house: support.natal_house,
            aspect_type: support.aspect_type,
            pressure_polarity: support.pressure_polarity,
            intensity_band: support.intensity_band,
          },
        ],
        interaction_type: 'cross_pressuring',
        activated_trait_ids: ['eligibility_trait_phase1_v1:mars:7:cardinal'],
        identity_modifier_ids: ['identity:natal_body:mars'],
        mechanic_tags: ['natal_body:mars'],
        carryover_bias: 0,
        uncertainty_modifier: 0,
        event_count: 2,
        eligible_event_count: 2,
        ranking_trace: {
          candidate_pressure_event_ids: ['primary_consistent', 'support_stronger'],
          filtered_out_event_ids: [],
          merged_cluster_ids: [],
          tie_break_rule_applied: 'none',
        },
        provenance: {
          pressure_event_set_hash: 'set_hash',
          engine_version: 'campaign_phase1_v1',
          rules_version: 'campaign_contract_v1',
        },
      },
      state_hash_before: 'state_before',
      trait_derivation_mode: 'phase1_synthetic_v1',
      provenance: {
        engine_version: 'campaign_phase1_v1',
        rules_version: 'campaign_contract_v1',
        transit_snapshot_hash: 'transit_hash',
      },
    };

    const materialized = await materializeCampaignDaily({
      resolution,
      state: { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] },
      natalSnapshot: makeSnapshot('1990-01-01T12:00:00Z', 0),
      transitSnapshot: makeSnapshot('2026-04-01T12:00:00Z', 15),
    });

    assert.strictEqual(materialized.challenge.primaryPressure.id, 'primary_consistent');
    assert.strictEqual(materialized.challenge_archetype.primary_pressure_event_id, 'primary_consistent');
  });

  it('keeps archetype domain family stable while differentiating body and aspect semantics', async () => {
    const { materializeCampaignDaily } = await import('../dist/vnext/vnext/campaign/materialize-daily.js');

    const baseState = { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] };
    const natalSnapshot = makeSnapshot('1990-01-01T12:00:00Z', 0);
    const transitSnapshot = makeSnapshot('2026-04-01T12:00:00Z', 15);
    const baseResolution = {
      campaign_id: 'camp_semantic',
      mode: 'solo',
      date: '2026-04-01',
      character_sheet_id: 'char_sheet_test',
      state_hash_before: 'state_before',
      trait_derivation_mode: 'phase1_synthetic_v1',
      provenance: {
        engine_version: 'campaign_phase1_v1',
        rules_version: 'campaign_contract_v1',
        transit_snapshot_hash: 'transit_hash',
      },
    };

    const marsPrimary = makePressureEvent({
      pressure_event_id: 'mars_primary',
      transit_body: 'moon',
      natal_body: 'mars',
      natal_house: 7,
      aspect_type: 'square',
      pressure_polarity: 'frictional',
      intensity_score: 0.81,
      intensity_band: 'critical',
      domain_id: 'partnership',
    });
    const venusPrimary = makePressureEvent({
      pressure_event_id: 'venus_primary',
      transit_body: 'venus',
      natal_body: 'venus',
      natal_house: 7,
      aspect_type: 'trine',
      pressure_polarity: 'constructive',
      pressure_family: 'value',
      intensity_score: 0.51,
      intensity_band: 'moderate',
      domain_id: 'partnership',
    });
    const marsTrinePrimary = makePressureEvent({
      pressure_event_id: 'mars_trine_primary',
      transit_body: 'moon',
      natal_body: 'mars',
      natal_house: 7,
      aspect_type: 'trine',
      pressure_polarity: 'constructive',
      pressure_family: 'value',
      intensity_score: 0.49,
      intensity_band: 'moderate',
      domain_id: 'partnership',
    });

    const buildResolution = (primary) => ({
      ...baseResolution,
      pressure_events: [primary],
      daily_pressure_state: {
        daily_pressure_state_id: `daily_${primary.pressure_event_id}`,
        campaign_id: 'camp_semantic',
        mode: 'solo',
        date: '2026-04-01',
        primary_pressure_event_id: primary.pressure_event_id,
        primary_transit_body: primary.transit_body,
        primary_natal_body: primary.natal_body,
        primary_natal_house: primary.natal_house,
        primary_aspect_type: primary.aspect_type,
        primary_pressure_family: primary.pressure_family,
        primary_pressure_polarity: primary.pressure_polarity,
        primary_domain_id: primary.domain_id,
        primary_intensity_score: primary.intensity_score,
        primary_intensity_band: primary.intensity_band,
        supporting_pressures: [],
        interaction_type: 'none',
        activated_trait_ids: primary.activated_trait_ids,
        identity_modifier_ids: primary.identity_modifier_ids,
        mechanic_tags: primary.mechanic_tags,
        carryover_bias: 0,
        uncertainty_modifier: 0,
        event_count: 1,
        eligible_event_count: 1,
        ranking_trace: {
          candidate_pressure_event_ids: [primary.pressure_event_id],
          filtered_out_event_ids: [],
          merged_cluster_ids: [],
          tie_break_rule_applied: 'none',
        },
        provenance: {
          pressure_event_set_hash: `set_${primary.pressure_event_id}`,
          engine_version: 'campaign_phase1_v1',
          rules_version: 'campaign_contract_v1',
        },
      },
    });

    const marsMaterialized = await materializeCampaignDaily({
      resolution: buildResolution(marsPrimary),
      state: baseState,
      natalSnapshot,
      transitSnapshot,
    });
    const venusMaterialized = await materializeCampaignDaily({
      resolution: buildResolution(venusPrimary),
      state: baseState,
      natalSnapshot,
      transitSnapshot,
    });
    const marsTrineMaterialized = await materializeCampaignDaily({
      resolution: buildResolution(marsTrinePrimary),
      state: baseState,
      natalSnapshot,
      transitSnapshot,
    });

    assert.strictEqual(marsMaterialized.challenge_archetype.archetype_id, 'bond_friction');
    assert.strictEqual(venusMaterialized.challenge_archetype.archetype_id, 'bond_repair');
    assert.strictEqual(marsTrineMaterialized.challenge_archetype.archetype_id, 'bond_repair');
    assert.notDeepStrictEqual(
      marsMaterialized.response_paths.map((path) => path.posture),
      venusMaterialized.response_paths.map((path) => path.posture),
    );
    assert.notDeepStrictEqual(
      marsMaterialized.response_paths.map((path) => path.posture),
      marsTrineMaterialized.response_paths.map((path) => path.posture),
    );
  });

  it('produces different downstream behavior for house, natal-body, aspect, and support changes while remaining deterministic', async () => {
    const { buildChallengeScene } = await import('../dist/vnext/vnext/rpg/challenge-generator.js');

    const character = {
      id: 'char',
      classSlug: 'class_test',
      subclassSlug: 'subclass_test',
      risingModifierSlug: 'rising_test',
      primaryElement: 'fire',
      tonalPolarity: 'balanced',
      motionProfile: 'steady',
      gravityProfile: 'grounded',
      luminaryWeight: 'balanced',
      dominantPlanets: ['sun'],
      angularEmphasis: { first: true, fourth: false, seventh: true, tenth: false },
      temperament: {
        will: 0.5,
        insight: 0.5,
        attunement: 0.5,
        courage: 0.5,
        discipline: 0.5,
        adaptability: 0.5,
        bond: 0.5,
        shadowCapacity: 0.5,
        radiance: 0.5,
      },
      signatureDomains: [{ domain: 'partnership', weight: 1 }],
    };
    const state = { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] };
    const natalSnapshot = makeSnapshot('1990-01-01T12:00:00Z', 0);
    const transitSnapshot = makeSnapshot('2026-04-01T12:00:00Z', 15);
    const semanticCore = await buildSemanticCore(natalSnapshot);

    const basePrimary = {
      id: 'primary',
      transitBody: 'moon',
      natalBody: 'mars',
      natalHouse: 7,
      aspectType: 'square',
      domain: 'partnership',
      pressureFamily: 'emotional',
      type: 'conflict',
      intensity: 0.8,
      intensityBand: 'high',
      lifeArea: 'relationships',
      likelyShadowPattern: 'phase1_shadow:frictional',
      growthPath: 'phase1_growth:none',
      contributingDomains: [],
    };

    const mars7 = buildChallengeScene({
      character,
      pressures: [basePrimary],
      state,
      semanticCore,
      natalSnapshot,
      transitSnapshot,
      challengeContext: {
        archetypeCategory: 'bond_friction',
        archetypeId: 'bond_friction',
        pressurePolarity: 'frictional',
        intensityBand: 'high',
        natalBodyModifier: 'volitional',
      },
    });
    const mars10 = buildChallengeScene({
      character,
      pressures: [{ ...basePrimary, natalHouse: 10, domain: 'career', lifeArea: 'career_visibility' }],
      state,
      semanticCore,
      natalSnapshot,
      transitSnapshot,
      challengeContext: {
        archetypeCategory: 'duty_pressure',
        archetypeId: 'duty_pressure',
        pressurePolarity: 'frictional',
        intensityBand: 'high',
        natalBodyModifier: 'volitional',
      },
    });
    const venus7 = buildChallengeScene({
      character,
      pressures: [{ ...basePrimary, natalBody: 'venus', pressureFamily: 'value', type: 'invitation' }],
      state,
      semanticCore,
      natalSnapshot,
      transitSnapshot,
      challengeContext: {
        archetypeCategory: 'bond_repair',
        archetypeId: 'bond_repair',
        pressurePolarity: 'constructive',
        intensityBand: 'moderate',
        natalBodyModifier: 'relational',
      },
    });
    const mars7Trine = buildChallengeScene({
      character,
      pressures: [{ ...basePrimary, aspectType: 'trine', type: 'invitation', likelyShadowPattern: 'phase1_shadow:constructive' }],
      state,
      semanticCore,
      natalSnapshot,
      transitSnapshot,
      challengeContext: {
        archetypeCategory: 'bond_repair',
        archetypeId: 'bond_repair',
        pressurePolarity: 'constructive',
        intensityBand: 'moderate',
        natalBodyModifier: 'volitional',
      },
    });
    const withSupport = buildChallengeScene({
      character,
      pressures: [
        basePrimary,
        {
          ...basePrimary,
          id: 'support',
          natalBody: 'venus',
          natalHouse: 11,
          intensity: 0.7,
          intensityBand: 'high',
          likelyShadowPattern: 'phase1_shadow:constructive',
          type: 'invitation',
        },
      ],
      state,
      semanticCore,
      natalSnapshot,
      transitSnapshot,
      challengeContext: {
        archetypeCategory: 'bond_friction',
        archetypeId: 'bond_friction',
        pressurePolarity: 'frictional',
        intensityBand: 'high',
        natalBodyModifier: 'volitional',
        supportingNatalBodyModifiers: ['relational'],
      },
    });

    assert.ok(mars7 && mars10 && venus7 && mars7Trine && withSupport);
    assert.notDeepStrictEqual(mars7.choices.map((choice) => choice.id), mars10.choices.map((choice) => choice.id));
    assert.notDeepStrictEqual(mars7.choices.map((choice) => choice.id), venus7.choices.map((choice) => choice.id));
    assert.notDeepStrictEqual(mars7.choices.map((choice) => choice.id), mars7Trine.choices.map((choice) => choice.id));
    assert.notDeepStrictEqual(mars7.choices.map((choice) => choice.id), withSupport.choices.map((choice) => choice.id));
    assert.deepStrictEqual(
      buildChallengeScene({
        character,
        pressures: [basePrimary],
        state,
        semanticCore,
        natalSnapshot,
        transitSnapshot,
        challengeContext: {
          archetypeCategory: 'bond_friction',
          archetypeId: 'bond_friction',
          pressurePolarity: 'frictional',
          intensityBand: 'high',
          natalBodyModifier: 'volitional',
        },
      }),
      mars7,
    );
  });

  it('keeps support influence bounded and preserves posture coverage', async () => {
    const { buildChallengeScene } = await import('../dist/vnext/vnext/rpg/challenge-generator.js');

    const character = {
      id: 'char',
      classSlug: 'class_test',
      subclassSlug: 'subclass_test',
      risingModifierSlug: 'rising_test',
      primaryElement: 'fire',
      tonalPolarity: 'balanced',
      motionProfile: 'steady',
      gravityProfile: 'grounded',
      luminaryWeight: 'balanced',
      dominantPlanets: ['sun'],
      angularEmphasis: { first: true, fourth: false, seventh: true, tenth: false },
      temperament: {
        will: 0.5,
        insight: 0.5,
        attunement: 0.5,
        courage: 0.5,
        discipline: 0.5,
        adaptability: 0.5,
        bond: 0.5,
        shadowCapacity: 0.5,
        radiance: 0.5,
      },
      signatureDomains: [{ domain: 'partnership', weight: 1 }],
    };
    const state = { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] };
    const natalSnapshot = makeSnapshot('1990-01-01T12:00:00Z', 0);
    const transitSnapshot = makeSnapshot('2026-04-01T12:00:00Z', 15);
    const semanticCore = await buildSemanticCore(natalSnapshot);

    const scene = buildChallengeScene({
      character,
      pressures: [
        {
          id: 'primary',
          transitBody: 'moon',
          natalBody: 'mars',
          natalHouse: 7,
          aspectType: 'square',
          domain: 'partnership',
          pressureFamily: 'emotional',
          type: 'conflict',
          intensity: 0.8,
          intensityBand: 'high',
          lifeArea: 'relationships',
          likelyShadowPattern: 'phase1_shadow:frictional',
          growthPath: 'phase1_growth:none',
          contributingDomains: [],
        },
        {
          id: 'support_1',
          transitBody: 'venus',
          natalBody: 'venus',
          natalHouse: 11,
          aspectType: 'trine',
          domain: 'community',
          pressureFamily: 'value',
          type: 'invitation',
          intensity: 0.76,
          intensityBand: 'high',
          lifeArea: 'community',
          likelyShadowPattern: 'phase1_shadow:constructive',
          growthPath: 'phase1_growth:none',
          contributingDomains: [],
        },
        {
          id: 'support_2',
          transitBody: 'jupiter',
          natalBody: 'moon',
          natalHouse: 11,
          aspectType: 'trine',
          domain: 'community',
          pressureFamily: 'expansion',
          type: 'invitation',
          intensity: 0.77,
          intensityBand: 'high',
          lifeArea: 'community',
          likelyShadowPattern: 'phase1_shadow:constructive',
          growthPath: 'phase1_growth:none',
          contributingDomains: [],
        },
      ],
      state,
      semanticCore,
      natalSnapshot,
      transitSnapshot,
      challengeContext: {
        archetypeCategory: 'bond_friction',
        archetypeId: 'bond_friction',
        pressurePolarity: 'frictional',
        intensityBand: 'high',
        natalBodyModifier: 'volitional',
        supportingNatalBodyModifiers: ['relational', 'felt'],
      },
    });

    assert.ok(scene);
    const postures = scene.choices.map((choice) => choice.posture);
    assert.ok(postures.length >= 4 && postures.length <= 5);
    assert.strictEqual(new Set(postures).size, postures.length);
    assert.ok(postures.includes('support'));
    assert.ok(postures.some((posture) => ['observe', 'withdraw', 'contain'].includes(posture)));
    assert.ok(postures.some((posture) => ['assert', 'engage', 'offer'].includes(posture)));
  });

  it('records semantic provenance in flags and history without changing state shape', async () => {
    const { applyOutcome } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

    const next = applyOutcome(
      { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] },
      {
        turn_id: 'camp:2026-04-01:chart_a',
        choice_id: 'pause_observe',
        outcome_patch_id: 'patch_observe_hold_partnership',
        actor_chart_id: 'chart_a',
        archetype_id: 'bond_friction',
        pressure_polarity: 'frictional',
        intensity_band: 'high',
        transit_body: 'moon',
        natal_body: 'mars',
        natal_house: 7,
        aspect_type: 'square',
      },
    );

    assert.ok(next.flags.includes('transit_body:moon'));
    assert.ok(next.flags.includes('natal_body:mars'));
    assert.ok(next.flags.includes('natal_house:7'));
    assert.ok(next.flags.includes('aspect_type:square'));
    assert.ok(next.flags.includes('tone:ambiguity'));
    assert.ok(next.flags.includes('climate:observe_hold'));
    assert.ok(next.history.some((entry) => entry === 'hs:moon:mars:7:square'));
    assert.ok(next.history.some((entry) => entry === 'hc:observe_hold:ambiguity'));
    assert.ok(next.members.chart_a.history.length <= 8);
    assert.ok(next.history.length <= 10);
    assert.ok(Object.prototype.hasOwnProperty.call(next, 'tone_track'));
    assert.ok(Object.prototype.hasOwnProperty.call(next, 'domain_track'));
    assert.ok(Object.prototype.hasOwnProperty.call(next, 'flags'));
    assert.ok(Object.prototype.hasOwnProperty.call(next, 'history'));
    assert.ok(!Object.prototype.hasOwnProperty.call(next, 'semantic_provenance'));
  });

  it('keeps patch vocabulary bounded and adds momentum only for engage outcomes', async () => {
    const { applyOutcome } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

    const engaged = applyOutcome(
      { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] },
      {
        turn_id: 'camp:2026-04-01:chart_a',
        choice_id: 'push_forward',
        outcome_patch_id: 'patch_engage_advance_career',
        actor_chart_id: 'chart_a',
      },
    );
    const observed = applyOutcome(
      { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] },
      {
        turn_id: 'camp:2026-04-01:chart_a',
        choice_id: 'pause_observe',
        outcome_patch_id: 'patch_observe_hold_career',
        actor_chart_id: 'chart_a',
      },
    );

    const engagedKeys = Object.keys(engaged.domain_track);
    const observedKeys = Object.keys(observed.domain_track);
    assert.ok(engagedKeys.includes('domain:career:momentum'));
    assert.ok(!observedKeys.includes('domain:career:momentum'));
    for (const key of engagedKeys.concat(observedKeys)) {
      assert.match(key, /^domain:[a-z_]+:(pressure|clarity|agency|boundary|trust|repair|integration|momentum)$/);
    }
  });
});
