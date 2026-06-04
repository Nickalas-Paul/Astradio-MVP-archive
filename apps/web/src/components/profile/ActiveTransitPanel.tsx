'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { LocationFinder } from '../sandbox/LocationFinder';
import { ExplainerSections } from './shared/ExplainerSections';
import { blobUrlFromComposePayload } from './shared/profile-audio-utils';
import { mapExplanationToSections } from './shared/profile-reading-utils';
import {
  isValidTransitLocationSource,
  normalizeLocalTime,
  parseSnapshotFingerprint,
  SAVE_DUP_PREFIX,
  snapshotSafeForWheel,
} from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';
import type { CanonicalLocation } from '../../types/location';
import { Button } from '@/components/shared/Button';
import { Tabs } from '@/components/shared/Tabs';
import { InputField } from '@/components/shared/Input';

const WheelDisplay = dynamic(
  () => import('@/components/wheel/WheelDisplay').then((m) => ({ default: m.WheelDisplay })),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

export interface ActiveTransitPanelProps {
  chartId: string | null;
  noRealChart: boolean;
  librarySaveError: string | null;
  onSaved: () => void;
  onSaveError: (message: string) => void;
  onClearSaveError: () => void;
}

export function ActiveTransitPanel({
  chartId,
  noRealChart,
  librarySaveError,
  onSaved,
  onSaveError,
  onClearSaveError,
}: ActiveTransitPanelProps) {
  const [activeDate, setActiveDate] = useState('');
  const [activeTime, setActiveTime] = useState('');
  const [activeLocLabel, setActiveLocLabel] = useState('');
  const [activeLat, setActiveLat] = useState('');
  const [activeLon, setActiveLon] = useState('');
  const [activeTz, setActiveTz] = useState('');
  const [activeTransitResolvedAt, setActiveTransitResolvedAt] = useState('');
  const [activeLocSource, setActiveLocSource] = useState<'browser_geo' | 'geofinder'>('geofinder');
  const [activeResult, setActiveResult] = useState<Record<string, unknown> | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeAudioBusy, setActiveAudioBusy] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<0 | 1>(0);

  const activeWheelSlots = useMemo(() => {
    const id = activeResult?.identity as
      | { natal_snapshot_fingerprint?: unknown; transit_snapshot_fingerprint?: unknown }
      | undefined;
    const natal = parseSnapshotFingerprint(id?.natal_snapshot_fingerprint);
    const transit = parseSnapshotFingerprint(id?.transit_snapshot_fingerprint);
    if (!natal || !transit) return null;
    return [
      { label: 'Your Chart', description: 'Natal positions', snapshot: natal },
      { label: 'Current Sky', description: 'Transiting positions', snapshot: transit },
    ] as const;
  }, [activeResult]);

  useEffect(() => {
    const now = new Date();
    setActiveDate((d) => d || now.toISOString().slice(0, 10));
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setActiveTime((t) => t || `${hh}:${mm}`);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const resolvedAt = new Date().toISOString();
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        setActiveLocLabel((l) => l || 'Current location');
        setActiveLat(String(pos.coords.latitude));
        setActiveLon(String(pos.coords.longitude));
        setActiveTz((z) => z || browserTz);
        setActiveTransitResolvedAt(resolvedAt);
        setActiveLocSource('browser_geo');
      },
      () => {},
      { maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    setActiveSlotIndex(0);
  }, [activeResult]);

  const loadActiveStateText = async () => {
    if (
      !chartId ||
      !activeDate ||
      !activeTime ||
      !isPersistableChartTimezone(activeTz) ||
      !activeTransitResolvedAt ||
      activeLat === '' ||
      activeLon === ''
    ) {
      setActiveError('Set date, time, and a resolved location with a valid timezone for current transit.');
      return;
    }
    const base = getApiBaseUrl();
    setActiveLoading(true);
    setActiveError(null);
    setActiveAudioUrl(null);
    try {
      const loc: CanonicalLocation = {
        source: activeLocSource,
        label: activeLocLabel.trim() || 'Location',
        lat: Number(activeLat),
        lon: Number(activeLon),
        timezone: activeTz.trim(),
        resolvedAt: activeTransitResolvedAt,
      };
      const r = await fetch(`${base || ''}/api/profile/active-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          chartId,
          calendarDate: activeDate,
          localTime: activeTime.length === 5 ? activeTime : activeTime.slice(0, 5),
          location: loc,
          generateAudio: false,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setActiveError(typeof j.error === 'string' ? j.error : `Active state failed (${r.status})`);
        setActiveResult(null);
        return;
      }
      setActiveResult(j);
    } catch (e) {
      setActiveError(e instanceof Error ? e.message : 'Active state failed');
      setActiveResult(null);
    } finally {
      setActiveLoading(false);
    }
  };

  const generateActiveAudio = async () => {
    if (!chartId || !activeResult) return;
    const hashes = activeResult.hashes as { plan_sha256?: string } | undefined;
    const exp = activeResult.explanation as { meta?: { canonical_object_hash?: string } } | undefined;
    const plan = hashes?.plan_sha256;
    const oid = exp?.meta?.canonical_object_hash;
    if (!plan || !oid) {
      setActiveError('Generate transit report first, then generate audio.');
      return;
    }
    if (!isPersistableChartTimezone(activeTz) || !activeTransitResolvedAt) {
      setActiveError('Resolve location with a valid timezone before generating audio.');
      return;
    }
    const base = getApiBaseUrl();
    setActiveAudioBusy(true);
    setActiveError(null);
    try {
      const loc: CanonicalLocation = {
        source: activeLocSource,
        label: activeLocLabel.trim() || 'Location',
        lat: Number(activeLat),
        lon: Number(activeLon),
        timezone: activeTz.trim(),
        resolvedAt: activeTransitResolvedAt,
      };
      const r = await fetch(`${base || ''}/api/profile/active-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          chartId,
          calendarDate: activeDate,
          localTime: activeTime.length === 5 ? activeTime : activeTime.slice(0, 5),
          location: loc,
          generateAudio: true,
          expectedPlanSha256: plan,
          expectedObjectIdentityHash: oid,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setActiveError(typeof j.error === 'string' ? j.error : `Audio failed (${r.status})`);
        return;
      }
      setActiveResult(j);
      const url = await blobUrlFromComposePayload(base, j);
      if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
      setActiveAudioUrl(url);
    } catch (e) {
      setActiveError(e instanceof Error ? e.message : 'Audio failed');
    } finally {
      setActiveAudioBusy(false);
    }
  };

  const canSaveCurrentTransit = () => {
    if (!chartId || !activeResult) return false;
    const h = activeResult.hashes as { plan_sha256?: string } | undefined;
    if (!h?.plan_sha256) return false;
    if (!activeDate || !activeTime || !activeTransitResolvedAt) return false;
    if (activeLat === '' || activeLon === '') return false;
    if (!isPersistableChartTimezone(activeTz)) return false;
    if (!isValidTransitLocationSource(activeLocSource)) return false;
    if (!Number.isFinite(Number(activeLat)) || !Number.isFinite(Number(activeLon))) return false;
    return true;
  };

  const saveActiveToLibrary = async () => {
    if (!chartId || !activeResult) return;
    if (!canSaveCurrentTransit()) {
      onSaveError('Cannot save: date, time, and resolved location with a valid timezone are required.');
      return;
    }
    const h = activeResult.hashes as { plan_sha256?: string } | undefined;
    const id = activeResult.identity as { object_identity_hash?: string } | undefined;
    const exp = activeResult.explanation as { meta?: { canonical_object_hash?: string } } | undefined;
    const exportId = activeResult.export_id as string | null | undefined;
    const ph = h?.plan_sha256 ?? '';
    const oid = id?.object_identity_hash ?? exp?.meta?.canonical_object_hash ?? '';
    if (!ph) return;
    const loc: CanonicalLocation = {
      source: activeLocSource,
      label: activeLocLabel.trim() || 'Location',
      lat: Number(activeLat),
      lon: Number(activeLon),
      timezone: activeTz.trim(),
      resolvedAt: activeTransitResolvedAt,
    };
    const timeNorm = normalizeLocalTime(activeTime);
    const resolvedAt = loc.resolvedAt;
    const dupKey = `${SAVE_DUP_PREFIX}${chartId}|${ph}|${activeDate}|${timeNorm}|${resolvedAt}`;
    if (sessionStorage.getItem(dupKey)) {
      if (
        !window.confirm('You already saved this transit snapshot this session. Save another copy?')
      ) {
        return;
      }
    }
    onClearSaveError();
    const base = getApiBaseUrl();
    const sandbox_state = {
      kind: 'profile_active' as const,
      chartId,
      calendarDate: activeDate,
      localTime: timeNorm,
      location: loc,
    };
    const r = await fetch(`${base || ''}/api/sandbox/compositions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        sandbox_state,
        vector_hash: ph,
        seed: `active_${chartId}`,
        plan_hash: ph,
        report: { savedFrom: 'profile_active', at: new Date().toISOString() },
        export_id: exportId ?? null,
        source: 'profile_active',
        composition_type: 'A+B',
        object_identity_hash: oid || null,
      }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      onSaveError(j.error || `Failed to save active artifact (${r.status})`);
      return;
    }
    sessionStorage.setItem(dupKey, dupKey);
    onSaved();
  };

  return (
    <div className="space-y-6">
      {!chartId || noRealChart ? (
        <p className="text-sm text-amber-600">Add a birth chart (Identity or Settings) to use Current Transit.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md w-full">
            <InputField
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
            />
            <InputField
              type="time"
              value={activeTime}
              onChange={(e) => setActiveTime(e.target.value)}
            />
          </div>
          <div className="max-w-xl">
            <LocationFinder
              value={activeLocLabel}
              onSelect={(r) => {
                const resolvedAt = new Date().toISOString();
                setActiveLocLabel(r.label);
                setActiveLat(String(r.lat));
                setActiveLon(String(r.lon));
                setActiveTz(r.timezone && isPersistableChartTimezone(r.timezone) ? r.timezone : '');
                setActiveTransitResolvedAt(resolvedAt);
                setActiveLocSource('geofinder');
              }}
              onClear={() => {
                setActiveLocLabel('');
                setActiveLat('');
                setActiveLon('');
                setActiveTz('');
                setActiveTransitResolvedAt('');
                setActiveLocSource('geofinder');
              }}
              placeholder="Current location (search)"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              disabled={activeLoading}
              loading={activeLoading}
              onClick={() => void loadActiveStateText()}
            >
              Generate transit report
            </Button>
            <Button
              type="button"
              variant="audio"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              disabled={activeAudioBusy || !activeResult}
              loading={activeAudioBusy}
              onClick={() => void generateActiveAudio()}
            >
              Generate transit audio
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              disabled={!canSaveCurrentTransit()}
              onClick={() => void saveActiveToLibrary()}
            >
              Save to Library
            </Button>
          </div>
          {librarySaveError ? <p className="text-sm text-red-500">{librarySaveError}</p> : null}
          {activeError && <p className="text-sm text-red-500">{activeError}</p>}
          {activeWheelSlots && (
            <div className="max-w-2xl mx-auto w-full space-y-3 min-w-0">
              <Tabs
                variant="segmented"
                ariaLabel="Transit wheel slot"
                tabs={activeWheelSlots.map((slot, idx) => ({
                  id: String(idx),
                  label: slot.label,
                  description: slot.description,
                }))}
                activeTab={String(activeSlotIndex)}
                onTabChange={(id) => setActiveSlotIndex(Number(id) as 0 | 1)}
              />
              {snapshotSafeForWheel(activeWheelSlots[activeSlotIndex]?.snapshot) ? (
                <WheelDisplay
                  chartData={activeWheelSlots[activeSlotIndex]!.snapshot as any}
                  isLoading={false}
                  className="max-w-full"
                />
              ) : (
                <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-text-secondary text-sm p-4">
                  Wheel unavailable for selected slot.
                </div>
              )}
            </div>
          )}
          {activeResult?.explanation && (
            <ExplainerSections sections={mapExplanationToSections(activeResult.explanation)} />
          )}
          {activeAudioUrl && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-text-secondary">Listen to this reading</p>
              <audio controls src={activeAudioUrl} className="w-full max-w-md" preload="metadata" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
