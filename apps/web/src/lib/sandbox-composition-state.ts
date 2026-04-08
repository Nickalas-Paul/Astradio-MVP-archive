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
  SandboxLiveResolveSession,
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

/** First slot with full ephemeris birth (for /api/sandbox/snapshot after load). */
export function firstEphemerisBirthForSnapshot(input: SandboxCompositionInputState): {
  birth: SandboxBirth;
  overrides: SandboxOverrides;
} | null {
  for (const slot of input.slots) {
    const b = slot.ephemeris_birth;
    if (b && typeof b.date === 'string' && b.date.length >= 8 && typeof b.time === 'string' && b.time.length >= 4) {
      return { birth: b, overrides: normalizeSandboxOverrides(slot.overrides ?? { planets: {} }) };
    }
  }
  return null;
}

export type ParsedPersistedSandboxState = {
  compositionInput: SandboxCompositionInputState;
  lastSubmittedResolveBody: Record<string, unknown> | null;
  fullResolveResponse: Record<string, unknown> | null;
};

/** Full-composition rows use `composition_input`; legacy rows use `birth` / `overrides` / `controls`. */
export function parsePersistedSandboxState(rowState: unknown): ParsedPersistedSandboxState {
  if (!rowState || typeof rowState !== 'object') {
    return {
      compositionInput: initialCompositionInput(),
      lastSubmittedResolveBody: null,
      fullResolveResponse: null,
    };
  }
  const r = rowState as Record<string, unknown>;
  const ci = r.composition_input;
  if (ci && typeof ci === 'object' && !Array.isArray(ci)) {
    const raw = ci as SandboxCompositionInputState;
    const slots = Array.isArray(raw.slots) && raw.slots.length > 0 ? raw.slots : [{ overrides: { planets: {} } }];
    const active =
      typeof raw.active_slot_index === 'number' && raw.active_slot_index >= 0 && raw.active_slot_index < slots.length
        ? raw.active_slot_index
        : 0;
    const controls =
      raw.compose_controls && typeof raw.compose_controls === 'object'
        ? { ...raw.compose_controls }
        : { ...SANDBOX_COMPOSE_CONTROLS };
    return {
      compositionInput: {
        schema_version: typeof raw.schema_version === 'string' ? raw.schema_version : '1',
        slots,
        active_slot_index: active,
        compose_controls: controls,
        output_kind: raw.output_kind === 'feed_card' ? 'feed_card' : 'full',
        ...(raw.transit_context && typeof raw.transit_context === 'object' ? { transit_context: raw.transit_context } : {}),
        ...(raw.binding && typeof raw.binding === 'object' ? { binding: raw.binding } : {}),
      },
      lastSubmittedResolveBody:
        r.last_submitted_resolve_body && typeof r.last_submitted_resolve_body === 'object' && !Array.isArray(r.last_submitted_resolve_body)
          ? (r.last_submitted_resolve_body as Record<string, unknown>)
          : null,
      fullResolveResponse:
        r.full_resolve_response && typeof r.full_resolve_response === 'object' && !Array.isArray(r.full_resolve_response)
          ? (r.full_resolve_response as Record<string, unknown>)
          : null,
    };
  }

  const birth = r.birth as SandboxBirth | undefined;
  const overrides = (r.overrides as SandboxOverrides) || { planets: {} };
  const controlsFlat = r.controls as Record<string, number> | undefined;
  const mergedControls =
    controlsFlat && typeof controlsFlat === 'object' ? { ...SANDBOX_COMPOSE_CONTROLS, ...controlsFlat } : { ...SANDBOX_COMPOSE_CONTROLS };
  return {
    compositionInput: {
      ...initialCompositionInput(),
      slots: [{ ephemeris_birth: birth, overrides: normalizeSandboxOverrides(overrides) }],
      active_slot_index: 0,
      compose_controls: mergedControls,
    },
    lastSubmittedResolveBody: null,
    fullResolveResponse: null,
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
  | {
      type: 'birth_first_snapshot_success';
      birth: SandboxBirth;
      /** Effective snapshot (natal + preserved overrides). */
      snapshot: EphemerisSnapshot;
      meta: SandboxSnapshotMeta;
      /** Natal-only snapshot when overrides were preserved; omit when snapshot is already natal-only. */
      baseSnapshot?: EphemerisSnapshot;
    }
  | {
      type: 'import_chart_id_slot0_success';
      chartId: string;
      snapshot: EphemerisSnapshot;
      meta: SandboxSnapshotMeta;
      baseSnapshot?: EphemerisSnapshot;
    }
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
  | {
      type: 'loaded_row_artifacts';
      report: SandboxReport | null;
      planSha256: string | null;
      exportId: string | null;
      combinedHashUsed: string | null;
    }
  | { type: 'load_saved_baseline'; birth: SandboxBirth; overrides: SandboxOverrides }
  | {
      type: 'load_saved_snapshot_restored';
      snapshot: EphemerisSnapshot;
      meta: SandboxSnapshotMeta;
    }
  | {
      type: 'hydrate_from_persistence';
      compositionInput: SandboxCompositionInputState;
      preview: SandboxPreviewSlice;
      lastResolve: SandboxResolvedSession | null;
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
      const preserved = normalizeSandboxOverrides(slot0(state).overrides ?? { planets: {} });
      const s0: (typeof slots)[0] = { ephemeris_birth: action.birth, overrides: preserved };
      slots[0] = s0;
      const base = action.baseSnapshot ?? action.snapshot;
      return {
        ...state,
        lastResolve: null,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
        preview: {
          ...state.preview,
          syncStatus: 'idle',
          baseSnapshot: base,
          overriddenSnapshot: action.snapshot,
          snapshotMeta: action.meta,
          error: null,
        },
      };
    }

    case 'import_chart_id_slot0_success': {
      const slots = [...state.compositionInput.slots];
      const preserved = normalizeSandboxOverrides(slot0(state).overrides ?? { planets: {} });
      const s0: (typeof slots)[0] = { chart_id: action.chartId.trim(), overrides: preserved };
      slots[0] = s0;
      const base = action.baseSnapshot ?? action.snapshot;
      return {
        ...state,
        lastResolve: null,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
        preview: {
          ...state.preview,
          syncStatus: 'idle',
          baseSnapshot: base,
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

    case 'resolve_success': {
      const live: SandboxLiveResolveSession = {
        source: 'live_resolve',
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
      };
      return {
        ...state,
        lastResolve: live,
      };
    }

    case 'resolve_cleared':
      return { ...state, lastResolve: null };

    case 'loaded_row_artifacts':
      return {
        ...state,
        lastResolve: {
          source: 'loaded_row',
          report: action.report,
          planSha256: action.planSha256,
          exportId: action.exportId,
          combinedHashUsed: action.combinedHashUsed,
          lastSubmittedResolveBody: null,
        },
      };

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

    case 'hydrate_from_persistence':
      return {
        compositionInput: { ...action.compositionInput, seed: undefined },
        preview: action.preview,
        lastResolve: action.lastResolve,
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
