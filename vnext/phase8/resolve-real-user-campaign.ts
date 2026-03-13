// vnext/phase8/resolve-real-user-campaign.ts
// Phase 8 proof lane: get-or-create real user + campaign + one deterministic daily turn.
// Shared by create-test-user API and /campaign default entrypoint when PHASE8_DEBUG=1.

import type { EphemerisSnapshot } from '../contracts';
import { generateNatalSnapshot } from './generate-natal-snapshot';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
  upsertUserProfileForPhase8,
} from '../rpg/store/rpg-store';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { getOrCreateDailyTurn } from '../rpg/campaign/turn-service';
import {
  createUser as compatCreateUser,
  getUser as compatGetUser,
  createChart as compatCreateChart,
  getChart as compatGetChart,
  setUserPrimaryChart as compatSetUserPrimaryChart,
  getUserPrimaryChart as compatGetUserPrimaryChart,
} from '../compat/storage';

export const PHASE8_REAL_USER_ID = 'phase8_real_user';
export const PHASE8_REAL_CHART_ID = 'phase8_real_chart';

/** Stage 5 isolation verification: second deterministic test user (distinct from real user). */
export const PHASE8_ISO_USER_ID = 'phase8_iso_user';
export const PHASE8_ISO_CHART_ID = 'phase8_iso_chart';

const BIRTH_DATE = '1990-01-01';
const BIRTH_TIME = '12:00';
const BIRTH_LOCATION = 'New York, NY, USA';
const BIRTH_LAT = 40.7128;
const BIRTH_LON = -74.006;

/** Deterministic transit snapshot for the one daily turn (same date key = stable turn). */
function getPhase8RealUserTransitSnapshot(): EphemerisSnapshot {
  return {
    ts: '2036-03-15T12:00:00Z',
    tz: 'UTC',
    lat: BIRTH_LAT,
    lon: BIRTH_LON,
    houseSystem: 'placidus',
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
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [
      { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
      { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
    ],
    moonPhase: 0.7,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

async function ensureCompatProfileForPhase8RealUser(params: {
  natalSnapshot: EphemerisSnapshot;
  natalSnapshotHash: string;
}) {
  // Debug: entry + env gate (no secrets).
  // eslint-disable-next-line no-console
  console.log('[phase8][compat-linkage] enter ensureCompatProfileForPhase8RealUser', {
    hasPostgresUrl: !!process.env.POSTGRES_URL,
  });

  // Compat storage is only meaningful when Postgres is configured; in in-memory mode
  // the Phase 8 verifier uses explicit user linkage instead.
  if (!process.env.POSTGRES_URL) {
    // eslint-disable-next-line no-console
    console.log('[phase8][compat-linkage] skip: POSTGRES_URL missing');
    return;
  }

  const displayName = 'Phase 8 Real User';
  const chartLabel = 'Phase 8 Real Chart';

  // 1) Ensure compat user row exists (idempotent).
  const existingUser = await compatGetUser(PHASE8_REAL_USER_ID).catch(() => {
    // eslint-disable-next-line no-console
    console.log('[phase8][compat-linkage] getUser error', {
      userId: PHASE8_REAL_USER_ID,
      success: false,
    });
    return undefined;
  });
  // eslint-disable-next-line no-console
  console.log('[phase8][compat-linkage] getUser result', {
    userId: PHASE8_REAL_USER_ID,
    exists: !!existingUser,
  });
  if (!existingUser) {
    try {
      await compatCreateUser({
        id: PHASE8_REAL_USER_ID,
        displayName,
      });
      // eslint-disable-next-line no-console
      console.log('[phase8][compat-linkage] createUser success', {
        userId: PHASE8_REAL_USER_ID,
        success: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[phase8][compat-linkage] createUser error', {
        userId: PHASE8_REAL_USER_ID,
        success: false,
      });
      // Ignore duplicate or transient errors here; a concurrent creator may have won the race.
    }
  }

  // 2) Ensure compat chart row exists with the pinned chart id.
  let chart = await compatGetChart(PHASE8_REAL_CHART_ID).catch(() => {
    // eslint-disable-next-line no-console
    console.log('[phase8][compat-linkage] getChart error', {
      chartId: PHASE8_REAL_CHART_ID,
      success: false,
    });
    return undefined;
  });
  // eslint-disable-next-line no-console
  console.log('[phase8][compat-linkage] getChart result', {
    chartId: PHASE8_REAL_CHART_ID,
    exists: !!chart,
  });
  if (!chart) {
    const ts = params.natalSnapshot.ts;
    const date = typeof ts === 'string' ? ts.slice(0, 10) : BIRTH_DATE;
    const time = typeof ts === 'string' ? ts.slice(11, 16) : BIRTH_TIME;

    try {
      chart = await compatCreateChart({
        id: PHASE8_REAL_CHART_ID,
        ownerId: PHASE8_REAL_USER_ID,
        label: chartLabel,
        date,
        time,
        lat: BIRTH_LAT,
        lon: BIRTH_LON,
        timezone: params.natalSnapshot.tz ?? 'America/New_York',
        snapshotHash: params.natalSnapshotHash,
      });
      // eslint-disable-next-line no-console
      console.log('[phase8][compat-linkage] createChart success', {
        chartId: PHASE8_REAL_CHART_ID,
        success: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[phase8][compat-linkage] createChart error', {
        chartId: PHASE8_REAL_CHART_ID,
        success: false,
      });
      // If chart already exists or creation races, fall through and rely on whatever is stored.
      chart = await compatGetChart(PHASE8_REAL_CHART_ID).catch(() => {
        // eslint-disable-next-line no-console
        console.log('[phase8][compat-linkage] getChart-after-create error', {
          chartId: PHASE8_REAL_CHART_ID,
          success: false,
        });
        return undefined;
      });
    }
  }

  // 3) Ensure compat primary-chart linkage for this user.
  const currentPrimary = await compatGetUserPrimaryChart(
    PHASE8_REAL_USER_ID
  ).catch(() => {
    // eslint-disable-next-line no-console
    console.log('[phase8][compat-linkage] getUserPrimaryChart error', {
      userId: PHASE8_REAL_USER_ID,
      success: false,
    });
    return undefined;
  });
  // eslint-disable-next-line no-console
  console.log('[phase8][compat-linkage] getUserPrimaryChart result', {
    userId: PHASE8_REAL_USER_ID,
    chartId: currentPrimary ?? null,
  });
  if (!currentPrimary) {
    try {
      await compatSetUserPrimaryChart(PHASE8_REAL_USER_ID, PHASE8_REAL_CHART_ID);
      // eslint-disable-next-line no-console
      console.log('[phase8][compat-linkage] setUserPrimaryChart success', {
        userId: PHASE8_REAL_USER_ID,
        chartId: PHASE8_REAL_CHART_ID,
        success: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[phase8][compat-linkage] setUserPrimaryChart error', {
        userId: PHASE8_REAL_USER_ID,
        chartId: PHASE8_REAL_CHART_ID,
        success: false,
      });
      // If this fails, profile GET will still fall back to default behavior; verifier will surface it.
    }
  }

  // Final readback to confirm linkage state.
  const finalUser = await compatGetUser(PHASE8_REAL_USER_ID).catch(() => undefined);
  const finalChart = await compatGetChart(PHASE8_REAL_CHART_ID).catch(() => undefined);
  const finalPrimary = await compatGetUserPrimaryChart(PHASE8_REAL_USER_ID).catch(
    () => undefined
  );
  // eslint-disable-next-line no-console
  console.log('[phase8][compat-linkage] final-state', {
    userExists: !!finalUser,
    chartExists: !!finalChart,
    primaryChartId: finalPrimary ?? null,
  });
}

// --- Stage 5 isolation lane: second deterministic user (phase8_iso_user) ---
const ISO_BIRTH_DATE = '1985-06-15';
const ISO_BIRTH_TIME = '14:00';
const ISO_BIRTH_LOCATION = 'London, UK';
const ISO_BIRTH_LAT = 51.5074;
const ISO_BIRTH_LON = -0.1278;

function getPhase8IsoUserTransitSnapshot(): EphemerisSnapshot {
  return {
    ts: '2036-06-20T14:00:00Z',
    tz: 'UTC',
    lat: ISO_BIRTH_LAT,
    lon: ISO_BIRTH_LON,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 90 },
      { name: 'Moon', lon: 270 },
      { name: 'Mercury', lon: 105 },
      { name: 'Venus', lon: 45 },
      { name: 'Mars', lon: 180 },
      { name: 'Jupiter', lon: 210 },
      { name: 'Saturn', lon: 30 },
      { name: 'Uranus', lon: 150 },
      { name: 'Neptune', lon: 60 },
      { name: 'Pluto', lon: 240 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [
      { bodyA: 'sun', bodyB: 'mars', type: 'square', orb: 2.5 },
      { bodyA: 'moon', bodyB: 'neptune', type: 'trine', orb: 1 },
    ],
    moonPhase: 0.25,
    dominantElements: { fire: 0, earth: 1, air: 0, water: 0 },
  };
}

async function ensureCompatProfileForPhase8IsoUser(params: {
  natalSnapshot: EphemerisSnapshot;
  natalSnapshotHash: string;
}) {
  if (!process.env.POSTGRES_URL) return;
  const displayName = 'Phase 8 Iso User';
  const chartLabel = 'Phase 8 Iso Chart';
  const existingUser = await compatGetUser(PHASE8_ISO_USER_ID).catch(() => undefined);
  if (!existingUser) {
    try {
      await compatCreateUser({ id: PHASE8_ISO_USER_ID, displayName });
    } catch {
      // idempotent: ignore duplicate
    }
  }
  let chart = await compatGetChart(PHASE8_ISO_CHART_ID).catch(() => undefined);
  if (!chart) {
    const ts = params.natalSnapshot.ts;
    const date = typeof ts === 'string' ? ts.slice(0, 10) : ISO_BIRTH_DATE;
    const time = typeof ts === 'string' ? ts.slice(11, 16) : ISO_BIRTH_TIME;
    try {
      chart = await compatCreateChart({
        id: PHASE8_ISO_CHART_ID,
        ownerId: PHASE8_ISO_USER_ID,
        label: chartLabel,
        date,
        time,
        lat: ISO_BIRTH_LAT,
        lon: ISO_BIRTH_LON,
        timezone: params.natalSnapshot.tz ?? 'Europe/London',
        snapshotHash: params.natalSnapshotHash,
      });
    } catch {
      chart = await compatGetChart(PHASE8_ISO_CHART_ID).catch(() => undefined);
    }
  }
  const currentPrimary = await compatGetUserPrimaryChart(PHASE8_ISO_USER_ID).catch(() => undefined);
  if (!currentPrimary) {
    try {
      await compatSetUserPrimaryChart(PHASE8_ISO_USER_ID, PHASE8_ISO_CHART_ID);
    } catch {
      // idempotent
    }
  }
}

export async function getOrCreatePhase8IsoUserCampaign(): Promise<{
  userId: string;
  campaignId: string;
  chartId: string;
}> {
  const natalSnapshot = await generateNatalSnapshot({
    birth_date: ISO_BIRTH_DATE,
    birth_time: ISO_BIRTH_TIME,
    birth_location: ISO_BIRTH_LOCATION,
    lat: ISO_BIRTH_LAT,
    lon: ISO_BIRTH_LON,
    timezone: 'Europe/London',
  });
  const profile = await getOrCreateRpgProfileForChart({
    userId: PHASE8_ISO_USER_ID,
    chartId: PHASE8_ISO_CHART_ID,
    snapshot: natalSnapshot,
  });
  const bundle = buildRpgEffectsBundleFromSnapshot(natalSnapshot);
  const initialState = initialCampaignState(bundle);
  await upsertUserProfileForPhase8({
    userId: PHASE8_ISO_USER_ID,
    chartId: PHASE8_ISO_CHART_ID,
    birthDate: ISO_BIRTH_DATE,
    birthTime: ISO_BIRTH_TIME,
    birthLocation: ISO_BIRTH_LOCATION,
    natalSnapshotHash: profile.natal_snapshot_hash,
    bundleHash: profile.bundle_hash,
  });
  const campaign = await getOrCreateCampaign({
    userId: PHASE8_ISO_USER_ID,
    chartId: PHASE8_ISO_CHART_ID,
    bundleHash: profile.bundle_hash,
    rpgMapVersion: profile.rpg_map_version,
    rpgAlgoVersion: 'rpg-v1',
    audioAlgoVersion: 'audio-v1',
    initialStateJson: initialState,
  });
  const transitSnapshot = getPhase8IsoUserTransitSnapshot();
  await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });
  await ensureCompatProfileForPhase8IsoUser({
    natalSnapshot,
    natalSnapshotHash: profile.natal_snapshot_hash,
  });
  return {
    userId: PHASE8_ISO_USER_ID,
    campaignId: campaign.id,
    chartId: PHASE8_ISO_CHART_ID,
  };
}

export async function getOrCreatePhase8RealUserCampaign(): Promise<{
  userId: string;
  campaignId: string;
}> {
  const natalSnapshot = await generateNatalSnapshot({
    birth_date: BIRTH_DATE,
    birth_time: BIRTH_TIME,
    birth_location: BIRTH_LOCATION,
    lat: BIRTH_LAT,
    lon: BIRTH_LON,
    timezone: 'America/New_York',
  });

  const profile = await getOrCreateRpgProfileForChart({
    userId: PHASE8_REAL_USER_ID,
    chartId: PHASE8_REAL_CHART_ID,
    snapshot: natalSnapshot,
  });

  const bundle = buildRpgEffectsBundleFromSnapshot(natalSnapshot);
  const initialState = initialCampaignState(bundle);

  await upsertUserProfileForPhase8({
    userId: PHASE8_REAL_USER_ID,
    chartId: PHASE8_REAL_CHART_ID,
    birthDate: BIRTH_DATE,
    birthTime: BIRTH_TIME,
    birthLocation: BIRTH_LOCATION,
    natalSnapshotHash: profile.natal_snapshot_hash,
    bundleHash: profile.bundle_hash,
  });

  const campaign = await getOrCreateCampaign({
    userId: PHASE8_REAL_USER_ID,
    chartId: PHASE8_REAL_CHART_ID,
    bundleHash: profile.bundle_hash,
    rpgMapVersion: profile.rpg_map_version,
    rpgAlgoVersion: 'rpg-v1',
    audioAlgoVersion: 'audio-v1',
    initialStateJson: initialState,
  });

  const transitSnapshot = getPhase8RealUserTransitSnapshot();
  await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });

  await ensureCompatProfileForPhase8RealUser({
    natalSnapshot,
    natalSnapshotHash: profile.natal_snapshot_hash,
  });

  return {
    userId: PHASE8_REAL_USER_ID,
    campaignId: campaign.id,
    chartId: PHASE8_REAL_CHART_ID,
  };
}
