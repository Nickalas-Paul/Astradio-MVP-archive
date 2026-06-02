import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialSandboxCompositionModelState,
  isBlankCanvasGenerateEligible,
  isBlankCanvasSlot,
  blankCanvasSlotHasPlacedPlanets,
  serializeSandboxResolveRequestBody,
  sandboxCompositionReducer,
} from './sandbox-composition-state';
import { dailyTransitBirth, applyBlankCanvasEqualHouses, DAILY_TRANSIT_COMPOSE_TIME } from './sandbox-transit-birth';
import type { EphemerisSnapshot } from '../types/sandbox';

test('dailyTransitBirth uses noon and default Texas location', () => {
  const birth = dailyTransitBirth();
  assert.equal(birth.time, DAILY_TRANSIT_COMPOSE_TIME);
  assert.equal(birth.location.lat, 29.42);
  assert.equal(birth.location.lon, -98.49);
  assert.equal(birth.location.timezone, 'America/Chicago');
  assert.equal(birth.houseSystem, 'placidus');
  assert.match(birth.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('applyBlankCanvasEqualHouses sets equal cusps from ASC', () => {
  const base = {
    ts: '2026-01-01T12:00:00.000Z',
    tz: 'UTC',
    lat: 0,
    lon: 0,
    houseSystem: 'placidus',
    planets: [],
    houses: [10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340] as EphemerisSnapshot['houses'],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
  const patched = applyBlankCanvasEqualHouses(base, 15);
  assert.equal(patched.houseSystem, 'equal');
  assert.deepEqual(patched.houses, [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345]);
});

test('blank canvas generate eligibility', () => {
  let state = createInitialSandboxCompositionModelState();
  state = sandboxCompositionReducer(state, { type: 'set_entry_mode', entryMode: 'blank_canvas' });
  assert.equal(isBlankCanvasSlot(state.compositionInput.slots[0]!), true);
  assert.equal(isBlankCanvasGenerateEligible(state.compositionInput, 0), false);

  state = sandboxCompositionReducer(state, {
    type: 'overrides_changed',
    overrides: { planets: { sun: { lonDeg: 120 } } },
  });
  assert.equal(blankCanvasSlotHasPlacedPlanets(state.compositionInput.slots[0]!), true);
  assert.equal(isBlankCanvasGenerateEligible(state.compositionInput, 0), true);
});

test('serializeSandboxResolveRequestBody injects transient ephemeris birth', () => {
  const state = createInitialSandboxCompositionModelState();
  const birth = dailyTransitBirth();
  const body = serializeSandboxResolveRequestBody(state, 'abc123seed', {
    transientEphemerisBirthBySlotIndex: { 0: birth },
  });
  const slot0 = (body.slots as Record<string, unknown>[])[0]!;
  assert.ok(slot0.ephemeris_birth);
  assert.equal((state.compositionInput.slots[0] as { ephemeris_birth?: unknown }).ephemeris_birth, undefined);
});

test('clear_slot resets entry_mode', () => {
  let state = createInitialSandboxCompositionModelState();
  state = sandboxCompositionReducer(state, { type: 'set_entry_mode', entryMode: 'blank_canvas' });
  state = sandboxCompositionReducer(state, { type: 'clear_slot', index: 0 });
  assert.equal(state.compositionInput.slots[0]!.entry_mode, undefined);
});
