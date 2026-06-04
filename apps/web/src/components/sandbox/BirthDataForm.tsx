'use client';

import { useState } from 'react';
import type { SandboxBirth } from '../../types/sandbox';
import type { CanonicalLocation } from '../../types/location';
import { LocationFinder, type GeocodeResult } from './LocationFinder';

export interface BirthDataFormProps {
  onSubmit: (birth: SandboxBirth) => Promise<void>;
  isLoading?: boolean;
}

export function BirthDataForm({ onSubmit, isLoading }: BirthDataFormProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [locationLabel, setLocationLabel] = useState('');
  const [location, setLocation] = useState<CanonicalLocation | null>(null);
  const [tz, setTz] = useState('UTC');
  const [houseSystem, setHouseSystem] = useState('placidus');
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleLocationSelect = (result: GeocodeResult) => {
    setLocationLabel(result.label);
    const resolvedAt = new Date().toISOString();
    const canonical: CanonicalLocation = {
      source: 'geofinder',
      label: result.label,
      lat: result.lat,
      lon: result.lon,
      timezone: result.timezone || 'UTC',
      resolvedAt,
    };
    setLocation(canonical);
    setTz(canonical.timezone);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!location) {
      setError('Select a location from the search results before continuing');
      return;
    }

    if (!date || !time) {
      setError('Date and time are required');
      return;
    }

    try {
      const birth: SandboxBirth = {
        date,
        time,
        location: {
          ...location,
          timezone: tz || location.timezone || 'UTC',
        },
        houseSystem: houseSystem || 'placidus',
      };
      await onSubmit(birth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text-primary"
            required
          />
        </div>
      </div>

      <LocationFinder
        value={locationLabel}
        onSelect={handleLocationSelect}
        disabled={isLoading}
        placeholder="City, State, Country"
        error={error}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Timezone</label>
          <input
            type="text"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="UTC"
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">House System</label>
          <select
            value={houseSystem}
            onChange={(e) => setHouseSystem(e.target.value)}
            className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text-primary"
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
