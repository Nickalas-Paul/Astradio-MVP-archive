import { chartApiRecordToSandboxBirthWire } from '@/lib/sandbox-bff-wire';
import type { SandboxBirth } from '@/types/sandbox';

export type ListenChartSlot =
  | { kind: 'chart_id'; chartId: string; label: string }
  | { kind: 'birth'; birth: SandboxBirth; label: string };

export type ListenSlotSnapshotResult =
  | { status: 'ok'; snapshot: unknown }
  | { status: 'unavailable'; message: string };

const UNAVAILABLE_MSG = 'Chart data not available for preview';

function isResolvableBirthWire(birth: SandboxBirth): boolean {
  return (
    Boolean(birth.date && birth.time) &&
    Number.isFinite(birth.location.lat) &&
    Number.isFinite(birth.location.lon) &&
    Boolean(birth.location.timezone)
  );
}

async function fetchChartWheelSnapshot(base: string, chartId: string): Promise<unknown | null> {
  const snapRes = await fetch(`${base || ''}/api/charts/${encodeURIComponent(chartId)}/snapshot`, {
    credentials: 'same-origin',
  });
  const snapData = (await snapRes.json().catch(() => ({}))) as { snapshot?: unknown; error?: string };
  if (snapRes.ok && snapData.snapshot) {
    return snapData.snapshot;
  }
  return null;
}

async function fetchBirthSnapshot(base: string, birth: SandboxBirth): Promise<unknown> {
  const snapRes = await fetch(`${base || ''}/api/sandbox/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ birth, overrides: { planets: {} } }),
  });
  const snapData = (await snapRes.json().catch(() => ({}))) as { snapshot?: unknown; error?: string; details?: unknown };
  if (!snapRes.ok || !snapData.snapshot) {
    const detailMsg =
      Array.isArray(snapData.details) &&
      snapData.details[0] &&
      typeof snapData.details[0] === 'object' &&
      snapData.details[0] !== null &&
      'message' in snapData.details[0]
        ? String((snapData.details[0] as { message?: string }).message)
        : null;
    throw new Error(
      typeof snapData.error === 'string' && snapData.error !== 'Invalid input'
        ? snapData.error
        : detailMsg || `Snapshot failed (${snapRes.status})`
    );
  }
  return snapData.snapshot;
}

/** Fetch ephemeris snapshot for a Listen chart slot (chart id or birth data). */
export async function fetchListenSlotSnapshot(
  base: string,
  slot: ListenChartSlot
): Promise<ListenSlotSnapshotResult> {
  try {
    if (slot.kind === 'birth') {
      if (!isResolvableBirthWire(slot.birth)) {
        return { status: 'unavailable', message: UNAVAILABLE_MSG };
      }
      const snapshot = await fetchBirthSnapshot(base, slot.birth);
      return { status: 'ok', snapshot };
    }

    const fromServer = await fetchChartWheelSnapshot(base, slot.chartId);
    if (fromServer) {
      return { status: 'ok', snapshot: fromServer };
    }

    const chartRes = await fetch(`${base || ''}/api/charts/${encodeURIComponent(slot.chartId)}`, {
      credentials: 'same-origin',
    });
    const chartData = (await chartRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!chartRes.ok) {
      return {
        status: 'unavailable',
        message:
          typeof chartData.error === 'string'
            ? chartData.error
            : `Could not load chart (${chartRes.status})`,
      };
    }

    const birth = chartApiRecordToSandboxBirthWire(
      chartData as {
        date: string;
        time: string;
        lat: number;
        lon: number;
        timezone?: string;
        label?: string;
      }
    );
    if (!isResolvableBirthWire(birth)) {
      return { status: 'unavailable', message: UNAVAILABLE_MSG };
    }

    const snapshot = await fetchBirthSnapshot(base, birth);
    return { status: 'ok', snapshot };
  } catch {
    return { status: 'unavailable', message: UNAVAILABLE_MSG };
  }
}

/** Snapshots returned directly from pair resolve (preferred — no re-fetch). */
export function extractResolveSlotSnapshots(resolveData: Record<string, unknown>): unknown[] | null {
  const snaps = resolveData.slot_snapshots;
  if (!Array.isArray(snaps) || snaps.length === 0) return null;
  return snaps;
}
