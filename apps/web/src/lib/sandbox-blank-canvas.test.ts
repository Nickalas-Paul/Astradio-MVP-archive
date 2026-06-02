import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialSandboxCompositionModelState,
  isBlankCanvasGenerateEligible,
  isBlankCanvasSlot,
  blankCanvasSlotHasPlacedPlanets,
  getPopulatedSlotIndicesFromCompositionInput,
  populatedSlotsAreAggregateEligible,
  slotWirePopulationKind,
  serializeSandboxResolveRequestBody,
  sandboxCompositionReducer,
} from './sandbox-composition-state';
import { dailyTransitBirth, dailyTransitBirthForBlankCanvas, applyBlankCanvasEqualHouses, DAILY_TRANSIT_COMPOSE_TIME } from './sandbox-transit-birth';
import { projectSlotsFromCompositionInput } from './sandbox-slot-projection';
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
  assert.equal(slotWirePopulationKind(state.compositionInput.slots[0]!), 'empty');
  assert.equal(isBlankCanvasGenerateEligible(state.compositionInput, 0), false);

  state = sandboxCompositionReducer(state, {
    type: 'overrides_changed',
    overrides: { planets: { sun: { lonDeg: 120 } } },
  });
  assert.equal(blankCanvasSlotHasPlacedPlanets(state.compositionInput.slots[0]!), true);
  assert.equal(slotWirePopulationKind(state.compositionInput.slots[0]!), 'blank_canvas');
  assert.equal(isBlankCanvasGenerateEligible(state.compositionInput, 0), true);
});

test('blank canvas slot counts as populated in multi-slot aggregate', () => {
  let state = createInitialSandboxCompositionModelState();
  state = {
    ...state,
    compositionInput: {
      ...state.compositionInput,
      slots: [
        { chart_id: 'chart_a', overrides: { planets: {} } },
        { chart_id: 'chart_b', overrides: { planets: {} } },
        { chart_id: 'chart_c', overrides: { planets: {} } },
        { entry_mode: 'blank_canvas', overrides: { planets: { sun: { lonDeg: 10 } } } },
      ],
      active_slot_index: 3,
    },
  };
  const populated = getPopulatedSlotIndicesFromCompositionInput(state.compositionInput);
  assert.deepEqual(populated, [0, 1, 2, 3]);
  assert.equal(populatedSlotsAreAggregateEligible(state.compositionInput, populated), true);
  assert.equal(slotWirePopulationKind(state.compositionInput.slots[3]!), 'blank_canvas');
});

test('dailyTransitBirthForBlankCanvas uses equal house system', () => {
  assert.equal(dailyTransitBirthForBlankCanvas().houseSystem, 'equal');
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

test('serializeSandboxResolveRequestBody defaults generateAudio to false', () => {
  const state = createInitialSandboxCompositionModelState();
  const body = serializeSandboxResolveRequestBody(state, 'abc123seed');
  assert.equal(body.generateAudio, false);
});

test('serializeSandboxResolveRequestBody passes generateAudio and expected hashes when requested', () => {
  const state = createInitialSandboxCompositionModelState();
  const body = serializeSandboxResolveRequestBody(state, 'abc123seed', {
    generateAudio: true,
    expectedPlanSha256: 'plan-hash',
    expectedObjectIdentityHash: 'object-hash',
  });
  assert.equal(body.generateAudio, true);
  assert.equal(body.expectedPlanSha256, 'plan-hash');
  assert.equal(body.expectedObjectIdentityHash, 'object-hash');
});

test('clear_slot resets entry_mode', () => {
  let state = createInitialSandboxCompositionModelState();
  state = sandboxCompositionReducer(state, { type: 'set_entry_mode', entryMode: 'blank_canvas' });
  state = sandboxCompositionReducer(state, { type: 'clear_slot', index: 0 });
  assert.equal(state.compositionInput.slots[0]!.entry_mode, undefined);
});

test('slot projection: birth_data before submit shows Manual', () => {
  let state = createInitialSandboxCompositionModelState();
  state = sandboxCompositionReducer(state, { type: 'set_entry_mode', entryMode: 'birth_data' });
  const rows = projectSlotsFromCompositionInput(state.compositionInput);
  assert.equal(rows[0]!.chipText, 'Manual');
  assert.equal(rows[0]!.isManualStyle, true);
});
