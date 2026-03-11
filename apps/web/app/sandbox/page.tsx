'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthDataForm } from '../../src/components/sandbox/BirthDataForm';
import { WheelCanvasBuilder } from '../../src/components/sandbox/WheelCanvasBuilder';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import { PlanetPalette } from '../../src/components/sandbox/PlanetPalette';
import type { SandboxDraft, SandboxBirth, SandboxOverrides, PlanetKey, EphemerisSnapshot, SandboxReport } from '../../src/types/sandbox';
import { getApiBaseUrl } from '../../src/core/api-base';
import { getPlayableLyriaUrl } from '../../src/core/audio/lyria-playback';
import { BODY_DISPLAY_ORDER } from '../../../../vnext/canonical-bodies';

const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];

type SandboxMode = 'birth_first' | 'free_build';

type SandboxState =
  | 'idle'
  | 'loading_base'
  | 'ready_builder'
  | 'syncing_overrides'
  | 'ready_report'
  | 'generating'
  | 'error';

function roundDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

function normalizeOverrides(overrides: SandboxOverrides): SandboxOverrides {
  const sortedPlanets: Partial<Record<PlanetKey, { lonDeg: number }>> = {};
  const planetKeys = Object.keys(overrides.planets || {}) as PlanetKey[];
  planetKeys.sort((a, b) => a.localeCompare(b));
  for (const key of planetKeys) {
    const override = overrides.planets[key];
    if (override) sortedPlanets[key] = { lonDeg: roundDegree(override.lonDeg) };
  }
  return { planets: sortedPlanets, angles: overrides.angles };
}

const SANDBOX_CONTROLS = {
  arc_shape: 0.5,
  density_level: 0.6,
  tempo_norm: 0.7,
  step_bias: 0.7,
  leap_cap: 5,
  rhythm_template_id: 3,
  syncopation_bias: 0.3,
  motif_rate: 0.6,
};

function ExplainerSections({ explanation }: { explanation: any }) {
  if (!explanation?.sections) return null;
  const sections = Array.isArray(explanation.sections) ? explanation.sections : [];
  return (
    <div className="space-y-6">
      {sections.map((sec: any, i: number) => (
        <section key={i} className="rounded-lg border border-border bg-bgElev p-4">
          <h3 className="text-lg font-semibold text-text mb-3">{sec.title || sec.id || `Section ${i + 1}`}</h3>
          <div className="text-subtext text-sm leading-relaxed whitespace-pre-wrap">{sec.text || sec.content || ''}</div>
          {sec.bullets?.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
              {sec.bullets.map((b: string, j: number) => <li key={j}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function SandboxPage() {
  const [mode, setMode] = useState<SandboxMode>('birth_first');
  const [selectedPlanetForPlacement, setSelectedPlanetForPlacement] = useState<PlanetKey | null>(null);
  const [state, setState] = useState<SandboxState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SandboxDraft>({
    birth: null,
    baseSnapshot: null,
    overrides: { planets: {} },
    overriddenSnapshot: null,
  });
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [constrainToHouse, setConstrainToHouse] = useState(true);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<{ chart?: string; report?: string; audio?: string } | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [planHash, setPlanHash] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [lastSnapshotUsed, setLastSnapshotUsed] = useState<EphemerisSnapshot | null>(null);
  const [lastCombinedHashUsed, setLastCombinedHashUsed] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayStatus, setReplayStatus] = useState<'idle' | 'match' | 'mismatch' | 'error'>('idle');
  const [replayError, setReplayError] = useState<string | null>(null);
  const [exportUnavailableReason, setExportUnavailableReason] = useState<{ summary: string; step?: string; message?: string } | null>(null);
  const [lastComposeProvider, setLastComposeProvider] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [exportDetailsOpen, setExportDetailsOpen] = useState(false);
  const [savedList, setSavedList] = useState<Array<{ id: string; plan_hash: string; vector_hash: string; created_at: string; export_id?: string | null }>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sandboxAudioSrc, setSandboxAudioSrc] = useState<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!exportId) {
      setSandboxAudioSrc(null);
      return;
    }
    const base = getApiBaseUrl() || '';
    const url = `${base}/api/exports/${exportId}`;
    try {
      setSandboxAudioSrc(getPlayableLyriaUrl({ url }));
    } catch {
      setSandboxAudioSrc(null);
    }
  }, [exportId]);

  const updateSnapshot = useCallback(async (birth: SandboxBirth, overrides: SandboxOverrides) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    const sequenceId = ++snapshotSequenceRef.current;
    updateTimeoutRef.current = setTimeout(async () => {
      if (sequenceId !== snapshotSequenceRef.current) return;
      setState('syncing_overrides');
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth, overrides: normalizeOverrides(overrides) }),
          signal: controller.signal,
        });
        if (sequenceId !== snapshotSequenceRef.current) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data?.error ?? data?.message) || `Snapshot failed: ${res.status}`);
        setDraft((prev) => ({ ...prev, overriddenSnapshot: data.snapshot, hash: data.meta }));
        setState('ready_report');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setState('error');
          setError(err.message);
        }
      } finally {
        if (sequenceId === snapshotSequenceRef.current) abortControllerRef.current = null;
      }
    }, 300);
  }, []);

  const handleBirthSubmit = useCallback(async (birth: SandboxBirth) => {
    setState('loading_base');
    setError(null);
    setGenerateError(null);
    const overridesToUse = mode === 'free_build' ? normalizeOverrides(draft.overrides) : { planets: {} };
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides: overridesToUse }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data?.error ?? data?.message) || 'Failed to load chart');
      const overriddenSnapshot = data.snapshot;
      setDraft({
        birth,
        baseSnapshot: data.snapshot,
        overrides: overridesToUse,
        overriddenSnapshot,
        hash: data.meta,
      });
      setState('ready_builder');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to load birth data');
      throw err;
    }
  }, [mode, draft.overrides]);

  const handleOverrideChange = useCallback((planet: PlanetKey, lonDeg: number | null) => {
    if (mode === 'free_build') setSelectedPlanetForPlacement(null);
    setDraft((prev) => {
      const newOverrides: SandboxOverrides = { ...prev.overrides, planets: { ...prev.overrides.planets } };
      if (lonDeg === null) delete newOverrides.planets[planet];
      else newOverrides.planets[planet] = { lonDeg: roundDegree(lonDeg) };
      const normalized = normalizeOverrides(newOverrides);
      if (prev.overriddenSnapshot && prev.birth) {
        const updatedPlanets = prev.overriddenSnapshot.planets.map((p) =>
          p.name === planet ? { ...p, lon: lonDeg !== null ? roundDegree(lonDeg) : p.lon } : p
        );
        updateSnapshot(prev.birth, normalized);
        return { ...prev, overrides: normalized, overriddenSnapshot: { ...prev.overriddenSnapshot, planets: updatedPlanets } };
      }
      return { ...prev, overrides: normalized };
    });
  }, [updateSnapshot, mode]);

  const handleResetAllOverrides = useCallback(() => {
    if (!draft.birth || !draft.baseSnapshot) return;
    const empty: SandboxOverrides = { planets: {} };
    setDraft((prev) => ({ ...prev, overrides: empty, overriddenSnapshot: prev.baseSnapshot }));
    updateSnapshot(draft.birth, empty);
    setState('ready_builder');
  }, [draft.birth, draft.baseSnapshot, updateSnapshot]);

  const handleResetPlanet = useCallback((planet: PlanetKey) => handleOverrideChange(planet, null), [handleOverrideChange]);

  const canGenerate = Boolean(draft.birth && (draft.overriddenSnapshot || draft.baseSnapshot) && draft.hash?.combinedHash);
  const generateDisabledReasons: string[] = [];
  if (!draft.birth) {
    generateDisabledReasons.push(mode === 'free_build'
      ? 'Add birth data (date, time, location) to generate report and audio.'
      : 'Enter birth data.');
  }
  if (!draft.baseSnapshot && !draft.overriddenSnapshot && draft.birth) generateDisabledReasons.push('Wait for the chart snapshot to load.');
  if (!draft.hash?.combinedHash && draft.birth) generateDisabledReasons.push('Wait for the internal hash to compute.');
  if (state === 'syncing_overrides') generateDisabledReasons.push('Finish syncing overrides.');

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !draft.birth) return;
    const birth = draft.birth;
    const overrides = normalizeOverrides(draft.overrides);
    setHasGenerated(true);
    setGenerateLoading(true);
    setGenerateError(null);
    setExportId(null);
    setPlanHash(null);
    setReplayStatus('idle');
    setReplayError(null);
    setLastSnapshotUsed(null);
    setLastCombinedHashUsed(null);
    setExportUnavailableReason(null);
    setLastComposeProvider(null);
    setDownloadError(null);
    setPlaybackError(null);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    const base = getApiBaseUrl();
    // Cancel any in-flight snapshot sync to avoid races.
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    snapshotSequenceRef.current++;
    let snapshotUsed: EphemerisSnapshot | null = null;
    let combinedHashUsed: string | null = null;
    try {
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides }),
      });
      const snapData = await snapRes.json().catch(() => ({}));
      if (!snapRes.ok) {
        setGenerateError({ chart: (snapData?.error ?? snapData?.message) || `Snapshot: ${snapRes.status}` });
        setGenerateLoading(false);
        return;
      }
      snapshotUsed = snapData.snapshot as EphemerisSnapshot | null;
      combinedHashUsed = (snapData.meta && snapData.meta.combinedHash) || null;
      if (!snapshotUsed || !combinedHashUsed) {
        setGenerateError({ chart: 'Snapshot response missing snapshot or combinedHash' });
        setGenerateLoading(false);
        return;
      }
      setLastSnapshotUsed(snapshotUsed);
      setLastCombinedHashUsed(combinedHashUsed);

      const reportRes = await fetch(`${base}/api/sandbox/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides, seed: combinedHashUsed }),
      });
      const reportData = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        setGenerateError({ report: (reportData?.error ?? reportData?.message) || `Report: ${reportRes.status}` });
        setReport(null);
        setGenerateLoading(false);
        return;
      }
      setReport(reportData);

      if (!snapshotUsed || !combinedHashUsed) {
        setGenerateError((e) => ({ ...e, audio: 'No snapshot or seed available for compose' }));
        setGenerateLoading(false);
        return;
      }
      const composeRes = await fetch(`${base}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sandbox',
          controls: SANDBOX_CONTROLS,
          seed: combinedHashUsed,
          overriddenSnapshot: snapshotUsed,
        }),
      });
      const composeData = await composeRes.json().catch(() => ({}));
      if (!composeRes.ok) {
        setGenerateError((e) => ({ ...e, audio: (composeData?.error ?? composeData?.message) || `Compose: ${composeRes.status}` }));
      } else {
        const providerUsed = composeData.audio?.provider_used ?? composeData.export_meta?.provider ?? null;
        const exportErr = composeData.audio?.export_error ?? null;
        const isLyriaSuccess = providerUsed === 'lyria' && (exportErr == null || exportErr === '') && composeData.export_id;
        if (isLyriaSuccess) {
          setExportId(composeData.export_id);
          setExportUnavailableReason(null);
          setLastComposeProvider(providerUsed);
        } else {
          setExportId(null);
          const ad = composeData.audio_debug;
          setExportUnavailableReason({
            summary: exportErr ? 'Lyria export failed' : 'Export disabled or failed',
            step: ad?.step,
            message: ad?.message ?? (exportErr ? String(exportErr) : undefined),
          });
          setLastComposeProvider(null);
        }
        if (composeData.hashes?.plan_sha256) setPlanHash(composeData.hashes.plan_sha256);
        else setGenerateError((e) => ({ ...e, audio: 'Compose response missing plan_sha256' }));
      }
    } catch (e) {
      setGenerateError({ audio: e instanceof Error ? e.message : 'Generate failed' });
    } finally {
      setGenerateLoading(false);
    }
  }, [canGenerate, draft]);

  const handleReplay = useCallback(async () => {
    if (!lastSnapshotUsed || !lastCombinedHashUsed || !planHash) {
      setReplayError('Replay unavailable: missing snapshot, seed, or plan hash from last generate.');
      setReplayStatus('error');
      return;
    }
    const base = getApiBaseUrl();
    setReplayLoading(true);
    setReplayError(null);
    setReplayStatus('idle');
    try {
      const composeRes = await fetch(`${base}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sandbox',
          controls: SANDBOX_CONTROLS,
          seed: lastCombinedHashUsed,
          overriddenSnapshot: lastSnapshotUsed,
        }),
      });
      const composeData = await composeRes.json().catch(() => ({}));
      if (!composeRes.ok) {
        setReplayError((composeData?.error ?? composeData?.message) || `Replay compose: ${composeRes.status}`);
        setReplayStatus('error');
        return;
      }
      const replayPlan = composeData.hashes?.plan_sha256 as string | undefined;
      if (!replayPlan) {
        setReplayError('Replay compose response missing plan_sha256');
        setReplayStatus('error');
        return;
      }
      if (replayPlan !== planHash) {
        setReplayStatus('mismatch');
      } else {
        setReplayStatus('match');
      }
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : 'Replay failed');
      setReplayStatus('error');
    } finally {
      setReplayLoading(false);
    }
  }, [lastSnapshotUsed, lastCombinedHashUsed, planHash]);

  const handleAudioPlay = useCallback(() => {
    setPlaybackError(null);
    const el = audioRef.current;
    if (!el) return;
    el.play().catch(() => {
      setPlaybackError('Playback blocked by browser. Press Play again or allow audio.');
    });
  }, []);
  const handleAudioStop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaybackError(null);
  }, []);
  const handleAudioReplay = useCallback(() => {
    setPlaybackError(null);
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    el.play().catch(() => {
      setPlaybackError('Playback blocked by browser. Press Play again or allow audio.');
    });
  }, []);

  const handleDownloadWav = useCallback(async () => {
    if (!exportId) return;
    const base = getApiBaseUrl();
    const url = `${base || ''}/api/exports/${exportId}`;
    setDownloadError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setDownloadError(`Download failed: ${res.status}`);
        return;
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct && !ct.includes('audio') && !ct.includes('wav')) {
        setDownloadError('Download failed: response is not audio (wrong content-type).');
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `astradio-sandbox-${exportId.slice(0, 8)}.wav`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
    }
  }, [exportId]);

  const fetchSavedList = useCallback(async () => {
    const base = getApiBaseUrl();
    setListLoading(true);
    try {
      const r = await fetch(`${base}/api/sandbox/compositions?limit=50`);
      const data = await r.json().catch(() => ([]));
      if (!r.ok) {
        setSavedList([]);
        return;
      }
      setSavedList(Array.isArray(data) ? data : []);
    } finally {
      setListLoading(false);
    }
  }, []);

  const canSave = Boolean(
    hasGenerated &&
    draft.birth &&
    lastCombinedHashUsed &&
    planHash &&
    report != null
  );

  const handleSave = useCallback(async () => {
    if (!canSave || !draft.birth) return;
    const base = getApiBaseUrl();
    setSaveLoading(true);
    setSaveError(null);
    try {
      const r = await fetch(`${base}/api/sandbox/compositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandbox_state: {
            birth: draft.birth,
            overrides: normalizeOverrides(draft.overrides),
            controls: SANDBOX_CONTROLS,
          },
          vector_hash: lastCombinedHashUsed,
          seed: lastCombinedHashUsed,
          plan_hash: planHash,
          report: report ?? {},
          provider: lastComposeProvider ?? null,
          provider_version: null,
          export_id: exportId ?? null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSaveError((data?.error ?? data?.message) || `Save failed: ${r.status}`);
        return;
      }
      await fetchSavedList();
    } finally {
      setSaveLoading(false);
    }
  }, [canSave, draft.birth, draft.overrides, lastCombinedHashUsed, planHash, report, lastComposeProvider, exportId, fetchSavedList]);

  const handleLoad = useCallback(async (id: string) => {
    const base = getApiBaseUrl();
    try {
      const r = await fetch(`${base}/api/sandbox/compositions/${id}`);
      const comp = await r.json().catch(() => null);
      if (!r.ok || !comp) {
        setError(comp?.error ?? 'Failed to load composition');
        return;
      }
      const state = comp.sandbox_state || {};
      const birth = state.birth;
      const overrides = state.overrides || { planets: {} };
      if (!birth || !birth.date || !birth.time) {
        setError('Invalid saved composition: missing birth data');
        return;
      }
      setReport(comp.report ?? null);
      setPlanHash(comp.plan_hash ?? null);
      setLastCombinedHashUsed(comp.seed ?? comp.vector_hash ?? null);
      setExportId(comp.export_id ?? null);
      setLastSnapshotUsed(null);
      setHasGenerated(true);
      setGenerateError(null);
      setDraft({
        birth,
        baseSnapshot: null,
        overrides,
        overriddenSnapshot: null,
      });
      setState('loading_base');
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides: normalizeOverrides(overrides) }),
      });
      const snapData = await snapRes.json().catch(() => ({}));
      if (!snapRes.ok) {
        setState('ready_builder');
        setError((snapData?.error ?? snapData?.message) || 'Snapshot failed after load');
        return;
      }
      setLastSnapshotUsed(snapData.snapshot ?? null);
      setDraft((prev) => ({
        ...prev,
        baseSnapshot: snapData.snapshot,
        overriddenSnapshot: snapData.snapshot,
        hash: snapData.meta,
      }));
      setState('ready_report');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, []);

  const handleExportJson = useCallback(() => {
    const bundle = {
      birth: draft.birth,
      overrides: normalizeOverrides(draft.overrides),
      controls: SANDBOX_CONTROLS,
      combinedHashUsed: lastCombinedHashUsed ?? null,
      plan_sha256: planHash ?? null,
      export_id: exportId ?? null,
      provider: lastComposeProvider ?? null,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `astradio-sandbox-${lastCombinedHashUsed?.slice(0, 8) ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [draft.birth, draft.overrides, lastCombinedHashUsed, planHash, exportId, lastComposeProvider]);

  useEffect(() => {
    if (state === 'ready_builder' || state === 'ready_report') fetchSavedList();
  }, [state, fetchSavedList]);

  const currentSnapshot = draft.overriddenSnapshot || draft.baseSnapshot;
  const basePositions: Record<string, number> = {};
  if (draft.baseSnapshot) for (const p of draft.baseSnapshot.planets) basePositions[p.name] = p.lon;
  const cusps = currentSnapshot?.houses ?? [];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-text">Sandbox</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Chart lab: build a chart from birth data or place planets directly. Generate chart, report, and audio from the same chart state.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sandbox-mode"
                checked={mode === 'birth_first'}
                onChange={() => { setMode('birth_first'); if (state === 'idle' && !draft.birth) setDraft((p) => ({ ...p, overrides: { planets: {} } })); }}
                className="rounded"
              />
              <span className="text-sm text-text">Birth-first</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sandbox-mode"
                checked={mode === 'free_build'}
                onChange={() => {
                  setMode('free_build');
                  setState('idle');
                  setSelectedPlanetForPlacement(null);
                  setDraft({ birth: null, baseSnapshot: null, overrides: { planets: {} }, overriddenSnapshot: null });
                  setError(null);
                  setReport(null);
                }}
                className="rounded"
              />
              <span className="text-sm text-text">Free-build</span>
            </label>
          </div>
          <p className="text-xs text-subtext/80">
            {mode === 'birth_first' ? 'Enter birth data first, then edit planets.' : 'Place planets on the wheel, then add birth data to generate.'}
          </p>
        </motion.div>

        {state === 'idle' && mode === 'birth_first' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-text mb-4">Enter birth data</h2>
            <BirthDataForm onSubmit={handleBirthSubmit} />
            <div className="mt-6 w-full aspect-square max-w-md mx-auto bg-bgElev border border-border rounded-2xl flex items-center justify-center">
              <p className="text-subtext text-sm">Enter birth data to see the wheel</p>
            </div>
          </motion.div>
        )}

        {state === 'loading_base' && (
          <div className="card max-w-2xl mx-auto text-center">
            <p className="text-subtext">Loading chart...</p>
          </div>
        )}

        {state === 'error' && error && (
          <div className="card max-w-2xl mx-auto">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button onClick={() => { setState('idle'); setError(null); setDraft({ birth: null, baseSnapshot: null, overrides: { planets: {} }, overriddenSnapshot: null }); }} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm">Reset</button>
            </div>
          </div>
        )}

        {state === 'idle' && mode === 'free_build' && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold text-text mb-2">Wheel</h2>
                <p className="text-sm text-subtext mb-3">Select a planet, then click the wheel to place it. Drag a planet to move it. Degree panel is for precision only.</p>
                <div className="mb-3">
                  <PlanetPalette
                    overrides={draft.overrides}
                    selectedPlanet={selectedPlanetForPlacement}
                    onSelectPlanet={setSelectedPlanetForPlacement}
                  />
                </div>
                <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
                  <WheelCanvasBuilder
                    snapshot={null}
                    overrides={draft.overrides}
                    onOverrideChange={(planet, lonDeg) => handleOverrideChange(planet, lonDeg)}
                    isUpdating={false}
                    constrainToHouse={false}
                    freeBuild
                    selectedPlanetForPlacement={selectedPlanetForPlacement}
                  />
                </div>
              </div>
              <div className="card">
                <h2 className="text-xl font-semibold text-text mb-4">Add birth data</h2>
                <p className="text-sm text-subtext mb-4">Birth data is required to generate report and audio. Add it when ready.</p>
                <BirthDataForm onSubmit={handleBirthSubmit} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <DegreePanel overrides={draft.overrides} basePositions={{}} cusps={undefined} onOverrideChange={handleOverrideChange} onResetPlanet={handleResetPlanet} />
              </div>
            </motion.div>
          </div>
        )}

        {/* Phase 8H verification (dev): body count, aspect metadata */}
        {(state === 'ready_builder' || state === 'syncing_overrides' || state === 'ready_report') && currentSnapshot && (
          <details className="card mt-4">
            <summary className="cursor-pointer text-sm font-medium text-subtext hover:text-text">Phase 8H verification</summary>
            <div className="mt-3 text-xs font-mono text-subtext space-y-1">
              <p><strong>Bodies:</strong> {currentSnapshot.planets?.length ?? 0} ({currentSnapshot.planets?.map((p) => p.name).join(', ') ?? '—'})</p>
              <p><strong>Aspects:</strong> {currentSnapshot.aspects?.length ?? 0}</p>
              {currentSnapshot.aspects?.length ? (
                <p><strong>Sample aspect:</strong> {currentSnapshot.aspects[0].a}–{currentSnapshot.aspects[0].b} {currentSnapshot.aspects[0].type} orb={currentSnapshot.aspects[0].orb}
                  {' '}{(currentSnapshot.aspects[0] as { dynamics?: string; strength?: number; exactness?: number; priorityBase?: number }).dynamics != null && (
                    <>dynamics={(currentSnapshot.aspects[0] as { dynamics?: string }).dynamics} strength={(currentSnapshot.aspects[0] as { strength?: number }).strength} exactness={(currentSnapshot.aspects[0] as { exactness?: number }).exactness} priorityBase={(currentSnapshot.aspects[0] as { priorityBase?: number }).priorityBase}</>
                  )}
                </p>
              ) : null}
            </div>
          </details>
        )}

        {(state === 'ready_builder' || state === 'syncing_overrides' || state === 'ready_report') && draft.birth && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text">Wheel</h2>
                    <p className="text-sm text-subtext mt-1">Drag planets or use degree inputs. Houses are from birth chart geometry in Phase 6.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-subtext">
                    <input type="checkbox" checked={constrainToHouse} onChange={(e) => setConstrainToHouse(e.target.checked)} className="rounded" />
                    Constrain to house
                  </label>
                  {Object.keys(draft.overrides.planets).length > 0 && (
                    <button onClick={handleResetAllOverrides} className="px-3 py-1.5 text-sm bg-bgElev hover:bg-bgElev/80 border border-border rounded-lg text-subtext hover:text-text">Reset All</button>
                  )}
                </div>
                <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
                  <WheelCanvasBuilder
                    snapshot={currentSnapshot}
                    overrides={draft.overrides}
                    onOverrideChange={(planet, lonDeg) => handleOverrideChange(planet, lonDeg)}
                    isUpdating={state === 'syncing_overrides'}
                    constrainToHouse={constrainToHouse}
                  />
                </div>
              </div>

              <div className="card">
                <h2 className="text-xl font-semibold text-text mb-4">Generate</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate || generateLoading}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generateLoading ? 'Generating…' : 'Generate chart, report & audio'}
                  </button>
                  {canSave && (
                    <button
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="px-4 py-2 bg-bgElev border border-border rounded-lg font-medium hover:bg-bgElev/80 disabled:opacity-50 text-text"
                    >
                      {saveLoading ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
                {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}
                {!canGenerate && (
                  <div className="mt-3 text-xs text-subtext">
                    <p className="mb-1">Generate is disabled until:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {generateDisabledReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasGenerated && (
                  <div className="mt-4 grid gap-2 text-xs text-subtext sm:grid-cols-3">
                    <div>
                      <span className="font-semibold">Chart:</span>{' '}
                      {generateLoading ? 'Generating…' : generateError?.chart ? 'Failed' : 'OK'}
                    </div>
                    <div>
                      <span className="font-semibold">Report:</span>{' '}
                      {generateLoading ? 'Generating…' : generateError?.report ? 'Failed' : report ? 'OK' : 'Not run'}
                    </div>
                    <div>
                      <span className="font-semibold">Audio:</span>{' '}
                      {generateLoading
                        ? 'Generating…'
                        : generateError?.audio
                        ? 'Failed'
                        : exportId
                        ? 'Ready'
                        : 'Export unavailable'}
                    </div>
                  </div>
                )}
                {generateError && (generateError.chart || generateError.report || generateError.audio) && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {generateError.chart && <p>Chart: {generateError.chart}</p>}
                    {generateError.report && <p>Report: {generateError.report}</p>}
                    {generateError.audio && <p>Audio: {generateError.audio}</p>}
                  </div>
                )}
                {report && (
                  <div className="mt-6 space-y-4">
                    {report.personality && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Personality</h3>
                        <div className="text-subtext text-sm">{report.personality.summary || JSON.stringify(report.personality, null, 2)}</div>
                      </section>
                    )}
                    {report.guidance && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Guidance</h3>
                        <div className="text-subtext text-sm">{report.guidance.advice || JSON.stringify(report.guidance, null, 2)}</div>
                      </section>
                    )}
                    {report.explanation && <ExplainerSections explanation={report.explanation} />}
                  </div>
                )}
                {hasGenerated && (
                  <div className="mt-6 space-y-2">
                    <h3 className="text-sm font-semibold text-text">Audio</h3>
                    {exportId ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={handleAudioPlay} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                            Play
                          </button>
                          <button type="button" onClick={handleAudioStop} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                            Stop
                          </button>
                          <button type="button" onClick={handleAudioReplay} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                            Replay
                          </button>
                          <button type="button" onClick={handleDownloadWav} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                            Download WAV
                          </button>
                        </div>
                        <audio
                          key={exportId}
                          ref={audioRef}
                          src={sandboxAudioSrc ?? undefined}
                          controls
                          className="max-w-full w-full"
                        />
                        {playbackError && <p className="text-xs text-red-400">{playbackError}</p>}
                        {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-subtext">
                          Audio export unavailable.
                          {exportUnavailableReason && (
                            <span className="ml-1">{exportUnavailableReason.summary}</span>
                          )}
                          {planHash && (
                            <span className="ml-1">
                              Plan hash: <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60">{planHash}</code>
                            </span>
                          )}
                        </p>
                        {exportUnavailableReason && (exportUnavailableReason.step || exportUnavailableReason.message) && (
                          <details className="text-xs text-subtext" open={exportDetailsOpen} onToggle={(e) => setExportDetailsOpen((e.target as HTMLDetailsElement).open)}>
                            <summary className="cursor-pointer hover:text-text">Details</summary>
                            <pre className="mt-1 p-2 bg-bgElev rounded border border-border/60 overflow-auto">
                              {[exportUnavailableReason.step && `step: ${exportUnavailableReason.step}`, exportUnavailableReason.message].filter(Boolean).join('\n')}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {hasGenerated && (
                  <div className="mt-6 border-t border-border/60 pt-4 text-xs text-subtext space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-text">Provenance</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleExportJson}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text"
                        >
                          Export JSON
                        </button>
                        <button
                          onClick={handleReplay}
                          disabled={replayLoading || !lastSnapshotUsed || !lastCombinedHashUsed || !planHash}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 disabled:opacity-50 disabled:cursor-not-allowed text-text"
                        >
                          {replayLoading ? 'Replaying…' : 'Replay (same seed)'}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <span className="font-semibold">combinedHash:</span>{' '}
                        {lastCombinedHashUsed ? (
                          <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">
                            {lastCombinedHashUsed}
                          </code>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold">plan_sha256:</span>{' '}
                        {planHash ? (
                          <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">
                            {planHash}
                          </code>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold">export_id:</span>{' '}
                        {exportId ? (
                          <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">
                            {exportId}
                          </code>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                    {replayStatus === 'mismatch' && (
                      <p className="text-xs font-semibold text-red-400">Determinism mismatch</p>
                    )}
                    {replayStatus === 'match' && (
                      <p className="text-xs text-emerald-400">Replay matched plan hash.</p>
                    )}
                    {replayStatus === 'error' && replayError && (
                      <p className="text-xs text-red-400">{replayError}</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <DegreePanel overrides={draft.overrides} basePositions={basePositions} cusps={cusps.length === 12 ? cusps : undefined} onOverrideChange={handleOverrideChange} onResetPlanet={handleResetPlanet} />
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text">Saved</h3>
                  <button
                    type="button"
                    onClick={fetchSavedList}
                    disabled={listLoading}
                    className="px-2 py-1 text-xs rounded border border-border bg-bgElev hover:bg-bgElev/80 disabled:opacity-50 text-text"
                  >
                    {listLoading ? '…' : 'Refresh'}
                  </button>
                </div>
                {savedList.length === 0 ? (
                  <p className="text-xs text-subtext">No saved compositions. Generate then Save.</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {savedList.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-xs border border-border/60 rounded p-2 bg-bgElev/50">
                        <span className="truncate text-subtext" title={item.id}>
                          {item.plan_hash?.slice(0, 8) ?? item.id.slice(0, 8)} — {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleLoad(item.id)}
                          className="flex-shrink-0 px-2 py-1 rounded border border-border bg-bgElev hover:bg-bgElev/80 text-text"
                        >
                          Load
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
