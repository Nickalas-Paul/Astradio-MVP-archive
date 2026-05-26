'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useProfile, useProfileChart, useCommunityInventory } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { LocationFinder } from '../sandbox/LocationFinder';
import { BirthChartSection } from '../profile/BirthChartSection';
import { ProfileAuthPanel } from '../profile/ProfileAuthPanel';
import { ExplainerSections } from '../profile/shared/ExplainerSections';
import { blobUrlFromComposePayload } from '../profile/shared/profile-audio-utils';
import {
  explanationFromCompatibilityText,
  librarySourceLabel,
  parseSandboxState,
} from '../profile/shared/profile-library-utils';
import {
  filterIdentityDisplaySections,
  mapExplanationToSections,
} from '../profile/shared/profile-reading-utils';
import {
  isValidTransitLocationSource,
  normalizeLocalTime,
  parseSnapshotFingerprint,
  sandboxStateCompleteForTransit,
  SAVE_DUP_PREFIX,
  snapshotSafeForWheel,
} from '../profile/shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';
import type { CanonicalLocation } from '../../types/location';
import { hasCompatibilityReadingSurface, type ExplanationLike } from '../../lib/compatibility-reading-surface';
import { IdentityMarkdown } from '../shared/IdentityMarkdown';
import { EXPANDED_READING_RENDER_ORDER, EXPANDED_SLOT_LABELS } from '../../lib/community-feed-reading-layout';
import { finalizeRelationalReadingSurfaces, type ExpandedSlotId } from '../../lib/relational-reading-enforcement';

export { filterIdentityDisplaySections } from '../profile/shared/profile-reading-utils';

const WheelCanvas = dynamic(
  () => import('../WheelCanvas').then((m) => m.default),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

export interface ProfilePanelProps {
  onSwitchToConnections?: () => void;
}

export function ProfilePanel({ onSwitchToConnections }: ProfilePanelProps) {
  const { user, primaryChart, loading: profileLoading, error: profileError, refresh } = useProfile();
  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const { data: chartData, loading: chartLoading, error: chartError, refresh: refreshChart } = useProfileChart(chartId);
  const { data: communityInventory } = useCommunityInventory();
  const searchParams = useSearchParams();
  const [profileSection, setProfileSection] = useState<'active' | 'identity' | 'library'>('active');
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
  const [identityAudioUrl, setIdentityAudioUrl] = useState<string | null>(null);
  const [activeAudioBusy, setActiveAudioBusy] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<0 | 1>(0);
  const [libraryRows, setLibraryRows] = useState<Array<Record<string, unknown>>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [libraryOpenId, setLibraryOpenId] = useState<string | null>(null);
  const [libraryDetailLoading, setLibraryDetailLoading] = useState(false);
  const [libraryDetailRow, setLibraryDetailRow] = useState<Record<string, unknown> | null>(null);
  const [libraryReconstructLoading, setLibraryReconstructLoading] = useState(false);
  const [libraryReconstructResult, setLibraryReconstructResult] = useState<Record<string, unknown> | null>(null);
  const [libraryReconstructError, setLibraryReconstructError] = useState<string | null>(null);
  const [libraryDetailAudioUrl, setLibraryDetailAudioUrl] = useState<string | null>(null);
  /** null = not checked; true = HEAD failed or GET blob failed; false = playable */
  const [libraryAudioMissingFromStore, setLibraryAudioMissingFromStore] = useState<boolean | null>(null);
  const [libraryRelationalWeatherTextMissing, setLibraryRelationalWeatherTextMissing] = useState(false);
  const [libraryHistoricalArtifact, setLibraryHistoricalArtifact] = useState(false);
  /** Community saved reading: artifact shape compatible with compose `artifact` (structured sections preferred). */
  const [libraryCommunityReadingArtifact, setLibraryCommunityReadingArtifact] = useState<Record<string, unknown> | null>(
    null,
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'active' || tab === 'identity' || tab === 'library') {
      setProfileSection(tab);
    }
  }, [searchParams]);

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

  const refreshLibrary = async () => {
    const base = getApiBaseUrl();
    setLibraryLoading(true);
    try {
      const r = await fetch(`${base || ''}/api/sandbox/compositions?limit=50`, {
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => []);
      setLibraryRows(Array.isArray(j) ? j : []);
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    if (user && profileSection === 'library') void refreshLibrary();
  }, [user, profileSection]);

  // Refetch profile chart when entering Identity so identity_export_id reflects async backend persistence.
  useEffect(() => {
    if (profileSection !== 'identity' || !user || !chartId) return;
    void refreshChart();
  }, [profileSection, user, chartId, refreshChart]);

  useEffect(() => {
    let cancelled = false;
    const base = getApiBaseUrl();
    const eid = chartData?.identity_export_id;

    setIdentityAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!eid || typeof eid !== 'string' || !/^[a-f0-9]{64}$/.test(eid)) {
      return undefined;
    }

    void (async () => {
      try {
        const url = await blobUrlFromComposePayload(base, { export_id: eid });
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        setIdentityAudioUrl(url);
      } catch {
        /* Playback unavailable — Identity text still shown */
      }
    })();

    return () => {
      cancelled = true;
      setIdentityAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [chartData?.identity_export_id]);

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

  const openLibraryRow = async (id: string) => {
    setLibraryOpenId(id);
    setLibraryDetailRow(null);
    setLibraryReconstructResult(null);
    setLibraryReconstructError(null);
    setLibraryAudioMissingFromStore(null);
    setLibraryRelationalWeatherTextMissing(false);
    setLibraryHistoricalArtifact(false);
    setLibraryCommunityReadingArtifact(null);
    if (libraryDetailAudioUrl) {
      URL.revokeObjectURL(libraryDetailAudioUrl);
      setLibraryDetailAudioUrl(null);
    }
    setLibraryDetailLoading(true);
    setLibraryReconstructLoading(false);
    const base = getApiBaseUrl();
    try {
      const r = await fetch(`${base || ''}/api/sandbox/compositions/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });
      const row = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setLibraryReconstructError(
          typeof row.error === 'string' ? row.error : `Failed to load composition (${r.status})`,
        );
        return;
      }
      setLibraryDetailRow(row);
      const source = row.source;
      const ps = parseSandboxState(row.sandbox_state);
      if (source === 'profile_identity' || ps?.kind === 'profile_identity') {
        setLibraryDetailLoading(false);
        return;
      }
      if (source === 'community_relationship' || ps?.kind === 'community_relationship') {
        const cmpId =
          (typeof ps?.comparisonId === 'string' && ps.comparisonId.trim()) ||
          (typeof row.object_identity_hash === 'string' && row.object_identity_hash.trim()) ||
          '';
        if (!cmpId) {
          setLibraryReconstructError('Missing comparison reference for this relationship artifact.');
          return;
        }
        setLibraryReconstructLoading(true);
        const cmpRes = await fetch(`${base || ''}/api/comparisons/${encodeURIComponent(cmpId)}`, {
          credentials: 'same-origin',
        });
        const cmp = (await cmpRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!cmpRes.ok) {
          setLibraryReconstructError(
            typeof cmp.error === 'string' ? cmp.error : `Failed to load comparison (${cmpRes.status})`,
          );
          return;
        }
        setLibraryReconstructResult({
          explanation: explanationFromCompatibilityText(cmp.compatibilityText),
        });
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
          if (url) setLibraryDetailAudioUrl(url);
        }
        return;
      }
      if (source === 'community_group' || ps?.kind === 'community_group') {
        const groupId = typeof ps?.groupId === 'string' ? ps.groupId : '';
        if (!groupId) {
          setLibraryReconstructError('Missing group reference for this group relationship artifact.');
          return;
        }
        setLibraryReconstructLoading(true);
        const gr = await fetch(
          `${base || ''}/api/community/relational-group/${encodeURIComponent(groupId)}/stored-artifact`,
          { credentials: 'same-origin' },
        );
        const gj = (await gr.json().catch(() => ({}))) as Record<string, unknown>;
        if (!gr.ok) {
          setLibraryReconstructError(
            typeof gj.error === 'string' ? gj.error : `Failed to load group artifact (${gr.status})`,
          );
          return;
        }
        const readingText =
          typeof (gj.readingSnapshot as { text?: unknown } | null)?.text === 'string'
            ? ((gj.readingSnapshot as { text?: string }).text ?? '')
            : '';
        setLibraryReconstructResult({
          explanation: {
            sections: [{ sectionId: 'community', title: 'Group relationship artifact', text: readingText }],
          },
        });
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
          if (url) setLibraryDetailAudioUrl(url);
        }
        return;
      }
      if (source === 'community_relational_weather' || ps?.kind === 'community_relational_weather') {
        const report = row.report as
          | { text?: unknown; weather?: unknown; freshness?: { historicalReason?: unknown; isHistorical?: unknown } }
          | undefined;
        const reportExpressionVersion =
          report &&
          report.freshness &&
          typeof (report.freshness as { expressionVersion?: unknown }).expressionVersion === 'string'
            ? String((report.freshness as { expressionVersion?: unknown }).expressionVersion).trim()
            : '';
        const sandboxExpressionVersion =
          ps && typeof ps.expressionVersion === 'string' ? ps.expressionVersion.trim() : '';
        const versionMissing = !reportExpressionVersion && !sandboxExpressionVersion;
        const freshnessHistorical =
          report?.freshness?.isHistorical === true ||
          (typeof report?.freshness?.historicalReason === 'string' && report.freshness.historicalReason.trim().length > 0) ||
          (typeof ps?.historicalReason === 'string' && ps.historicalReason.trim().length > 0) ||
          versionMissing;
        setLibraryHistoricalArtifact(freshnessHistorical);
        const textValue = report?.text;
        const textMissing = textValue == null;
        setLibraryRelationalWeatherTextMissing(textMissing);
        if (textMissing) {
          setLibraryCommunityReadingArtifact(null);
          setLibraryReconstructResult(null);
          setLibraryDetailLoading(false);
          const eid = row.export_id;
          if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
            try {
              const headRes = await fetch(`${base || ''}/api/exports/${encodeURIComponent(eid)}`, {
                method: 'HEAD',
                credentials: 'same-origin',
              });
              if (headRes.status !== 204 && headRes.status !== 200) {
                setLibraryAudioMissingFromStore(true);
              } else {
                const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
                if (url) {
                  setLibraryDetailAudioUrl(url);
                  setLibraryAudioMissingFromStore(false);
                } else {
                  setLibraryAudioMissingFromStore(true);
                }
              }
            } catch {
              setLibraryAudioMissingFromStore(true);
            }
          } else {
            setLibraryAudioMissingFromStore(null);
          }
          return;
        }
        const artifactPayload: Record<string, unknown> = {
          weather: report?.weather ?? undefined,
        };
        if (typeof textValue === 'object' && textValue !== null && !Array.isArray(textValue)) {
          artifactPayload.text = textValue as Record<string, unknown>;
        } else if (typeof textValue === 'string') {
          artifactPayload.text = { short: textValue };
        } else {
          artifactPayload.text = { short: '' };
        }
        setLibraryCommunityReadingArtifact(artifactPayload);
        setLibraryReconstructResult({ explanation: null });
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          try {
            const headRes = await fetch(`${base || ''}/api/exports/${encodeURIComponent(eid)}`, {
              method: 'HEAD',
              credentials: 'same-origin',
            });
            if (headRes.status !== 204 && headRes.status !== 200) {
              setLibraryAudioMissingFromStore(true);
            } else {
              const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
              if (url) {
                setLibraryDetailAudioUrl(url);
                setLibraryAudioMissingFromStore(false);
              } else {
                setLibraryAudioMissingFromStore(true);
              }
            }
          } catch {
            setLibraryAudioMissingFromStore(true);
          }
        } else {
          setLibraryAudioMissingFromStore(null);
        }
        return;
      }
      if (source === 'profile_active' || ps?.kind === 'profile_active') {
        if (!ps || !sandboxStateCompleteForTransit(ps)) {
          setLibraryReconstructError(
            'This bookmark was saved before transit details were stored. Generate a new report from Current Transit and save again.',
          );
          return;
        }
        setLibraryReconstructLoading(true);
        const st = ps;
        const r2 = await fetch(`${base || ''}/api/profile/active-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            chartId: st.chartId,
            calendarDate: st.calendarDate,
            localTime: normalizeLocalTime(st.localTime),
            location: st.location,
            generateAudio: false,
          }),
        });
        const j = (await r2.json().catch(() => ({}))) as Record<string, unknown>;
        if (!r2.ok) {
          setLibraryReconstructError(
            typeof j.error === 'string' ? j.error : `Reconstruction failed (${r2.status})`,
          );
          return;
        }
        setLibraryReconstructResult(j);
        const eid = row.export_id;
        if (typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid)) {
          const url = await blobUrlFromComposePayload(base, { export_id: eid } as Record<string, unknown>);
          if (url) setLibraryDetailAudioUrl(url);
        }
      }
    } catch (e) {
      setLibraryReconstructError(e instanceof Error ? e.message : 'Failed to open');
    } finally {
      setLibraryDetailLoading(false);
      setLibraryReconstructLoading(false);
    }
  };

  const saveActiveToLibrary = async () => {
    if (!chartId || !activeResult) return;
    if (!canSaveCurrentTransit()) {
      setLibraryError('Cannot save: date, time, and resolved location with a valid timezone are required.');
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
    setLibraryError(null);
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
      setLibraryError(j.error || `Failed to save active artifact (${r.status})`);
      return;
    }
    sessionStorage.setItem(dupKey, dupKey);
    await refreshLibrary();
  };

  if (profileLoading) {
    return (
      <div className="card space-y-6">
        <div className="h-8 w-48 bg-bgElev rounded animate-pulse" />
        <div className="aspect-square max-w-md bg-bgElev rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 bg-bgElev rounded w-full animate-pulse" />
          <div className="h-4 bg-bgElev rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="card">
        <p className="text-subtext text-sm">{profileError}</p>
      </div>
    );
  }

  // No session: register or log in (account creation is POST /api/auth/register only).
  if (user === null) {
    return <ProfileAuthPanel onAuthSuccess={refresh} />;
  }

  const loading = chartLoading;
  const error = chartError;
  const hasExplainer = chartData?.explainer?.sections?.length;
  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text">{user.displayName}</h2>
            {realChart && (
              <p className="text-sm text-subtext mt-1">
                {primaryChart!.label} · {primaryChart!.date} {primaryChart!.time}
              </p>
            )}
            {noRealChart && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                No chart linked. Add your birth chart when creating a profile, or use the Sandbox to build a chart.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToConnections && realChart && (
              <button
                type="button"
                onClick={onSwitchToConnections}
                className="btn-primary text-sm"
              >
                Find connections
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-border text-subtext text-sm hover:bg-bgElev"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                await refresh();
              }}
            >
              Log out
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border pb-2" role="tablist">
          {(['active', 'identity', 'library'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                profileSection === s ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
              }`}
              onClick={() => setProfileSection(s)}
            >
              {s === 'active' ? 'Current Transit' : s === 'identity' ? 'Identity' : 'Library'}
            </button>
          ))}
        </div>

        {profileSection === 'active' && (
          <div className="space-y-4">
            {!chartId || noRealChart ? (
              <p className="text-sm text-amber-600">Add a birth chart (Identity or Settings) to use Current Transit.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  <input
                    type="date"
                    className="input w-full"
                    value={activeDate}
                    onChange={(e) => setActiveDate(e.target.value)}
                  />
                  <input
                    type="time"
                    className="input w-full"
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={activeLoading}
                    onClick={() => void loadActiveStateText()}
                  >
                    {activeLoading ? 'Loading…' : 'Generate transit report'}
                  </button>
                  <button
                    type="button"
                    className="btn-audio text-sm"
                    disabled={activeAudioBusy || !activeResult}
                    onClick={() => void generateActiveAudio()}
                  >
                    {activeAudioBusy ? 'Generating…' : 'Generate transit audio'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={!canSaveCurrentTransit()}
                    onClick={() => void saveActiveToLibrary()}
                  >
                    Save to Library
                  </button>
                </div>
                {libraryError && <p className="text-sm text-red-500">{libraryError}</p>}
                {activeError && <p className="text-sm text-red-500">{activeError}</p>}
                {activeWheelSlots && (
                  <div className="max-w-xl space-y-3">
                    <div className="flex gap-2 rounded-lg bg-bgElev p-1 border border-border">
                      {activeWheelSlots.map((slot, idx) => (
                        <button
                          key={slot.label}
                          type="button"
                          className={`flex-1 rounded-md px-3 py-2 text-left transition-colors ${
                            activeSlotIndex === idx
                              ? 'bg-bg border border-border text-emerald'
                              : 'text-subtext hover:bg-bg'
                          }`}
                          onClick={() => setActiveSlotIndex(idx as 0 | 1)}
                          aria-pressed={activeSlotIndex === idx}
                        >
                          <div className="text-sm font-medium">{slot.label}</div>
                          <div className="text-xs text-subtext">{slot.description}</div>
                        </button>
                      ))}
                    </div>
                    {snapshotSafeForWheel(activeWheelSlots[activeSlotIndex]?.snapshot) ? (
                      <WheelCanvas
                        chartData={activeWheelSlots[activeSlotIndex]!.snapshot as any}
                        isLoading={false}
                        className="max-w-full"
                      />
                    ) : (
                      <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
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
        )}

        {profileSection === 'identity' && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,400px)_1fr]">
          <div>
            {noRealChart ? (
              <BirthChartSection
                variant="profile_onboarding"
                refresh={refresh}
                refreshChart={refreshChart}
                primaryChart={primaryChart}
              />
            ) : loading ? (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border animate-pulse" />
            ) : chartData?.snapshot && snapshotSafeForWheel(chartData.snapshot) ? (
              <WheelCanvas
                chartData={chartData.snapshot as any}
                isLoading={false}
                className="max-w-full"
              />
            ) : chartData?.snapshot ? (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
                Chart data received; add planets and houses for wheel view.
              </div>
            ) : (
              <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
                {error || 'No chart data'}
              </div>
            )}
            {!noRealChart && (
              <p className="mt-4 text-xs text-subtext">
                Birth chart data can be updated in{' '}
                <Link href="/settings#birth-chart" className="text-emerald hover:underline">
                  Settings
                </Link>
                .
              </p>
            )}
          </div>
          <div className="min-w-0">
            {noRealChart && (
              <p className="text-subtext text-sm">Link a chart to see your astrology breakdown and use Matches.</p>
            )}
            {loading && !chartData && !noRealChart && (
              <div className="space-y-4">
                <div className="h-20 bg-bgElev rounded animate-pulse" />
                <div className="h-20 bg-bgElev rounded animate-pulse" />
              </div>
            )}
            {error && !chartData && !noRealChart && (
              <p className="text-subtext text-sm">{error}</p>
            )}
            {hasExplainer && (
              <ExplainerSections
                sections={filterIdentityDisplaySections(chartData!.explainer.sections)}
              />
            )}
            {identityAudioUrl && (
              <div className="mt-6 space-y-2">
                <p className="text-sm text-text-secondary">Listen to this reading</p>
                <audio controls src={identityAudioUrl} className="w-full max-w-md" preload="metadata" />
              </div>
            )}
          </div>
        </div>
        )}

        {profileSection === 'library' && (
          <div className="space-y-3">
            <p className="text-sm text-subtext">
              Saved profile and community artifacts (text first; audio when export is available). Older engine versions are shown as historical snapshots.
            </p>
            {libraryLoading ? (
              <p className="text-sm text-subtext">Loading…</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {libraryRows.map((row) => (
                    <li key={String(row.id)} className="rounded border border-border p-3 text-sm flex flex-wrap items-center gap-2 justify-between">
                      <span>
                        <span className="text-subtext">{String(row.created_at)}</span>
                        {' · '}
                        <span>{librarySourceLabel(row.source)}</span>
                        {' · '}
                        <span>{String(row.composition_type ?? '—')}</span>
                      </span>
                      <button
                        type="button"
                        className="px-3 py-1 rounded border border-border text-xs text-emerald hover:bg-bgElev"
                        onClick={() => void openLibraryRow(String(row.id))}
                      >
                        View
                      </button>
                    </li>
                  ))}
                  {libraryRows.length === 0 && <li className="text-subtext">Nothing saved yet.</li>}
                </ul>
                {libraryOpenId && (
                  <div className="rounded border border-border bg-bgElev p-4 space-y-3 mt-4">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-text">
                        {libraryDetailRow ? librarySourceLabel(libraryDetailRow.source) : 'Saved artifact'}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-subtext hover:text-text"
                        onClick={() => {
                          setLibraryOpenId(null);
                          setLibraryDetailRow(null);
                          setLibraryReconstructResult(null);
                          setLibraryReconstructError(null);
                          setLibraryAudioMissingFromStore(null);
                          setLibraryRelationalWeatherTextMissing(false);
                          setLibraryHistoricalArtifact(false);
                          setLibraryCommunityReadingArtifact(null);
                          if (libraryDetailAudioUrl) {
                            URL.revokeObjectURL(libraryDetailAudioUrl);
                            setLibraryDetailAudioUrl(null);
                          }
                        }}
                      >
                        Close
                      </button>
                    </div>
                    {libraryDetailLoading && <p className="text-sm text-subtext">Loading…</p>}
                    {libraryHistoricalArtifact && (
                      <div className="text-sm text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-lg px-3 py-2 space-y-2">
                        <p>Historical saved artifact.</p>
                        <p>Generated with an earlier expression version.</p>
                        <a
                          href="/community?tab=feed"
                          className="inline-block px-3 py-1 rounded border border-amber-500/50 text-xs hover:bg-amber-500/10"
                        >
                          Generate current version
                        </a>
                      </div>
                    )}
                    {libraryReconstructError && (
                      <p className="text-sm text-red-500">{libraryReconstructError}</p>
                    )}
                    {libraryDetailRow != null &&
                      (libraryDetailRow.source === 'profile_identity' ||
                        parseSandboxState(libraryDetailRow.sandbox_state)?.kind === 'profile_identity') ? (
                        <p className="text-sm text-subtext">
                          Identity comes from your birth chart. Open the Identity tab to view it.
                        </p>
                      ) : null}
                    {libraryReconstructLoading && (
                      <p className="text-sm text-subtext">Loading report…</p>
                    )}
                    {libraryCommunityReadingArtifact &&
                    (libraryDetailRow?.source === 'community_relational_weather' ||
                      parseSandboxState(libraryDetailRow?.sandbox_state)?.kind === 'community_relational_weather') ? (
                      <div className="space-y-4">
                        {(() => {
                          const art = libraryCommunityReadingArtifact;
                          const w =
                            art.weather && typeof art.weather === 'object' ? (art.weather as Record<string, unknown>) : undefined;
                          const finalized = finalizeRelationalReadingSurfaces({
                            kind: 'expanded_artifact',
                            artifact: art,
                            weather: w,
                          });
                          const slots =
                            finalized.kind === 'expanded_artifact'
                              ? finalized.slots
                              : ({
                                  summary: '',
                                  support: '',
                                  tension: '',
                                  activation: '',
                                  whatToDo: '',
                                  audio: '',
                                } as Record<ExpandedSlotId, string>);
                          return (
                            <div className="space-y-4">
                              {EXPANDED_READING_RENDER_ORDER.map((slot: ExpandedSlotId) => {
                                const body = slots[slot];
                                if (!body?.trim()) return null;
                                return (
                                  <section key={slot} className="space-y-1">
                                    <h4 className="text-xs font-semibold text-text uppercase tracking-wide">
                                      {EXPANDED_SLOT_LABELS[slot]}
                                    </h4>
                                    <IdentityMarkdown content={body} />
                                  </section>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                    {libraryReconstructResult != null &&
                      libraryReconstructResult.explanation != null &&
                      !libraryCommunityReadingArtifact &&
                      hasCompatibilityReadingSurface(
                        libraryReconstructResult.explanation as ExplanationLike,
                        undefined,
                      ) && (
                        <ExplainerSections
                          sections={mapExplanationToSections(libraryReconstructResult.explanation)}
                        />
                      )}
                    {libraryReconstructResult != null &&
                      libraryReconstructResult.explanation != null &&
                      !libraryCommunityReadingArtifact &&
                      !hasCompatibilityReadingSurface(
                        libraryReconstructResult.explanation as ExplanationLike,
                        undefined,
                      ) &&
                      !libraryReconstructError && (
                        <p className="text-sm text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-2">
                          Stored reading text for this artifact is missing or empty. Generate a new compatibility reading or
                          contact support.
                        </p>
                      )}
                    {libraryDetailRow &&
                      (libraryDetailRow.source === 'community_relational_weather' ||
                        parseSandboxState(libraryDetailRow.sandbox_state)?.kind === 'community_relational_weather') &&
                      libraryRelationalWeatherTextMissing && (
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                          Reading text was not stored for this bookmark. Re-save from the Community Feed, or
                          ask an operator to run a library repair.
                        </p>
                      )}
                    {libraryDetailRow &&
                      (libraryDetailRow.source === 'community_relational_weather' ||
                        parseSandboxState(libraryDetailRow.sandbox_state)?.kind === 'community_relational_weather') &&
                      libraryAudioMissingFromStore === true && (
                        <p className="text-sm text-amber-600 dark:text-amber-300">
                          Audio record missing from storage (export pointer exists but file was not found).
                        </p>
                      )}
                    {libraryDetailAudioUrl && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-text-secondary">Listen to this reading</p>
                        <audio controls src={libraryDetailAudioUrl} className="w-full max-w-md" preload="metadata" />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4 text-xs text-subtext">
          Connections (read-only):{' '}
          {Array.isArray(communityInventory?.pairs) ? communityInventory!.pairs.length : 0} pairs. Manage in Community.
        </div>

        {/* Phase 8G: privacy / discoverability — only when backend returns flags */}
        {(user?.discoverable !== undefined || user?.show_in_feed !== undefined) && (
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-text">Community visibility</h3>
            <p className="text-xs text-subtext">Control how others can find you. Off = hidden from search or feed.</p>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={user?.discoverable !== false}
                  disabled={privacySaving}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setPrivacySaving(true);
                    try {
                      const r = await fetch('/api/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ discoverable: val }),
                        credentials: 'same-origin',
                      });
                      if (r.ok) await refresh();
                    } finally {
                      setPrivacySaving(false);
                    }
                  }}
                  className="rounded border-border"
                />
                <span className="text-sm text-text">Show in community search</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={user?.show_in_feed !== false}
                  disabled={privacySaving}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setPrivacySaving(true);
                    try {
                      const r = await fetch('/api/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ show_in_feed: val }),
                        credentials: 'same-origin',
                      });
                      if (r.ok) await refresh();
                    } finally {
                      setPrivacySaving(false);
                    }
                  }}
                  className="rounded border-border"
                />
                <span className="text-sm text-text">Show in community feed</span>
              </label>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
