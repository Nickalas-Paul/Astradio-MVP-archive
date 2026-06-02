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

/** Max composition slots in Sandbox UI (import auto-advance respects this cap). */
export const SANDBOX_MAX_SLOTS = 8;

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

/** Clamped active index for composition input (always valid slot subscript when slots non-empty). */
export function getActiveSlotIndexFromCompositionInput(input: SandboxCompositionInputState): number {
  const n = input.slots.length;
  if (n === 0) return 0;
  const i = input.active_slot_index;
  return i >= 0 && i < n ? i : 0;
}

/**
 * True when ephemeris birth has coordinates the engine accepts (top-level lat/lon or nested location).
 * Aligns with `vnext/api/sandbox-composition-normalize` populated-slot rules post–BFF flatten.
 */
export function ephemerisBirthHasEngineCoordinates(b: SandboxBirth | undefined): boolean {
  if (!b || typeof b.date !== 'string' || typeof b.time !== 'string') return false;
  const flat = b as unknown as { lat?: unknown; lon?: unknown };
  const lat =
    typeof flat.lat === 'number' && Number.isFinite(flat.lat)
      ? flat.lat
      : b.location && typeof b.location.lat === 'number' && Number.isFinite(b.location.lat)
        ? b.location.lat
        : null;
  const lon =
    typeof flat.lon === 'number' && Number.isFinite(flat.lon)
      ? flat.lon
      : b.location && typeof b.location.lon === 'number' && Number.isFinite(b.location.lon)
        ? b.location.lon
        : null;
  return lat != null && lon != null;
}

export type SlotWirePopulationKind =
  | 'chart_id'
  | 'ephemeris_birth'
  | 'birth_incomplete'
  | 'empty'
  | 'invalid';

/** Mirrors engine slot population (chart_id vs ephemeris_birth exclusive; birth needs engine-grade coordinates). */
export function slotWirePopulationKind(slot: SandboxCompositionInputState['slots'][number]): SlotWirePopulationKind {
  const hasChart = typeof slot.chart_id === 'string' && slot.chart_id.trim().length > 0;
  const b = slot.ephemeris_birth;
  const hasDateTime = !!(
    b &&
    typeof b.date === 'string' &&
    b.date.length >= 8 &&
    typeof b.time === 'string' &&
    b.time.length >= 4
  );
  if (hasChart && hasDateTime) return 'invalid';
  if (hasChart) return 'chart_id';
  if (hasDateTime) {
    return ephemerisBirthHasEngineCoordinates(b) ? 'ephemeris_birth' : 'birth_incomplete';
  }
  return 'empty';
}

/** Strict ascending UI indices of occupied slots (engine ignores empties between). */
export function getPopulatedSlotIndicesFromCompositionInput(input: SandboxCompositionInputState): number[] {
  const indices: number[] = [];
  for (let i = 0; i < input.slots.length; i++) {
    const k = slotWirePopulationKind(input.slots[i]);
    if (k === 'empty' || k === 'invalid' || k === 'birth_incomplete') continue;
    indices.push(i);
  }
  return indices;
}

export function compositionHasInvalidSlotWire(input: SandboxCompositionInputState): boolean {
  return input.slots.some((s) => slotWirePopulationKind(s) === 'invalid');
}

/** True if any slot has date/time but missing coordinates (cannot resolve). */
export function compositionHasIncompleteBirthSlot(input: SandboxCompositionInputState): boolean {
  return input.slots.some((s) => slotWirePopulationKind(s) === 'birth_incomplete');
}

/**
 * Multi-slot aggregate accepts any mix of chart_id and ephemeris_birth (engine-normalized); invalid wire still blocks.
 */
export function populatedSlotsAreAggregateEligible(
  input: SandboxCompositionInputState,
  populatedIndices: number[]
): boolean {
  if (populatedIndices.length < 2) return true;
  return populatedIndices.every((i) => {
    const k = slotWirePopulationKind(input.slots[i]);
    return k === 'chart_id' || k === 'ephemeris_birth';
  });
}

/** True if slot is Path A blank canvas (no chart_id / ephemeris_birth on wire). */
export function isBlankCanvasSlot(slot: SandboxCompositionInputState['slots'][number]): boolean {
  return slot.entry_mode === 'blank_canvas' && slotWirePopulationKind(slot) === 'empty';
}

export function blankCanvasSlotHasPlacedPlanets(slot: SandboxCompositionInputState['slots'][number]): boolean {
  return Object.keys(normalizeSandboxOverrides(slot.overrides ?? { planets: {} }).planets).length > 0;
}

/** Blank-canvas generate: active slot only, no mixed populated slots (single-slot Path A). */
export function isBlankCanvasGenerateEligible(input: SandboxCompositionInputState, activeIdx: number): boolean {
  const slot = input.slots[activeIdx];
  if (!slot || !isBlankCanvasSlot(slot)) return false;
  if (!blankCanvasSlotHasPlacedPlanets(slot)) return false;
  if (getPopulatedSlotIndicesFromCompositionInput(input).length > 0) return false;
  return true;
}

export type SerializeSandboxResolveOptions = {
  /** Ephemeris birth injected at generate time (not persisted on slot state). */
  transientEphemerisBirthBySlotIndex?: Record<number, SandboxBirth>;
};


/** First slot with engine-resolvable ephemeris birth (for /api/sandbox/snapshot after load). */
export function firstEphemerisBirthForSnapshot(input: SandboxCompositionInputState): {
  birth: SandboxBirth;
  overrides: SandboxOverrides;
} | null {
  for (const slot of input.slots) {
    const b = slot.ephemeris_birth;
    if (b && slotWirePopulationKind(slot) === 'ephemeris_birth') {
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
  | {
      /** Replace preview snapshots without mutating slots (e.g. after switching active slot). */
      type: 'preview_restore';
      snapshot: EphemerisSnapshot;
      meta: SandboxSnapshotMeta;
      baseSnapshot?: EphemerisSnapshot;
    }
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
      type: 'import_chart_id_success';
      chartId: string;
      chartDisplayName?: string;
      snapshot: EphemerisSnapshot;
      meta: SandboxSnapshotMeta;
      baseSnapshot?: EphemerisSnapshot;
      /** After import, append an empty slot and activate it (default true). */
      advanceToNewSlot?: boolean;
    }
  | {
      type: 'overrides_changed';
      overrides: SandboxOverrides;
      /** When omitted, uses current active_slot_index. */
      slotIndex?: number;
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
    }
  | { type: 'set_active_slot'; index: number }
  | { type: 'add_slot' }
  | { type: 'remove_slot'; index: number }
  | { type: 'clear_slot'; index: number }
  | { type: 'free_build_asc_changed'; lonDeg: number; slotIndex?: number }
  | { type: 'preview_clear' }
  | { type: 'set_commit_relational_classification'; value: boolean }
  | { type: 'set_entry_mode'; entryMode: import('../types/sandbox').SandboxSlotEntryMode | null };

function withSlotsEnsured(
  slots: SandboxCompositionInputState['slots'],
  minIndex: number
): SandboxCompositionInputState['slots'] {
  const next = [...slots];
  while (next.length <= minIndex) {
    next.push({ overrides: { planets: {} } });
  }
  return next;
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

    case 'preview_restore': {
      const base = action.baseSnapshot ?? action.snapshot;
      return {
        ...state,
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
      const idx = getActiveSlotIndexFromCompositionInput(state.compositionInput);
      let slots = withSlotsEnsured(state.compositionInput.slots, idx);
      const prevSlot = slots[idx] ?? { overrides: { planets: {} } };
      const preserved = normalizeSandboxOverrides(prevSlot.overrides ?? { planets: {} });
      slots = [...slots];
      const { free_build_asc_deg: _dropAsc, ...prevWithoutAsc } = prevSlot;
      slots[idx] = { ...prevWithoutAsc, ephemeris_birth: action.birth, overrides: preserved };
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

    case 'import_chart_id_success': {
      const idx = getActiveSlotIndexFromCompositionInput(state.compositionInput);
      let slots = withSlotsEnsured(state.compositionInput.slots, idx);
      const preserved = normalizeSandboxOverrides(slots[idx]?.overrides ?? { planets: {} });
      const displayName = action.chartDisplayName?.trim();
      slots = [...slots];
      slots[idx] = {
        chart_id: action.chartId.trim(),
        ...(displayName ? { chart_display_name: displayName } : {}),
        overrides: preserved,
      };
      let active_slot_index = idx;
      const shouldAdvance = action.advanceToNewSlot !== false;
      if (shouldAdvance && slots.length < SANDBOX_MAX_SLOTS) {
        slots = [...slots, { overrides: { planets: {} } }];
        active_slot_index = slots.length - 1;
      }
      const base = action.baseSnapshot ?? action.snapshot;
      return {
        ...state,
        lastResolve: null,
        compositionInput: {
          ...state.compositionInput,
          slots,
          active_slot_index,
          seed: undefined,
        },
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
      const idx =
        action.slotIndex !== undefined
          ? Math.max(0, Math.min(action.slotIndex, Math.max(0, state.compositionInput.slots.length - 1)))
          : getActiveSlotIndexFromCompositionInput(state.compositionInput);
      let slots = withSlotsEnsured(state.compositionInput.slots, idx);
      const prev = slots[idx] ?? { overrides: { planets: {} } };
      slots = [...slots];
      slots[idx] = { ...prev, overrides: action.overrides };
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
      const idx = getActiveSlotIndexFromCompositionInput(state.compositionInput);
      let slots = withSlotsEnsured(state.compositionInput.slots, idx);
      const prev = slots[idx] ?? { overrides: { planets: {} } };
      slots = [...slots];
      slots[idx] = { ...prev, overrides: { planets: {} } };
      const base = state.preview.baseSnapshot;
      return {
        ...state,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
        preview: {
          ...state.preview,
          syncStatus: 'idle',
          error: null,
          overriddenSnapshot: base ?? null,
        },
      };
    }

    case 'set_active_slot': {
      const n = state.compositionInput.slots.length;
      if (n === 0) return state;
      const idx = Math.max(0, Math.min(action.index, n - 1));
      return {
        ...state,
        compositionInput: { ...state.compositionInput, active_slot_index: idx },
      };
    }

    case 'add_slot': {
      if (state.compositionInput.slots.length >= SANDBOX_MAX_SLOTS) return state;
      const slots = [...state.compositionInput.slots, { overrides: { planets: {} } }];
      return {
        ...state,
        lastResolve: null,
        compositionInput: {
          ...state.compositionInput,
          slots,
          active_slot_index: slots.length - 1,
          seed: undefined,
        },
      };
    }

    case 'remove_slot': {
      if (state.compositionInput.slots.length <= 1) return state;
      const index = action.index;
      if (index < 0 || index >= state.compositionInput.slots.length) return state;
      const slots = state.compositionInput.slots.filter((_, i) => i !== index);
      let newActive = state.compositionInput.active_slot_index;
      if (newActive === index) newActive = Math.max(0, index - 1);
      else if (newActive > index) newActive -= 1;
      newActive = Math.max(0, Math.min(newActive, slots.length - 1));
      return {
        ...state,
        lastResolve: null,
        compositionInput: { ...state.compositionInput, slots, active_slot_index: newActive, seed: undefined },
      };
    }

    case 'clear_slot': {
      const index = action.index;
      if (index < 0 || index >= state.compositionInput.slots.length) return state;
      const slots = [...state.compositionInput.slots];
      slots[index] = { overrides: { planets: {} } };
      return {
        ...state,
        lastResolve: null,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
      };
    }

    case 'set_entry_mode': {
      const slotIndex = getActiveSlotIndexFromCompositionInput(state.compositionInput);
      const slots = [...state.compositionInput.slots];
      const prev = slots[slotIndex] ?? { overrides: { planets: {} } };
      slots[slotIndex] = { ...prev, entry_mode: action.entryMode };
      return {
        ...state,
        compositionInput: { ...state.compositionInput, slots },
      };
    }

    case 'free_build_asc_changed': {
      const idx =
        action.slotIndex !== undefined
          ? Math.max(0, Math.min(action.slotIndex, Math.max(0, state.compositionInput.slots.length - 1)))
          : getActiveSlotIndexFromCompositionInput(state.compositionInput);
      let slots = withSlotsEnsured(state.compositionInput.slots, idx);
      const prev = slots[idx] ?? { overrides: { planets: {} } };
      slots = [...slots];
      slots[idx] = { ...prev, free_build_asc_deg: roundSandboxDegree(action.lonDeg) };
      return {
        ...state,
        compositionInput: { ...state.compositionInput, slots, seed: undefined },
      };
    }

    case 'preview_clear':
      return {
        ...state,
        preview: {
          ...state.preview,
          syncStatus: 'idle',
          baseSnapshot: null,
          overriddenSnapshot: null,
          snapshotMeta: null,
          error: null,
        },
      };

    case 'set_commit_relational_classification':
      return {
        ...state,
        compositionInput: {
          ...state.compositionInput,
          commit_relational_classification: action.value,
        },
      };

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
  seed?: string,
  options?: SerializeSandboxResolveOptions
): Record<string, unknown> {
  const { compositionInput } = state;
  const effectiveSeed = seed ?? compositionInput.seed;
  if (typeof effectiveSeed !== 'string' || !effectiveSeed.trim()) {
    throw new Error('serializeSandboxResolveRequestBody: seed must be set before resolve');
  }
  const transientBirth = options?.transientEphemerisBirthBySlotIndex;
  const slots = compositionInput.slots.map((slot, index) => ({
    ...(slot.chart_id ? { chart_id: slot.chart_id } : {}),
    ...(slot.ephemeris_birth
      ? { ephemeris_birth: slot.ephemeris_birth }
      : transientBirth && transientBirth[index]
        ? { ephemeris_birth: transientBirth[index] }
        : {}),
    overrides: normalizeSandboxOverrides(slot.overrides ?? { planets: {} }),
  }));
  return {
    schema_version: compositionInput.schema_version,
    slots,
    active_slot_index: compositionInput.active_slot_index,
    compose_controls: compositionInput.compose_controls,
    output_kind: compositionInput.output_kind,
    seed: effectiveSeed,
    ...(compositionInput.commit_relational_classification === true
      ? { commit_relational_classification: true }
      : {}),
    ...(compositionInput.transit_context ? { transit_context: compositionInput.transit_context } : {}),
    ...(compositionInput.binding ? { binding: compositionInput.binding } : {}),
  };
}
