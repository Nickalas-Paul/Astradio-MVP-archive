/**
 * Sandbox surface fixes: fingerprint, persisted classify, slot population (web lib only).
 */
import {
  fingerprintCompositionInputExcludingSeed,
  fingerprintResolveBodyExcludingSeed,
} from '../apps/web/src/lib/sandbox-resolve-fingerprint';
import { classifySandboxPersistedState } from '../apps/web/src/lib/sandbox-persisted-classify';
import {
  slotWirePopulationKind,
  getPopulatedSlotIndicesFromCompositionInput,
} from '../apps/web/src/lib/sandbox-composition-state';
import type { SandboxCompositionInputState } from '../apps/web/src/types/sandbox';

describe('fingerprintResolveBodyExcludingSeed', () => {
  it('matches composition fingerprint when only seed differs', () => {
    const input: SandboxCompositionInputState = {
      schema_version: '1',
      slots: [{ chart_id: 'abc', overrides: { planets: {} } }],
      active_slot_index: 0,
      compose_controls: { arc_shape: 0.5 },
      output_kind: 'full',
    };
    const fpDoc = fingerprintCompositionInputExcludingSeed(input);
    const bodyA = {
      schema_version: '1',
      slots: [{ chart_id: 'abc', overrides: { planets: {} } }],
      active_slot_index: 0,
      compose_controls: { arc_shape: 0.5 },
      output_kind: 'full',
      seed: 'hash_one',
    };
    const bodyB = { ...bodyA, seed: 'hash_two' };
    expect(fingerprintResolveBodyExcludingSeed(bodyA as Record<string, unknown>)).toBe(fpDoc);
    expect(fingerprintResolveBodyExcludingSeed(bodyB as Record<string, unknown>)).toBe(fpDoc);
    expect(fingerprintResolveBodyExcludingSeed(bodyA as Record<string, unknown>)).toBe(
      fingerprintResolveBodyExcludingSeed(bodyB as Record<string, unknown>),
    );
  });

  it('differs when a slot chart_id changes', () => {
    const body1 = {
      slots: [{ chart_id: 'a', overrides: { planets: {} } }],
      active_slot_index: 0,
      compose_controls: {},
      output_kind: 'full',
      seed: 's',
    };
    const body2 = {
      ...body1,
      slots: [{ chart_id: 'b', overrides: { planets: {} } }],
    };
    expect(fingerprintResolveBodyExcludingSeed(body1 as Record<string, unknown>)).not.toBe(
      fingerprintResolveBodyExcludingSeed(body2 as Record<string, unknown>),
    );
  });
});

describe('classifySandboxPersistedState', () => {
  it('allows full composition_input', () => {
    expect(
      classifySandboxPersistedState({
        composition_input: { slots: [{ chart_id: 'x' }], active_slot_index: 0 },
      }),
    ).toEqual({ kind: 'full_composition' });
  });

  it('allows legacy birth with nested location', () => {
    expect(
      classifySandboxPersistedState({
        birth: {
          date: '1990-01-01',
          time: '12:00',
          location: { lat: 1, lon: 2, label: 'L', source: 'geofinder', timezone: 'UTC', resolvedAt: '2020-01-01' },
        },
        overrides: { planets: {} },
      }),
    ).toEqual({ kind: 'legacy_birth' });
  });

  it('rejects profile-style rows', () => {
    const r = classifySandboxPersistedState({ kind: 'profile_identity', chartId: 'c1' });
    expect(r.kind).toBe('unsupported');
    if (r.kind === 'unsupported') expect(r.reason).toContain('profile_identity');
  });

  it('rejects unknown shapes', () => {
    expect(classifySandboxPersistedState({ foo: 1 }).kind).toBe('unsupported');
  });
});

describe('slotWirePopulationKind / getPopulatedSlotIndices', () => {
  it('treats date/time without coordinates as birth_incomplete (not populated)', () => {
    const slot = {
      ephemeris_birth: {
        date: '1990-01-01',
        time: '12:00',
        location: {
          source: 'geofinder' as const,
          label: 'x',
          lat: NaN,
          lon: 0,
          timezone: 'UTC',
          resolvedAt: '2020-01-01',
        },
      },
      overrides: { planets: {} },
    };
    expect(slotWirePopulationKind(slot)).toBe('birth_incomplete');
    expect(getPopulatedSlotIndicesFromCompositionInput({ ...minimalInput(), slots: [slot] })).toEqual([]);
  });

  it('accepts nested location lat/lon as ephemeris_birth', () => {
    const slot = {
      ephemeris_birth: {
        date: '1990-01-01',
        time: '12:00',
        location: {
          source: 'geofinder' as const,
          label: 'x',
          lat: 40.7,
          lon: -74,
          timezone: 'America/New_York',
          resolvedAt: '2020-01-01',
        },
      },
      overrides: { planets: {} },
    };
    expect(slotWirePopulationKind(slot)).toBe('ephemeris_birth');
    expect(getPopulatedSlotIndicesFromCompositionInput({ ...minimalInput(), slots: [slot] })).toEqual([0]);
  });

  it('accepts flat lat/lon on birth wire', () => {
    const slot = {
      ephemeris_birth: {
        date: '1990-01-01',
        time: '12:00',
        lat: 1,
        lon: 2,
        location: {
          source: 'geofinder' as const,
          label: 'x',
          lat: 40,
          lon: -70,
          timezone: 'UTC',
          resolvedAt: '2020-01-01',
        },
      },
      overrides: { planets: {} },
    };
    expect(slotWirePopulationKind(slot as never)).toBe('ephemeris_birth');
  });
});

function minimalInput(): SandboxCompositionInputState {
  return {
    schema_version: '1',
    slots: [{ overrides: { planets: {} } }],
    active_slot_index: 0,
    compose_controls: {},
    output_kind: 'full',
  };
}
