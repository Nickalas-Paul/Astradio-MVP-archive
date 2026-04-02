/**
 * Sandbox composition normalization — derives composition_mode from slot structure only.
 * No routing or I/O. Fail-closed validation per command-center policy.
 */

import * as crypto from 'crypto';
import type { SandboxBirth, SandboxOverrides } from '../contracts';
import { hashBirth, hashOverrides, validateSandboxOverrides } from './sandbox-snapshot';
import { CANONICAL_INPUT_HASH_VERSION, serializeNumberForHash } from './sandbox-determinism';

export const SANDBOX_COMPOSITION_ERROR_CODES = {
  INVALID_BODY: 'invalid_body',
  NO_POPULATED_SLOTS: 'no_populated_slots',
  MIXED_AGGREGATE_INPUT: 'mixed_aggregate_input',
  AGGREGATE_REQUIRES_CHART_ID: 'aggregate_requires_chart_id',
  OVERLAY_AMBIGUOUS_SLOTS: 'overlay_ambiguous_slots',
  INVALID_TRANSIT_CONTEXT: 'invalid_transit_context',
  INVALID_ACTIVE_SLOT: 'invalid_active_slot',
} as const;

export type SandboxCompositionErrorCode =
  (typeof SANDBOX_COMPOSITION_ERROR_CODES)[keyof typeof SANDBOX_COMPOSITION_ERROR_CODES];

export type CompositionOutputKind = 'full' | 'feed_card';

export type CompositionSlotInput = {
  chart_id?: string;
  ephemeris_birth?: SandboxBirth;
  overrides?: SandboxOverrides;
};

export type OverlayTransitContextInput = {
  natal_chart_id: string;
  current_datetime: string;
  current_latitude: number;
  current_longitude: number;
  /** IANA zone for transit snapshot (aligned with transitContextFingerprint / Profile active state). */
  current_timezone?: string;
};

export type CompositionBindingInput = {
  group_id?: string;
  relationship_id?: string;
  binding_key?: string;
  relationship_mode?: import('../compat/types').RelationshipMode;
};

export type SandboxCompositionInputV1 = {
  schema_version?: string;
  slots: CompositionSlotInput[];
  active_slot_index: number;
  binding?: CompositionBindingInput;
  transit_context?: OverlayTransitContextInput;
  compose_controls?: Record<string, unknown>;
  output_kind?: CompositionOutputKind;
  seed?: string;
};

export type DerivedCompositionMode = 'single' | 'overlay' | 'pair_aggregate' | 'group_aggregate';

export type NormalizedCompositionSuccess = {
  ok: true;
  composition_mode: DerivedCompositionMode;
  /** Canonical participant order for identity (lexical chart ids for aggregates; structured for single birth). */
  canonical_slot_order: string[];
  canonical_input_hash: string;
  canonical_input_hash_version: number;
  output_kind: CompositionOutputKind;
  seed?: string;
  /** Populated slot indices and resolved chart_id or null for birth slot. */
  slot_resolutions: Array<{ ui_index: number; chart_id: string | null; birth?: SandboxBirth; overrides?: SandboxOverrides }>;
  transit_context?: OverlayTransitContextInput;
  binding?: CompositionBindingInput;
  compose_controls: Record<string, unknown>;
};

export type NormalizedCompositionFailure = {
  ok: false;
  code: SandboxCompositionErrorCode;
  message: string;
};

export type NormalizeCompositionResult = NormalizedCompositionSuccess | NormalizedCompositionFailure;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value === 'number') return serializeNumberForHash(value);
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function isPopulatedSlot(s: CompositionSlotInput): boolean {
  const hasChart = typeof s.chart_id === 'string' && s.chart_id.trim().length > 0;
  const hasBirth =
    s.ephemeris_birth &&
    typeof s.ephemeris_birth.date === 'string' &&
    typeof s.ephemeris_birth.time === 'string' &&
    typeof s.ephemeris_birth.lat === 'number' &&
    typeof s.ephemeris_birth.lon === 'number';
  return hasChart || !!hasBirth;
}

function slotPopulationKind(s: CompositionSlotInput): 'chart_id' | 'ephemeris_birth' | 'empty' | 'invalid' {
  const hasChart = typeof s.chart_id === 'string' && s.chart_id.trim().length > 0;
  const hasBirth =
    s.ephemeris_birth &&
    typeof s.ephemeris_birth.date === 'string' &&
    typeof s.ephemeris_birth.time === 'string' &&
    typeof s.ephemeris_birth.lat === 'number' &&
    typeof s.ephemeris_birth.lon === 'number';
  if (hasChart && hasBirth) return 'invalid';
  if (hasChart) return 'chart_id';
  if (hasBirth) return 'ephemeris_birth';
  return 'empty';
}

function isValidTransitContext(tc: OverlayTransitContextInput): boolean {
  if (!tc || typeof tc.natal_chart_id !== 'string' || !tc.natal_chart_id.trim()) return false;
  if (typeof tc.current_datetime !== 'string' || !tc.current_datetime.includes('T')) return false;
  if (typeof tc.current_latitude !== 'number' || !Number.isFinite(tc.current_latitude)) return false;
  if (typeof tc.current_longitude !== 'number' || !Number.isFinite(tc.current_longitude)) return false;
  return true;
}

/**
 * Pure normalization: no chart store, no vectors. Callers run aggregate vector checks after this for group mode.
 */
export function normalizeCompositionInput(input: SandboxCompositionInputV1): NormalizeCompositionResult {
  if (!input || typeof input !== 'object' || !Array.isArray(input.slots)) {
    return {
      ok: false,
      code: SANDBOX_COMPOSITION_ERROR_CODES.INVALID_BODY,
      message: 'composition.slots array required',
    };
  }

  const activeIdx = input.active_slot_index;
  if (typeof activeIdx !== 'number' || activeIdx < 0 || activeIdx >= input.slots.length) {
    return {
      ok: false,
      code: SANDBOX_COMPOSITION_ERROR_CODES.INVALID_ACTIVE_SLOT,
      message: 'active_slot_index must be within slots bounds',
    };
  }

  const output_kind: CompositionOutputKind =
    input.output_kind === 'feed_card' ? 'feed_card' : 'full';

  const populatedIndices: number[] = [];
  for (let i = 0; i < input.slots.length; i++) {
    const sk = slotPopulationKind(input.slots[i]);
    if (sk === 'invalid') {
      return {
        ok: false,
        code: SANDBOX_COMPOSITION_ERROR_CODES.INVALID_BODY,
        message: `slot ${i}: chart_id and ephemeris_birth are mutually exclusive`,
      };
    }
    if (sk !== 'empty') populatedIndices.push(i);
  }

  if (populatedIndices.length === 0) {
    return {
      ok: false,
      code: SANDBOX_COMPOSITION_ERROR_CODES.NO_POPULATED_SLOTS,
      message: 'at least one populated slot required',
    };
  }

  const n = populatedIndices.length;

  for (const i of populatedIndices) {
    const s = input.slots[i];
    if (slotPopulationKind(s) === 'ephemeris_birth' && s.overrides) {
      try {
        validateSandboxOverrides(s.overrides);
      } catch (e) {
        return {
          ok: false,
          code: SANDBOX_COMPOSITION_ERROR_CODES.INVALID_BODY,
          message: e instanceof Error ? e.message : 'invalid overrides',
        };
      }
    }
  }

  if (n >= 2) {
    for (const i of populatedIndices) {
      const s = input.slots[i];
      if (slotPopulationKind(s) === 'ephemeris_birth') {
        return {
          ok: false,
          code: SANDBOX_COMPOSITION_ERROR_CODES.MIXED_AGGREGATE_INPUT,
          message: 'aggregate compositions require chart_id-only slots; persist birth data to a chart first',
        };
      }
      if (slotPopulationKind(s) !== 'chart_id') {
        return {
          ok: false,
          code: SANDBOX_COMPOSITION_ERROR_CODES.AGGREGATE_REQUIRES_CHART_ID,
          message: `slot ${i}: chart_id required for multi-slot composition`,
        };
      }
    }
  }

  const slot_resolutions: NormalizedCompositionSuccess['slot_resolutions'] = [];
  for (let i = 0; i < input.slots.length; i++) {
    const s = input.slots[i];
    const kind = slotPopulationKind(s);
    if (kind === 'empty') {
      slot_resolutions.push({ ui_index: i, chart_id: null });
    } else if (kind === 'chart_id') {
      slot_resolutions.push({ ui_index: i, chart_id: String(s.chart_id).trim() });
    } else {
      slot_resolutions.push({
        ui_index: i,
        chart_id: null,
        birth: s.ephemeris_birth,
        overrides: s.overrides || { planets: {} },
      });
    }
  }

  const populatedRes = populatedIndices.map((idx) => slot_resolutions.find((r) => r.ui_index === idx)!);

  let composition_mode: DerivedCompositionMode;
  let canonical_slot_order: string[] = [];
  const tc = input.transit_context;

  if (n === 1) {
    composition_mode = 'single';
    const r = populatedRes[0];
    if (r.chart_id) canonical_slot_order = [r.chart_id];
    else if (r.birth) {
      const bh = hashBirth(r.birth);
      const oh = hashOverrides(r.overrides || { planets: {} });
      canonical_slot_order = [`birth:${bh}`, `overrides:${oh}`];
    }
  } else if (n === 2) {
    const id0 = populatedRes[0].chart_id!;
    const id1 = populatedRes[1].chart_id!;
    const overlayCandidate =
      tc &&
      isValidTransitContext(tc) &&
      tc.natal_chart_id === id0 &&
      id0 === id1;
    if (overlayCandidate) {
      composition_mode = 'overlay';
      canonical_slot_order = [
        `natal:${id0}`,
        `transit:${stableStringify({
          dt: tc.current_datetime,
          lat: tc.current_latitude,
          lon: tc.current_longitude,
        })}`,
      ];
    } else {
      composition_mode = 'pair_aggregate';
      const lo = id0.localeCompare(id1, 'en') <= 0 ? id0 : id1;
      const hi = lo === id0 ? id1 : id0;
      canonical_slot_order = [lo, hi];
    }
  } else {
    composition_mode = 'group_aggregate';
    const ids = populatedRes.map((r) => r.chart_id!).sort((a, b) => a.localeCompare(b, 'en'));
    canonical_slot_order = ids;
  }

  const hashPayload = {
    v: CANONICAL_INPUT_HASH_VERSION,
    mode: composition_mode,
    order: canonical_slot_order,
    binding: input.binding || null,
    transit:
      composition_mode === 'overlay' && tc
        ? {
            natal_chart_id: tc.natal_chart_id,
            current_datetime: tc.current_datetime,
            current_latitude: tc.current_latitude,
            current_longitude: tc.current_longitude,
          }
        : null,
    controls: input.compose_controls || {},
    output_kind,
    seed: input.seed ?? null,
  };

  const canonical_input_hash = crypto.createHash('sha256').update(stableStringify(hashPayload), 'utf8').digest('hex');

  return {
    ok: true,
    composition_mode,
    canonical_slot_order,
    canonical_input_hash,
    canonical_input_hash_version: CANONICAL_INPUT_HASH_VERSION,
    output_kind,
    seed: input.seed,
    slot_resolutions,
    transit_context: tc,
    binding: input.binding,
    compose_controls: (input.compose_controls || {}) as Record<string, unknown>,
  };
}
