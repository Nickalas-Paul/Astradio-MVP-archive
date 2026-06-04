'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LocationFinder } from '../sandbox/LocationFinder';
import { getApiBaseUrl } from '../../core/api-base';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import type { ProfilePrimaryChart } from '../../core/social/hooks';
import { useUIStore } from '../../store';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/Input';

export type BirthChartSectionVariant = 'profile_onboarding' | 'manage';

export interface BirthChartSectionProps {
  variant: BirthChartSectionVariant;
  /** Profile refresh from parent `useProfile` (single source). */
  refresh: () => Promise<void>;
  /** Chart explainer refresh from parent `useProfileChart` (single source). */
  refreshChart: () => Promise<void>;
  primaryChart: ProfilePrimaryChart | null;
}

/**
 * Birth chart create (onboarding) or update (manage). POST /api/profile unchanged.
 */
export function BirthChartSection({ variant, refresh, refreshChart, primaryChart }: BirthChartSectionProps) {
  const { addToast } = useUIStore();
  const realChart = hasRealChart(primaryChart) ? primaryChart : null;

  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [tz, setTz] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== 'manage' || !realChart) return;
    setLabel(realChart.label);
    setDate(realChart.date);
    setTime(realChart.time);
    setLat(String(realChart.lat));
    setLon(String(realChart.lon));
    setTz(
      realChart.timezone && isPersistableChartTimezone(realChart.timezone) ? realChart.timezone : '',
    );
    setLocationLabel('');
  }, [variant, realChart]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!isPersistableChartTimezone(tz)) {
        setError(
          'Choose a birth place from search results so a valid local timezone is set (UTC alone is not accepted).',
        );
        return;
      }
      const body = {
        chart: {
          label: label.trim() || 'My Natal',
          date,
          time,
          location: {
            source: 'geofinder' as const,
            label: locationLabel,
            lat: Number(lat),
            lon: Number(lon),
            timezone: tz.trim(),
            resolvedAt: new Date().toISOString(),
          },
        },
      };
      const r = await fetch(`${getApiBaseUrl() || ''}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to save chart');
        return;
      }
      if (variant === 'profile_onboarding') {
        setLabel('');
        setDate('');
        setTime('12:00');
        setLat('');
        setLon('');
        setTz('');
        setLocationLabel('');
      } else {
        setLocationLabel('');
      }
      await refresh();
      if (variant === 'manage') {
        await refreshChart();
        addToast({
          type: 'success',
          title: 'Chart updated',
          message: 'Head to your Identity tab to hear the new you.',
          duration: 5000,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (variant === 'manage') {
    if (!primaryChart || primaryChart.id === DEFAULT_PROFILE_CHART_ID || !realChart) {
      return (
        <p className="text-sm text-text-secondary">
          Add a birth chart from My Sky first, or complete onboarding.
        </p>
      );
    }
  }

  return (
    <div className="max-w-full space-y-4 rounded-2xl border border-border bg-bgElev p-4">
      <p className="text-sm font-medium text-text-primary">
        {variant === 'profile_onboarding' ? 'Add your birth chart' : 'Birth chart'}
      </p>
      {variant === 'profile_onboarding' && (
        <p className="text-xs text-text-secondary">Required for your natal wheel and Identity text.</p>
      )}
      <InputField
        placeholder="Label (e.g. My Natal)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <InputField type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <InputField type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <LocationFinder
        value={locationLabel}
        onSelect={(r) => {
          setLocationLabel(r.label);
          setLat(String(r.lat));
          setLon(String(r.lon));
          setTz(r.timezone && isPersistableChartTimezone(r.timezone) ? r.timezone : '');
        }}
        onClear={() => {
          setLocationLabel('');
          setLat('');
          setLon('');
          setTz('');
        }}
        placeholder={variant === 'manage' ? 'Birth place (search to set timezone)' : 'Birth place (city, region, or address)'}
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={saving}
        loading={saving}
        onClick={() => void submit()}
      >
        {variant === 'profile_onboarding' ? 'Save birth chart' : 'Save updated birth chart'}
      </Button>
      {variant === 'profile_onboarding' && (
        <Link href="/sandbox" className="block text-sm text-accent-light hover:underline">
          Open Sandbox
        </Link>
      )}
    </div>
  );
}
