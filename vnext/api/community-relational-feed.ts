/**
 * Community relational weather feed — deterministic ranking over established connections only.
 *
 * Ordering (locked, server-side, identical for pair and group):
 * 1. activation_overlay.activation_vector.intensity DESC
 * 2. RelationalFieldScoreContract.scalar_outputs.overall_relational_intensity DESC
 * 3. Tie-break ASC: canonical field object_identity_hash (lexical)
 *
 * Requires activation_overlay — natal-only / missing transit is rejected.
 * Does not use compatibility-intent, matches, recency, or engagement.
 */

import { snapshotFingerprint } from '../canonical/stable-json';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import { fetchChartSnapshot } from '../core/architecture-engine';

/** Documented sort tuple id; bump when tuple definition changes. */
export const COMMUNITY_RELATIONAL_FEED_SORT_VERSION = 'community_relational_feed_sort_v1';

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
  compatibility_field_hash: string;
  relational_weather_state_hash: string | null;
  transit_snapshot_hash: string;
  ranking: {
    activation_intensity: number;
    overall_relational_intensity: number;
    tie_break_key: string;
  };
}

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

type PgStore = {
  listRelationshipsByOwner: (userId: string) => Promise<
    Array<{ id: string; chartIdLow: string; chartIdHigh: string }>
  >;
  listRelationalGroupsAccessibleToUser: (userId: string) => Promise<Array<{ id: string }>>;
  listRelationalGroupMembersForScope: (
    groupId: string,
    viewerUserId: string
  ) => Promise<Array<{ chartId: string }> | undefined>;
  listStage5CampaignsByOwnerOrParticipant: (userId: string) => Promise<
    Array<{ campaignId: string; participantChartIds: string[] }>
  >;
};

function uniqueSortedChartIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.trim()))).sort((a, b) =>
    a.localeCompare(b, 'en')
  );
}

function compareFeedItems(a: CommunityRelationalFeedItemV1, b: CommunityRelationalFeedItemV1): number {
  const ai = a.ranking.activation_intensity;
  const bi = b.ranking.activation_intensity;
  if (bi !== ai) return bi - ai;
  const ao = a.ranking.overall_relational_intensity;
  const bo = b.ranking.overall_relational_intensity;
  if (bo !== ao) return bo - ao;
  return a.ranking.tie_break_key.localeCompare(b.ranking.tie_break_key, 'en');
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
  }> = [];

  const rels = await pgStore.listRelationshipsByOwner(userId);
  for (const r of rels) {
    const chart_ids_ordered = uniqueSortedChartIds([r.chartIdLow, r.chartIdHigh]);
    if (chart_ids_ordered.length >= 2) {
      work.push({ connection_kind: 'pair', binding_id: r.id, chart_ids_ordered });
    }
  }

  const groups = await pgStore.listRelationalGroupsAccessibleToUser(userId);
  for (const g of groups) {
    const members = await pgStore.listRelationalGroupMembersForScope(g.id, userId);
    if (!members?.length) continue;
    const chart_ids_ordered = uniqueSortedChartIds(members.map((m) => m.chartId));
    if (chart_ids_ordered.length >= 2) {
      work.push({ connection_kind: 'relational_group', binding_id: g.id, chart_ids_ordered });
    }
  }

  const campaigns = await pgStore.listStage5CampaignsByOwnerOrParticipant(userId);
  for (const c of campaigns) {
    const chart_ids_ordered = uniqueSortedChartIds(c.participantChartIds || []);
    if (chart_ids_ordered.length >= 2) {
      work.push({ connection_kind: 'campaign_group', binding_id: c.campaignId, chart_ids_ordered });
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

  const items: CommunityRelationalFeedItemV1[] = [];
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
    const activation_intensity = overlay.activation_vector.intensity;
    const overall_relational_intensity = scoring.scalar_outputs.overall_relational_intensity;
    const tie_break_key = computed.field.object_identity_hash;

    if (!envelopeLock) {
      envelopeLock = { ...overlay.transit_lock };
      envelopeTransitSnap = overlay.transit_snapshot_hash;
      envelopeWeather = overlay.relational_weather_state_hash;
    }

    items.push({
      feed_item_id: `${w.connection_kind}:${w.binding_id}`,
      connection_kind: w.connection_kind,
      binding_id: w.binding_id,
      chart_ids_ordered: w.chart_ids_ordered,
      compatibility_field_hash: computed.field.object_identity_hash,
      relational_weather_state_hash: overlay.relational_weather_state_hash,
      transit_snapshot_hash: overlay.transit_snapshot_hash,
      ranking: {
        activation_intensity,
        overall_relational_intensity,
        tie_break_key,
      },
    });
  }

  items.sort(compareFeedItems);

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
