'use client';

import { useState } from 'react';
import type { SandboxBirth } from '../../types/sandbox';
import { LocationFinder, type GeocodeResult } from './LocationFinder';

export interface BirthDataFormProps {
  onSubmit: (birth: SandboxBirth) => Promise<void>;
  isLoading?: boolean;
}

export function BirthDataForm({ onSubmit, isLoading }: BirthDataFormProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [locationLabel, setLocationLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [tz, setTz] = useState('UTC');
  const [houseSystem, setHouseSystem] = useState('placidus');
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');

  const handleLocationSelect = (result: GeocodeResult) => {
    setLocationLabel(result.label);
    setLat(result.lat);
    setLon(result.lon);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let latNum: number;
    let lonNum: number;

    if (advancedOpen && manualLat && manualLon) {
      latNum = parseFloat(manualLat);
      lonNum = parseFloat(manualLon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        setError('Valid latitude and longitude are required');
        return;
      }
      if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        setError('Latitude must be -90 to 90; longitude -180 to 180');
        return;
      }
    } else {
      if (lat == null || lon == null) {
        setError('Select a location from the search results, or use Advanced to enter coordinates');
        return;
      }
      latNum = lat;
      lonNum = lon;
    }

    if (!date || !time) {
      setError('Date and time are required');
      return;
    }

    try {
      await onSubmit({
        date,
        time,
        lat: latNum,
        lon: lonNum,
        tz: tz || 'UTC',
        houseSystem: houseSystem || 'placidus',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text"
            required
          />
        </div>
      </div>

      <LocationFinder
        value={locationLabel}
        onSelect={handleLocationSelect}
        disabled={isLoading}
        placeholder="City, State, Country"
        error={!advancedOpen ? error : null}
      />

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="group"
      >
        <summary className="cursor-pointer text-sm text-subtext hover:text-text list-none">
          <span className="inline-block group-open:rotate-90 transition-transform">▶</span> Advanced: enter coordinates manually
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-4 pl-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="40.7128"
              className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={manualLon}
              onChange={(e) => setManualLon(e.target.value)}
              placeholder="-74.006"
              className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text"
            />
          </div>
          <p className="col-span-2 text-xs text-subtext">
            When Advanced is open and both fields are filled, manual coordinates are used instead of the location search.
          </p>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Timezone</label>
          <input
            type="text"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="UTC"
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">House System</label>
          <select
            value={houseSystem}
            onChange={(e) => setHouseSystem(e.target.value)}
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text"
          >
            <option value="placidus">Placidus</option>
            <option value="equal">Equal</option>
            <option value="koch">Koch</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Loading chart...' : 'Load Chart'}
      </button>
    </form>
  );
}
