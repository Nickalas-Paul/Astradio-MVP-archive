/**
 * Stable fingerprint of Sandbox resolve input for staleness detection (excludes seed).
 * Mirrors the subset of POST /api/sandbox/resolve body that affects composition identity.
 */

import type { SandboxCompositionInputState } from '../types/sandbox';
import { normalizeSandboxOverrides } from './sandbox-composition-state';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(Number.isFinite(value) ? value : null);
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function slotWireForFingerprint(slot: SandboxCompositionInputState['slots'][number]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof slot.chart_id === 'string' && slot.chart_id.trim()) {
    out.chart_id = slot.chart_id.trim();
  }
  if (slot.ephemeris_birth && typeof slot.ephemeris_birth === 'object') {
    const b = slot.ephemeris_birth;
    const flat = b as unknown as { lat?: unknown; lon?: unknown; tz?: unknown };
    out.ephemeris_birth = {
      date: typeof b.date === 'string' ? b.date : '',
      time: typeof b.time === 'string' ? (b.time.length >= 5 ? b.time.slice(0, 5) : b.time) : '',
      lat:
        typeof flat.lat === 'number' && Number.isFinite(flat.lat)
          ? flat.lat
          : typeof b.location?.lat === 'number' && Number.isFinite(b.location.lat)
            ? b.location.lat
            : null,
      lon:
        typeof flat.lon === 'number' && Number.isFinite(flat.lon)
          ? flat.lon
          : typeof b.location?.lon === 'number' && Number.isFinite(b.location.lon)
            ? b.location.lon
            : null,
      tz:
        typeof flat.tz === 'string'
          ? flat.tz
          : typeof b.location?.timezone === 'string'
            ? b.location.timezone
            : undefined,
      houseSystem: typeof b.houseSystem === 'string' ? b.houseSystem : undefined,
    };
  }
  out.overrides = normalizeSandboxOverrides(slot.overrides ?? { planets: {} });
  return out;
}

/** Fingerprint from live composition model (no seed). */
export function fingerprintCompositionInputExcludingSeed(input: SandboxCompositionInputState): string {
  const payload = {
    schema_version: typeof input.schema_version === 'string' ? input.schema_version : '1',
    slots: input.slots.map(slotWireForFingerprint),
    active_slot_index: typeof input.active_slot_index === 'number' ? input.active_slot_index : 0,
    compose_controls: input.compose_controls ?? {},
    output_kind: input.output_kind === 'feed_card' ? 'feed_card' : 'full',
    binding: input.binding && typeof input.binding === 'object' ? input.binding : null,
    transit_context: input.transit_context && typeof input.transit_context === 'object' ? input.transit_context : null,
  };
  return stableStringify(payload);
}

/** Strip seed from a persisted resolve body and fingerprint the rest. */
export function fingerprintResolveBodyExcludingSeed(body: Record<string, unknown> | null | undefined): string | null {
  if (!body || typeof body !== 'object') return null;
  const { seed: _s, ...rest } = body as Record<string, unknown> & { seed?: unknown };
  const slots = Array.isArray(rest.slots) ? rest.slots : [];
  const normalizedSlots = slots.map((slot) => {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return {};
    return slotWireForFingerprint(slot as SandboxCompositionInputState['slots'][number]);
  });
  const activeIdx =
    typeof rest.active_slot_index === 'number' && Number.isFinite(rest.active_slot_index)
      ? rest.active_slot_index
      : 0;
  const payload = {
    schema_version: typeof rest.schema_version === 'string' ? rest.schema_version : '1',
    slots: normalizedSlots,
    active_slot_index: activeIdx,
    compose_controls: rest.compose_controls && typeof rest.compose_controls === 'object' ? rest.compose_controls : {},
    output_kind: rest.output_kind === 'feed_card' ? 'feed_card' : 'full',
    binding: rest.binding && typeof rest.binding === 'object' ? rest.binding : null,
    transit_context: rest.transit_context && typeof rest.transit_context === 'object' ? rest.transit_context : null,
  };
  return stableStringify(payload);
}
