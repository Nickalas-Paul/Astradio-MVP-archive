'use client';

import { useState, useCallback, useRef, useEffect, useReducer, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthDataForm } from '../../src/components/sandbox/BirthDataForm';
import { WheelCanvasBuilder } from '../../src/components/sandbox/WheelCanvasBuilder';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import type {
  SandboxBirth,
  SandboxOverrides,
  PlanetKey,
  EphemerisSnapshot,
  SandboxReport,
  SandboxSnapshotMeta,
  SandboxResolvedSession,
} from '../../src/types/sandbox';
import { getApiBaseUrl } from '../../src/core/api-base';
import { getPlayableLyriaUrl } from '../../src/core/audio/lyria-playback';
import {
  SANDBOX_COMPOSE_CONTROLS,
  createInitialSandboxCompositionModelState,
  normalizeSandboxOverrides,
  roundSandboxDegree,
  sandboxCompositionReducer,
  serializeSandboxResolveRequestBody,
  firstEphemerisBirthForSnapshot,
  parsePersistedSandboxState,
  type SandboxCompositionModelState,
} from '../../src/lib/sandbox-composition-state';
import { projectSlotsFromCompositionInput } from '../../src/lib/sandbox-slot-projection';

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

function buildLastResolveFromLoadedRow(
  comp: Record<string, unknown>,
  parsed: ReturnType<typeof parsePersistedSandboxState>,
  snapshot: EphemerisSnapshot | null
): SandboxResolvedSession | null {
  const report = (comp.report ?? null) as SandboxReport | null;
  const planSha256 = typeof comp.plan_hash === 'string' ? comp.plan_hash : null;
  const exportId = typeof comp.export_id === 'string' ? comp.export_id : null;
  const combinedHashUsed =
    typeof comp.seed === 'string' ? comp.seed : typeof comp.vector_hash === 'string' ? comp.vector_hash : null;

  const body = parsed.lastSubmittedResolveBody;
  if (body && planSha256 && snapshot) {
    const full =
      parsed.fullResolveResponse && Object.keys(parsed.fullResolveResponse).length > 0
        ? parsed.fullResolveResponse
        : ({} as Record<string, unknown>);
    const env =
      report && typeof report === 'object' && 'artifact_envelope' in report
        ? (report as SandboxReport & { artifact_envelope?: Record<string, unknown> }).artifact_envelope
        : undefined;
    const canonicalSlotOrder = Array.isArray(full.canonical_slot_order)
      ? (full.canonical_slot_order as string[])
      : env && Array.isArray(env.canonical_slot_order)
        ? (env.canonical_slot_order as string[])
        : null;
    const canonicalInputHash =
      typeof full.canonical_input_hash === 'string'
        ? full.canonical_input_hash
        : env && typeof env.canonical_input_hash === 'string'
          ? env.canonical_input_hash
          : null;
    const canonicalObjectHash =
      report?.meta?.canonical_object_hash ??
      (typeof full.canonical_object_hash === 'string' ? full.canonical_object_hash : null) ??
      null;

    const safeReport =
      report ??
      ({
        features: [],
        personality: null as unknown as SandboxReport['personality'],
        guidance: null as unknown as SandboxReport['guidance'],
        explanation: { spec: 'UnifiedSpecV1.1', sections: [] },
        seed: combinedHashUsed ?? '',
        meta: { combinedHash: combinedHashUsed ?? '' },
      } as SandboxReport);

    return {
      source: 'live_resolve',
      fullResponse: full,
      lastSubmittedResolveBody: body,
      snapshotUsed: snapshot,
      combinedHashUsed: combinedHashUsed ?? '',
      planSha256,
      canonicalSlotOrder,
      canonicalInputHash,
      canonicalObjectHash,
      report: safeReport,
      exportId,
      lastComposeProvider: null,
      exportUnavailableReason: exportId ? null : { summary: 'Export unavailable' },
    };
  }

  if (!report && !planSha256) return null;

  return {
    source: 'loaded_row',
    report,
    planSha256,
    exportId,
    combinedHashUsed,
    lastSubmittedResolveBody: null,
  };
}

/** Thin extraction only: one of compose | aggregate per response, never mixed. */
function extractSandboxResolvePayload(resolveData: Record<string, unknown>): {
  explanation: unknown;
  planSha256: string;
  exportId: string | null;
  exportAvailable: boolean;
} | null {
  const compose = resolveData.compose;
  const aggregate = resolveData.aggregate;
  const source =
    compose && typeof compose === 'object'
      ? (compose as Record<string, unknown>)
      : aggregate && typeof aggregate === 'object'
        ? (aggregate as Record<string, unknown>)
        : null;
  if (!source) return null;
  const explanation = source.explanation;
  const hashes = source.hashes as { plan_sha256?: string } | undefined;
  const planSha256 = hashes?.plan_sha256;
  const exportIdRaw = source.export_id;
  const exportId = typeof exportIdRaw === 'string' && exportIdRaw.length > 0 ? exportIdRaw : null;
  const exportAvailable = exportId != null;
  if (!explanation || typeof explanation !== 'object' || !planSha256 || typeof planSha256 !== 'string' || !planSha256.trim()) {
    return null;
  }
  return { explanation, planSha256, exportId, exportAvailable };
}

function extractPlanSha256FromResolveResponse(resolveData: Record<string, unknown>): string | undefined {
  const compose = resolveData.compose;
  if (compose && typeof compose === 'object') {
    const h = (compose as Record<string, unknown>).hashes as { plan_sha256?: string } | undefined;
    if (typeof h?.plan_sha256 === 'string' && h.plan_sha256.trim()) return h.plan_sha256;
  }
  const aggregate = resolveData.aggregate;
  if (aggregate && typeof aggregate === 'object') {
    const h = (aggregate as Record<string, unknown>).hashes as { plan_sha256?: string } | undefined;
    if (typeof h?.plan_sha256 === 'string' && h.plan_sha256.trim()) return h.plan_sha256;
  }
  return undefined;
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

  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const preview = compositionModel.preview;
  const lastResolve = compositionModel.lastResolve;

  const displayReport = lastResolve?.report ?? null;
  const planHash = lastResolve?.planSha256 ?? null;
  const exportId = lastResolve?.exportId ?? null;
  const exportUnavailableReason = lastResolve?.source === 'live_resolve' ? lastResolve.exportUnavailableReason : null;
  const lastComposeProvider = lastResolve?.source === 'live_resolve' ? lastResolve.lastComposeProvider : null;
  const canonicalSlotOrder = lastResolve?.source === 'live_resolve' ? lastResolve.canonicalSlotOrder : null;
  const canonicalInputHash = lastResolve?.source === 'live_resolve' ? lastResolve.canonicalInputHash : null;
  const lastCombinedHashUsed = lastResolve?.combinedHashUsed ?? preview.snapshotMeta?.combinedHash ?? null;

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

  const slotProjectionRows = useMemo(
    () => projectSlotsFromCompositionInput(compositionModel.compositionInput),
    [compositionModel.compositionInput],
  );

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
    generateDisabledReasons.push('Add birth data (date, time, and place) first.');
  }
  if (!preview.baseSnapshot && !preview.overriddenSnapshot && birth) {
    generateDisabledReasons.push('Wait for the chart preview to finish loading.');
  }
  if (!preview.snapshotMeta?.combinedHash && birth) {
    generateDisabledReasons.push('Wait for the preview hash to finish updating (required before generate).');
  }
  if (surfaceState === 'syncing_overrides') {
    generateDisabledReasons.push('Wait until override edits finish syncing to the preview.');
  }

  const previewCombinedHash = preview.snapshotMeta?.combinedHash;
  const lastResolveCombinedHash = compositionModel.lastResolve?.combinedHashUsed ?? null;
  const resolveOutputStaleVsPreview = Boolean(
    lastResolveCombinedHash && previewCombinedHash && lastResolveCombinedHash !== previewCombinedHash
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !birth) return;
    const overridesNorm = normalizeSandboxOverrides(overrides);
    setHasGenerated(true);
    setGenerateLoading(true);
    setGenerateError(null);
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

      const resolved = extractSandboxResolvePayload(resolveData);
      if (!resolved) {
        setGenerateError({
          report: 'Resolve response missing a valid compose or aggregate payload with explainer and plan hash.',
        });
        setGenerateLoading(false);
        return;
      }

      const explanationForSections = resolved.explanation as {
        sections?: unknown[];
        spec?: string;
        meta?: { canonical_object_hash?: string };
      };
      const sections = Array.isArray(explanationForSections?.sections)
        ? explanationForSections.sections!.map((s: unknown) => {
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
          spec: explanationForSections?.spec || 'UnifiedSpecV1.1',
          sections,
        },
        seed: combinedHashUsed,
        meta: {
          combinedHash: combinedHashUsed,
          canonical_object_hash:
            (resolveData.canonical_object_hash as string | undefined) ?? explanationForSections?.meta?.canonical_object_hash,
          data_classification: {
            explanation: 'semantic_projection_v1',
            features_personality_guidance: 'mechanical_support_non_authoritative',
          },
        },
      };

      const exportIdNext = resolved.exportId;
      const exportUnavailableReasonNext: { summary: string; step?: string; message?: string } | null = resolved.exportAvailable
        ? null
        : { summary: 'Export unavailable' };
      const lastComposeProviderNext: string | null = null;

      const planSha256 = resolved.planSha256;

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
          (typeof explanationForSections?.meta?.canonical_object_hash === 'string'
            ? explanationForSections.meta.canonical_object_hash
            : null),
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
    const lr = compositionModel.lastResolve;
    const body = lr?.source === 'live_resolve' ? lr.lastSubmittedResolveBody : null;
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
      const replayPlan = extractPlanSha256FromResolveResponse(resolveData as Record<string, unknown>);
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
  }, [planHash, compositionModel.lastResolve]);

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

  const canSave = Boolean(hasGenerated && lastCombinedHashUsed && planHash && displayReport != null);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const base = getApiBaseUrl();
    setSaveLoading(true);
    setSaveError(null);
    try {
      const lr = compositionModel.lastResolve;
      const fr =
        lr?.source === 'live_resolve' && lr.fullResponse && typeof lr.fullResponse === 'object'
          ? (lr.fullResponse as Record<string, unknown>)
          : null;
      const loadedEnv = (displayReport as (SandboxReport & { artifact_envelope?: Record<string, unknown> }) | null)?.artifact_envelope;
      const composition_mode =
        (typeof fr?.composition_mode === 'string' && fr.composition_mode) ||
        (typeof loadedEnv?.composition_mode === 'string' && loadedEnv.composition_mode) ||
        'single';
      const artifact_envelope = {
        composition_mode,
        canonical_slot_order:
          (Array.isArray(fr?.canonical_slot_order) ? fr.canonical_slot_order : canonicalSlotOrder) ??
          (Array.isArray(loadedEnv?.canonical_slot_order) ? loadedEnv.canonical_slot_order : null),
        canonical_input_hash:
          (typeof fr?.canonical_input_hash === 'string' ? fr.canonical_input_hash : canonicalInputHash) ??
          (typeof loadedEnv?.canonical_input_hash === 'string' ? loadedEnv.canonical_input_hash : null),
        canonical_input_hash_version:
          typeof fr?.canonical_input_hash_version === 'number' ? fr.canonical_input_hash_version : 2,
        output_kind:
          (typeof fr?.output_kind === 'string' ? fr.output_kind : compositionModel.compositionInput.output_kind) ?? 'full',
      };
      const r = await fetch(`${base}/api/sandbox/compositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandbox_state: {
            composition_input: compositionModel.compositionInput,
            last_submitted_resolve_body:
              lr?.source === 'live_resolve' && lr.lastSubmittedResolveBody ? lr.lastSubmittedResolveBody : null,
            full_resolve_response: lr?.source === 'live_resolve' ? lr.fullResponse : null,
          },
          vector_hash: lastCombinedHashUsed,
          seed: lastCombinedHashUsed,
          plan_hash: planHash,
          report: {
            ...(displayReport ?? {}),
            artifact_envelope,
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
    compositionModel.compositionInput,
    compositionModel.lastResolve,
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
      const compRec = comp as Record<string, unknown>;
      const rowState = compRec.sandbox_state;
      const parsed = parsePersistedSandboxState(rowState);
      const hasNewComposition =
        rowState && typeof rowState === 'object' && 'composition_input' in (rowState as object);
      if (!hasNewComposition) {
        const slot0 = parsed.compositionInput.slots[0];
        const b = slot0?.ephemeris_birth;
        if (!b || !b.date || !b.time) {
          setError('Invalid saved composition: missing birth data');
          return;
        }
      }

      setHasGenerated(true);
      setGenerateError(null);
      setSurfaceState('loading_base');

      const ephem = firstEphemerisBirthForSnapshot(parsed.compositionInput);
      if (ephem) {
        const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth: ephem.birth, overrides: ephem.overrides }),
        });
        const snapData = await snapRes.json().catch(() => ({}));
        if (!snapRes.ok) {
          setSurfaceState('ready_builder');
          setError((snapData?.error ?? snapData?.message) || 'Snapshot failed after load');
          return;
        }
        const snapshot = snapData.snapshot as EphemerisSnapshot;
        const meta = snapData.meta as SandboxSnapshotMeta;
        const lastResolve = buildLastResolveFromLoadedRow(compRec, parsed, snapshot);
        dispatchComposition({
          type: 'hydrate_from_persistence',
          compositionInput: parsed.compositionInput,
          preview: {
            epoch: 0,
            syncStatus: 'idle',
            baseSnapshot: snapshot,
            overriddenSnapshot: snapshot,
            snapshotMeta: meta,
            error: null,
          },
          lastResolve,
        });
      } else {
        const lastResolve = buildLastResolveFromLoadedRow(compRec, parsed, null);
        dispatchComposition({
          type: 'hydrate_from_persistence',
          compositionInput: parsed.compositionInput,
          preview: {
            epoch: 0,
            syncStatus: 'idle',
            baseSnapshot: null,
            overriddenSnapshot: null,
            snapshotMeta: null,
            error: null,
          },
          lastResolve,
        });
      }
      setSurfaceState('ready_report');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, []);

  const handleExportJson = useCallback(() => {
    const bundle = {
      composition_input: compositionModel.compositionInput,
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
  }, [compositionModel.compositionInput, lastCombinedHashUsed, planHash, exportId, lastComposeProvider]);

  useEffect(() => {
    if (surfaceState === 'ready_builder' || surfaceState === 'ready_report') fetchSavedList();
  }, [surfaceState, fetchSavedList]);

  const currentSnapshot = preview.overriddenSnapshot || preview.baseSnapshot;
  const basePositions: Record<string, number> = {};
  if (preview.baseSnapshot) for (const p of preview.baseSnapshot.planets) basePositions[p.name] = p.lon;
  const cusps = currentSnapshot?.houses ?? [];

  const replayNeedsSnapshot = Boolean(
    compositionModel.lastResolve?.source === 'live_resolve' &&
      compositionModel.lastResolve.lastSubmittedResolveBody &&
      compositionModel.lastResolve.planSha256
  );

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
                <p className="text-sm font-semibold text-text mb-3">
                  Slots: <span className="font-normal text-subtext">{compositionModel.compositionInput.slots.length}</span> · active:{' '}
                  <span className="font-mono text-text">{compositionModel.compositionInput.active_slot_index}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {slotProjectionRows.map((row) => {
                    const active = row.index === compositionModel.compositionInput.active_slot_index;
                    return (
                      <div
                        key={row.index}
                        className={`rounded-lg border px-2 py-1.5 text-xs ${
                          active ? 'border-primary bg-primary/10' : 'border-border bg-bgElev/50'
                        }`}
                      >
                        <span className="font-mono text-subtext">#{row.index}</span>{' '}
                        <span className="text-text capitalize">{row.kind}</span>
                        <span className="text-subtext"> · {row.summary}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-subtext mt-3">These slots match what resolve uses for the current composition.</p>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text">Wheel</h2>
                    <p className="text-sm text-subtext mt-1">Drag planets or use degree inputs. Houses are from birth chart geometry in Phase 6.</p>
                    <p className="text-xs text-subtext mt-1">
                      Ephemeris preview for active slot {compositionModel.compositionInput.active_slot_index}—positions here are not the resolved
                      report or audio output.
                    </p>
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
                <h2 className="text-xl font-semibold text-text mb-2">Generate</h2>
                <p className="text-xs text-subtext mb-4">
                  Resolve uses your current composition (slots and controls) and a hash seed from the chart preview; Generate refreshes the preview,
                  then runs resolve.
                </p>
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
                {hasGenerated && (
                  <div className="mt-6 space-y-1">
                    <p className="text-xs text-subtext font-medium text-text">Last generated (report / audio)</p>
                    <p className="text-xs text-subtext">
                      From the last successful resolve. If you changed the chart after that, this section may be out of step with the wheel
                      until you generate again.
                    </p>
                    {resolveOutputStaleVsPreview && (
                      <p className="text-xs text-amber-500/90">Output does not reflect current preview.</p>
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
                            Restart
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
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <button onClick={handleExportJson} className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                          Export JSON
                        </button>
                        <button
                          onClick={handleReplay}
                          disabled={replayLoading || !replayNeedsSnapshot}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 disabled:opacity-50 disabled:cursor-not-allowed text-text"
                        >
                          {replayLoading ? 'Re-running…' : 'Re-run last resolve'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-subtext">
                      Re-run sends the previous resolve request again—not your current edits. Use Generate to resolve what you see now.
                    </p>
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
