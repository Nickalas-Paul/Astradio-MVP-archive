import { getSlotPopulationKind, snapshotFromEphemeris } from './sandbox-slot-utils';
import { dailyTransitBirthForBlankCanvas } from './sandbox-blank-canvas';
import { roundSandboxDegree } from './sandbox-zodiac';
import type { SandboxSlot } from '../types/sandbox';

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

export function overridesToWire(overrides?: Record<string, { lon: number }>) {
  const planets: Record<string, { lonDeg: number }> = {};
  for (const [key, val] of Object.entries(overrides ?? {})) {
    if (typeof val.lon === 'number' && Number.isFinite(val.lon)) {
      planets[key] = { lonDeg: roundSandboxDegree(val.lon) };
    }
  }
  return { planets };
}

export function birthToWire(slot: SandboxSlot) {
  if (!slot.birth) return null;
  const b = slot.birth;
  return {
    date: b.date,
    time: b.time.length >= 5 ? b.time.slice(0, 5) : b.time,
    lat: b.lat,
    lon: b.lon,
    tz: b.timezone || 'UTC',
    houseSystem: b.houseSystem ?? 'placidus',
  };
}

export function getPopulatedSlotIndices(slots: SandboxSlot[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const k = getSlotPopulationKind(slots[i]!);
    if (k !== 'empty' && k !== 'invalid' && k !== 'birth_incomplete') indices.push(i);
  }
  return indices;
}

export function compositionCanGenerate(slots: SandboxSlot[]): boolean {
  return getPopulatedSlotIndices(slots).length > 0;
}

export function slotToWire(
  slot: SandboxSlot,
  transientBirth?: ReturnType<typeof dailyTransitBirthForBlankCanvas>
) {
  const overrides = overridesToWire(slot.overrides);
  if (slot.chartId) {
    return { chart_id: slot.chartId.trim(), overrides };
  }
  const birthWire = birthToWire(slot);
  if (birthWire) {
    return { ephemeris_birth: birthWire, overrides };
  }
  if (slot.entryMode === 'blank_canvas' && transientBirth) {
    return { ephemeris_birth: transientBirth, overrides };
  }
  return { overrides };
}

export function serializeSandboxResolveRequestBody(
  slots: SandboxSlot[],
  activeSlotIndex: number,
  seed: string,
  options?: {
    generateAudio?: boolean;
    expectedPlanSha256?: string;
    expectedObjectIdentityHash?: string;
    transientBirthBySlot?: Record<number, ReturnType<typeof dailyTransitBirthForBlankCanvas>>;
  }
): Record<string, unknown> {
  const transient = options?.transientBirthBySlot ?? {};
  const wireSlots = slots.map((slot, index) =>
    slotToWire(slot, transient[index] ?? (slot.entryMode === 'blank_canvas' ? dailyTransitBirthForBlankCanvas() : undefined))
  );
  const populated = getPopulatedSlotIndices(slots);
  const binding =
    populated.length >= 2 ? { relationship_mode: 'friends' as const } : undefined;
  return {
    schema_version: '1',
    slots: wireSlots,
    active_slot_index: activeSlotIndex,
    compose_controls: { ...SANDBOX_COMPOSE_CONTROLS },
    output_kind: 'full',
    seed,
    generateAudio: options?.generateAudio === true,
    ...(options?.generateAudio &&
    options.expectedPlanSha256 &&
    options.expectedObjectIdentityHash
      ? {
          expectedPlanSha256: options.expectedPlanSha256,
          expectedObjectIdentityHash: options.expectedObjectIdentityHash,
        }
      : {}),
    ...(binding ? { binding } : {}),
  };
}

export function extractSandboxResolvePayload(resolveData: Record<string, unknown>): {
  explanation: unknown;
  planSha256: string;
  exportId: string | null;
  sandboxSynastryReport: unknown | null;
} | null {
  const compose = resolveData.compose;
  const aggregate = resolveData.aggregate;
  const source =
    compose && typeof compose === 'object'
      ? (compose as Record<string, unknown>)
      : aggregate && typeof aggregate === 'object'
        ? (aggregate as Record<string, unknown>)
        : null;
  if (!source) return null;
  const explanation = source.explanation;
  const hashes = source.hashes as { plan_sha256?: string } | undefined;
  const planSha256 = hashes?.plan_sha256;
  const exportIdRaw = source.export_id;
  const exportId = typeof exportIdRaw === 'string' && exportIdRaw.length > 0 ? exportIdRaw : null;
  if (!explanation || typeof explanation !== 'object' || !planSha256 || typeof planSha256 !== 'string') {
    return null;
  }
  const rawSynastry = resolveData.sandboxSynastryReport;
  const sandboxSynastryReport =
    rawSynastry && typeof rawSynastry === 'object' ? rawSynastry : null;
  return { explanation, planSha256, exportId, sandboxSynastryReport };
}

export function buildReportFromResolve(
  resolveData: Record<string, unknown>,
  combinedHash: string
): Record<string, unknown> {
  const resolved = extractSandboxResolvePayload(resolveData);
  if (!resolved) return { explanation: { sections: [] }, seed: combinedHash };
  const explanationForSections = resolved.explanation as {
    sections?: unknown[];
    spec?: string;
    meta?: { canonical_object_hash?: string };
  };
  const sections = Array.isArray(explanationForSections?.sections)
    ? explanationForSections.sections!.map((s: unknown) => {
        const x = s as {
          sectionId?: string;
          id?: string;
          title?: string;
          text?: string;
          bullets?: string[];
        };
        return {
          id: x.sectionId || x.id || '',
          title: x.title || '',
          text: x.text || '',
          bullets: x.bullets,
        };
      })
    : [];
  return {
    features: [],
    personality: null,
    guidance: null,
    explanation: {
      spec: explanationForSections?.spec || 'UnifiedSpecV1.1',
      sections,
    },
    ...(resolved.sandboxSynastryReport
      ? { sandboxSynastryReport: resolved.sandboxSynastryReport }
      : {}),
    seed: combinedHash,
    meta: {
      combinedHash,
      canonical_object_hash:
        (resolveData.canonical_object_hash as string | undefined) ??
        explanationForSections?.meta?.canonical_object_hash,
    },
  };
}

export function metaCombinedHash(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const h = (meta as { combinedHash?: string }).combinedHash;
  return typeof h === 'string' && h.trim() ? h.trim() : null;
}

export function applyOverridesToSnapshotLite(
  base: NonNullable<ReturnType<typeof snapshotFromEphemeris>>,
  overrides?: Record<string, { lon: number }>
) {
  if (!overrides || Object.keys(overrides).length === 0) return base;
  const planets = base.planets.map((p) => {
    const ov = overrides[p.name] ?? overrides[p.name.toLowerCase()];
    return ov ? { ...p, lon: ov.lon } : p;
  });
  return { ...base, planets };
}
