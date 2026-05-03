import { type AspectTypeKey } from '../aspect-engine';
import { CORE_BODIES, type BodyKey } from '../canonical-bodies';
import { findBestDirectedCrossAspect } from '../synastry/cross-chart-best-aspect';
import { snapshotFingerprint } from '../canonical/stable-json';
import type { EphemerisSnapshot } from '../contracts';
import { lonToHouse } from '../astro/profile-from-snapshot';
import { getChartById } from '../compat/chart-store';
import { fetchChartSnapshot, type ChartInput } from '../core/architecture-engine';
import { toCampaignBodyId, DOMAIN_ID_BY_HOUSE, PRESSURE_FAMILY_BY_TRANSIT_BODY } from '../campaign/phase1/pressure-maps';
import { buildPhase1SyntheticTraitId } from '../campaign/phase1/synthetic-trait';
import { buildPressureEventsForMember } from '../campaign/phase1/build-pressure-events';
import { derivePressurePolarity } from '../campaign/phase1/polarity';
import { resolveRelationalConnectionFromChartIds } from '../relational/resolve-relational-connection-context';
import { computeRelationalWeatherV1 } from '../relational/weather/compute-relational-weather-v1';
import type { RelationalWeatherStateV1 } from '../relational/weather/types';
import type { DomainId } from '../campaign/phase1/contracts';
import type {
  CanonicalRelationalFieldObject,
  DomainDistribution,
  DomainHouseInteraction,
  PairKey,
  PairwiseInteractionCell,
  PersistedCompatibilityRecord,
  RelationalActivationOverlay,
  RelationalInteractionCategory,
  TraitInteractionEdge,
} from './contracts';
import {
  COMPATIBILITY_ACTIVATION_ALGORITHM_VERSION,
  COMPATIBILITY_FIELD_ALGORITHM_ID,
  COMPATIBILITY_FIELD_ALGORITHM_VERSION,
  COMPATIBILITY_FIELD_SCHEMA_VERSION,
  COMPATIBILITY_SURFACE_KIND,
} from './contracts';
import { clamp01, roundCompat, stableSha256, sortedUnique } from './stable';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../lib/vector-store');

type VectorRow = { chartId: string; vector64: number[]; version: string; encoderVersion: string; snapshotHash?: string };

type NatalCrossSignal = {
  pair_key: PairKey;
  source_slot_index: number;
  target_slot_index: number;
  source_body: string;
  target_body: string;
  source_house: DomainHouseInteraction['source_house'];
  target_house: DomainHouseInteraction['target_house'];
  source_trait_id: string;
  target_trait_id: string;
  domain_id: DomainId;
  category: RelationalInteractionCategory;
  weight: number;
};

function chartToInput(chart: { date: string; time: string; lat: number; lon: number; timezone?: string }): ChartInput {
  return {
    date: chart.date,
    time: chart.time,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone,
  };
}

function pairKey(a: number, b: number): PairKey {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return `${low}:${high}`;
}

function lonByBody(snapshot: EphemerisSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const planet of snapshot.planets || []) {
    if (planet?.name && typeof planet.lon === 'number' && Number.isFinite(planet.lon)) {
      out.set(String(planet.name).toLowerCase(), planet.lon);
    }
  }
  return out;
}

function bodyWeight(name: string): number {
  const n = name.toLowerCase();
  if (n === 'sun' || n === 'moon') return 1.15;
  if (n === 'mercury') return 1.08;
  if (n === 'venus' || n === 'mars') return 1.06;
  if (n === 'uranus' || n === 'neptune' || n === 'pluto') return 1.12;
  return 1;
}

function aspectWeight(type: AspectTypeKey): number {
  switch (type) {
    case 'conjunction':
      return 1.4;
    case 'opposition':
      return 1.35;
    case 'square':
      return 1.3;
    case 'trine':
      return 1.1;
    case 'sextile':
      return 1.05;
    default:
      return 1;
  }
}

function mapCategory(type: AspectTypeKey, sourceBody: string, targetBody: string): RelationalInteractionCategory {
  const source = toCampaignBodyId(sourceBody);
  const target = toCampaignBodyId(targetBody);
  if (!source || !target) return 'cross_pressuring';
  const familySource = PRESSURE_FAMILY_BY_TRANSIT_BODY[source];
  const familyTarget = PRESSURE_FAMILY_BY_TRANSIT_BODY[target];
  const polarity = derivePressurePolarity(type, source, target);
  if (familySource === 'dissolution' || familyTarget === 'dissolution') return 'dissolving';
  if (familySource === 'transformation' || familyTarget === 'transformation') return 'transforming';
  if (polarity === 'volatile' || familySource === 'disruption' || familyTarget === 'disruption' || familySource === 'conflict' || familyTarget === 'conflict') {
    return 'escalating';
  }
  if (polarity === 'constructive') return 'reinforcing';
  return 'cross_pressuring';
}

function computePairSignals(
  pair_key: PairKey,
  source_slot_index: number,
  target_slot_index: number,
  sourceSnapshot: EphemerisSnapshot,
  targetSnapshot: EphemerisSnapshot
): NatalCrossSignal[] {
  const out: NatalCrossSignal[] = [];
  const sourceLon = lonByBody(sourceSnapshot);
  const targetLon = lonByBody(targetSnapshot);
  const sourceCusps = [...sourceSnapshot.houses];
  const targetCusps = [...targetSnapshot.houses];

  for (const sb of [...CORE_BODIES] as BodyKey[]) {
      const lonA = sourceLon.get(sb);
      if (lonA === undefined) continue;
      for (const tb of [...CORE_BODIES] as BodyKey[]) {
      const lonB = targetLon.get(tb);
      if (lonB === undefined) continue;
      const best = findBestDirectedCrossAspect(lonA, lonB);
      if (!best) continue;

      const sourceHouse = Math.min(12, Math.max(1, lonToHouse(lonA, sourceCusps))) as NatalCrossSignal['source_house'];
      const targetHouse = Math.min(12, Math.max(1, lonToHouse(lonB, targetCusps))) as NatalCrossSignal['target_house'];
      const category = mapCategory(best.type, sb, tb);
      const domain_id = DOMAIN_ID_BY_HOUSE[targetHouse] ?? 'self';
      const weight = clamp01(best.exactness * Math.min(1, (aspectWeight(best.type) * bodyWeight(sb) * bodyWeight(tb)) / (1.4 * 1.15 * 1.15)));
      out.push({
        pair_key,
        source_slot_index,
        target_slot_index,
        source_body: sb,
        target_body: tb,
        source_house: sourceHouse,
        target_house: targetHouse,
        source_trait_id: buildPhase1SyntheticTraitId(sb, sourceHouse, sourceSnapshot),
        target_trait_id: buildPhase1SyntheticTraitId(tb, targetHouse, targetSnapshot),
        domain_id,
        category,
        weight,
      });
    }
  }
  return out;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length, 64);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const x = Number.isFinite(a[i]) ? a[i] : 0;
    const y = Number.isFinite(b[i]) ? b[i] : 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom <= 0) return 0;
  return clamp01((dot / denom + 1) / 2);
}

function buildPairwiseCell(
  aIndex: number,
  bIndex: number,
  vectorA: number[],
  vectorB: number[],
  vectorHashA: string,
  vectorHashB: string,
  encoderVersionA: string,
  encoderVersionB: string,
  signals: NatalCrossSignal[]
): PairwiseInteractionCell {
  const categories: Record<RelationalInteractionCategory, number> = {
    reinforcing: 0,
    cross_pressuring: 0,
    escalating: 0,
    dissolving: 0,
    transforming: 0,
  };
  for (const signal of signals) {
    categories[signal.category] = roundCompat(categories[signal.category] + signal.weight);
  }
  const totalCategoryWeight = Object.values(categories).reduce((sum, value) => sum + value, 0);
  const normalizedCategories = Object.fromEntries(
    Object.entries(categories).map(([key, value]) => [key, totalCategoryWeight > 0 ? clamp01(value / totalCategoryWeight) : 0])
  ) as Record<RelationalInteractionCategory, number>;
  const dominant_category = (Object.keys(normalizedCategories) as RelationalInteractionCategory[]).sort((left, right) => {
    const delta = normalizedCategories[right] - normalizedCategories[left];
    if (delta !== 0) return delta > 0 ? 1 : -1;
    return left.localeCompare(right, 'en');
  })[0] ?? 'cross_pressuring';
  const resonance = cosineSimilarity(vectorA, vectorB);
  const friction = clamp01(normalizedCategories.cross_pressuring + normalizedCategories.escalating * 0.5);
  const volatility = clamp01(normalizedCategories.escalating + normalizedCategories.dissolving * 0.5);
  const complementarity = clamp01(1 - Math.abs((vectorA[32] ?? 0) - (vectorB[32] ?? 0)));
  const asymmetry = clamp01(Math.abs((vectorA[31] ?? 0) - (vectorB[31] ?? 0)));
  const persistence = clamp01((normalizedCategories.reinforcing + normalizedCategories.transforming) / 2);
  return {
    pair_key: pairKey(aIndex, bIndex),
    a_slot_index: aIndex,
    b_slot_index: bIndex,
    vector_hash_a: vectorHashA,
    vector_hash_b: vectorHashB,
    interaction_vector: {
      resonance,
      friction,
      volatility,
      complementarity,
      asymmetry,
      persistence,
    },
    category_weights: normalizedCategories,
    dominant_category,
    provenance: {
      encoder_version_a: encoderVersionA,
      encoder_version_b: encoderVersionB,
      algorithm_version: COMPATIBILITY_FIELD_ALGORITHM_VERSION,
    },
  };
}

function normalizeTraitGraph(signals: NatalCrossSignal[]): TraitInteractionEdge[] {
  const buckets = new Map<string, { signal: NatalCrossSignal; raw: number; count: number }>();
  for (const signal of signals) {
    const key = `${signal.source_slot_index}:${signal.source_trait_id}->${signal.target_slot_index}:${signal.target_trait_id}:${signal.category}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.raw = roundCompat(existing.raw + signal.weight);
      existing.count += 1;
    } else {
      buckets.set(key, { signal, raw: signal.weight, count: 1 });
    }
  }

  const maxByBucket = new Map<string, number>();
  for (const entry of buckets.values()) {
    const bucketKey = `${entry.signal.pair_key}:${entry.signal.category}`;
    const current = maxByBucket.get(bucketKey) ?? 0;
    if (entry.raw > current) maxByBucket.set(bucketKey, entry.raw);
  }

  const edges: TraitInteractionEdge[] = [];
  for (const [edge_key, entry] of buckets.entries()) {
    const bucketKey = `${entry.signal.pair_key}:${entry.signal.category}`;
    const denom = maxByBucket.get(bucketKey) ?? 1;
    edges.push({
      edge_key: edge_key as TraitInteractionEdge['edge_key'],
      source_slot_index: entry.signal.source_slot_index,
      target_slot_index: entry.signal.target_slot_index,
      trait_id_source: entry.signal.source_trait_id,
      trait_id_target: entry.signal.target_trait_id,
      interaction_category: entry.signal.category,
      weight: denom > 0 ? clamp01(entry.raw / denom) : 0,
      contributing_pair_key: entry.signal.pair_key,
      contributing_signal_count: entry.count,
      provenance: {
        derivation_code: 'DERIVE_COMPATIBILITY_TRAIT_GRAPH',
        algorithm_version: COMPATIBILITY_FIELD_ALGORITHM_VERSION,
      },
    });
  }

  edges.sort((a, b) =>
    a.source_slot_index - b.source_slot_index ||
    a.target_slot_index - b.target_slot_index ||
    a.trait_id_source.localeCompare(b.trait_id_source, 'en') ||
    a.trait_id_target.localeCompare(b.trait_id_target, 'en') ||
    a.interaction_category.localeCompare(b.interaction_category, 'en')
  );
  return edges;
}

function buildDomainHouseInteractions(signals: NatalCrossSignal[]): DomainHouseInteraction[] {
  const interactions = signals.map((signal) => ({
    interaction_key: `${signal.source_slot_index}:${signal.target_slot_index}:${signal.domain_id}:${signal.source_house}:${signal.target_house}:${signal.category}` as DomainHouseInteraction['interaction_key'],
    pair_key: signal.pair_key,
    source_slot_index: signal.source_slot_index,
    target_slot_index: signal.target_slot_index,
    domain_id: signal.domain_id,
    source_house: signal.source_house,
    target_house: signal.target_house,
    interaction_category: signal.category,
    weight: signal.weight,
  }));
  interactions.sort((a, b) => a.interaction_key.localeCompare(b.interaction_key, 'en'));
  return interactions;
}

function buildDomainDistribution(interactions: DomainHouseInteraction[]): DomainDistribution[] {
  const totals = new Map<DomainId, { sum: number; count: number }>();
  let global = 0;
  for (const interaction of interactions) {
    global += interaction.weight;
    const current = totals.get(interaction.domain_id) ?? { sum: 0, count: 0 };
    current.sum = roundCompat(current.sum + interaction.weight);
    current.count += 1;
    totals.set(interaction.domain_id, current);
  }
  const rows: DomainDistribution[] = [];
  for (const [domain_id, current] of totals.entries()) {
    rows.push({
      domain_id,
      total_weight: global > 0 ? clamp01(current.sum / global) : 0,
      contributing_edges: current.count,
    });
  }
  rows.sort((a, b) => a.domain_id.localeCompare(b.domain_id, 'en'));
  return rows;
}

async function buildActivationOverlay(params: {
  base_field_hash: string;
  chart_ids_ordered: string[];
  bindingKey: string;
  memberSnapshotsOrdered: EphemerisSnapshot[];
  vectorHashes: Record<string, string>;
  transitInput: { date: string; time: string; lat: number; lon: number; timezone?: string };
}): Promise<{ overlay: RelationalActivationOverlay; weather: RelationalWeatherStateV1 }> {
  const transitSnapshot = await fetchChartSnapshot(params.transitInput);
  const weather = computeRelationalWeatherV1({
    connection: {
      kind: params.chart_ids_ordered.length === 2 ? 'pair' : 'group',
      bindingId: params.bindingKey,
      chartIdsOrdered: params.chart_ids_ordered,
    },
    transit: transitSnapshot,
    memberSnapshotsOrdered: params.memberSnapshotsOrdered,
    vectorHashes: params.vectorHashes,
  });
  const pairKeys = new Set<PairKey>();
  const activatedTraitIds = new Set<string>();
  const identityModifierIds = new Set<string>();
  const mechanicTags = new Set<string>();
  for (let i = 0; i < params.memberSnapshotsOrdered.length; i++) {
    const memberChartId = params.chart_ids_ordered[i];
    const events = buildPressureEventsForMember({
      campaign_id: params.bindingKey,
      date: params.transitInput.date,
      source_mode: 'group_member',
      member_chart_id: memberChartId,
      transit: transitSnapshot,
      natal: params.memberSnapshotsOrdered[i],
      transit_snapshot_hash: snapshotFingerprint(transitSnapshot),
      natal_snapshot_hash: snapshotFingerprint(params.memberSnapshotsOrdered[i]),
      engine_version: COMPATIBILITY_ACTIVATION_ALGORITHM_VERSION,
      rules_version: COMPATIBILITY_ACTIVATION_ALGORITHM_VERSION,
    });
    for (const event of events) {
      for (const traitId of event.activated_trait_ids) activatedTraitIds.add(traitId);
      for (const modifierId of event.identity_modifier_ids) identityModifierIds.add(modifierId);
      for (const tag of event.mechanic_tags) mechanicTags.add(tag);
      const memberIndex = params.chart_ids_ordered.indexOf(memberChartId);
      for (let j = 0; j < params.chart_ids_ordered.length; j++) {
        if (j !== memberIndex) pairKeys.add(pairKey(memberIndex, j));
      }
    }
  }
  const overlayBase = {
    base_field_hash: params.base_field_hash,
    transit_lock: {
      ts: transitSnapshot.ts,
      lat: transitSnapshot.lat,
      lon: transitSnapshot.lon,
      tz: transitSnapshot.tz,
    },
    transit_snapshot_hash: snapshotFingerprint(transitSnapshot),
    relational_weather_state_hash: weather.stateHash,
    activation_vector: {
      harmony: roundCompat(weather.activation.harmony),
      friction: roundCompat(weather.activation.friction),
      intensity: roundCompat(weather.activation.intensity),
      emotional_activation: roundCompat(weather.activation.emotional_activation),
      communication_emphasis: roundCompat(weather.activation.communication_emphasis),
      volatility: roundCompat(weather.activation.volatility),
      growth_pressure: roundCompat(weather.activation.growth_pressure),
    },
    activated_pair_keys: Array.from(pairKeys).sort((a, b) => a.localeCompare(b, 'en')),
    activated_trait_ids: sortedUnique(Array.from(activatedTraitIds)),
    identity_modifier_ids: sortedUnique(Array.from(identityModifierIds)),
    mechanic_tags: sortedUnique(Array.from(mechanicTags)),
    provenance: {
      algorithm_version: COMPATIBILITY_ACTIVATION_ALGORITHM_VERSION,
      transit_input_version: 'transit_chart_input_v1',
    },
  };
  const overlay: RelationalActivationOverlay = {
    ...overlayBase,
    activation_hash: stableSha256(overlayBase),
  };
  return { overlay, weather };
}

export async function buildCanonicalRelationalField(params: {
  chartIds: string[];
  bindingKey?: string;
  transitInput?: { date: string; time: string; lat: number; lon: number; timezone?: string };
}): Promise<{ field: CanonicalRelationalFieldObject; transit_weather: RelationalWeatherStateV1 | null }> {
  const chartIds = sortedUnique(params.chartIds);
  if (chartIds.length < 2) {
    throw new Error('compatibility field requires at least two charts');
  }
  const ctx = await resolveRelationalConnectionFromChartIds(chartIds, params.bindingKey);
  const vectorMap: Map<string, VectorRow> = await vectorStore.getChartVectorsByIds(ctx.chartIdsOrdered);
  const entities = [];
  const signals: NatalCrossSignal[] = [];
  const pairwise_matrix: PairwiseInteractionCell[] = [];
  const snapshotsById: Record<string, EphemerisSnapshot> = {};
  const snapshot_hashes: Record<string, string> = {};
  const encoder_versions: Record<string, string> = {};
  const vectorsById: Record<string, number[]> = {};

  for (let i = 0; i < ctx.chartIdsOrdered.length; i++) {
    const chartId = ctx.chartIdsOrdered[i];
    const snapshot = ctx.natalSnapshotsOrdered[i];
    const row = vectorMap.get(chartId);
    if (!row || !Array.isArray(row.vector64) || row.vector64.length === 0) {
      throw new Error(`Vector not found for chart ${chartId}`);
    }
    snapshotsById[chartId] = snapshot;
    snapshot_hashes[chartId] = snapshotFingerprint(snapshot);
    encoder_versions[chartId] = row.encoderVersion ?? 'v1';
    vectorsById[chartId] = row.vector64;
    entities.push({
      slot_index: i,
      chart_id: chartId,
      natal_snapshot_hash: snapshot_hashes[chartId],
      feature_vector_hash: ctx.provenance.vector_hashes[chartId],
    });
  }

  for (let i = 0; i < ctx.chartIdsOrdered.length; i++) {
    for (let j = i + 1; j < ctx.chartIdsOrdered.length; j++) {
      const chartA = ctx.chartIdsOrdered[i];
      const chartB = ctx.chartIdsOrdered[j];
      const currentPairKey = pairKey(i, j);
      const pairSignals = [
        ...computePairSignals(currentPairKey, i, j, snapshotsById[chartA], snapshotsById[chartB]),
        ...computePairSignals(currentPairKey, j, i, snapshotsById[chartB], snapshotsById[chartA]),
      ];
      signals.push(...pairSignals);
      pairwise_matrix.push(
        buildPairwiseCell(
          i,
          j,
          vectorsById[chartA],
          vectorsById[chartB],
          ctx.provenance.vector_hashes[chartA],
          ctx.provenance.vector_hashes[chartB],
          encoder_versions[chartA],
          encoder_versions[chartB],
          pairSignals
        )
      );
    }
  }

  const trait_interaction_graph = normalizeTraitGraph(signals);
  const domain_house_interactions = buildDomainHouseInteractions(signals);
  const domain_distribution = buildDomainDistribution(domain_house_interactions);

  const base = {
    schema_version: COMPATIBILITY_FIELD_SCHEMA_VERSION,
    surface_kind: COMPATIBILITY_SURFACE_KIND,
    entity_ordering_rule_id: 'ordering_lexical_chart_v1',
    entities,
    pairwise_matrix,
    trait_interaction_graph,
    domain_house_interactions,
    domain_distribution,
    composite_feature_vector_hash: stableSha256(Array.from(ctx.composite)),
    field_algorithm_id: COMPATIBILITY_FIELD_ALGORITHM_ID,
    field_algorithm_version: COMPATIBILITY_FIELD_ALGORITHM_VERSION,
    created_from: {
      chart_ids_ordered: ctx.chartIdsOrdered,
      vector_hashes: ctx.provenance.vector_hashes,
      snapshot_hashes,
      encoder_versions,
    },
  };
  const object_identity_hash = stableSha256(base);
  let transit_weather: RelationalWeatherStateV1 | null = null;
  let activation_overlay = null;
  if (params.transitInput) {
    const built = await buildActivationOverlay({
      base_field_hash: object_identity_hash,
      chart_ids_ordered: ctx.chartIdsOrdered,
      bindingKey: params.bindingKey ?? object_identity_hash,
      memberSnapshotsOrdered: ctx.natalSnapshotsOrdered,
      vectorHashes: ctx.provenance.vector_hashes,
      transitInput: params.transitInput,
    });
    activation_overlay = built.overlay;
    transit_weather = built.weather;
  }
  const field: CanonicalRelationalFieldObject = {
    ...base,
    object_identity_hash,
    activation_overlay,
  };
  return { field, transit_weather };
}

export async function buildCompatibilityRecord(params: {
  chartIds: string[];
  relationshipBindingId?: string | null;
  transitInput?: { date: string; time: string; lat: number; lon: number; timezone?: string };
  computedAt?: string;
}): Promise<{
  field: CanonicalRelationalFieldObject;
  record: PersistedCompatibilityRecord;
  transit_weather: RelationalWeatherStateV1 | null;
}> {
  const { field, transit_weather } = await buildCanonicalRelationalField({
    chartIds: params.chartIds,
    bindingKey: params.relationshipBindingId ?? undefined,
    transitInput: params.transitInput,
  });
  const computedAt = params.computedAt ?? new Date().toISOString();
  return {
    field,
    transit_weather,
    record: {
      compatibility_id: `compat_${field.object_identity_hash.slice(0, 16)}`,
      compatibility_field_hash: field.object_identity_hash,
      relationship_binding_id: params.relationshipBindingId ?? null,
      chart_ids_ordered: field.created_from.chart_ids_ordered,
      scoring_contract_version: 'relational_field_score_v1',
      scoring_algorithm_version: 'relational_field_score_v1',
      classification_id: null,
      classification_version: null,
      vector_hashes: field.created_from.vector_hashes,
      snapshot_hashes: field.created_from.snapshot_hashes,
      encoder_versions: field.created_from.encoder_versions,
      relational_weather_state_hash: field.activation_overlay?.relational_weather_state_hash ?? null,
      transit_snapshot_hash: field.activation_overlay?.transit_snapshot_hash ?? null,
      canonical_surface_kind: COMPATIBILITY_SURFACE_KIND,
      created_at: computedAt,
      computed_at: computedAt,
    },
  };
}

export async function resolveTransitInputForCharts(chartId: string): Promise<{ date: string; time: string; lat: number; lon: number; timezone?: string }> {
  const chart = await getChartById(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);
  const snapshot = await fetchChartSnapshot(chartToInput(chart));
  return {
    date: snapshot.ts.slice(0, 10),
    time: snapshot.ts.slice(11, 16),
    lat: snapshot.lat,
    lon: snapshot.lon,
    timezone: snapshot.tz,
  };
}
