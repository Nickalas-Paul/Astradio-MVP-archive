/**
 * Single source of truth for Sandbox resolve input + preview line + last resolve outcome.
 * Use serializeSandboxResolveRequestBody after compositionInput.seed is set (fresh combined hash).
 */

import type {
  SandboxBirth,
  SandboxOverrides,
  EphemerisSnapshot,
  SandboxReport,
  SandboxSnapshotMeta,
  SandboxResolvedSession,
  SandboxCompositionInputState,
} from '../types/sandbox';

export const SANDBOX_COMPOSE_CONTROLS = {
  arc_shape: 0.5,
  density_level: 0.6,
  tempo_norm: 0.7,
  step_bias: 0.7,
  leap_cap: 5,
  rhythm_template_id: 3,
  syncopation_bias: 0.3,
  motif_rate: 0.6,
} as const;

export function roundSandboxDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

export function normalizeSandboxOverrides(overrides: SandboxOverrides): SandboxOverrides {
  const sortedPlanets: SandboxOverrides['planets'] = {};
  const planetKeys = Object.keys(overrides.planets || {}) as (keyof SandboxOverrides['planets'])[];
  planetKeys.sort((a, b) => String(a).localeCompare(String(b)));
  for (const key of planetKeys) {
    const override = overrides.planets[key];
    if (override) sortedPlanets[key] = { lonDeg: roundSandboxDegree(override.lonDeg) };
  }
  return { planets: sortedPlanets, angles: overrides.angles };
}

function initialCompositionInput(): SandboxCompositionInputState {
  return {
    schema_version: '1',
    slots: [{ overrides: { planets: {} } }],
    active_slot_index: 0,
    compose_controls: { ...SANDBOX_COMPOSE_CONTROLS },
    output_kind: 'full',
  };
}

export type SandboxPreviewSlice = {
  epoch: number;
  syncStatus: 'idle' | 'debouncing' | 'syncing' | 'error';
  baseSnapshot: EphemerisSnapshot | null;
  overriddenSnapshot: EphemerisSnapshot | null;
  snapshotMeta: SandboxSnapshotMeta | null;
  error: string | null;
};

export type SandboxCompositionModelState = {
  compositionInput: SandboxCompositionInputState;
  preview: SandboxPreviewSlice;
  lastResolve: SandboxResolvedSession | null;
};

export function createInitialSandboxCompositionModelState(): SandboxCompositionModelState {
  return {
    compositionInput: initialCompositionInput(),
    preview: {
      epoch: 0,
      syncStatus: 'idle',
      baseSnapshot: null,
      overriddenSnapshot: null,
      snapshotMeta: null,
      error: null,
    },
    lastResolve: null,
  };
}

export type SandboxCompositionAction =
  | { type: 'reset_all' }
  | { type: 'bump_preview_epoch' }
  | { type: 'preview_sync_start' }
  | { type: 'preview_sync_success'; snapshot: EphemerisSnapshot; meta: SandboxSnapshotMeta }
  | { type: 'preview_sync_error'; message: string }
  | { type: 'birth_first_snapshot_success'; birth: SandboxBirth; snapshot: EphemerisSnapshot; meta: SandboxSnapshotMeta }
  | {
      type: 'overrides_changed';
      overrides: SandboxOverrides;
      optimisticSnapshot?: EphemerisSnapshot | null;
    }
  | { type: 'reset_overrides_to_base' }
  | {
      type: 'resolve_success';
      payload: Record<string, unknown>;
      lastSubmittedResolveBody: Record<string, unknown>;
      snapshotUsed: EphemerisSnapshot;
      combinedHashUsed: string;
      planSha256: string | null;
      canonicalSlotOrder: string[] | null;
      canonicalInputHash: string | null;
      canonicalObjectHash: string | null;
      report: SandboxReport;
      exportId: string | null;
      lastComposeProvider: string | null;
      exportUnavailableReason: { summary: string; step?: string; message?: string } | null;
    }
  | { type: 'resolve_cleared' }
  | { type: 'load_saved_baseline'; birth: SandboxBirth; overrides: SandboxOverrides }
  | {
      type: 'load_saved_snapshot_restored';
      snapshot: EphemerisSnapshot;
      meta: SandboxSnapshotMeta;
    };

function slot0(state: SandboxCompositionModelState) {
  return state.compositionInput.slots[0] ?? { overrides: { planets: {} } };
}

export function sandboxCompositionReducer(
  state: SandboxCompositionModelState,
  action: SandboxCompositionAction
): SandboxCompositionModelState {
  switch (action.type) {
    case 'reset_all':
      return createInitialSandboxCompositionModelState();

    case 'bump_preview_epoch':
      return {
        ...state,
        preview: { ...state.preview, epoch: state.preview.epoch + 1 },
      };

    case 'preview_sync_start':
      return {
        ...state,
        preview: { ...state.preview, syncStatus: 'syncing', error: null },
      };

    case 'preview_sync_success':
      return {
        ...state,
        preview: {
          ...state.preview,
          syncStatus: 'idle',
          overriddenSnapshot: action.snapshot,
          snapshotMeta: action.meta,
          error: null,
        },
      };

    case 'preview_sync_error':
      return {
        ...state,
        preview: {
          ...state.preview,
          syncStatus: 'error',
          error: action.message,
        },
      };

    case 'birth_first_snapshot_success': {
      const slots = [...state.compositionInput.slots];
      const s0 = { ...slot0(state), ephemeris_birth: action.birth, overrides: { planets: {} } };
      slots[0] = s0;
      return {
        ...state,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
        preview: {
          ...state.preview,
          syncStatus: 'idle',
          baseSnapshot: action.snapshot,
          overriddenSnapshot: action.snapshot,
          snapshotMeta: action.meta,
          error: null,
        },
      };
    }

    case 'overrides_changed': {
      const slots = [...state.compositionInput.slots];
      const s0 = { ...slot0(state), overrides: action.overrides };
      slots[0] = s0;
      const preview =
        action.optimisticSnapshot != null
          ? {
              ...state.preview,
              overriddenSnapshot: action.optimisticSnapshot,
            }
          : state.preview;
      return {
        ...state,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
        preview,
      };
    }

    case 'reset_overrides_to_base': {
      const base = state.preview.baseSnapshot;
      if (!base) return state;
      const slots = [...state.compositionInput.slots];
      const s0 = { ...slot0(state), overrides: { planets: {} } };
      slots[0] = s0;
      return {
        ...state,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
        preview: {
          ...state.preview,
          overriddenSnapshot: base,
        },
      };
    }

    case 'resolve_success':
      return {
        ...state,
        lastResolve: {
          fullResponse: action.payload,
          lastSubmittedResolveBody: action.lastSubmittedResolveBody,
          snapshotUsed: action.snapshotUsed,
          combinedHashUsed: action.combinedHashUsed,
          planSha256: action.planSha256,
          canonicalSlotOrder: action.canonicalSlotOrder,
          canonicalInputHash: action.canonicalInputHash,
          canonicalObjectHash: action.canonicalObjectHash,
          report: action.report,
          exportId: action.exportId,
          lastComposeProvider: action.lastComposeProvider,
          exportUnavailableReason: action.exportUnavailableReason,
        },
      };

    case 'resolve_cleared':
      return { ...state, lastResolve: null };

    case 'load_saved_baseline':
      return {
        compositionInput: {
          ...initialCompositionInput(),
          slots: [{ ephemeris_birth: action.birth, overrides: action.overrides }],
        },
        preview: {
          epoch: 0,
          syncStatus: 'idle',
          baseSnapshot: null,
          overriddenSnapshot: null,
          snapshotMeta: null,
          error: null,
        },
        lastResolve: null,
      };

    case 'load_saved_snapshot_restored':
      return {
        ...state,
        preview: {
          ...state.preview,
          baseSnapshot: action.snapshot,
          overriddenSnapshot: action.snapshot,
          snapshotMeta: action.meta,
          syncStatus: 'idle',
          error: null,
        },
        compositionInput: { ...state.compositionInput, seed: undefined },
      };

    default:
      return state;
  }
}

/**
 * Build the POST body for /api/sandbox/resolve from the unified model.
 * Pass `seed` (e.g. fresh combinedHash from the preflight snapshot) or set `state.compositionInput.seed` first.
 */
export function serializeSandboxResolveRequestBody(
  state: SandboxCompositionModelState,
  seed?: string
): Record<string, unknown> {
  const { compositionInput } = state;
  const effectiveSeed = seed ?? compositionInput.seed;
  if (typeof effectiveSeed !== 'string' || !effectiveSeed.trim()) {
    throw new Error('serializeSandboxResolveRequestBody: seed must be set before resolve');
  }
  const slots = compositionInput.slots.map((slot) => ({
    ...(slot.chart_id ? { chart_id: slot.chart_id } : {}),
    ...(slot.ephemeris_birth ? { ephemeris_birth: slot.ephemeris_birth } : {}),
    overrides: normalizeSandboxOverrides(slot.overrides ?? { planets: {} }),
  }));
  return {
    schema_version: compositionInput.schema_version,
    slots,
    active_slot_index: compositionInput.active_slot_index,
    compose_controls: compositionInput.compose_controls,
    output_kind: compositionInput.output_kind,
    seed: effectiveSeed,
    ...(compositionInput.transit_context ? { transit_context: compositionInput.transit_context } : {}),
    ...(compositionInput.binding ? { binding: compositionInput.binding } : {}),
  };
}
