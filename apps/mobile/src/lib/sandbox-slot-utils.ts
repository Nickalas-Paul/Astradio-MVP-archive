import { equalHouseCuspsFromAscendant } from './sandbox-equal-houses';
import { lonToSignDeg } from './sandbox-zodiac';
import { mapSnapshotToWheel } from './my-sky-mappers';
import type { EphemerisSnapshot } from '../types/my-sky';
import type { SandboxSlot, SlotEntryMode } from '../types/sandbox';

export function createEmptySlot(index: number): SandboxSlot {
  return { index, entryMode: 'empty' };
}

/** Mirrors web slotWirePopulationKind for chip labels and gating. */
export function getSlotPopulationKind(slot: SandboxSlot): SlotEntryMode {
  const hasChart = typeof slot.chartId === 'string' && slot.chartId.trim().length > 0;
  const b = slot.birth;
  const hasDateTime = !!(b?.date && b.date.length >= 8 && b?.time && b.time.length >= 4);

  if (hasChart && hasDateTime) return 'invalid';
  if (hasChart) return 'chart_id';

  if (hasDateTime) {
    const lat = b?.lat;
    const lon = b?.lon;
    return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? 'ephemeris_birth'
      : 'birth_incomplete';
  }

  if (slot.entryMode === 'blank_canvas' && blankCanvasHasPlacedPlanets(slot)) {
    return 'blank_canvas';
  }

  if (slot.entryMode === 'birth_incomplete') return 'birth_incomplete';
  if (slot.entryMode === 'chart_id' && !hasChart) return 'empty';

  return 'empty';
}

export function blankCanvasHasPlacedPlanets(slot: SandboxSlot): boolean {
  const planets = slot.overrides ?? {};
  return Object.keys(planets).length > 0;
}

export function slotIsPopulated(slot: SandboxSlot): boolean {
  return getSlotPopulationKind(slot) !== 'empty';
}

/** Mirrors web compositionHasExistingData (no auto-skip on mount). */
export function compositionHasExistingData(state: {
  slots: SandboxSlot[];
  resolveResult: unknown | null;
}): boolean {
  if (state.resolveResult != null) return true;
  return state.slots.some((s) => slotIsPopulated(s));
}

function chartSlotDisplayName(slot: SandboxSlot): string {
  const stored = slot.chartDisplayName?.trim();
  if (stored) return stored;
  const chartId = slot.chartId?.trim();
  if (chartId) {
    if (chartId.length > 16) return `${chartId.slice(0, 12)}…`;
    return chartId;
  }
  return 'Imported chart';
}

function manualChipText(manualOrdinal: number, manualCount: number): string {
  if (manualCount <= 1) return 'Manual';
  return `Manual ${manualOrdinal}`;
}

export type SlotChipRow = {
  index: number;
  label: string;
  isManualStyle: boolean;
  populationKind: SlotEntryMode;
};

/** Chip labels aligned with web projectSlotsFromCompositionInput. */
export function projectSlotChips(slots: SandboxSlot[]): SlotChipRow[] {
  const manualIndices: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const k = getSlotPopulationKind(slots[i]!);
    if (k === 'empty' || k === 'blank_canvas' || slots[i]?.entryMode === 'blank_canvas') {
      manualIndices.push(i);
    }
  }
  const manualCount = manualIndices.length;

  return slots.map((slot, index) => {
    const k = getSlotPopulationKind(slot);
    const hasChartId = typeof slot.chartId === 'string' && slot.chartId.trim().length > 0;

    if (k === 'invalid') {
      return { index, label: 'Invalid', isManualStyle: false, populationKind: k };
    }
    if (hasChartId || k === 'chart_id') {
      return {
        index,
        label: chartSlotDisplayName(slot),
        isManualStyle: false,
        populationKind: 'chart_id' as SlotEntryMode,
      };
    }
    if (k === 'birth_incomplete') {
      const b = slot.birth;
      const timeShort = b && b.time.length >= 5 ? b.time.slice(0, 5) : (b?.time ?? '');
      return {
        index,
        label: b ? `${b.date} ${timeShort} (add location)` : 'Incomplete birth',
        isManualStyle: false,
        populationKind: k,
      };
    }
    if (k === 'ephemeris_birth' && slot.birth) {
      const timeShort = slot.birth.time.length >= 5 ? slot.birth.time.slice(0, 5) : slot.birth.time;
      return {
        index,
        label: `${slot.birth.date} ${timeShort}`,
        isManualStyle: false,
        populationKind: k,
      };
    }
    const manualOrdinal = manualIndices.indexOf(index) + 1;
    return {
      index,
      label: manualChipText(manualOrdinal, manualCount),
      isManualStyle: true,
      populationKind: k,
    };
  });
}

export function snapshotFromEphemeris(raw: unknown): SandboxSlot['snapshot'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const planetsRaw = Array.isArray(obj.planets) ? obj.planets : [];
  const planets = planetsRaw
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const name = String((p as { name?: string }).name ?? '');
      const lon = (p as { lon?: number }).lon;
      if (!name || typeof lon !== 'number' || !Number.isFinite(lon)) return null;
      return { name, lon };
    })
    .filter((p): p is { name: string; lon: number } => p !== null);

  const housesRaw = Array.isArray(obj.houses)
    ? obj.houses
    : Array.isArray(obj.cusps)
      ? obj.cusps
      : [];
  const houses = housesRaw
    .slice(0, 12)
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter(Number.isFinite);

  const aspectsRaw = Array.isArray(obj.aspects) ? obj.aspects : [];
  const aspects = aspectsRaw
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const row = a as Record<string, unknown>;
      const bodyA = String(row.bodyA ?? row.a ?? '');
      const bodyB = String(row.bodyB ?? row.b ?? '');
      const type = String(row.type ?? '');
      const orb = typeof row.orb === 'number' ? row.orb : 0;
      if (!bodyA || !bodyB) return null;
      return { bodyA, bodyB, type, orb };
    })
    .filter((a): a is { bodyA: string; bodyB: string; type: string; orb: number } => a !== null);

  if (planets.length === 0 && houses.length < 12) return undefined;
  return { planets, houses, aspects };
}

function snapshotToEphemeris(snap: NonNullable<SandboxSlot['snapshot']>): EphemerisSnapshot {
  return {
    planets: snap.planets,
    houses: snap.houses,
    aspects: snap.aspects.map((a) => ({
      bodyA: a.bodyA,
      bodyB: a.bodyB,
      type: a.type,
      orb: a.orb,
    })),
  };
}

/** Wheel data for sandbox slots, including blank-canvas equal houses. */
export function mapSandboxSlotToWheel(slot: SandboxSlot | undefined) {
  if (!slot) return null;

  if (slot.entryMode === 'blank_canvas') {
    const asc = slot.freeBuildAscDeg ?? 0;
    const cusps = equalHouseCuspsFromAscendant(asc);
    const snap = slot.snapshot;
    if (snap && snap.planets.length > 0) {
      const ephem = snapshotToEphemeris({ ...snap, houses: cusps });
      const wheel = mapSnapshotToWheel(ephem);
      if (wheel) {
        return { ...wheel, cusps, ascendantLongitude: asc };
      }
    }
    return {
      placements: [],
      houses: cusps.map((degree, index) => {
        const { sign, deg } = lonToSignDeg(degree);
        return { house: index + 1, sign, degree: deg };
      }),
      aspects: [],
      cusps,
      ascendantLongitude: asc,
    };
  }

  if (!slot.snapshot) return null;
  return mapSnapshotToWheel(snapshotToEphemeris(slot.snapshot));
}

type WireSlot = {
  chart_id?: string;
  chart_display_name?: string;
  entry_mode?: string | null;
  ephemeris_birth?: {
    date?: string;
    time?: string;
    location?: { lat?: number; lon?: number; timezone?: string; label?: string };
    lat?: number;
    lon?: number;
    houseSystem?: string;
  };
  overrides?: { planets?: Record<string, { lonDeg?: number }> };
};

export function wireSlotToSandboxSlot(index: number, wire: WireSlot): SandboxSlot {
  const overrides: SandboxSlot['overrides'] = {};
  const planets = wire.overrides?.planets ?? {};
  for (const [key, val] of Object.entries(planets)) {
    if (val && typeof val.lonDeg === 'number' && Number.isFinite(val.lonDeg)) {
      overrides[key] = { lon: val.lonDeg };
    }
  }

  const chartId = typeof wire.chart_id === 'string' ? wire.chart_id.trim() : undefined;
  const chartDisplayName =
    typeof wire.chart_display_name === 'string' ? wire.chart_display_name.trim() : undefined;

  let entryMode: SlotEntryMode = 'empty';
  if (wire.entry_mode === 'blank_canvas') entryMode = 'blank_canvas';
  else if (wire.entry_mode === 'birth_data') entryMode = 'birth_incomplete';

  const eb = wire.ephemeris_birth;
  let birth: SandboxSlot['birth'];
  if (eb?.date && eb?.time) {
    const lat =
      typeof eb.lat === 'number'
        ? eb.lat
        : typeof eb.location?.lat === 'number'
          ? eb.location.lat
          : undefined;
    const lon =
      typeof eb.lon === 'number'
        ? eb.lon
        : typeof eb.location?.lon === 'number'
          ? eb.location.lon
          : undefined;
    birth = {
      date: eb.date,
      time: eb.time.length >= 5 ? eb.time.slice(0, 5) : eb.time,
      lat: lat ?? NaN,
      lon: lon ?? NaN,
      timezone: eb.location?.timezone ?? 'UTC',
      locationLabel: eb.location?.label,
    };
    if (lat == null || lon == null) entryMode = 'birth_incomplete';
    else entryMode = 'ephemeris_birth';
  }

  if (chartId) entryMode = 'chart_id';

  const slot: SandboxSlot = {
    index,
    entryMode,
    ...(chartId ? { chartId, chartDisplayName } : {}),
    ...(birth ? { birth } : {}),
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };

  slot.entryMode = getSlotPopulationKind(slot) === 'empty' && wire.entry_mode === 'blank_canvas'
    ? 'blank_canvas'
    : getSlotPopulationKind(slot);

  return { ...slot, index };
}

export function parsePersistedSandboxSlots(sandboxState: unknown): {
  slots: SandboxSlot[];
  activeSlotIndex: number;
} {
  if (!sandboxState || typeof sandboxState !== 'object') {
    return { slots: [createEmptySlot(0)], activeSlotIndex: 0 };
  }

  const state = sandboxState as Record<string, unknown>;
  const ci = state.composition_input;
  if (ci && typeof ci === 'object' && !Array.isArray(ci)) {
    const raw = ci as { slots?: WireSlot[]; active_slot_index?: number };
    const wireSlots = Array.isArray(raw.slots) && raw.slots.length > 0 ? raw.slots : [{}];
    const slots = wireSlots.map((wire, index) => wireSlotToSandboxSlot(index, wire ?? {}));
    const active =
      typeof raw.active_slot_index === 'number' &&
      raw.active_slot_index >= 0 &&
      raw.active_slot_index < slots.length
        ? raw.active_slot_index
        : 0;
    return { slots, activeSlotIndex: active };
  }

  const birth = state.birth as WireSlot['ephemeris_birth'];
  const overrides = (state.overrides as WireSlot['overrides']) ?? { planets: {} };
  const slot = wireSlotToSandboxSlot(0, { ephemeris_birth: birth, overrides });
  return { slots: [slot], activeSlotIndex: 0 };
}
