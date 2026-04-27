'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useProfile, useProfileChart, useCommunityInventory, type ProfileChartSection } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { LocationFinder } from '../sandbox/LocationFinder';
import { BirthChartSection } from '../profile/BirthChartSection';
import { getApiBaseUrl } from '../../core/api-base';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';
import type { CanonicalLocation } from '../../types/location';
import { hasCompatibilityReadingSurface, type ExplanationLike } from '../../lib/compatibility-reading-surface';

const SAVE_DUP_PREFIX = 'profile_transit_save_dup_v1|';

function normalizeLocalTime(t: string): string {
  return t.length === 5 ? t : t.slice(0, 5);
}

function parseSandboxState(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mapExplanationToSections(explanation: unknown): ProfileChartSection[] {
  const exp = explanation as { sections?: Array<Record<string, unknown>> } | undefined;
  return (exp?.sections || []).map((x) => ({
    id: String(x.sectionId ?? x.id ?? 'signatures'),
    title: String(x.title ?? ''),
    text: String(x.text ?? ''),
    bullets: Array.isArray(x.bullets) ? (x.bullets as string[]) : undefined,
  }));
}

function explanationFromCompatibilityText(raw: unknown): { sections: Array<Record<string, unknown>> } {
  if (typeof raw === 'string') {
    return {
      sections: [{ sectionId: 'community', title: 'Community artifact', text: raw }],
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { short?: unknown; long?: unknown; bullets?: unknown };
    const short = typeof obj.short === 'string' ? obj.short : '';
    const long = typeof obj.long === 'string' ? obj.long : '';
    const bullets = Array.isArray(obj.bullets) ? obj.bullets.map((b) => String(b)) : [];
    const text = [short, long].filter(Boolean).join('\n\n');
    return {
      sections: [{ sectionId: 'community', title: 'Community artifact', text, bullets }],
    };
  }
  return {
    sections: [{ sectionId: 'community', title: 'Community artifact', text: '' }],
  };
}

function librarySourceLabel(source: unknown): string {
  const s = String(source || '').trim();
  if (s === 'community_relationship') return 'Relationship artifact';
  if (s === 'community_group') return 'Group relationship artifact';
  if (s === 'community_relational_weather') return 'Relational weather artifact';
  if (s === 'profile_active') return 'Current transit';
  if (s === 'profile_identity') return 'Identity';
  return s || '—';
}

function isValidTransitLocationSource(s: unknown): s is CanonicalLocation['source'] {
  return s === 'browser_geo' || s === 'geofinder';
}

function sandboxStateCompleteForTransit(
  s: Record<string, unknown>,
): s is {
  kind: string;
  chartId: string;
  calendarDate: string;
  localTime: string;
  location: CanonicalLocation;
} {
  if (s.kind !== 'profile_active' || typeof s.chartId !== 'string') return false;
  if (typeof s.calendarDate !== 'string' || typeof s.localTime !== 'string') return false;
  const loc = s.location;
  if (!loc || typeof loc !== 'object') return false;
  const L = loc as Record<string, unknown>;
  return (
    isValidTransitLocationSource(L.source) &&
    typeof L.label === 'string' &&
    typeof L.lat === 'number' &&
    Number.isFinite(L.lat) &&
    typeof L.lon === 'number' &&
    Number.isFinite(L.lon) &&
    typeof L.timezone === 'string' &&
    L.timezone.length > 0 &&
    typeof L.resolvedAt === 'string' &&
    L.resolvedAt.length > 0
  );
}

const WheelCanvas = dynamic(
  () => import('../WheelCanvas').then((m) => m.default),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

const SECTION_ORDER = ['signatures', 'significance', 'musical'];
const SECTION_TITLES: Record<string, string> = {
  signatures: 'Astrology',
  significance: 'Personal Significance',
  musical: 'Music Theory',
};

function ExplainerSections({ sections }: { sections: ProfileChartSection[] }) {
  const sorted = [...sections].sort(
    (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)
  );
  return (
    <div className="space-y-6">
      {sorted.map((sec) => (
        <section key={sec.id} className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="text-lg font-semibold text-text mb-3">
            {SECTION_TITLES[sec.id] ?? sec.title}
          </h3>
          <div className="text-subtext text-sm leading-relaxed whitespace-pre-wrap">
            {sec.text}
          </div>
          {sec.bullets && sec.bullets.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
              {sec.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function snapshotSafeForWheel(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const o = snapshot as Record<string, unknown>;
  const planets = o.planets ?? o.positions;
  const houses = o.houses ?? o.cusps;
  const hasPlanets = Array.isArray(planets) && planets.length > 0;
  const hasHouses = Array.isArray(houses) && houses.length >= 12;
  return hasPlanets || hasHouses;
}

async function blobUrlFromComposePayload(
  base: string,
  composePayload: Record<string, unknown>
): Promise<string | null> {
  const audio = composePayload?.audio as Record<string, unknown> | undefined;
  const base64 = audio?.base64;
  if (typeof base64 === 'string' && base64.length > 0) {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
  const exportId = (composePayload?.export_id ?? audio?.export_id) as string | undefined;
  if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
    try {
      const exportRes = await fetch(`${base || ''}/api/exports/${exportId}`, { credentials: 'same-origin' });
      if (exportRes.ok) {
        const ab = await exportRes.arrayBuffer();
        if (ab.byteLength > 0) {
          const blob = new Blob([ab], { type: exportRes.headers.get('content-type') || 'audio/wav' });
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

export interface ProfilePanelProps {
  onSwitchToConnections?: () => void;
}

export function ProfilePanel({ onSwitchToConnections }: ProfilePanelProps) {
  const { user, primaryChart, loading: profileLoading, error: profileError, refresh } = useProfile();
  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const { data: chartData, loading: chartLoading, error: chartError, refresh: refreshChart } = useProfileChart(chartId);
  const { data: communityInventory } = useCommunityInventory();
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
  const [libraryRows, setLibraryRows] = useState<Array<Record<string, unknown>>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createHandle, setCreateHandle] = useState('');
  const [createChartLabel, setCreateChartLabel] = useState('');
  const [createChartDate, setCreateChartDate] = useState('');
  const [createChartTime, setCreateChartTime] = useState('12:00');
  const [createChartLat, setCreateChartLat] = useState('');
  const [createChartLon, setCreateChartLon] = useState('');
  const [createChartTz, setCreateChartTz] = useState('');
  const [createChartLocationLabel, setCreateChartLocationLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
        const report = row.report as { text?: unknown; weather?: unknown } | undefined;
        const textValue = report?.text;
        const textMissing = textValue == null;
        setLibraryRelationalWeatherTextMissing(textMissing);
        const text =
          typeof textValue === 'string'
            ? textValue
            : textValue && typeof textValue === 'object'
              ? [String((textValue as { short?: unknown }).short || ''), String((textValue as { long?: unknown }).long || '')]
                  .filter(Boolean)
                  .join('\n\n')
              : 'Saved relational weather artifact.';
        setLibraryReconstructResult({
          explanation: {
            sections: [
              {
                sectionId: 'community',
                title: 'Relational weather artifact',
                text,
              },
            ],
          },
        });
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
    const chartPayload = {
      label: createChartLabel.trim() || 'My Natal',
      date: createChartDate,
      time: createChartTime,
      lat: Number(createChartLat),
      lon: Number(createChartLon),
      timezone: createChartTz.trim(),
    };
    const chartReady =
      createChartDate &&
      createChartTime &&
      createChartLat !== '' &&
      createChartLon !== '' &&
      isPersistableChartTimezone(createChartTz) &&
      Number.isFinite(Number(createChartLat)) &&
      Number.isFinite(Number(createChartLon));
    const canRegister =
      registerEmail.trim().includes('@') &&
      registerPassword.length >= 8 &&
      createName.trim() &&
      chartReady;
    const canLogin = loginEmail.trim().includes('@') && loginPassword.length >= 1;

    return (
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-6"
        >
          <h2 className="text-xl font-semibold text-text">Sign in to Astradio</h2>
          <p className="text-sm text-subtext">
            Register with email and password, or log in to continue. Your natal chart is saved with your account.
          </p>
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                authTab === 'register' ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
              }`}
              onClick={() => {
                setAuthTab('register');
                setAuthError(null);
              }}
            >
              Register
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                authTab === 'login' ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
              }`}
              onClick={() => {
                setAuthTab('login');
                setAuthError(null);
              }}
            >
              Log in
            </button>
          </div>

          {authTab === 'login' ? (
            <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4 max-w-md">
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="input w-full"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="input w-full"
              />
              {authError && <p className="text-red-500 text-xs">{authError}</p>}
              <button
                type="button"
                disabled={authBusy || !canLogin}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthError(null);
                  try {
                    const r = await fetch('/api/auth/login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'same-origin',
                      body: JSON.stringify({
                        email: loginEmail.trim(),
                        password: loginPassword,
                      }),
                    });
                    const data = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      setAuthError(typeof data.error === 'string' ? data.error : 'Login failed');
                      return;
                    }
                    setLoginPassword('');
                    await refresh();
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                {authBusy ? 'Signing in…' : 'Log in'}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="input w-full"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password (min 8 characters)"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="input w-full"
                />
              </div>
              <input
                placeholder="Display name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="input w-full"
              />
              <input
                placeholder="Handle (optional)"
                value={createHandle}
                onChange={(e) => setCreateHandle(e.target.value)}
                className="input w-full"
              />
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-medium text-text">Birth chart (required)</h3>
                <input
                  placeholder="Label (e.g. My Natal)"
                  value={createChartLabel}
                  onChange={(e) => setCreateChartLabel(e.target.value)}
                  className="input w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={createChartDate}
                    onChange={(e) => setCreateChartDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                  <input
                    type="time"
                    value={createChartTime}
                    onChange={(e) => setCreateChartTime(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>
                <LocationFinder
                  value={createChartLocationLabel}
                  onSelect={(r) => {
                    setCreateChartLocationLabel(r.label);
                    setCreateChartLat(String(r.lat));
                    setCreateChartLon(String(r.lon));
                    setCreateChartTz(r.timezone && isPersistableChartTimezone(r.timezone) ? r.timezone : '');
                  }}
                  onClear={() => {
                    setCreateChartLocationLabel('');
                    setCreateChartLat('');
                    setCreateChartLon('');
                    setCreateChartTz('');
                  }}
                  placeholder="Birth place (city, region, or address)"
                />
              </div>
              {(createError || authError) && (
                <p className="text-red-500 text-xs">{authError || createError}</p>
              )}
              <button
                type="button"
                disabled={creating || authBusy || !canRegister}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                onClick={async () => {
                  setCreating(true);
                  setCreateError(null);
                  setAuthError(null);
                  try {
                    const body = {
                      email: registerEmail.trim(),
                      password: registerPassword,
                      displayName: createName.trim(),
                      handle: createHandle.trim() || undefined,
                      chart: chartPayload,
                    };
                    const r = await fetch('/api/auth/register', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'same-origin',
                      body: JSON.stringify(body),
                    });
                    const data = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      const msg =
                        typeof data.error === 'string'
                          ? data.error
                          : typeof data.message === 'string'
                            ? data.message
                            : 'Registration failed';
                      setAuthError(msg);
                      return;
                    }
                    const newChartId = data?.primaryChart?.id ?? null;
                    setRegisterPassword('');
                    setCreateName('');
                    setCreateHandle('');
                    setCreateChartLabel('');
                    setCreateChartDate('');
                    setCreateChartTime('12:00');
                    setCreateChartLat('');
                    setCreateChartLon('');
                    setCreateChartTz('');
                    setCreateChartLocationLabel('');
                    await refresh();
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating || authBusy ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
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
                className="px-5 py-2.5 rounded-full bg-emerald text-bg font-medium text-sm shadow-md hover:opacity-90 transition-opacity"
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
                    className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium"
                    disabled={activeLoading}
                    onClick={() => void loadActiveStateText()}
                  >
                    {activeLoading ? 'Loading…' : 'Generate transit report'}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-border text-sm"
                    disabled={activeAudioBusy || !activeResult}
                    onClick={() => void generateActiveAudio()}
                  >
                    {activeAudioBusy ? 'Generating…' : 'Generate transit audio'}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-border text-sm"
                    disabled={!canSaveCurrentTransit()}
                    onClick={() => void saveActiveToLibrary()}
                  >
                    Save to Library
                  </button>
                </div>
                {libraryError && <p className="text-sm text-red-500">{libraryError}</p>}
                {activeError && <p className="text-sm text-red-500">{activeError}</p>}
                {activeResult?.explanation && (
                  <ExplainerSections sections={mapExplanationToSections(activeResult.explanation)} />
                )}
                {activeAudioUrl && (
                  <audio controls src={activeAudioUrl} className="w-full max-w-md" preload="metadata" />
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
              <ExplainerSections sections={chartData!.explainer.sections} />
            )}
            {identityAudioUrl && (
              <audio controls src={identityAudioUrl} className="w-full max-w-md mt-6" preload="metadata" />
            )}
          </div>
        </div>
        )}

        {profileSection === 'library' && (
          <div className="space-y-3">
            <p className="text-sm text-subtext">Saved profile and community artifacts (text first; audio when export is available).</p>
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
                    {libraryReconstructResult != null &&
                      libraryReconstructResult.explanation != null &&
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
                          Reading text was not stored for this bookmark. Re-save from the Community relational feed, or
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
                      <audio controls src={libraryDetailAudioUrl} className="w-full max-w-md" preload="metadata" />
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
