'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { LocationFinder } from '../sandbox/LocationFinder';
import { ExplainerSections } from './shared/ExplainerSections';
import { mapExplanationToSections } from './shared/profile-reading-utils';
import {
  isValidTransitLocationSource,
  normalizeLocalTime,
  parseSnapshotFingerprint,
  SAVE_DUP_PREFIX,
  snapshotSafeForWheel,
} from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import {
  cleanExpiredTransitCache,
  clearTransitCacheForDate,
  getTransitCache,
  setTransitCache,
  type TransitComposeCacheEntry,
} from '../../core/transit-compose-cache';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';
import type { CanonicalLocation } from '../../types/location';
import { Button } from '@/components/shared/Button';
import { Tabs } from '@/components/shared/Tabs';
import { InputField } from '@/components/shared/Input';
import { useAudioPlayerStore } from '@/store';

const WheelDisplay = dynamic(
  () => import('@/components/wheel/WheelDisplay').then((m) => ({ default: m.WheelDisplay })),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

function formatTransitDate(dateStr: string): string {
  if (!dateStr) return 'today';
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function exportIdFromComposePayload(payload: Record<string, unknown>): string | null {
  const audio = payload?.audio as Record<string, unknown> | undefined;
  const exportId = (payload?.export_id ?? audio?.export_id) as string | undefined;
  if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
    return exportId;
  }
  console.warn('Compose response missing valid export_id');
  return null;
}

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
  const [activeAudioBusy, setActiveAudioBusy] = useState(false);
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const [activeSlotIndex, setActiveSlotIndex] = useState<0 | 1>(0);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [transitWheelMaxSize, setTransitWheelMaxSize] = useState(320);
  const fetchInFlightRef = useRef(false);

  useEffect(() => {
    const update = () => {
      const vhCap = Math.floor(window.innerHeight * 0.4) - 32;
      setTransitWheelMaxSize(Math.min(320, Math.max(200, vhCap)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  useEffect(() => {
    if (!activeResult && !activeLoading && !controlsExpanded) {
      setControlsExpanded(true);
    }
  }, [activeResult, activeLoading, controlsExpanded]);

  const buildLocation = useCallback((): CanonicalLocation | null => {
    if (
      activeLat === '' ||
      activeLon === '' ||
      !isPersistableChartTimezone(activeTz) ||
      !activeTransitResolvedAt
    ) {
      return null;
    }
    const lat = Number(activeLat);
    const lon = Number(activeLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      source: activeLocSource,
      label: activeLocLabel.trim() || 'Location',
      lat,
      lon,
      timezone: activeTz.trim(),
      resolvedAt: activeTransitResolvedAt,
    };
  }, [
    activeLat,
    activeLon,
    activeTz,
    activeTransitResolvedAt,
    activeLocSource,
    activeLocLabel,
  ]);

  const applyCachedEntry = useCallback((entry: TransitComposeCacheEntry) => {
    setActiveDate(entry.calendarDate);
    setActiveTime(entry.localTime);
    setActiveLocLabel(entry.location.label);
    setActiveLat(String(entry.location.lat));
    setActiveLon(String(entry.location.lon));
    setActiveTz(entry.location.timezone);
    setActiveTransitResolvedAt(entry.location.resolvedAt);
    setActiveLocSource(
      entry.location.source === 'browser_geo' ? 'browser_geo' : 'geofinder'
    );
    setActiveResult(entry.activeState);
    setActiveError(null);
    setLoadedFromCache(true);
  }, []);

  const loadActiveStateText = useCallback(
    async (options: { bypassCache?: boolean } = {}) => {
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

      const loc = buildLocation();
      if (!loc) {
        setActiveError('Set date, time, and a resolved location with a valid timezone for current transit.');
        return;
      }

      const lat = loc.lat;
      const lon = loc.lon;
      const timeNorm = activeTime.length === 5 ? activeTime : activeTime.slice(0, 5);

      if (!options.bypassCache) {
        cleanExpiredTransitCache(activeDate);
        const cached = getTransitCache(activeDate, chartId, lat, lon);
        if (cached) {
          applyCachedEntry(cached);
          return;
        }
      }

      if (fetchInFlightRef.current) return;
      fetchInFlightRef.current = true;

      const base = getApiBaseUrl();
      setActiveLoading(true);
      setActiveError(null);
      setLoadedFromCache(false);
      try {
        const r = await fetch(`${base || ''}/api/profile/active-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            chartId,
            calendarDate: activeDate,
            localTime: timeNorm,
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
        setTransitCache(activeDate, chartId, lat, lon, {
          calendarDate: activeDate,
          localTime: timeNorm,
          location: loc,
          activeState: j,
        });
      } catch (e) {
        setActiveError(e instanceof Error ? e.message : 'Active state failed');
        setActiveResult(null);
      } finally {
        setActiveLoading(false);
        fetchInFlightRef.current = false;
      }
    },
    [
      chartId,
      activeDate,
      activeTime,
      activeTz,
      activeTransitResolvedAt,
      activeLat,
      activeLon,
      buildLocation,
      applyCachedEntry,
    ]
  );

  // Auto-generate once per day (cache) when chart + date + location are ready.
  useEffect(() => {
    if (!chartId || noRealChart || !activeDate || activeLat === '' || activeLon === '') {
      return;
    }
    if (!isPersistableChartTimezone(activeTz) || !activeTransitResolvedAt) {
      return;
    }

    const lat = Number(activeLat);
    const lon = Number(activeLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    let cancelled = false;

    void (async () => {
      cleanExpiredTransitCache(activeDate);
      const cached = getTransitCache(activeDate, chartId, lat, lon);
      if (cached) {
        if (!cancelled) applyCachedEntry(cached);
        return;
      }
      if (!cancelled) await loadActiveStateText({ bypassCache: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    chartId,
    noRealChart,
    activeDate,
    activeLat,
    activeLon,
    activeTz,
    activeTransitResolvedAt,
    applyCachedEntry,
    loadActiveStateText,
  ]);

  const generateActiveAudio = async () => {
    if (!chartId || !activeResult) return;
    const hashes = activeResult.hashes as { plan_sha256?: string } | undefined;
    const exp = activeResult.explanation as { meta?: { canonical_object_hash?: string } } | undefined;
    const plan = hashes?.plan_sha256;
    const oid = exp?.meta?.canonical_object_hash;
    if (!plan || !oid) {
      setActiveError('Compose a transit report first, then compose audio.');
      return;
    }
    if (!isPersistableChartTimezone(activeTz) || !activeTransitResolvedAt) {
      setActiveError('Resolve location with a valid timezone before composing audio.');
      return;
    }
    const base = getApiBaseUrl();
    setActiveAudioBusy(true);
    setActiveError(null);
    try {
      const loc = buildLocation();
      if (!loc) {
        setActiveError('Resolve location with a valid timezone before composing audio.');
        return;
      }
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
      const exportId = exportIdFromComposePayload(j);
      if (!exportId) {
        setActiveError('Audio export not available.');
        return;
      }
      playTrack({ exportId, label: 'Your Transit', source: 'transit' });
    } catch (e) {
      setActiveError(e instanceof Error ? e.message : 'Audio failed');
    } finally {
      setActiveAudioBusy(false);
    }
  };

  const activeExportId = activeResult ? exportIdFromComposePayload(activeResult) : null;

  const canSaveCurrentTransit = () => {
    if (!chartId || !activeResult) return false;
    if (!activeExportId) return false;
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
    const exportId = activeExportId;
    if (!exportId) {
      onSaveError('Compose transit audio before saving to library.');
      return;
    }
    const ph = h?.plan_sha256 ?? '';
    const oid = id?.object_identity_hash ?? exp?.meta?.canonical_object_hash ?? '';
    if (!ph) return;
    const loc = buildLocation();
    if (!loc) return;
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

  const reportButtonLabel = activeResult ? 'Refresh transit report' : 'Compose transit report';

  const renderWheelColumn = (maxSize?: number) => {
    if (!activeWheelSlots) return null;
    return (
      <div className="w-full space-y-3 min-w-0">
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
            maxSize={maxSize}
          />
        ) : (
          <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-text-secondary text-sm p-4">
            Wheel unavailable for selected slot.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!chartId || noRealChart ? (
        <p className="text-sm text-amber-600">
          Add a birth chart in My Sky (Identity or Settings) to see your personal transit on Today.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-body-sm text-text-secondary min-w-0">
              Transit for {formatTransitDate(activeDate)}
              {' · '}
              {activeLocLabel.trim() || 'Current location'}
              {loadedFromCache && activeResult ? (
                <span className="text-text-muted"> (cached)</span>
              ) : null}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={activeLoading}
                loading={activeLoading}
                onClick={() => void loadActiveStateText({ bypassCache: true })}
              >
                Refresh
              </Button>
              <button
                type="button"
                onClick={() => setControlsExpanded((v) => !v)}
                className="text-caption text-text-muted hover:text-text-secondary transition-colors"
              >
                {controlsExpanded ? 'Hide options' : 'Customize'}
              </button>
            </div>
          </div>

          {controlsExpanded && (
            <div className="space-y-3 mb-6 pb-4 border-b border-border/30">
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
                    const dateForCache = activeDate || new Date().toISOString().slice(0, 10);
                    if (chartId) {
                      clearTransitCacheForDate(dateForCache, chartId);
                    }
                    setActiveResult(null);
                    setLoadedFromCache(false);
                    setActiveLocLabel(r.label);
                    setActiveLat(String(r.lat));
                    setActiveLon(String(r.lon));
                    setActiveTz(
                      r.timezone && isPersistableChartTimezone(r.timezone) ? r.timezone : ''
                    );
                    setActiveTransitResolvedAt(resolvedAt);
                    setActiveLocSource('geofinder');
                  }}
                  onClear={() => {
                    if (chartId && activeDate) {
                      clearTransitCacheForDate(activeDate, chartId);
                    }
                    setActiveResult(null);
                    setLoadedFromCache(false);
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
                  onClick={() => void loadActiveStateText({ bypassCache: true })}
                >
                  {reportButtonLabel}
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
                  Hear Your Transit
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
            </div>
          )}

          {activeLoading && (
            <p className="text-sm text-text-secondary">Loading today&apos;s transit…</p>
          )}
          {librarySaveError ? <p className="text-sm text-danger">{librarySaveError}</p> : null}
          {activeError && <p className="text-sm text-danger">{activeError}</p>}

          {activeWheelSlots ? (
            <div className="sticky top-20 z-30 -mx-6 px-6 py-4 mb-2 bg-bg border-b border-border/60 shadow-sm max-h-[40vh] overflow-hidden">
              <div className="max-w-md mx-auto w-full">{renderWheelColumn(transitWheelMaxSize)}</div>
            </div>
          ) : null}

          {activeResult?.explanation ? (
            <ExplainerSections sections={mapExplanationToSections(activeResult.explanation)} />
          ) : null}
        </>
      )}
    </div>
  );
}
