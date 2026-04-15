/**
 * DailyPressureState — deterministic assembly from PressureEvent[].
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import { hashCanonicalJson } from '../../rpg/hash/json-hash';
import type {
  DailyPressureState,
  PressureEvent,
  PressureInteractionType,
  SupportingPressureRef,
} from './contracts';
import { CAMPAIGN_PHASE1_ENGINE_VERSION, CAMPAIGN_PHASE1_RULES_VERSION } from './contracts';

export type DailyPressureBuildResult =
  | { ok: true; state: DailyPressureState }
  | { ok: false; code: 'NO_PRIMARY_PRESSURE'; ranking_trace: DailyPressureState['ranking_trace'] };

type Cluster = { representative: PressureEvent; member_ids: string[] };

function comparePrimary(a: PressureEvent, b: PressureEvent): number {
  if (b.intensity_score !== a.intensity_score) return b.intensity_score - a.intensity_score;
  if (b.source_weight !== a.source_weight) return b.source_weight - a.source_weight;
  if (b.orb_score !== a.orb_score) return b.orb_score - a.orb_score;
  const la = a.activated_trait_ids.length;
  const lb = b.activated_trait_ids.length;
  if (lb !== la) return lb - la;
  return a.pressure_event_id.localeCompare(b.pressure_event_id);
}

function tieBreakRule(a: PressureEvent, b: PressureEvent): DailyPressureState['ranking_trace']['tie_break_rule_applied'] {
  if (Math.abs(a.intensity_score - b.intensity_score) > 1e-9) return 'none';
  if (Math.abs(a.source_weight - b.source_weight) > 1e-9) return 'source_weight';
  if (Math.abs(a.orb_score - b.orb_score) > 1e-9) return 'orb_score';
  if (a.activated_trait_ids.length !== b.activated_trait_ids.length) return 'activated_trait_count';
  return 'pressure_event_id';
}

function bandRank(b: PressureEvent['intensity_band']): number {
  switch (b) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function evaluateInteraction(reps: PressureEvent[], clusters: Cluster[]): PressureInteractionType {
  const priority: PressureInteractionType[] = [
    'transforming',
    'escalating',
    'dissolving',
    'cross_pressuring',
    'reinforcing',
    'none',
  ];

  const transforming = () =>
    reps.some(
      (e) =>
        (e.pressure_family === 'transformation' || e.pressure_family === 'disruption') &&
        (e.pressure_polarity === 'frictional' || e.pressure_polarity === 'volatile')
    );

  const escalating = () =>
    reps.filter((e) => e.pressure_family === 'conflict' && e.pressure_polarity === 'frictional').length >= 2;

  const dissolving = () => reps.some((e) => e.pressure_family === 'dissolution');

  const cross_pressuring = () => {
    const hi = (e: PressureEvent) => bandRank(e.intensity_band) >= 2;
    for (let i = 0; i < reps.length; i++) {
      for (let j = i + 1; j < reps.length; j++) {
        if (reps[i].domain_id !== reps[j].domain_id && hi(reps[i]) && hi(reps[j])) return true;
      }
    }
    return false;
  };

  const reinforcing = () => clusters.some((c) => c.member_ids.length > 1);

  const checks: Record<PressureInteractionType, () => boolean> = {
    transforming,
    escalating,
    dissolving,
    cross_pressuring,
    reinforcing,
    none: () => true,
  };

  for (const p of priority) {
    if (checks[p]()) return p;
  }
  return 'none';
}

function buildClusters(eligible: PressureEvent[]): { clusters: Cluster[]; merged_cluster_ids: string[] } {
  const byDomain = new Map<string, PressureEvent[]>();
  for (const e of eligible) {
    const k = e.domain_id;
    if (!byDomain.has(k)) byDomain.set(k, []);
    byDomain.get(k)!.push(e);
  }

  const clusters: Cluster[] = [];
  const merged_cluster_ids: string[] = [];

  for (const [, arr] of [...byDomain.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...arr].sort((a, b) => comparePrimary(a, b));
    // Mechanic tags are preserved for downstream refinement, but they must not
    // change phase-1 pressure selection semantics.
    const components: PressureEvent[][] = [sorted];
    for (const comp of components) {
      const member_ids = comp.map((c) => c.pressure_event_id).sort((a, b) => a.localeCompare(b));
      const rep = [...comp].sort(comparePrimary)[0];
      clusters.push({ representative: rep, member_ids });
      if (member_ids.length > 1) {
        merged_cluster_ids.push(hashCanonicalJson({ domain: rep.domain_id, members: member_ids }));
      }
    }
  }

  clusters.sort((a, b) => a.representative.pressure_event_id.localeCompare(b.representative.pressure_event_id));
  return { clusters, merged_cluster_ids: merged_cluster_ids.sort((a, b) => a.localeCompare(b)) };
}

function neptuneUncertainty(events: PressureEvent[]): number {
  const n = events.filter((e) => e.pressure_family === 'dissolution').length;
  return Math.min(1, n * 0.15);
}

export function buildDailyPressureState(params: {
  campaign_id: string;
  mode: 'solo' | 'group';
  date: string;
  events: PressureEvent[];
  chart_ids_ordered?: string[];
  relational_volatility?: number;
}): DailyPressureBuildResult {
  const engine_version = CAMPAIGN_PHASE1_ENGINE_VERSION;
  const rules_version = CAMPAIGN_PHASE1_RULES_VERSION;

  const ranking_trace: DailyPressureState['ranking_trace'] = {
    candidate_pressure_event_ids: [],
    filtered_out_event_ids: [],
    merged_cluster_ids: [],
    tie_break_rule_applied: 'none',
  };

  const sorted = [...params.events].sort((a, b) => a.pressure_event_id.localeCompare(b.pressure_event_id));

  const eligible = sorted.filter((e) => e.activated_trait_ids.length >= 1);
  for (const e of sorted) {
    if (!eligible.includes(e)) ranking_trace.filtered_out_event_ids.push(e.pressure_event_id);
  }
  ranking_trace.filtered_out_event_ids.sort((a, b) => a.localeCompare(b));

  const { clusters, merged_cluster_ids } = buildClusters(eligible);
  ranking_trace.merged_cluster_ids = merged_cluster_ids;

  const reps = clusters.map((c) => c.representative);
  const interaction_type = evaluateInteraction(reps, clusters);

  const primaryPool = reps.filter((e) => bandRank(e.intensity_band) >= 2);
  const sortedPrimary = [...primaryPool].sort(comparePrimary);

  if (sortedPrimary.length === 0) {
    return { ok: false, code: 'NO_PRIMARY_PRESSURE', ranking_trace };
  }

  ranking_trace.candidate_pressure_event_ids = sortedPrimary.map((e) => e.pressure_event_id);
  const primary = sortedPrimary[0]!;
  if (sortedPrimary.length >= 2) {
    ranking_trace.tie_break_rule_applied = tieBreakRule(sortedPrimary[0]!, sortedPrimary[1]!);
  }

  const supportingPool = eligible
    .filter((e) => e.pressure_event_id !== primary.pressure_event_id)
    .sort((a, b) => {
      const c = comparePrimary(a, b);
      if (c !== 0) return c;
      const da = a.domain_id === primary.domain_id ? 1 : 0;
      const db = b.domain_id === primary.domain_id ? 1 : 0;
      if (da !== db) return da - db;
      return a.pressure_event_id.localeCompare(b.pressure_event_id);
    });

  const supporting: SupportingPressureRef[] = [];
  for (const e of supportingPool) {
    if (supporting.length >= 2) break;
    supporting.push({
      pressure_event_id: e.pressure_event_id,
      member_chart_id: e.member_chart_id,
      intensity_score: e.intensity_score,
      pressure_family: e.pressure_family,
      domain_id: e.domain_id,
      natal_body: e.natal_body,
      natal_house: e.natal_house,
      aspect_type: e.aspect_type,
      pressure_polarity: e.pressure_polarity,
      intensity_band: e.intensity_band,
    });
  }

  const traitSet = new Set<string>();
  for (const id of primary.activated_trait_ids) traitSet.add(id);
  for (const s of supporting) {
    const ev = eligible.find((x) => x.pressure_event_id === s.pressure_event_id);
    if (ev) for (const id of ev.activated_trait_ids) traitSet.add(id);
  }
  const activated_trait_ids = [...traitSet].sort((a, b) => a.localeCompare(b)).slice(0, 6);

  const idenSet = new Set<string>();
  for (const id of primary.identity_modifier_ids) idenSet.add(id);
  for (const s of supporting) {
    const ev = eligible.find((x) => x.pressure_event_id === s.pressure_event_id);
    if (ev) for (const id of ev.identity_modifier_ids) idenSet.add(id);
  }
  const identity_modifier_ids = [...idenSet].sort((a, b) => a.localeCompare(b));

  const mechSet = new Set<string>();
  for (const t of primary.mechanic_tags) mechSet.add(t);
  for (const s of supporting) {
    const ev = eligible.find((x) => x.pressure_event_id === s.pressure_event_id);
    if (ev) for (const t of ev.mechanic_tags) mechSet.add(t);
  }
  const mechanic_tags = [...mechSet].sort((a, b) => a.localeCompare(b));

  const carryover_bias = 0;

  let uncertainty_modifier = neptuneUncertainty(eligible);
  if (interaction_type === 'none') uncertainty_modifier = Math.min(1, uncertainty_modifier + 0.08);
  if (typeof params.relational_volatility === 'number') {
    uncertainty_modifier = Math.min(1, uncertainty_modifier + params.relational_volatility * 0.25);
  }
  uncertainty_modifier = Math.round(uncertainty_modifier * 10000) / 10000;

  const contributing = new Set<string>();
  contributing.add(primary.pressure_event_id);
  for (const s of supporting) contributing.add(s.pressure_event_id);
  const contributing_member_chart_ids = [
    ...new Set(
      eligible
        .filter((e) => contributing.has(e.pressure_event_id) && e.member_chart_id)
        .map((e) => e.member_chart_id as string)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const primary_member_chart_ids = primary.member_chart_id ? [primary.member_chart_id] : [];

  const pressure_event_set_hash = hashCanonicalJson({
    eligible_ids: eligible.map((e) => e.pressure_event_id).sort((a, b) => a.localeCompare(b)),
    interaction_type,
  });

  const daily_pressure_state_id = hashCanonicalJson([
    params.campaign_id,
    params.mode,
    params.date,
    primary.pressure_event_id,
    supporting.map((p) => p.pressure_event_id).sort((a, b) => a.localeCompare(b)),
    interaction_type,
    pressure_event_set_hash,
    engine_version,
    rules_version,
  ]);

  const state: DailyPressureState = {
    daily_pressure_state_id,
    campaign_id: params.campaign_id,
    mode: params.mode,
    date: params.date,
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
    supporting_pressures: supporting,
    interaction_type,
    activated_trait_ids,
    identity_modifier_ids,
    mechanic_tags,
    carryover_bias,
    uncertainty_modifier,
    event_count: sorted.length,
    eligible_event_count: eligible.length,
    ranking_trace,
    group_context:
      params.mode === 'group'
        ? {
            member_count: params.chart_ids_ordered?.length ?? contributing_member_chart_ids.length,
            contributing_member_chart_ids,
            primary_member_chart_ids,
          }
        : undefined,
    provenance: {
      pressure_event_set_hash,
      engine_version,
      rules_version,
    },
  };

  return { ok: true, state };
}
