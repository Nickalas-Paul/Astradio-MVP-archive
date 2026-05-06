/**
 * Community relational weather feed — deterministic ranking over established connections only.
 *
 * Ordering (locked, server-side, identical for pair and group):
 * 1. activation_effective DESC — clamp01(0.55 * weather_activation_intensity + 0.45 * overall_relational_intensity)
 * 2. RelationalFieldScoreContract.scalar_outputs.overall_relational_intensity DESC
 * 3. Tie-break ASC: canonical field object_identity_hash (lexical)
 *
 * weather_activation_intensity is overlay activation_vector.intensity (transit weather only).
 * Requires activation_overlay — natal-only / missing transit is rejected.
 * Does not use compatibility-intent, matches, recency, or engagement.
 */

import { snapshotFingerprint } from '../canonical/stable-json';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import { clamp01 } from '../compatibility/stable';
import { fetchChartSnapshot } from '../core/architecture-engine';
import type { CrossAspectHitV1, RelationalWeatherStateV1 } from '../relational/weather/types';
import { buildFeedCollapsedDisplayV1, type FeedCollapsedDisplayV1 } from './feed-collapsed-display';
import { selectDisplayedFeedAspectForSortedRow } from './feed-displayed-aspect-v1';

/**
 * Documented sort tuple id; bump when tuple definition changes.
 * v3: pair feed dedupes duplicate astradio_relationships rows (same charts + label) to viewer-owned binding_id.
 */
export const COMMUNITY_RELATIONAL_FEED_SORT_VERSION = 'community_relational_feed_sort_v3';
const COMMUNITY_RELATIONAL_EXPRESSION_VERSION = 'community_relational_expression_v3';

export interface TransitInputV1 {
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export function parseCommunityFeedTransit(value: unknown): TransitInputV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.date !== 'string' ||
    typeof candidate.time !== 'string' ||
    typeof candidate.lat !== 'number' ||
    typeof candidate.lon !== 'number'
  ) {
    return null;
  }
  return {
    date: candidate.date.slice(0, 10),
    time: candidate.time.slice(0, 5),
    lat: candidate.lat,
    lon: candidate.lon,
    timezone: typeof candidate.timezone === 'string' ? candidate.timezone : undefined,
  };
}

export type CommunityFeedConnectionKind = 'pair' | 'relational_group' | 'campaign_group';

export interface CommunityRelationalFeedItemV1 {
  feed_item_id: string;
  connection_kind: CommunityFeedConnectionKind;
  binding_id: string;
  chart_ids_ordered: string[];
  /** User-facing line (e.g. You · label, Group · name). */
  connection_identity_line: string;
  /** Collapsed card: one sky signal + descriptor; derived from existing transit/activation snapshot only. */
  collapsed_display: FeedCollapsedDisplayV1;
  compatibility_field_hash: string;
  relational_weather_state_hash: string | null;
  transit_snapshot_hash: string;
  ranking: {
    /** Transit relational weather intensity only (overlay activation_vector.intensity). */
    weather_activation_intensity: number;
    /** Feed projection: blend of weather + canonical overall_relational_intensity; primary sort key. */
    activation_effective: number;
    overall_relational_intensity: number;
    tie_break_key: string;
  };
  artifactStatus: 'not_generated' | 'available' | 'partial' | 'failed';
}

/** Pass-1 row (before diversity display); `collapsed_display` applied in pass 2 after sort. */
export type CommunityRelationalFeedItemPass1V1 = Omit<CommunityRelationalFeedItemV1, 'collapsed_display'> & {
  transit_weather: RelationalWeatherStateV1 | null;
};

export interface CommunityRelationalFeedResponseV1 {
  version: 'community_relational_feed_v1';
  sort_tuple_version: typeof COMMUNITY_RELATIONAL_FEED_SORT_VERSION;
  userId: string;
  transit_lock: {
    ts: string;
    lat: number;
    lon: number;
    tz: string;
  };
  transit_snapshot_hash: string;
  relational_weather_state_hash: string | null;
  generated_at: string;
  items: CommunityRelationalFeedItemV1[];
}

export type ListRelationshipByParticipantRow = {
  id: string;
  chartIdLow: string;
  chartIdHigh: string;
  ownerUserId: string;
  label: string;
};

type PgStore = {
  listRelationshipsByParticipant: (userId: string) => Promise<Array<ListRelationshipByParticipantRow>>;
  listRelationalGroupsAccessibleToUser: (userId: string) => Promise<Array<{ id: string; name?: string }>>;
  listRelationalGroupMembersForScope: (
    groupId: string,
    viewerUserId: string
  ) => Promise<Array<{ chartId: string }> | undefined>;
  listStage5CampaignsByOwnerOrParticipant: (userId: string) => Promise<
    Array<{ campaignId: string; participantChartIds: string[]; contextKey?: string }>
  >;
  canonicalDayBucketFromTransitTs: (transitTs: string) => string;
  getUserPrimaryChart: (userId: string) => Promise<string | undefined>;
  getCommunityRelationalWeatherStatusesForFeed: (input: {
    canonicalDayBucket: string;
    currentExpressionVersion?: string;
    /** Pair artifact rows are seeker-scoped; required for correct pair status (groups ignore). */
    viewerPrimaryChartId: string;
    identities: Array<{ scopeKind: 'pair' | 'group'; bindingId: string; chartIdsOrdered: string[] }>;
  }) => Promise<Map<string, 'not_generated' | 'available' | 'partial' | 'failed'>>;
};

function uniqueSortedChartIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.trim()))).sort((a, b) =>
    a.localeCompare(b, 'en')
  );
}

function compareFeedRanking(
  a: { ranking: CommunityRelationalFeedItemV1['ranking'] },
  b: { ranking: CommunityRelationalFeedItemV1['ranking'] }
): number {
  const ae = a.ranking.activation_effective;
  const be = b.ranking.activation_effective;
  if (be !== ae) return be - ae;
  const ao = a.ranking.overall_relational_intensity;
  const bo = b.ranking.overall_relational_intensity;
  if (bo !== ao) return bo - ao;
  return a.ranking.tie_break_key.localeCompare(b.ranking.tie_break_key, 'en');
}

/**
 * Pass 2: deterministic display aspect selection + collapsed strings (after ranking is final).
 * Exported for regression tests.
 */
export function applyFeedCollapsedDisplayPass2(
  sortedPass1: CommunityRelationalFeedItemPass1V1[]
): CommunityRelationalFeedItemV1[] {
  let recentWindow: string[] = [];
  const out: CommunityRelationalFeedItemV1[] = [];
  for (let i = 0; i < sortedPass1.length; i++) {
    const row = sortedPass1[i]!;
    const weather = row.transit_weather;
    const hits = weather?.aspects?.topCrossAspects ?? [];
    let displayHit: CrossAspectHitV1 | undefined;
    if (hits.length > 0) {
      const sel = selectDisplayedFeedAspectForSortedRow({
        hits,
        recentKeyWindow: recentWindow,
      });
      displayHit = sel.hit;
      recentWindow = sel.nextWindow;
    }
    const collapsed_display = buildFeedCollapsedDisplayV1(weather, displayHit);
    const { transit_weather: _drop, ...rest } = row;
    out.push({
      ...rest,
      collapsed_display,
    });
  }
  return out;
}

/**
 * Collapse duplicate `astradio_relationships` rows (Option B: two per pair) to one Community feed id.
 *
 * **Canonical key:** (ordered chart ids) + (trimmed label) — one logical pair.
 * **Selection:** the row with `ownerUserId === viewerUserId` (viewer "owns" the relationship copy); if neither or both
 * match, pick lexicographically smaller `id` (deterministic, stable for tests).
 */
export function selectCanonicalPairRowsForFeed(
  viewerUserId: string,
  rels: Array<ListRelationshipByParticipantRow>
): Array<ListRelationshipByParticipantRow> {
  const v = String(viewerUserId || '').trim();
  const groups = new Map<string, ListRelationshipByParticipantRow[]>();
  for (const r of rels) {
    const chartIdsOrdered = uniqueSortedChartIds([r.chartIdLow, r.chartIdHigh]);
    if (chartIdsOrdered.length < 2) continue;
    const label = String(r.label || '').trim();
    const gk = `pair|${chartIdsOrdered.join('\u0000')}|${label}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk)!.push(r);
  }
  const out: ListRelationshipByParticipantRow[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]!);
      continue;
    }
    let best = g[0]!;
    for (let i = 1; i < g.length; i++) {
      const cur = g[i]!;
      const aOwner = String(best.ownerUserId || '').trim() === v;
      const cOwner = String(cur.ownerUserId || '').trim() === v;
      if (cOwner && !aOwner) {
        best = cur;
        continue;
      }
      if (aOwner && !cOwner) {
        continue;
      }
      if (String(cur.id).localeCompare(String(best.id), 'en') < 0) {
        best = cur;
      }
    }
    out.push(best);
  }
  return out;
}

/**
 * Build ordered relational feed for a user. Throws if transit invalid or Postgres unavailable.
 */
export async function buildCommunityRelationalFeed(params: {
  userId: string;
  transitInput: TransitInputV1;
  pgStore: PgStore;
}): Promise<CommunityRelationalFeedResponseV1> {
  const { userId, transitInput, pgStore } = params;

  const work: Array<{
    connection_kind: CommunityFeedConnectionKind;
    binding_id: string;
    chart_ids_ordered: string[];
    connection_identity_line: string;
  }> = [];

  const relsRaw = await pgStore.listRelationshipsByParticipant(userId);
  const rels = selectCanonicalPairRowsForFeed(userId, relsRaw);
  for (const r of rels) {
    const chart_ids_ordered = uniqueSortedChartIds([r.chartIdLow, r.chartIdHigh]);
    if (chart_ids_ordered.length >= 2) {
      const lab = String(r.label || '').trim();
      work.push({
        connection_kind: 'pair',
        binding_id: r.id,
        chart_ids_ordered,
        connection_identity_line: lab ? `You · ${lab}` : 'You · Connection',
      });
    }
  }

  const groups = await pgStore.listRelationalGroupsAccessibleToUser(userId);
  for (const g of groups) {
    const members = await pgStore.listRelationalGroupMembersForScope(g.id, userId);
    if (!members?.length) continue;
    const chart_ids_ordered = uniqueSortedChartIds(members.map((m) => m.chartId));
    if (chart_ids_ordered.length >= 2) {
      const gn = String(g.name || '').trim();
      work.push({
        connection_kind: 'relational_group',
        binding_id: g.id,
        chart_ids_ordered,
        connection_identity_line: gn ? `Group · ${gn}` : 'Group',
      });
    }
  }

  const campaigns = await pgStore.listStage5CampaignsByOwnerOrParticipant(userId);
  for (const c of campaigns) {
    const chart_ids_ordered = uniqueSortedChartIds(c.participantChartIds || []);
    if (chart_ids_ordered.length >= 2) {
      const ck = String(c.contextKey || '').trim();
      work.push({
        connection_kind: 'campaign_group',
        binding_id: c.campaignId,
        chart_ids_ordered,
        connection_identity_line: ck ? `Campaign · ${ck.slice(0, 32)}` : 'Campaign',
      });
    }
  }

  if (work.length === 0) {
    const snap = await fetchChartSnapshot(transitInput);
    return {
      version: 'community_relational_feed_v1',
      sort_tuple_version: COMMUNITY_RELATIONAL_FEED_SORT_VERSION,
      userId,
      transit_lock: { ts: snap.ts, lat: snap.lat, lon: snap.lon, tz: snap.tz },
      transit_snapshot_hash: snapshotFingerprint(snap),
      relational_weather_state_hash: null,
      generated_at: new Date().toISOString(),
      items: [],
    };
  }

  const pass1: CommunityRelationalFeedItemPass1V1[] = [];
  let envelopeLock: CommunityRelationalFeedResponseV1['transit_lock'] | null = null;
  let envelopeTransitSnap: string | null = null;
  let envelopeWeather: string | null = null;

  for (const w of work) {
    const computed = await computeCompatibilitySystem({
      chartIds: w.chart_ids_ordered,
      relationshipBindingId: w.binding_id,
      transitInput,
    });
    const overlay = computed.field.activation_overlay;
    if (!overlay) {
      throw new Error('Community relational feed requires activation_overlay (transit must produce overlay)');
    }
    const scoring: RelationalFieldScoreContract = computed.scoring;
    const weather_activation_intensity = overlay.activation_vector.intensity;
    const overall_relational_intensity = scoring.scalar_outputs.overall_relational_intensity;
    const activation_effective = clamp01(
      0.55 * weather_activation_intensity + 0.45 * overall_relational_intensity
    );
    const tie_break_key = computed.field.object_identity_hash;

    if (!envelopeLock) {
      envelopeLock = { ...overlay.transit_lock };
      envelopeTransitSnap = overlay.transit_snapshot_hash;
      envelopeWeather = overlay.relational_weather_state_hash;
    }

    pass1.push({
      feed_item_id: `${w.connection_kind}:${w.binding_id}`,
      connection_kind: w.connection_kind,
      binding_id: w.binding_id,
      chart_ids_ordered: w.chart_ids_ordered,
      connection_identity_line: w.connection_identity_line,
      transit_weather: computed.transit_weather,
      compatibility_field_hash: computed.field.object_identity_hash,
      relational_weather_state_hash: overlay.relational_weather_state_hash,
      transit_snapshot_hash: overlay.transit_snapshot_hash,
      ranking: {
        weather_activation_intensity,
        activation_effective,
        overall_relational_intensity,
        tie_break_key,
      },
      artifactStatus: 'not_generated',
    });
  }

  pass1.sort(compareFeedRanking);

  const canonicalDayBucket = pgStore.canonicalDayBucketFromTransitTs(envelopeLock?.ts || '');
  const viewerPrimaryChartId = (await pgStore.getUserPrimaryChart(userId)) || '';
  if (canonicalDayBucket) {
    const scoped = pass1
      .filter((x) => x.connection_kind === 'pair' || x.connection_kind === 'relational_group')
      .map((x) => ({
        scopeKind: x.connection_kind === 'pair' ? 'pair' : 'group',
        bindingId: x.binding_id,
        chartIdsOrdered: x.chart_ids_ordered,
      })) as Array<{ scopeKind: 'pair' | 'group'; bindingId: string; chartIdsOrdered: string[] }>;
    const statusByIdentity = await pgStore.getCommunityRelationalWeatherStatusesForFeed({
      canonicalDayBucket,
      currentExpressionVersion: COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
      viewerPrimaryChartId,
      identities: scoped,
    });
    for (const item of pass1) {
      if (item.connection_kind === 'campaign_group') {
        item.artifactStatus = 'not_generated';
        continue;
      }
      const key = `${item.connection_kind === 'pair' ? 'pair' : 'group'}:${item.binding_id}`;
      const status = statusByIdentity.get(key) || 'not_generated';
      item.artifactStatus = status;
    }
  }

  const items = applyFeedCollapsedDisplayPass2(pass1);

  if (!envelopeLock) {
    throw new Error('Community relational feed: missing transit envelope');
  }

  return {
    version: 'community_relational_feed_v1',
    sort_tuple_version: COMMUNITY_RELATIONAL_FEED_SORT_VERSION,
    userId,
    transit_lock: envelopeLock,
    transit_snapshot_hash: envelopeTransitSnap || '',
    relational_weather_state_hash: envelopeWeather,
    generated_at: new Date().toISOString(),
    items,
  };
}
