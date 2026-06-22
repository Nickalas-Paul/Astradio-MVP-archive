import { formatApiError } from './format-api-error';
import { postSnapshot } from './sandbox-fetch';
import { snapshotFromEphemeris } from './sandbox-slot-utils';
import { historicalPresetTimezone, type HistoricalPreset } from '../data/historical-presets';
import { useSandboxStore } from '../store/sandbox';

export async function applyHistoricalPresetToSlot(
  slotIndex: number,
  preset: HistoricalPreset
): Promise<void> {
  const timezone = historicalPresetTimezone(preset);
  const birthWire = {
    date: preset.date,
    time: preset.time.length >= 5 ? preset.time.slice(0, 5) : preset.time,
    lat: preset.lat,
    lon: preset.lon,
    tz: timezone,
    houseSystem: 'placidus' as const,
    location: {
      label: preset.locationLabel,
      lat: preset.lat,
      lon: preset.lon,
      timezone,
    },
  };

  const snapRes = await postSnapshot(birthWire, { planets: {} });
  const snap = snapshotFromEphemeris(snapRes.snapshot);
  if (!snap) throw new Error('Failed to load chart');

  useSandboxStore.getState().updateSlot(slotIndex, {
    entryMode: 'ephemeris_birth',
    chartDisplayName: preset.label,
    birth: {
      date: birthWire.date,
      time: birthWire.time,
      lat: birthWire.lat,
      lon: birthWire.lon,
      timezone,
      locationLabel: preset.locationLabel,
      houseSystem: 'placidus',
    },
    snapshot: snap,
    baseSnapshot: snap,
  });
}

export async function applyHistoricalPresetWithErrorHandling(
  slotIndex: number,
  preset: HistoricalPreset
): Promise<string | null> {
  try {
    await applyHistoricalPresetToSlot(slotIndex, preset);
    return null;
  } catch (e) {
    return formatApiError(e, 'Failed to load historical preset');
  }
}
