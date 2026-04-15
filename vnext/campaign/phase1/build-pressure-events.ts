/**
 * PressureEvent builder: transit × natal via computeCrossAspectsForMember.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { EphemerisSnapshot } from '../../contracts';
import { lonToHouse } from '../../astro/profile-from-snapshot';
import { computeCrossAspectsForMember } from '../../relational/weather/cross-aspects-v1';
import { hashCanonicalJson } from '../../rpg/hash/json-hash';
import { hashSnapshot } from '../../rpg/hash/snapshot-hash';
import type { PressureEvent, PressureSourceMode } from './contracts';
import {
  allowedOrbForAspect,
  aspectBaseWeight,
  bodyPairSourceWeight,
  DOMAIN_ID_BY_HOUSE,
  PRESSURE_FAMILY_BY_TRANSIT_BODY,
  toCampaignBodyId,
} from './pressure-maps';
import { derivePressurePolarity } from './polarity';
import { buildPhase1SyntheticTraitId } from './synthetic-trait';
import type { Phase1AspectType } from './contracts';

function intensityBand(score: number): PressureEvent['intensity_band'] {
  if (score <= 0.29) return 'low';
  if (score <= 0.54) return 'moderate';
  if (score <= 0.79) return 'high';
  return 'critical';
}

function natalLonForBody(natal: EphemerisSnapshot, body: string): number | null {
  const p = natal.planets.find((x) => String(x.name).toLowerCase() === body.toLowerCase());
  if (!p || !Number.isFinite(p.lon)) return null;
  return p.lon;
}

function emphasisWeightForHouse(house: number): number {
  if (house === 1 || house === 4 || house === 7 || house === 10) return 1.15;
  return 1.0;
}

function buildIdentityModifierIds(
  natalBody: PressureEvent['natal_body'],
  natalHouse: PressureEvent['natal_house'],
  domainId: PressureEvent['domain_id'],
): string[] {
  return [
    `identity:natal_body:${natalBody}`,
    `identity:natal_house:${natalHouse}`,
    `identity:domain:${domainId}`,
  ];
}

function buildMechanicTags(params: {
  sourceMode: PressureSourceMode;
  transitBody: PressureEvent['transit_body'];
  natalBody: PressureEvent['natal_body'];
  aspectType: Phase1AspectType;
  natalHouse: PressureEvent['natal_house'];
  domainId: PressureEvent['domain_id'];
  pressurePolarity: PressureEvent['pressure_polarity'];
  intensityBand: PressureEvent['intensity_band'];
}): string[] {
  const tags = [
    `source_mode:${params.sourceMode}`,
    `transit_body:${params.transitBody}`,
    `natal_body:${params.natalBody}`,
    `aspect_type:${params.aspectType}`,
    `natal_house:${params.natalHouse}`,
    `domain:${params.domainId}`,
    `polarity:${params.pressurePolarity}`,
    `intensity:${params.intensityBand}`,
  ];
  return tags.sort((a, b) => a.localeCompare(b));
}

export function buildPressureEventsForMember(params: {
  campaign_id: string;
  date: string;
  source_mode: PressureSourceMode;
  member_chart_id?: string;
  transit: EphemerisSnapshot;
  natal: EphemerisSnapshot;
  transit_snapshot_hash: string;
  natal_snapshot_hash: string;
  engine_version: string;
  rules_version: string;
}): PressureEvent[] {
  const hits = computeCrossAspectsForMember(params.transit, params.natal, params.member_chart_id ?? params.campaign_id);
  const out: PressureEvent[] = [];

  for (const h of hits) {
    const tb = toCampaignBodyId(h.transitBody);
    const nb = toCampaignBodyId(h.natalBody);
    if (!tb || !nb) continue;

    const aspectType = h.type as Phase1AspectType;
    const nl = natalLonForBody(params.natal, h.natalBody);
    if (nl === null) continue;
    const cusps = params.natal.houses;
    const houseRaw = lonToHouse(nl, [...cusps]);
    const natal_house = Math.min(12, Math.max(1, houseRaw)) as PressureEvent['natal_house'];
    const domain_id = DOMAIN_ID_BY_HOUSE[natal_house] ?? 'self';

    const aw = aspectBaseWeight(aspectType);
    const aspect_weight = Math.min(1, aw / 1.4);
    const orb_score = h.exactness;
    const source_weight = bodyPairSourceWeight(h.transitBody, h.natalBody);
    const recurrence_weight = 1.0;
    const emphasis_weight = emphasisWeightForHouse(natal_house);

    let intensity_score =
      aspect_weight * orb_score * source_weight * recurrence_weight * emphasis_weight;
    intensity_score = Math.round(Math.min(1, Math.max(0, intensity_score)) * 10000) / 10000;

    const pressure_family = PRESSURE_FAMILY_BY_TRANSIT_BODY[tb];
    const pressure_polarity = derivePressurePolarity(aspectType, tb, nb);
    const intensity_band = intensityBand(intensity_score);

    const cross_aspect_hash = hashCanonicalJson({
      transit_body: tb,
      natal_body: nb,
      aspect: aspectType,
      orb: h.orbDeg,
      member: params.member_chart_id ?? 'solo',
    });

    const synthetic = buildPhase1SyntheticTraitId(nb, natal_house, params.natal);
    const identity_modifier_ids = buildIdentityModifierIds(nb, natal_house, domain_id);
    const mechanic_tags = buildMechanicTags({
      sourceMode: params.source_mode,
      transitBody: tb,
      natalBody: nb,
      aspectType,
      natalHouse: natal_house,
      domainId: domain_id,
      pressurePolarity: pressure_polarity,
      intensityBand: intensity_band,
    });

    const provenance = {
      transit_snapshot_hash: params.transit_snapshot_hash,
      natal_snapshot_hash: params.natal_snapshot_hash,
      cross_aspect_hash,
      engine_version: params.engine_version,
      rules_version: params.rules_version,
    };

    const pressure_event_id = hashCanonicalJson([
      params.campaign_id,
      params.date,
      params.source_mode,
      params.member_chart_id ?? 'solo',
      tb,
      nb,
      aspectType,
      natal_house,
      h.orbDeg.toFixed(4),
      provenance.transit_snapshot_hash,
      provenance.natal_snapshot_hash,
      provenance.engine_version,
      provenance.rules_version,
    ]);

    const ev: PressureEvent = {
      pressure_event_id,
      source_mode: params.source_mode,
      member_chart_id: params.source_mode === 'group_member' ? params.member_chart_id : undefined,
      campaign_id: params.campaign_id,
      date: params.date,
      transit_body: tb,
      natal_body: nb,
      aspect_type: aspectType,
      natal_house,
      domain_id,
      pressure_family,
      pressure_polarity,
      // interaction_hint: not used in campaign `phase1` slice; see DailyPressureState.interaction_type.
      interaction_hint: 'none',
      actual_orb_deg: h.orbDeg,
      allowed_orb_deg: allowedOrbForAspect(aspectType),
      aspect_weight,
      orb_score,
      source_weight,
      recurrence_weight,
      emphasis_weight,
      intensity_score,
      intensity_band,
      exactness_score: h.exactness,
      target_priority_score: Math.min(1, h.weight / 2),
      activated_trait_ids: [synthetic],
      identity_modifier_ids,
      mechanic_tags,
      provenance,
    };
    out.push(ev);
  }

  return out.sort((a, b) => a.pressure_event_id.localeCompare(b.pressure_event_id));
}

export function buildSoloPressureEvents(params: {
  campaign_id: string;
  date: string;
  chart_id: string;
  transit: EphemerisSnapshot;
  natal: EphemerisSnapshot;
  engine_version: string;
  rules_version: string;
}): PressureEvent[] {
  return buildPressureEventsForMember({
    campaign_id: params.campaign_id,
    date: params.date,
    source_mode: 'solo',
    member_chart_id: undefined,
    transit: params.transit,
    natal: params.natal,
    transit_snapshot_hash: hashSnapshot(params.transit),
    natal_snapshot_hash: hashSnapshot(params.natal),
    engine_version: params.engine_version,
    rules_version: params.rules_version,
  });
}
