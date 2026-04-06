'use client';

import { useState, useCallback, useRef, useEffect, useReducer } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthDataForm } from '../../src/components/sandbox/BirthDataForm';
import { WheelCanvasBuilder } from '../../src/components/sandbox/WheelCanvasBuilder';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import type { SandboxBirth, SandboxOverrides, PlanetKey, EphemerisSnapshot, SandboxReport, SandboxSnapshotMeta } from '../../src/types/sandbox';
import { getApiBaseUrl } from '../../src/core/api-base';
import { getPlayableLyriaUrl } from '../../src/core/audio/lyria-playback';
import {
  SANDBOX_COMPOSE_CONTROLS,
  createInitialSandboxCompositionModelState,
  normalizeSandboxOverrides,
  roundSandboxDegree,
  sandboxCompositionReducer,
  serializeSandboxResolveRequestBody,
  type SandboxCompositionModelState,
} from '../../src/lib/sandbox-composition-state';

type SandboxSurfaceState =
  | 'idle'
  | 'loading_base'
  | 'ready_builder'
  | 'syncing_overrides'
  | 'ready_report'
  | 'generating'
  | 'error';

function ExplainerSections({ explanation }: { explanation: unknown }) {
  const ex = explanation as { sections?: unknown } | null;
  if (!ex?.sections) return null;
  const sections = Array.isArray(ex.sections) ? ex.sections : [];
  return (
    <div className="space-y-6">
      {sections.map((sec: unknown, i: number) => {
        const s = sec as { title?: string; id?: string; text?: string; content?: string; bullets?: string[] };
        return (
          <section key={i} className="rounded-lg border border-border bg-bgElev p-4">
            <h3 className="text-lg font-semibold text-text mb-3">{s.title || s.id || `Section ${i + 1}`}</h3>
            <div className="text-subtext text-sm leading-relaxed whitespace-pre-wrap">{s.text || s.content || ''}</div>
            {s.bullets?.length ? (
              <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
                {s.bullets.map((b: string, j: number) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function slot0Birth(model: SandboxCompositionModelState): SandboxBirth | undefined {
  return model.compositionInput.slots[0]?.ephemeris_birth;
}

function slot0Overrides(model: SandboxCompositionModelState): SandboxOverrides {
  return model.compositionInput.slots[0]?.overrides ?? { planets: {} };
}

export default function SandboxPage() {
  const [compositionModel, dispatchComposition] = useReducer(sandboxCompositionReducer, createInitialSandboxCompositionModelState());
  const compositionRef = useRef(compositionModel);
  compositionRef.current = compositionModel;

  const [surfaceState, setSurfaceState] = useState<SandboxSurfaceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [constrainToHouse, setConstrainToHouse] = useState(true);
  const [showAspectLines, setShowAspectLines] = useState(true);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<{ chart?: string; report?: string; audio?: string } | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayStatus, setReplayStatus] = useState<'idle' | 'match' | 'mismatch' | 'error'>('idle');
  const [replayError, setReplayError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [exportDetailsOpen, setExportDetailsOpen] = useState(false);
  const [savedList, setSavedList] = useState<Array<{ id: string; plan_hash: string; vector_hash: string; created_at: string; export_id?: string | null }>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sandboxAudioSrc, setSandboxAudioSrc] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  /** Hydrated from persistence row when lastResolve is null (full document persistence is a later step). */
  const [persistenceHydration, setPersistenceHydration] = useState<{
    report: SandboxReport | null;
    planHash: string | null;
    combinedHash: string | null;
    exportId: string | null;
  } | null>(null);

  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const preview = compositionModel.preview;
  const lastResolve = compositionModel.lastResolve;

  const displayReport = lastResolve?.report ?? persistenceHydration?.report ?? null;
  const planHash = lastResolve?.planSha256 ?? persistenceHydration?.planHash ?? null;
  const exportId = lastResolve?.exportId ?? persistenceHydration?.exportId ?? null;
  const exportUnavailableReason = lastResolve?.exportUnavailableReason ?? null;
  const lastComposeProvider = lastResolve?.lastComposeProvider ?? null;
  const canonicalSlotOrder = lastResolve?.canonicalSlotOrder ?? null;
  const canonicalInputHash = lastResolve?.canonicalInputHash ?? null;
  const lastCombinedHashUsed =
    lastResolve?.combinedHashUsed ?? preview.snapshotMeta?.combinedHash ?? persistenceHydration?.combinedHash ?? null;

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

  const birth = slot0Birth(compositionModel);
  const overrides = slot0Overrides(compositionModel);

  const updateSnapshot = useCallback(
    async (b: SandboxBirth, ov: SandboxOverrides) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      const sequenceId = ++snapshotSequenceRef.current;
      updateTimeoutRef.current = setTimeout(async () => {
        if (sequenceId !== snapshotSequenceRef.current) return;
        setSurfaceState('syncing_overrides');
        dispatchComposition({ type: 'preview_sync_start' });
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
          const base = getApiBaseUrl();
          const res = await fetch(`${base}/api/sandbox/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ birth: b, overrides: normalizeSandboxOverrides(ov) }),
            signal: controller.signal,
          });
          if (sequenceId !== snapshotSequenceRef.current) return;
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((data?.error ?? data?.message) || `Snapshot failed: ${res.status}`);
          dispatchComposition({
            type: 'preview_sync_success',
            snapshot: data.snapshot as EphemerisSnapshot,
            meta: data.meta as SandboxSnapshotMeta,
          });
          setSurfaceState('ready_report');
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            setSurfaceState('error');
            setError(err.message);
            dispatchComposition({ type: 'preview_sync_error', message: err.message });
          }
        } finally {
          if (sequenceId === snapshotSequenceRef.current) abortControllerRef.current = null;
        }
      }, 300);
    },
    []
  );

  const handleBirthSubmit = useCallback(async (b: SandboxBirth) => {
    setSurfaceState('loading_base');
    setError(null);
    setGenerateError(null);
    setPersistenceHydration(null);
    const overridesToUse = { planets: {} };
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: b, overrides: overridesToUse }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data?.error ?? data?.message) || 'Failed to load chart');
      dispatchComposition({
        type: 'birth_first_snapshot_success',
        birth: b,
        snapshot: data.snapshot as EphemerisSnapshot,
        meta: data.meta as SandboxSnapshotMeta,
      });
      setSurfaceState('ready_builder');
    } catch (err) {
      setSurfaceState('error');
      setError(err instanceof Error ? err.message : 'Failed to load birth data');
      throw err;
    }
  }, []);

  const handleOverrideChange = useCallback(
    (planet: PlanetKey, lonDeg: number | null) => {
      const model = compositionRef.current;
      const b = slot0Birth(model);
      if (!b) return;
      const prevOverrides = slot0Overrides(model);
      const newOverrides: SandboxOverrides = { ...prevOverrides, planets: { ...prevOverrides.planets } };
      if (lonDeg === null) delete newOverrides.planets[planet];
      else newOverrides.planets[planet] = { lonDeg: roundSandboxDegree(lonDeg) };
      const normalized = normalizeSandboxOverrides(newOverrides);

      let optimistic: EphemerisSnapshot | null = null;
      const snap = model.preview.overriddenSnapshot;
      if (snap && b) {
        optimistic = {
          ...snap,
          planets: snap.planets.map((p) =>
            p.name === planet ? { ...p, lon: lonDeg !== null ? roundSandboxDegree(lonDeg) : p.lon } : p
          ),
        };
      }

      dispatchComposition({
        type: 'overrides_changed',
        overrides: normalized,
        optimisticSnapshot: optimistic ?? undefined,
      });
      if (model.preview.overriddenSnapshot && b) {
        updateSnapshot(b, normalized);
      }
    },
    [updateSnapshot]
  );

  const handleResetAllOverrides = useCallback(() => {
    if (!birth || !preview.baseSnapshot) return;
    dispatchComposition({ type: 'reset_overrides_to_base' });
    updateSnapshot(birth, { planets: {} });
    setSurfaceState('ready_builder');
  }, [birth, preview.baseSnapshot, updateSnapshot]);

  const handleResetPlanet = useCallback((planet: PlanetKey) => handleOverrideChange(planet, null), [handleOverrideChange]);

  const canGenerate = Boolean(
    birth && (preview.overriddenSnapshot || preview.baseSnapshot) && preview.snapshotMeta?.combinedHash && surfaceState !== 'syncing_overrides'
  );

  const generateDisabledReasons: string[] = [];
  if (!birth) {
    generateDisabledReasons.push('Enter birth data.');
  }
  if (!preview.baseSnapshot && !preview.overriddenSnapshot && birth) generateDisabledReasons.push('Wait for the chart snapshot to load.');
  if (!preview.snapshotMeta?.combinedHash && birth) generateDisabledReasons.push('Wait for the internal hash to compute.');
  if (surfaceState === 'syncing_overrides') generateDisabledReasons.push('Finish syncing overrides.');

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !birth) return;
    const overridesNorm = normalizeSandboxOverrides(overrides);
    setHasGenerated(true);
    setGenerateLoading(true);
    setGenerateError(null);
    setPersistenceHydration(null);
    dispatchComposition({ type: 'resolve_cleared' });
    setReplayStatus('idle');
    setReplayError(null);
    setDownloadError(null);
    setPlaybackError(null);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    const base = getApiBaseUrl();
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    snapshotSequenceRef.current++;

    try {
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth, overrides: overridesNorm }),
      });
      const snapData = await snapRes.json().catch(() => ({}));
      if (!snapRes.ok) {
        setGenerateError({ chart: (snapData?.error ?? snapData?.message) || `Snapshot: ${snapRes.status}` });
        setGenerateLoading(false);
        return;
      }
      const snapshotUsed = snapData.snapshot as EphemerisSnapshot | null;
      const combinedHashUsed = (snapData.meta && snapData.meta.combinedHash) || null;
      if (!snapshotUsed || !combinedHashUsed) {
        setGenerateError({ chart: 'Snapshot response missing snapshot or combinedHash' });
        setGenerateLoading(false);
        return;
      }

      const resolveBody = serializeSandboxResolveRequestBody(compositionRef.current, combinedHashUsed);

      const resolveRes = await fetch(`${base}/api/sandbox/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolveBody),
      });
      const resolveData = (await resolveRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!resolveRes.ok || resolveData.ok === false) {
        const msg =
          (resolveData.error as string) ||
          (resolveData.message as string) ||
          (typeof resolveData.code === 'string' ? resolveData.code : null) ||
          `Resolve: ${resolveRes.status}`;
        setGenerateError({ report: String(msg) });
        setGenerateLoading(false);
        return;
      }

      const canonicalSlotOrderNext = Array.isArray(resolveData.canonical_slot_order)
        ? (resolveData.canonical_slot_order as string[])
        : null;
      const canonicalInputHashNext =
        typeof resolveData.canonical_input_hash === 'string' ? resolveData.canonical_input_hash : null;

      const composeData = resolveData.compose as Record<string, unknown> | undefined;
      if (!composeData) {
        setGenerateError({
          audio: 'Resolve returned no compose payload (aggregate-only result not supported in this UI yet)',
        });
        setGenerateLoading(false);
        return;
      }

      const explanation = composeData.explanation as { sections?: unknown[]; spec?: string; meta?: { canonical_object_hash?: string } } | undefined;
      const sections = Array.isArray(explanation?.sections)
        ? explanation!.sections!.map((s: unknown) => {
            const x = s as { sectionId?: string; id?: string; title?: string; text?: string; bullets?: string[]; meta?: unknown };
            return {
              id: x.sectionId || x.id || '',
              title: x.title || '',
              text: x.text || '',
              bullets: x.bullets,
              meta: x.meta,
            };
          })
        : [];

      const report: SandboxReport = {
        features: [],
        personality: null as unknown as SandboxReport['personality'],
        guidance: null as unknown as SandboxReport['guidance'],
        explanation: {
          spec: explanation?.spec || 'UnifiedSpecV1.1',
          sections,
        },
        seed: ((composeData.artifacts as { provenance?: { seed?: string } } | undefined)?.provenance?.seed as string | undefined) ?? combinedHashUsed,
        meta: {
          combinedHash: combinedHashUsed,
          canonical_object_hash:
            (resolveData.canonical_object_hash as string | undefined) ?? explanation?.meta?.canonical_object_hash,
          data_classification: {
            explanation: 'semantic_projection_v1',
            features_personality_guidance: 'mechanical_support_non_authoritative',
          },
        },
      };

      const providerUsed = (composeData.audio as { provider_used?: string } | undefined)?.provider_used ?? (composeData.export_meta as { provider?: string } | undefined)?.provider ?? null;
      const exportErr = (composeData.audio as { export_error?: string | null } | undefined)?.export_error ?? null;
      const isLyriaSuccess = providerUsed === 'lyria' && (exportErr == null || exportErr === '') && composeData.export_id;

      let exportIdNext: string | null = null;
      let exportUnavailableReasonNext: { summary: string; step?: string; message?: string } | null = null;
      let lastComposeProviderNext: string | null = null;

      if (isLyriaSuccess) {
        exportIdNext = composeData.export_id as string;
        lastComposeProviderNext = providerUsed;
      } else {
        const ad = composeData.audio_debug as { step?: string; message?: string } | undefined;
        exportUnavailableReasonNext = {
          summary: exportErr ? 'Lyria export failed' : 'Export disabled or failed',
          step: ad?.step,
          message: ad?.message ?? (exportErr ? String(exportErr) : undefined),
        };
      }

      const hashes = composeData.hashes as { plan_sha256?: string } | undefined;
      const planSha256 = hashes?.plan_sha256 ?? null;
      if (!planSha256) setGenerateError((e) => ({ ...e, audio: 'Compose response missing plan_sha256' }));

      dispatchComposition({
        type: 'resolve_success',
        payload: resolveData,
        lastSubmittedResolveBody: resolveBody,
        snapshotUsed,
        combinedHashUsed,
        planSha256,
        canonicalSlotOrder: canonicalSlotOrderNext,
        canonicalInputHash: canonicalInputHashNext,
        canonicalObjectHash:
          (typeof resolveData.canonical_object_hash === 'string' ? resolveData.canonical_object_hash : null) ??
          (typeof explanation?.meta?.canonical_object_hash === 'string' ? explanation.meta.canonical_object_hash : null),
        report,
        exportId: exportIdNext,
        lastComposeProvider: lastComposeProviderNext,
        exportUnavailableReason: exportUnavailableReasonNext,
      });
    } catch (e) {
      setGenerateError({ audio: e instanceof Error ? e.message : 'Generate failed' });
    } finally {
      setGenerateLoading(false);
    }
  }, [canGenerate, birth, overrides]);

  const handleReplay = useCallback(async () => {
    const body = compositionModel.lastResolve?.lastSubmittedResolveBody;
    if (!planHash || !body) {
      setReplayError('Replay unavailable: missing last composition payload or plan hash from last generate.');
      setReplayStatus('error');
      return;
    }
    const base = getApiBaseUrl();
    setReplayLoading(true);
    setReplayError(null);
    setReplayStatus('idle');
    try {
      const resolveRes = await fetch(`${base}/api/sandbox/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resolveData = await resolveRes.json().catch(() => ({}));
      if (!resolveRes.ok || resolveData.ok === false) {
        setReplayError((resolveData.error ?? resolveData.message) || `Replay resolve: ${resolveRes.status}`);
        setReplayStatus('error');
        return;
      }
      const composeData = resolveData.compose;
      const replayPlan = composeData?.hashes?.plan_sha256 as string | undefined;
      if (!replayPlan) {
        setReplayError('Replay resolve response missing plan_sha256');
        setReplayStatus('error');
        return;
      }
      setReplayStatus(replayPlan !== planHash ? 'mismatch' : 'match');
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : 'Replay failed');
      setReplayStatus('error');
    } finally {
      setReplayLoading(false);
    }
  }, [planHash, compositionModel.lastResolve?.lastSubmittedResolveBody]);

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
      const data = await r.json().catch(() => []);
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
    birth &&
    lastCombinedHashUsed &&
    planHash &&
    displayReport != null
  );

  const handleSave = useCallback(async () => {
    if (!canSave || !birth) return;
    const base = getApiBaseUrl();
    setSaveLoading(true);
    setSaveError(null);
    try {
      const r = await fetch(`${base}/api/sandbox/compositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandbox_state: {
            birth,
            overrides: normalizeSandboxOverrides(overrides),
            controls: SANDBOX_COMPOSE_CONTROLS,
          },
          vector_hash: lastCombinedHashUsed,
          seed: lastCombinedHashUsed,
          plan_hash: planHash,
          report: {
            ...(displayReport ?? {}),
            artifact_envelope: {
              composition_mode: 'single',
              canonical_slot_order: canonicalSlotOrder,
              canonical_input_hash: canonicalInputHash,
              canonical_input_hash_version: 2,
              output_kind: 'full',
            },
          },
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
  }, [
    canSave,
    birth,
    overrides,
    lastCombinedHashUsed,
    planHash,
    displayReport,
    lastComposeProvider,
    exportId,
    fetchSavedList,
    canonicalSlotOrder,
    canonicalInputHash,
  ]);

  const handleLoad = useCallback(async (id: string) => {
    const base = getApiBaseUrl();
    try {
      const r = await fetch(`${base}/api/sandbox/compositions/${id}`);
      const comp = await r.json().catch(() => null);
      if (!r.ok || !comp) {
        setError(comp?.error ?? 'Failed to load composition');
        return;
      }
      const rowState = comp.sandbox_state || {};
      const rowBirth = rowState.birth as SandboxBirth | undefined;
      const rowOverrides = rowState.overrides || { planets: {} };
      if (!rowBirth || !rowBirth.date || !rowBirth.time) {
        setError('Invalid saved composition: missing birth data');
        return;
      }
      setPersistenceHydration({
        report: comp.report ?? null,
        planHash: comp.plan_hash ?? null,
        combinedHash: comp.seed ?? comp.vector_hash ?? null,
        exportId: comp.export_id ?? null,
      });
      setHasGenerated(true);
      setGenerateError(null);
      dispatchComposition({ type: 'load_saved_baseline', birth: rowBirth, overrides: rowOverrides });
      setSurfaceState('loading_base');
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: rowBirth, overrides: normalizeSandboxOverrides(rowOverrides) }),
      });
      const snapData = await snapRes.json().catch(() => ({}));
      if (!snapRes.ok) {
        setSurfaceState('ready_builder');
        setError((snapData?.error ?? snapData?.message) || 'Snapshot failed after load');
        return;
      }
      dispatchComposition({
        type: 'load_saved_snapshot_restored',
        snapshot: snapData.snapshot as EphemerisSnapshot,
        meta: snapData.meta as SandboxSnapshotMeta,
      });
      setSurfaceState('ready_report');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, []);

  const handleExportJson = useCallback(() => {
    const bundle = {
      birth,
      overrides: normalizeSandboxOverrides(overrides),
      controls: SANDBOX_COMPOSE_CONTROLS,
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
  }, [birth, overrides, lastCombinedHashUsed, planHash, exportId, lastComposeProvider]);

  useEffect(() => {
    if (surfaceState === 'ready_builder' || surfaceState === 'ready_report') fetchSavedList();
  }, [surfaceState, fetchSavedList]);

  const currentSnapshot = preview.overriddenSnapshot || preview.baseSnapshot;
  const basePositions: Record<string, number> = {};
  if (preview.baseSnapshot) for (const p of preview.baseSnapshot.planets) basePositions[p.name] = p.lon;
  const cusps = currentSnapshot?.houses ?? [];

  const replayNeedsSnapshot = Boolean(compositionModel.lastResolve?.snapshotUsed && lastCombinedHashUsed && planHash);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-text">Sandbox</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Composition lab: enter birth data, refine placements, then resolve once through the canonical pipeline (preview snapshot + unified resolve).
          </p>
          <p className="text-xs text-subtext/80 max-w-xl mx-auto">
            Enter birth data first, then edit planets. Canonical order for the current composition is shown after resolve.
          </p>
        </motion.div>

        {surfaceState === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-text mb-4">Enter birth data</h2>
            <BirthDataForm onSubmit={handleBirthSubmit} />
            <div className="mt-6 w-full aspect-square max-w-md mx-auto bg-bgElev border border-border rounded-2xl flex items-center justify-center">
              <p className="text-subtext text-sm">Enter birth data to see the wheel</p>
            </div>
          </motion.div>
        )}

        {surfaceState === 'loading_base' && (
          <div className="card max-w-2xl mx-auto text-center">
            <p className="text-subtext">Loading chart...</p>
          </div>
        )}

        {surfaceState === 'error' && error && (
          <div className="card max-w-2xl mx-auto">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => {
                  setSurfaceState('idle');
                  setError(null);
                  dispatchComposition({ type: 'reset_all' });
                  setPersistenceHydration(null);
                }}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {(surfaceState === 'ready_builder' || surfaceState === 'syncing_overrides' || surfaceState === 'ready_report') && currentSnapshot && (
          <details className="card mt-4">
            <summary className="cursor-pointer text-sm font-medium text-subtext hover:text-text">Phase 8H verification</summary>
            <div className="mt-3 text-xs font-mono text-subtext space-y-1">
              <p>
                <strong>Bodies:</strong> {currentSnapshot.planets?.length ?? 0} ({currentSnapshot.planets?.map((p) => p.name).join(', ') ?? '—'})
              </p>
              <p>
                <strong>Aspects:</strong> {currentSnapshot.aspects?.length ?? 0}
              </p>
              {currentSnapshot.aspects?.length ? (
                <p>
                  <strong>Sample aspect:</strong> {(currentSnapshot.aspects[0].bodyA ?? (currentSnapshot.aspects[0] as { a?: string }).a)}–
                  {(currentSnapshot.aspects[0].bodyB ?? (currentSnapshot.aspects[0] as { b?: string }).b)} {currentSnapshot.aspects[0].type} orb=
                  {currentSnapshot.aspects[0].orb}{' '}
                  {(currentSnapshot.aspects[0] as { dynamics?: string; strength?: number; exactness?: number; priorityBase?: number }).dynamics !=
                    null && (
                    <>
                      dynamics={(currentSnapshot.aspects[0] as { dynamics?: string }).dynamics} strength=
                      {(currentSnapshot.aspects[0] as { strength?: number }).strength} exactness=
                      {(currentSnapshot.aspects[0] as { exactness?: number }).exactness} priorityBase=
                      {(currentSnapshot.aspects[0] as { priorityBase?: number }).priorityBase}
                    </>
                  )}
                </p>
              ) : null}
            </div>
          </details>
        )}

        {(surfaceState === 'ready_builder' || surfaceState === 'syncing_overrides' || surfaceState === 'ready_report') && birth && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text">Wheel</h2>
                    <p className="text-sm text-subtext mt-1">Drag planets or use degree inputs. Houses are from birth chart geometry in Phase 6.</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-subtext">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={constrainToHouse} onChange={(e) => setConstrainToHouse(e.target.checked)} className="rounded" />
                      Constrain to house
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={showAspectLines} onChange={(e) => setShowAspectLines(e.target.checked)} className="rounded" />
                      Aspect lines
                    </label>
                  </div>
                  {Object.keys(overrides.planets).length > 0 && (
                    <button onClick={handleResetAllOverrides} className="px-3 py-1.5 text-sm bg-bgElev hover:bg-bgElev/80 border border-border rounded-lg text-subtext hover:text-text">
                      Reset All
                    </button>
                  )}
                </div>
                <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
                  <WheelCanvasBuilder
                    snapshot={currentSnapshot}
                    overrides={overrides}
                    onOverrideChange={(planet, lonDeg) => handleOverrideChange(planet, lonDeg)}
                    isUpdating={surfaceState === 'syncing_overrides'}
                    constrainToHouse={constrainToHouse}
                    showAspectLines={showAspectLines}
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
                      {generateLoading ? 'Generating…' : generateError?.report ? 'Failed' : displayReport ? 'OK' : 'Not run'}
                    </div>
                    <div>
                      <span className="font-semibold">Audio:</span>{' '}
                      {generateLoading ? 'Generating…' : generateError?.audio ? 'Failed' : exportId ? 'Ready' : 'Export unavailable'}
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
                {(canonicalSlotOrder?.length || canonicalInputHash) && (
                  <div className="mt-4 text-xs text-subtext font-mono space-y-1 border border-border rounded-lg p-3 bg-bgElev/50">
                    {canonicalSlotOrder && canonicalSlotOrder.length > 0 && (
                      <p>
                        <span className="text-text font-medium">Canonical order:</span> {canonicalSlotOrder.join(' → ')}
                      </p>
                    )}
                    {canonicalInputHash && (
                      <p>
                        <span className="text-text font-medium">canonical_input_hash:</span> {canonicalInputHash.slice(0, 32)}…
                      </p>
                    )}
                  </div>
                )}
                {displayReport && (
                  <div className="mt-6 space-y-4">
                    {displayReport.personality && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Personality</h3>
                        <div className="text-subtext text-sm">
                          {displayReport.personality.summary || JSON.stringify(displayReport.personality, null, 2)}
                        </div>
                      </section>
                    )}
                    {displayReport.guidance && (
                      <section className="rounded-lg border border-border bg-bgElev p-4">
                        <h3 className="text-lg font-semibold text-text mb-3">Guidance</h3>
                        <div className="text-subtext text-sm">
                          {displayReport.guidance.advice || JSON.stringify(displayReport.guidance, null, 2)}
                        </div>
                      </section>
                    )}
                    {displayReport.explanation && <ExplainerSections explanation={displayReport.explanation} />}
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
                        <audio key={exportId} ref={audioRef} src={sandboxAudioSrc ?? undefined} controls className="max-w-full w-full" />
                        {playbackError && <p className="text-xs text-red-400">{playbackError}</p>}
                        {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-subtext">
                          Audio export unavailable.
                          {exportUnavailableReason && <span className="ml-1">{exportUnavailableReason.summary}</span>}
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
                              {[exportUnavailableReason.step && `step: ${exportUnavailableReason.step}`, exportUnavailableReason.message]
                                .filter(Boolean)
                                .join('\n')}
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
                        <button onClick={handleExportJson} className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                          Export JSON
                        </button>
                        <button
                          onClick={handleReplay}
                          disabled={replayLoading || !replayNeedsSnapshot}
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
                          <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">{lastCombinedHashUsed}</code>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold">plan_sha256:</span>{' '}
                        {planHash ? (
                          <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">{planHash}</code>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold">export_id:</span>{' '}
                        {exportId ? (
                          <code className="text-[10px] bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">{exportId}</code>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                    {replayStatus === 'mismatch' && <p className="text-xs font-semibold text-red-400">Determinism mismatch</p>}
                    {replayStatus === 'match' && <p className="text-xs text-emerald-400">Replay matched plan hash.</p>}
                    {replayStatus === 'error' && replayError && <p className="text-xs text-red-400">{replayError}</p>}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <DegreePanel overrides={overrides} basePositions={basePositions} cusps={cusps.length === 12 ? cusps : undefined} onOverrideChange={handleOverrideChange} onResetPlanet={handleResetPlanet} />
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
                        <button type="button" onClick={() => handleLoad(item.id)} className="flex-shrink-0 px-2 py-1 rounded border border-border bg-bgElev hover:bg-bgElev/80 text-text">
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
