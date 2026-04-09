/**
 * Campaign Phase 1 — authoritative daily resolver (read-only CampaignState).
 * Single entry for server routes; does not mutate persistence.
 *
 * Group note: pressure events from all members are pooled and ranked together (`mode: 'group'`).
 * CharacterSheet / challenge natal for Command-Center materialization is chosen separately by the
 * route layer (primary member’s chart), not an aggregate chart. See `materializeCampaignDaily`.
 */

import type { EphemerisSnapshot } from '../../contracts';
import { hashSnapshot } from '../../rpg/hash/snapshot-hash';
import { computeRelationalWeatherV1 } from '../../relational/weather/compute-relational-weather-v1';
import type { CampaignResolutionSeed } from './contracts';
import { CAMPAIGN_PHASE1_ENGINE_VERSION, CAMPAIGN_PHASE1_RULES_VERSION } from './contracts';
import { buildPressureEventsForMember } from './build-pressure-events';
import { buildDailyPressureState } from './build-daily-pressure-state';
import { TRAIT_DERIVATION_MODE_PHASE1 } from './synthetic-trait';

export type ResolveCampaignDailySoloInput = {
  kind: 'solo';
  campaign_id: string;
  chart_id: string;
  date: string;
  state_hash_before: string;
  natal: EphemerisSnapshot;
  transit: EphemerisSnapshot;
};

export type ResolveCampaignDailyGroupInput = {
  kind: 'group';
  campaign_id: string;
  group_id?: string;
  date: string;
  state_hash_before: string;
  chart_ids_ordered: string[];
  member_natals: EphemerisSnapshot[];
  transit: EphemerisSnapshot;
  vector_hashes: Record<string, string>;
};

export type ResolveCampaignDailyInput = ResolveCampaignDailySoloInput | ResolveCampaignDailyGroupInput;

export function resolveCampaignDaily(input: ResolveCampaignDailyInput): CampaignResolutionSeed {
  const engine_version = CAMPAIGN_PHASE1_ENGINE_VERSION;
  const rules_version = CAMPAIGN_PHASE1_RULES_VERSION;
  const transit_snapshot_hash = hashSnapshot(input.transit);

  if (input.kind === 'solo') {
    const natal_hash = hashSnapshot(input.natal);
    const events = buildPressureEventsForMember({
      campaign_id: input.campaign_id,
      date: input.date,
      source_mode: 'solo',
      transit: input.transit,
      natal: input.natal,
      transit_snapshot_hash,
      natal_snapshot_hash: natal_hash,
      engine_version,
      rules_version,
    });

    const daily = buildDailyPressureState({
      campaign_id: input.campaign_id,
      mode: 'solo',
      date: input.date,
      events,
    });

    if (!daily.ok) {
      return {
        campaign_id: input.campaign_id,
        mode: 'solo',
        date: input.date,
        character_sheet_id: undefined,
        group_context_id: undefined,
        pressure_events: events,
        daily_pressure_state: null,
        state_hash_before: input.state_hash_before,
        trait_derivation_mode: TRAIT_DERIVATION_MODE_PHASE1,
        provenance: { engine_version, rules_version, transit_snapshot_hash },
        refusal: { code: 'NO_PRIMARY_PRESSURE' },
      };
    }

    return {
      campaign_id: input.campaign_id,
      mode: 'solo',
      date: input.date,
      character_sheet_id: `char_sheet_${natal_hash.slice(0, 16)}`,
      group_context_id: undefined,
      pressure_events: events,
      daily_pressure_state: daily.state,
      state_hash_before: input.state_hash_before,
      trait_derivation_mode: TRAIT_DERIVATION_MODE_PHASE1,
      provenance: { engine_version, rules_version, transit_snapshot_hash },
    };
  }

  // Pooled cross-aspects: same transit × each member natal; selection is global across members.
  const pressure_events: import('./contracts').PressureEvent[] = [];
  for (let i = 0; i < input.chart_ids_ordered.length; i++) {
    const chartId = input.chart_ids_ordered[i]!;
    const natal = input.member_natals[i]!;
    const natal_hash = hashSnapshot(natal);
    const ev = buildPressureEventsForMember({
      campaign_id: input.campaign_id,
      date: input.date,
      source_mode: 'group_member',
      member_chart_id: chartId,
      transit: input.transit,
      natal,
      transit_snapshot_hash,
      natal_snapshot_hash: natal_hash,
      engine_version,
      rules_version,
    });
    pressure_events.push(...ev);
  }
  pressure_events.sort((a, b) => a.pressure_event_id.localeCompare(b.pressure_event_id));

  const weather = computeRelationalWeatherV1({
    connection: {
      kind: 'group',
      bindingId: input.group_id ?? input.campaign_id,
      chartIdsOrdered: [...input.chart_ids_ordered],
    },
    transit: input.transit,
    memberSnapshotsOrdered: input.member_natals,
    vectorHashes: input.vector_hashes,
  });

  const daily = buildDailyPressureState({
    campaign_id: input.campaign_id,
    mode: 'group',
    date: input.date,
    events: pressure_events,
    chart_ids_ordered: input.chart_ids_ordered,
    relational_volatility: weather.activation.volatility,
  });

  if (!daily.ok) {
    return {
      campaign_id: input.campaign_id,
      mode: 'group',
      date: input.date,
      group_context_id: input.group_id ?? input.campaign_id,
      pressure_events,
      daily_pressure_state: null,
      state_hash_before: input.state_hash_before,
      trait_derivation_mode: TRAIT_DERIVATION_MODE_PHASE1,
      provenance: {
        engine_version,
        rules_version,
        transit_snapshot_hash,
        relational_weather_state_hash: weather.stateHash,
      },
      refusal: { code: 'NO_PRIMARY_PRESSURE' },
    };
  }

  return {
    campaign_id: input.campaign_id,
    mode: 'group',
    date: input.date,
    group_context_id: input.group_id ?? input.campaign_id,
    pressure_events,
    daily_pressure_state: daily.state,
    state_hash_before: input.state_hash_before,
    trait_derivation_mode: TRAIT_DERIVATION_MODE_PHASE1,
    provenance: {
      engine_version,
      rules_version,
      transit_snapshot_hash,
      relational_weather_state_hash: weather.stateHash,
    },
  };
}
