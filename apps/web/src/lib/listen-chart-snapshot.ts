import { chartApiRecordToSandboxBirthWire } from '@/lib/sandbox-bff-wire';
import type { SandboxBirth } from '@/types/sandbox';

export type ListenChartSlot =
  | { kind: 'chart_id'; chartId: string; label: string }
  | { kind: 'birth'; birth: SandboxBirth; label: string };

/** Fetch ephemeris snapshot for a Listen chart slot (chart id or birth data). */
export async function fetchListenSlotSnapshot(
  base: string,
  slot: ListenChartSlot
): Promise<unknown> {
  let birth: SandboxBirth;
  if (slot.kind === 'birth') {
    birth = slot.birth;
  } else {
    const chartRes = await fetch(`${base || ''}/api/charts/${encodeURIComponent(slot.chartId)}`, {
      credentials: 'same-origin',
    });
    const chartData = (await chartRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!chartRes.ok) {
      throw new Error(
        typeof chartData.error === 'string'
          ? chartData.error
          : `Could not load chart (${chartRes.status})`
      );
    }
    birth = chartApiRecordToSandboxBirthWire(
      chartData as {
        date: string;
        time: string;
        lat: number;
        lon: number;
        timezone?: string;
        label?: string;
      }
    );
  }

  const snapRes = await fetch(`${base || ''}/api/sandbox/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ birth, overrides: { planets: {} } }),
  });
  const snapData = (await snapRes.json().catch(() => ({}))) as { snapshot?: unknown; error?: string };
  if (!snapRes.ok || !snapData.snapshot) {
    throw new Error(
      typeof snapData.error === 'string' ? snapData.error : `Snapshot failed (${snapRes.status})`
    );
  }
  return snapData.snapshot;
}
