/**
 * Local verification for Campaign Phase 1 (determinism + solo/group resolver).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/campaign-phase1-verify.js
 */

import type { EphemerisSnapshot } from '../contracts';
import { resolveCampaignDaily } from '../campaign/phase1';
import { hashCanonicalJson } from '../rpg/hash/json-hash';

function baseLon(i: number): number {
  return (i * 30 + 5) % 360;
}

function makeFullSnapshot(ts: string, offset: number): EphemerisSnapshot {
  const names = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ];
  const planets = names.map((name, i) => ({
    name,
    lon: (baseLon(i) + offset) % 360,
  }));
  return {
    ts,
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets,
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function main(): void {
  let failed = false;
  const natal = makeFullSnapshot('1990-06-15T14:30:00Z', 0);
  const transit = makeFullSnapshot('2026-03-28T12:00:00Z', 3);

  const solo1 = resolveCampaignDaily({
    kind: 'solo',
    campaign_id: 'camp_solo_test',
    chart_id: 'chart_a',
    date: '2026-03-28',
    state_hash_before: 'abc',
    natal,
    transit,
  });
  const solo2 = resolveCampaignDaily({
    kind: 'solo',
    campaign_id: 'camp_solo_test',
    chart_id: 'chart_a',
    date: '2026-03-28',
    state_hash_before: 'abc',
    natal,
    transit,
  });

  const h1 = hashCanonicalJson(solo1.pressure_events.map((e) => e.pressure_event_id).sort());
  const h2 = hashCanonicalJson(solo2.pressure_events.map((e) => e.pressure_event_id).sort());
  if (h1 !== h2) {
    console.error('FAIL: solo PressureEvent set not deterministic');
    failed = true;
  } else {
    console.log('OK solo PressureEvent ids deterministic');
  }

  if (solo1.daily_pressure_state && solo2.daily_pressure_state) {
    if (
      solo1.daily_pressure_state.daily_pressure_state_id !== solo2.daily_pressure_state.daily_pressure_state_id
    ) {
      console.error('FAIL: solo DailyPressureState id mismatch');
      failed = true;
    } else {
      console.log('OK solo DailyPressureState id stable');
    }
  } else if (!solo1.refusal && !solo2.refusal) {
    console.error('FAIL: expected daily state or refusal');
    failed = true;
  } else {
    console.log('OK solo refusal path deterministic (no primary)');
  }

  const natalB = makeFullSnapshot('1991-01-01T09:00:00Z', 7);
  const chartIds = ['chart_a', 'chart_b'];
  const g1 = resolveCampaignDaily({
    kind: 'group',
    campaign_id: 'camp_grp',
    group_id: 'grp_1',
    date: '2026-03-28',
    state_hash_before: 'x',
    chart_ids_ordered: chartIds,
    member_natals: [natal, natalB],
    transit,
    vector_hashes: { chart_a: 'ha', chart_b: 'hb' },
  });
  const g2 = resolveCampaignDaily({
    kind: 'group',
    campaign_id: 'camp_grp',
    group_id: 'grp_1',
    date: '2026-03-28',
    state_hash_before: 'x',
    chart_ids_ordered: chartIds,
    member_natals: [natal, natalB],
    transit,
    vector_hashes: { chart_a: 'ha', chart_b: 'hb' },
  });

  const gh1 = hashCanonicalJson(g1.pressure_events.map((e) => e.pressure_event_id).sort());
  const gh2 = hashCanonicalJson(g2.pressure_events.map((e) => e.pressure_event_id).sort());
  if (gh1 !== gh2) {
    console.error('FAIL: group PressureEvent set not deterministic');
    failed = true;
  } else {
    console.log('OK group PressureEvent ids deterministic');
  }

  const synth = solo1.pressure_events[0]?.activated_trait_ids[0] ?? '';
  if (!synth.startsWith('eligibility_trait_phase1_v1:')) {
    console.error('FAIL: synthetic trait prefix missing');
    failed = true;
  } else {
    console.log('OK synthetic trait namespace');
  }

  if (failed) {
    process.exit(1);
  }
  console.log('campaign-phase1-verify: all checks passed');
}

main();
