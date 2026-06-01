/**
 * BFF-only: wire JSON (client) → engine-safe JSON for sandbox snapshot / resolve.
 * Does not redefine engine semantics, hashes, or composition rules.
 */
import { z } from 'zod';
import type { CanonicalLocation } from '../types/location';
import type { SandboxBirth } from '../types/sandbox';

export const CanonicalLocationSchema = z.object({
  source: z.literal('geofinder'),
  label: z.string().min(1).max(300),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(100),
  resolvedAt: z.string().min(1).max(100),
}) satisfies z.ZodType<CanonicalLocation>;

/** Wire birth as sent from Sandbox UI (nested location). */
export const SandboxBirthWireSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  location: CanonicalLocationSchema,
  houseSystem: z.string().min(1).max(50).optional(),
});

export const SandboxSnapshotRequestSchema = z.object({
  birth: SandboxBirthWireSchema,
  overrides: z.any(),
});

/** Matches vnext/contracts.SandboxBirth (flat lat/lon). */
export type EngineSandboxBirth = {
  date: string;
  time: string;
  lat: number;
  lon: number;
  tz?: string;
  houseSystem?: string;
};

export function wireBirthToEngineBirth(wire: z.infer<typeof SandboxBirthWireSchema>): EngineSandboxBirth {
  return {
    date: wire.date,
    time: wire.time,
    lat: wire.location.lat,
    lon: wire.location.lon,
    tz: wire.location.timezone,
    houseSystem: wire.houseSystem ?? 'placidus',
  };
}

/**
 * Map GET /api/charts/:id (engine Chart) into Sandbox birth wire for snapshot preview only.
 * chart_id remains the canonical slot identity for resolve.
 */
/** User-facing label for a chart import (never the raw chart_id). */
export function chartApiOwnerDisplayLabel(chart: Record<string, unknown>): string {
  const displayName =
    (typeof chart.ownerDisplayName === 'string' && chart.ownerDisplayName.trim()) ||
    (typeof chart.owner_display_name === 'string' && chart.owner_display_name.trim()) ||
    (typeof chart.display_name === 'string' && chart.display_name.trim()) ||
    '';
  if (displayName) return displayName;

  const handleRaw =
    (typeof chart.ownerHandle === 'string' && chart.ownerHandle.trim()) ||
    (typeof chart.owner_handle === 'string' && chart.owner_handle.trim()) ||
    (typeof chart.handle === 'string' && chart.handle.trim()) ||
    '';
  if (handleRaw) {
    const h = handleRaw.trim();
    return h.startsWith('@') ? h : `@${h}`;
  }

  const chartLabel = typeof chart.label === 'string' ? chart.label.trim() : '';
  if (chartLabel && !chartLabel.startsWith('chart_')) return chartLabel;

  return 'Imported chart';
}

export function chartApiRecordToSandboxBirthWire(chart: {
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  label?: string;
}): SandboxBirth {
  const date = String(chart.date).slice(0, 10);
  const rawTime = String(chart.time);
  const time = rawTime.length >= 5 ? rawTime.slice(0, 5) : rawTime;
  return {
    date,
    time,
    location: {
      source: 'geofinder',
      label: (chart.label && chart.label.trim()) || 'Imported chart',
      lat: chart.lat,
      lon: chart.lon,
      timezone: (chart.timezone && chart.timezone.trim()) || 'UTC',
      resolvedAt: new Date().toISOString(),
    },
    houseSystem: 'placidus',
  };
}

function isEngineShapedBirth(b: unknown): boolean {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  if (typeof o.date !== 'string' || typeof o.time !== 'string') return false;
  if (typeof o.lat !== 'number' || typeof o.lon !== 'number') return false;
  return Number.isFinite(o.lat) && Number.isFinite(o.lon);
}

function sanitizeEngineBirth(o: Record<string, unknown>): EngineSandboxBirth {
  const out: EngineSandboxBirth = {
    date: String(o.date).slice(0, 10),
    time: String(o.time).slice(0, 5),
    lat: Number(o.lat),
    lon: Number(o.lon),
  };
  if (typeof o.tz === 'string' && o.tz.trim()) out.tz = o.tz.trim();
  if (typeof o.houseSystem === 'string' && o.houseSystem.trim()) out.houseSystem = o.houseSystem.trim();
  return out;
}

/**
 * Single slot ephemeris_birth: wire → engine, or sanitize already-flat engine birth, else pass through.
 */
export function normalizeEphemerisBirthForEngine(raw: unknown): unknown {
  if (raw == null) return raw;
  if (isEngineShapedBirth(raw)) {
    return sanitizeEngineBirth(raw as Record<string, unknown>);
  }
  const wireParsed = SandboxBirthWireSchema.safeParse(raw);
  if (wireParsed.success) {
    return wireBirthToEngineBirth(wireParsed.data);
  }
  return raw;
}

/**
 * SandboxCompositionInputV1-like body: normalize each slots[].ephemeris_birth for the engine.
 */
export function normalizeSandboxCompositionBodyForEngine(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const body = raw as Record<string, unknown>;
  const slots = body.slots;
  if (!Array.isArray(slots)) return raw;
  const newSlots = slots.map((slot) => {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return slot;
    const s = slot as Record<string, unknown>;
    if (!('ephemeris_birth' in s)) return slot;
    const normalized = normalizeEphemerisBirthForEngine(s.ephemeris_birth);
    return { ...s, ephemeris_birth: normalized };
  });
  return { ...body, slots: newSlots };
}
