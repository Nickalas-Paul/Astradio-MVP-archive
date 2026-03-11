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

export const PHASE8_REAL_USER_ID = 'phase8_real_user';
export const PHASE8_REAL_CHART_ID = 'phase8_real_chart';

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

  return {
    userId: PHASE8_REAL_USER_ID,
    campaignId: campaign.id,
  };
}
