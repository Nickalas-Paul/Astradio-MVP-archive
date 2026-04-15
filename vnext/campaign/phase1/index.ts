/**
 * **Campaign:** daily pressure resolver (Command-Center). Folder `phase1` is an internal pipeline slice — not **Product:Phase-1**.
 *
 * Synthetic traits (eligibility_trait_phase1_v1:*) are NOT canonical CharacterSheet truth.
 * Remove when real trait engine supplies activated_trait_ids for all supported cases.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

export * from './contracts';
export * from './resolve-campaign-daily';
export * from './build-pressure-events';
export * from './build-daily-pressure-state';
export { TRAIT_DERIVATION_MODE_PHASE1 } from './synthetic-trait';

import { hashCanonicalJson } from '../../rpg/hash/json-hash';
import type { CampaignResolutionSeed } from './contracts';

/** Fingerprint for daily cache / idempotency auditing (campaign `phase1` slice; not Product:Phase-1). */
export function campaignPhase1DerivationFingerprint(seed: CampaignResolutionSeed): string {
  return hashCanonicalJson({
    v: 'campaign_phase1_derivation_v1',
    campaign_id: seed.campaign_id,
    mode: seed.mode,
    date: seed.date,
    state_hash_before: seed.state_hash_before,
    transit_snapshot_hash: seed.provenance.transit_snapshot_hash,
    relational_weather_state_hash: seed.provenance.relational_weather_state_hash ?? null,
    daily_pressure_state_id: seed.daily_pressure_state?.daily_pressure_state_id ?? null,
    refusal: seed.refusal ?? null,
    pressure_event_count: seed.pressure_events.length,
    trait_derivation_mode: seed.trait_derivation_mode,
  });
}
