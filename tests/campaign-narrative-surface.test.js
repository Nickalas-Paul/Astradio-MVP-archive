/**
 * Campaign surface realization, identity slate shaping, and outcome posture history.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('campaign narrative surface', () => {
  it('records response posture on resolve history for future slate shaping', async () => {
    const { applyOutcome } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

    const initial = {
      tone_track: { neutral: 1 },
      domain_track: {},
      chapter: 1,
      flags: [],
      history: [],
    };

    const next = applyOutcome(initial, {
      turn_id: 'camp:2026-05-01:turn',
      choice_id: 'pause_observe',
      outcome_patch_id: 'patch_observe_hold_self',
      response_posture: 'observe',
      response_pattern_tag: 'pause_observe',
    });

    const joined = (next.history || []).join('|');
    assert.ok(joined.includes('hp:observe'), 'shared history records posture trace');
  });

  it('materializes Campaign-facing prose without raw aspect tokens in persisted challenge strings', async () => {
    const { materializeCampaignDaily } = await import('../dist/vnext/vnext/campaign/materialize-daily.js');

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
    const transit = {
      ...natal,
      ts: '2026-03-15T12:00:00Z',
      planets: natal.planets,
      aspects: [{ bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 }],
      moonPhase: 0.7,
    };

    const resolution = {
      campaign_id: 'camp_narrative',
      mode: 'solo',
      date: '2026-04-20',
      character_sheet_id: 'char_sheet_test',
      state_hash_before: 'state_before',
      trait_derivation_mode: 'phase1_synthetic_v1',
      pressure_events: [
        {
          pressure_event_id: 'pe_narr',
          campaign_id: 'camp_narrative',
          date: '2026-04-20',
          source_mode: 'solo',
          member_chart_id: null,
          transit_body: 'mars',
          natal_body: 'venus',
          natal_house: 7,
          aspect_type: 'square',
          pressure_family: 'conflict',
          pressure_polarity: 'frictional',
          domain_id: 'partnership',
          intensity_score: 0.72,
          intensity_band: 'high',
          ranking_score: 1,
          engine_version: 'campaign_phase1_v1',
          rules_version: 'campaign_contract_v1',
          transit_snapshot_hash: 't',
          natal_snapshot_hash: 'n',
        },
      ],
      daily_pressure_state: {
        daily_pressure_state_id: 'dps_narrative',
        campaign_id: 'camp_narrative',
        mode: 'solo',
        date: '2026-04-20',
        primary_pressure_event_id: 'pe_narr',
        primary_transit_body: 'mars',
        primary_natal_body: 'venus',
        primary_natal_house: 7,
        primary_aspect_type: 'square',
        primary_pressure_family: 'conflict',
        primary_pressure_polarity: 'frictional',
        primary_domain_id: 'partnership',
        primary_intensity_score: 0.72,
        primary_intensity_band: 'high',
        supporting_pressures: [],
        interaction_type: 'none',
        activated_trait_ids: [],
        identity_modifier_ids: [],
        mechanic_tags: [],
        carryover_bias: 0,
        uncertainty_modifier: 0,
        event_count: 1,
        eligible_event_count: 1,
        ranking_trace: {
          candidate_pressure_event_ids: ['pe_narr'],
          filtered_out_event_ids: [],
          merged_cluster_ids: [],
          tie_break_rule_applied: 'none',
        },
        provenance: {
          pressure_event_set_hash: 'set_narr',
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

    const state = { tone_track: { neutral: 1 }, domain_track: {}, chapter: 1, flags: [], history: [] };
    const m = await materializeCampaignDaily({ resolution, state, natalSnapshot: natal, transitSnapshot: transit });
    const t = `${m.challenge.theme} ${m.challenge.obstacle} ${m.challenge.setting}`.toLowerCase();
    assert.ok(!/\b(square|conjunction|opposition|trine|sextile)\b/.test(t), 'raw aspect terms scrubbed from surface copy');
    assert.ok(!/\bhouse\s*\d+\b/.test(t), 'raw house index scrubbed from surface copy');
    assert.ok(m.challenge.choices.length >= 1, 'choices present');
    assert.ok(!m.challenge.choices[0].label.includes('Pause and observe'), 'labels are not generic posture-table defaults');
  });

  it('produces different response posture slates for different identity slugs (class + rising)', async () => {
    const { buildChallengeScene } = await import('../dist/vnext/vnext/rpg/challenge-generator.js');
    const { buildCampaignSlateContinuity } = await import('../dist/vnext/vnext/campaign/campaign-slate-continuity.js');
    const { encodeFeatures } = await import('../dist/vnext/vnext/feature-encode.js');
    const { guidanceFromFeatures } = await import('../dist/vnext/vnext/astro/guidance.js');
    const { buildCanonicalReportForSnapshotSurface } = await import(
      '../dist/vnext/vnext/canonical/build-from-compose-context.js'
    );
    const { interpretCanonicalReportObject } = await import('../dist/vnext/vnext/semantic/semantic-authority.js');
    const { buildCharacterProfile } = await import('../dist/vnext/vnext/rpg/character-builder.js');
    const { buildRpgEffectsBundleFromSnapshot } = await import('../dist/vnext/vnext/rpg/effects/bundle-from-snapshot.js');
    const { buildTransitPressureMap } = await import('../dist/vnext/vnext/rpg/transit-pressure-map.js');
    const { initialCampaignState } = await import('../dist/vnext/vnext/rpg/campaign/state-machine.js');

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
    const transit = {
      ...natal,
      ts: '2026-03-15T12:00:00Z',
      planets: [
        { name: 'Sun', lon: 15 },
        { name: 'Moon', lon: 195 },
        { name: 'Mercury', lon: 30 },
        { name: 'Venus', lon: 210 },
        { name: 'Mars', lon: 90 },
        { name: 'Jupiter', lon: 105 },
        { name: 'Saturn', lon: 300 },
        { name: 'Uranus', lon: 120 },
        { name: 'Neptune', lon: 330 },
        { name: 'Pluto', lon: 270 },
      ],
      aspects: [
        { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
        { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
        { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
      ],
      moonPhase: 0.7,
    };

    const featureVec = encodeFeatures(natal);
    const guidance = guidanceFromFeatures(featureVec, natal, 'rising-slate');
    const canonical = buildCanonicalReportForSnapshotSurface({
      surface_kind: 'profile_natal',
      subject_ids: ['rising-slate'],
      snapshot: natal,
      featureVec,
      control_surface_hash: 'rising-slate',
      compose_seed: 'rising-slate',
      guidance,
    });
    const semanticCore = interpretCanonicalReportObject(canonical);
    const bundle = buildRpgEffectsBundleFromSnapshot(natal);
    const character = buildCharacterProfile({
      natalSnapshot: natal,
      featureVec,
      semanticCore,
      dominantPlanetNames: canonical.participants[0].dominant_planet_names,
      effectsBundle: bundle,
    });
    const pressuresRaw = buildTransitPressureMap({ natalSnapshot: natal, transitSnapshot: transit });
    const p0 = { ...pressuresRaw[0], domain: 'partnership', intensityBand: 'moderate', likelyShadowPattern: 'phase1_shadow:frictional' };
    const pressures = [p0, ...pressuresRaw.slice(1)];
    const state = initialCampaignState(bundle);
    const primary = pressures[0];
    const sessionKeyBase = `2026-03-15|dps_rising|rising_leo`;
    const continuityA = buildCampaignSlateContinuity({
      state,
      primaryDomain: primary.domain,
      sessionKey: sessionKeyBase,
    });
    const continuityB = buildCampaignSlateContinuity({
      state,
      primaryDomain: primary.domain,
      sessionKey: sessionKeyBase,
    });
    const challengeContext = {
      archetypeCategory: 'resource_strain',
      archetypeId: 'resource_strain',
      interactionType: 'none',
      intensityBand: 'moderate',
      pressurePolarity: String(primary.likelyShadowPattern || '').replace('phase1_shadow:', ''),
      primaryDomain: primary.domain,
      natalBodyModifier: 'relational',
      supportingNatalBodyModifiers: [],
      mechanicTags: [],
    };

    const sceneA = buildChallengeScene({
      character,
      pressures,
      state,
      semanticCore,
      natalSnapshot: natal,
      transitSnapshot: transit,
      challengeContext,
      campaignIdentitySlugs: {
        class_slug: 'class_taurus',
        subclass_slug: 'subclass_virgo',
        rising_modifier_slug: 'rising_leo',
      },
      slateContinuity: continuityA,
    });
    const sceneB = buildChallengeScene({
      character,
      pressures,
      state,
      semanticCore,
      natalSnapshot: natal,
      transitSnapshot: transit,
      challengeContext,
      campaignIdentitySlugs: {
        class_slug: 'class_scorpio',
        subclass_slug: 'subclass_virgo',
        rising_modifier_slug: 'rising_leo',
      },
      slateContinuity: continuityB,
    });

    assert.ok(sceneA && sceneB, 'scenes built');
    const posturesA = sceneA.choices.map((c) => c.posture).join(',');
    const posturesB = sceneB.choices.map((c) => c.posture).join(',');
    assert.notStrictEqual(posturesA, posturesB, 'identity slug mix changes posture slate');
  });
});
