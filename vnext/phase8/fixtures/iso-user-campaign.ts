/**
 * Phase 8 Stage 5 — isolation verification fixture only.
 * Second deterministic test user (phase8_iso_user). Not a product feature.
 * Gated by debug endpoints only. Do not import from resolve-real-user-campaign.
 */

import type { EphemerisSnapshot } from '../../contracts';
import { generateNatalSnapshot } from '../generate-natal-snapshot';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
  upsertUserProfileForPhase8,
} from '../../rpg/store/rpg-store';
import { initialCampaignState } from '../../rpg/campaign/state-machine';
import { buildRpgEffectsBundleFromSnapshot } from '../../rpg/effects/bundle-from-snapshot';
import { getOrCreateDailyTurn } from '../../rpg/campaign/turn-service';
import {
  createUser as compatCreateUser,
  getUser as compatGetUser,
  createChart as compatCreateChart,
  getChart as compatGetChart,
  setUserPrimaryChart as compatSetUserPrimaryChart,
  getUserPrimaryChart as compatGetUserPrimaryChart,
} from '../../compat/storage';
import type { Phase8BootstrapResponse } from '../debug-bootstrap-contract';

export const PHASE8_ISO_USER_ID = 'phase8_iso_user';
export const PHASE8_ISO_CHART_ID = 'phase8_iso_chart';

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

export async function getOrCreatePhase8IsoUserCampaign(): Promise<Phase8BootstrapResponse> {
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
