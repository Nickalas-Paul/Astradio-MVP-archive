'use client';

import { useState, useCallback, useRef, useEffect, useReducer, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthDataForm } from '../../src/components/sandbox/BirthDataForm';
import { WheelCanvasBuilder } from '../../src/components/sandbox/WheelCanvasBuilder';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import { PlanetPalette } from '../../src/components/sandbox/PlanetPalette';
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
  getActiveSlotIndexFromCompositionInput,
  getPopulatedSlotIndicesFromCompositionInput,
  compositionHasInvalidSlotWire,
  populatedSlotsAreAggregateEligible,
  slotWirePopulationKind,
  parsePersistedSandboxState,
  type SandboxCompositionModelState,
} from '../../src/lib/sandbox-composition-state';
import { projectSlotsFromCompositionInput } from '../../src/lib/sandbox-slot-projection';
import { chartApiRecordToSandboxBirthWire } from '../../src/lib/sandbox-bff-wire';

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

function activeSlotBirth(model: SandboxCompositionModelState): SandboxBirth | undefined {
  const i = getActiveSlotIndexFromCompositionInput(model.compositionInput);
  return model.compositionInput.slots[i]?.ephemeris_birth;
}

function activeSlotOverrides(model: SandboxCompositionModelState): SandboxOverrides {
  const i = getActiveSlotIndexFromCompositionInput(model.compositionInput);
  return model.compositionInput.slots[i]?.overrides ?? { planets: {} };
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
  if (body && planSha256) {
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

  const [surfaceState, setSurfaceState] = useState<SandboxSurfaceState>('ready_builder');
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
  const [paletteSelectedPlanet, setPaletteSelectedPlanet] = useState<PlanetKey | null>(null);
  const [chartIdImportInput, setChartIdImportInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Per-slot birth wire when slot uses chart_id (and optional cache for snapshot). */
  const resolvePreviewBirthBySlotRef = useRef<Map<number, SandboxBirth>>(new Map());
  const activeSlotPreviewSeqRef = useRef(0);

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

  const birth = activeSlotBirth(compositionModel);
  const overrides = activeSlotOverrides(compositionModel);

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

  /** Loads wheel preview for the current active slot without mutating slot contents (used on slot switch). */
  const syncPreviewToActiveSlot = useCallback(async () => {
    const seq = ++activeSlotPreviewSeqRef.current;
    const model = compositionRef.current;
    const input = model.compositionInput;
    const idx = getActiveSlotIndexFromCompositionInput(input);
    const slot = input.slots[idx];
    const baseUrl = getApiBaseUrl();

    const birth = slot?.ephemeris_birth;
    const cid = typeof slot?.chart_id === 'string' ? slot.chart_id.trim() : '';
    const overridesToUse = normalizeSandboxOverrides(slot?.overrides ?? { planets: {} });

    const isFullBirth =
      birth &&
      typeof birth.date === 'string' &&
      birth.date.length >= 8 &&
      typeof birth.time === 'string' &&
      birth.time.length >= 4;

    if (!isFullBirth && !cid) {
      if (seq !== activeSlotPreviewSeqRef.current) return;
      dispatchComposition({ type: 'preview_clear' });
      return;
    }

    dispatchComposition({ type: 'preview_sync_start' });

    try {
      let b: SandboxBirth;
      if (isFullBirth) {
        b = birth;
      } else {
        const chartRes = await fetch(`${baseUrl}/api/charts/${encodeURIComponent(cid)}`);
        const chartData = await chartRes.json().catch(() => ({}));
        if (!chartRes.ok) {
          if (seq !== activeSlotPreviewSeqRef.current) return;
          dispatchComposition({
            type: 'preview_sync_error',
            message: (chartData?.error ?? chartData?.message) || `Chart: ${chartRes.status}`,
          });
          return;
        }
        const wire = chartApiRecordToSandboxBirthWire(chartData);
        resolvePreviewBirthBySlotRef.current.set(idx, wire);
        b = wire;
      }

      const hasPreserved = Object.keys(overridesToUse.planets).length > 0;
      const res = await fetch(`${baseUrl}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: b, overrides: overridesToUse }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (seq !== activeSlotPreviewSeqRef.current) return;
        dispatchComposition({
          type: 'preview_sync_error',
          message: (data?.error ?? data?.message) || `Snapshot failed: ${res.status}`,
        });
        return;
      }
      const effectiveSnapshot = data.snapshot as EphemerisSnapshot;
      const meta = data.meta as SandboxSnapshotMeta;

      let baseSnapshot: EphemerisSnapshot | undefined;
      if (hasPreserved) {
        const baseRes = await fetch(`${baseUrl}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth: b, overrides: { planets: {} } }),
        });
        const baseData = await baseRes.json().catch(() => ({}));
        if (!baseRes.ok) {
          if (seq !== activeSlotPreviewSeqRef.current) return;
          dispatchComposition({
            type: 'preview_sync_error',
            message: (baseData?.error ?? baseData?.message) || 'Failed to load natal chart for preview base',
          });
          return;
        }
        baseSnapshot = baseData.snapshot as EphemerisSnapshot;
      }

      if (seq !== activeSlotPreviewSeqRef.current) return;
      if (isFullBirth) resolvePreviewBirthBySlotRef.current.set(idx, b);
      dispatchComposition({
        type: 'preview_restore',
        snapshot: effectiveSnapshot,
        meta,
        ...(baseSnapshot ? { baseSnapshot } : {}),
      });
    } catch (e) {
      if (seq !== activeSlotPreviewSeqRef.current) return;
      dispatchComposition({
        type: 'preview_sync_error',
        message: e instanceof Error ? e.message : 'Preview sync failed',
      });
    }
  }, []);

  useEffect(() => {
    void syncPreviewToActiveSlot();
  }, [compositionModel.compositionInput.active_slot_index, syncPreviewToActiveSlot]);

  const handleBirthSubmit = useCallback(async (b: SandboxBirth) => {
    setSurfaceState('loading_base');
    setError(null);
    setGenerateError(null);
    const overridesToUse = normalizeSandboxOverrides(activeSlotOverrides(compositionRef.current));
    const hasPreservedPlanetOverrides = Object.keys(overridesToUse.planets).length > 0;
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: b, overrides: overridesToUse }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data?.error ?? data?.message) || 'Failed to load chart');
      const effectiveSnapshot = data.snapshot as EphemerisSnapshot;
      const meta = data.meta as SandboxSnapshotMeta;

      let baseSnapshot: EphemerisSnapshot | undefined;
      if (hasPreservedPlanetOverrides) {
        const baseRes = await fetch(`${baseUrl}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth: b, overrides: { planets: {} } }),
        });
        const baseData = await baseRes.json().catch(() => ({}));
        if (!baseRes.ok) {
          throw new Error((baseData?.error ?? baseData?.message) || 'Failed to load natal chart for preview base');
        }
        baseSnapshot = baseData.snapshot as EphemerisSnapshot;
      }

      dispatchComposition({
        type: 'birth_first_snapshot_success',
        birth: b,
        snapshot: effectiveSnapshot,
        meta,
        ...(baseSnapshot ? { baseSnapshot } : {}),
      });
      resolvePreviewBirthBySlotRef.current.set(
        getActiveSlotIndexFromCompositionInput(compositionRef.current.compositionInput),
        b
      );
      setSurfaceState('ready_builder');
    } catch (err) {
      setSurfaceState('error');
      setError(err instanceof Error ? err.message : 'Failed to load birth data');
      throw err;
    }
  }, []);

  const handleImportChartById = useCallback(async () => {
    const rawId = chartIdImportInput.trim();
    if (!rawId) {
      setImportError('Enter a chart ID');
      return;
    }
    setImportLoading(true);
    setImportError(null);
    setGenerateError(null);
    setSurfaceState('loading_base');
    try {
      const base = getApiBaseUrl();
      const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(rawId)}`);
      const chartData = await chartRes.json().catch(() => ({}));
      if (!chartRes.ok) {
        setSurfaceState('ready_builder');
        setImportError(
          (typeof chartData?.error === 'string' && chartData.error) ||
            (typeof chartData?.message === 'string' && chartData.message) ||
            `Chart request failed (${chartRes.status})`,
        );
        return;
      }
      const chartIdCanonical = typeof chartData?.id === 'string' && chartData.id.trim() ? chartData.id.trim() : rawId;
      const wire = chartApiRecordToSandboxBirthWire(chartData);
      resolvePreviewBirthBySlotRef.current.set(
        getActiveSlotIndexFromCompositionInput(compositionRef.current.compositionInput),
        wire
      );
      const overridesToUse = normalizeSandboxOverrides(activeSlotOverrides(compositionRef.current));
      const hasPreservedPlanetOverrides = Object.keys(overridesToUse.planets).length > 0;
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: wire, overrides: overridesToUse }),
      });
      const snapData = await snapRes.json().catch(() => ({}));
      if (!snapRes.ok) {
        setSurfaceState('ready_builder');
        setImportError((snapData?.error ?? snapData?.message) || 'Snapshot failed after import');
        return;
      }
      let baseSnapshot: EphemerisSnapshot | undefined;
      if (hasPreservedPlanetOverrides) {
        const baseRes = await fetch(`${base}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ birth: wire, overrides: { planets: {} } }),
        });
        const baseD = await baseRes.json().catch(() => ({}));
        if (!baseRes.ok) {
          setSurfaceState('ready_builder');
          setImportError((baseD?.error ?? baseD?.message) || 'Natal snapshot failed for import');
          return;
        }
        baseSnapshot = baseD.snapshot as EphemerisSnapshot;
      }
      dispatchComposition({
        type: 'import_chart_id_success',
        chartId: chartIdCanonical,
        snapshot: snapData.snapshot as EphemerisSnapshot,
        meta: snapData.meta as SandboxSnapshotMeta,
        ...(baseSnapshot ? { baseSnapshot } : {}),
      });
      setChartIdImportInput('');
      setSurfaceState('ready_builder');
    } catch (e) {
      setSurfaceState('ready_builder');
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }, [chartIdImportInput]);

  const handleOverrideChange = useCallback(
    (planet: PlanetKey, lonDeg: number | null) => {
      const model = compositionRef.current;
      const idx = getActiveSlotIndexFromCompositionInput(model.compositionInput);
      const b =
        model.compositionInput.slots[idx]?.ephemeris_birth ?? resolvePreviewBirthBySlotRef.current.get(idx) ?? undefined;
      const prevOverrides = activeSlotOverrides(model);
      const newOverrides: SandboxOverrides = { ...prevOverrides, planets: { ...prevOverrides.planets } };
      if (lonDeg === null) delete newOverrides.planets[planet];
      else newOverrides.planets[planet] = { lonDeg: roundSandboxDegree(lonDeg) };
      const normalized = normalizeSandboxOverrides(newOverrides);

      let optimistic: EphemerisSnapshot | null = null;
      const snap = model.preview.overriddenSnapshot;
      if (snap && b != null) {
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
      if (model.preview.overriddenSnapshot && b != null) {
        updateSnapshot(b, normalized);
      }
    },
    [updateSnapshot]
  );

  const handleResetAllOverrides = useCallback(() => {
    const model = compositionRef.current;
    const idx = getActiveSlotIndexFromCompositionInput(model.compositionInput);
    const bReset =
      model.compositionInput.slots[idx]?.ephemeris_birth ?? resolvePreviewBirthBySlotRef.current.get(idx) ?? undefined;
    if (!bReset || !preview.baseSnapshot) return;
    dispatchComposition({ type: 'reset_overrides_to_base' });
    updateSnapshot(bReset, { planets: {} });
    setSurfaceState('ready_builder');
  }, [preview.baseSnapshot, updateSnapshot]);

  const handleResetPlanet = useCallback((planet: PlanetKey) => handleOverrideChange(planet, null), [handleOverrideChange]);

  const populatedSlotIndices = useMemo(
    () => getPopulatedSlotIndicesFromCompositionInput(compositionModel.compositionInput),
    [compositionModel.compositionInput],
  );
  const aggregateEligible = populatedSlotsAreAggregateEligible(compositionModel.compositionInput, populatedSlotIndices);
  const hasInvalidSlotWire = compositionHasInvalidSlotWire(compositionModel.compositionInput);
  const isMultiChartAggregate = populatedSlotIndices.length >= 2 && aggregateEligible;
  const hasResolveSource = Boolean(
    populatedSlotIndices.length > 0 && !hasInvalidSlotWire && (populatedSlotIndices.length >= 2 ? aggregateEligible : true),
  );
  const previewReadyForSeed = Boolean(
    (preview.overriddenSnapshot || preview.baseSnapshot) && preview.snapshotMeta?.combinedHash,
  );
  const canGenerate = Boolean(
    hasResolveSource && (isMultiChartAggregate || previewReadyForSeed) && surfaceState !== 'syncing_overrides',
  );

  const generateDisabledReasons: string[] = [];
  if (hasInvalidSlotWire) {
    generateDisabledReasons.push('A slot has both chart ID and birth data—clear one or split them so each slot is either a stored chart or ephemeris birth.');
  }
    if (!hasResolveSource && !hasInvalidSlotWire) {
      if (populatedSlotIndices.length >= 2 && !aggregateEligible) {
        generateDisabledReasons.push(
          'Two or more occupied slots must each be either a stored chart or ephemeris birth (not both, not empty).',
        );
      } else {
      generateDisabledReasons.push(
        'Add birth data or import a stored chart ID (engine GET /api/charts/:id). You can draft on the wheel first; after preview exists, overrides stay when you add birth data or import.',
      );
    }
  }
  if (hasResolveSource && !isMultiChartAggregate && !preview.baseSnapshot && !preview.overriddenSnapshot) {
    generateDisabledReasons.push('Wait for the chart preview to finish loading.');
  }
  if (hasResolveSource && !isMultiChartAggregate && !preview.snapshotMeta?.combinedHash) {
    generateDisabledReasons.push('Wait for the preview hash to finish updating after the last edit (required for resolve).');
  }
  if (surfaceState === 'syncing_overrides') {
    generateDisabledReasons.push('Wait until override edits finish syncing to the preview.');
  }

  const previewCombinedHash = preview.snapshotMeta?.combinedHash;
  const lastResolveCombinedHash = compositionModel.lastResolve?.combinedHashUsed ?? null;
  const resolveOutputStaleVsPreview = Boolean(
    !isMultiChartAggregate &&
      lastResolveCombinedHash &&
      previewCombinedHash &&
      lastResolveCombinedHash !== previewCombinedHash,
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    const modelPre = compositionRef.current;
    const input = modelPre.compositionInput;
    const populated = getPopulatedSlotIndicesFromCompositionInput(input);
    if (populated.length === 0) return;

    const base = getApiBaseUrl();
    let birthForSnap: SandboxBirth | null = null;
    let overridesNorm: SandboxOverrides;

    if (populated.length >= 2) {
      if (!populatedSlotsAreAggregateEligible(input, populated)) {
        setGenerateError({
          report:
            'Two or more occupied slots must each be either a stored chart ID or ephemeris birth (mutually exclusive per slot).',
        });
        return;
      }
      const seedIdx = populated[0];
      const seedSlot = input.slots[seedIdx];
      overridesNorm = normalizeSandboxOverrides(seedSlot?.overrides ?? { planets: {} });
      const seedKind = slotWirePopulationKind(seedSlot ?? { overrides: { planets: {} } });
      try {
        if (seedKind === 'chart_id') {
          const cid = String(seedSlot?.chart_id ?? '').trim();
          const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(cid)}`);
          const chartData = await chartRes.json().catch(() => ({}));
          if (!chartRes.ok) {
            setGenerateError({ chart: (chartData?.error ?? chartData?.message) || `Chart: ${chartRes.status}` });
            return;
          }
          birthForSnap = chartApiRecordToSandboxBirthWire(chartData);
          resolvePreviewBirthBySlotRef.current.set(seedIdx, birthForSnap);
        } else if (seedKind === 'ephemeris_birth') {
          birthForSnap =
            seedSlot?.ephemeris_birth ?? resolvePreviewBirthBySlotRef.current.get(seedIdx) ?? null;
          if (!birthForSnap) {
            setGenerateError({ chart: 'First occupied slot needs complete birth data for resolve seed snapshot.' });
            return;
          }
        } else {
          setGenerateError({ chart: 'First occupied slot is invalid for aggregate seed.' });
          return;
        }
      } catch (e) {
        setGenerateError({ chart: e instanceof Error ? e.message : 'Chart fetch failed' });
        return;
      }
    } else {
      const onlyIdx = populated[0];
      const slot = input.slots[onlyIdx];
      birthForSnap =
        slot?.ephemeris_birth ?? resolvePreviewBirthBySlotRef.current.get(onlyIdx) ?? null;
      const cid = typeof slot?.chart_id === 'string' ? slot.chart_id.trim() : '';
      if (!birthForSnap && cid) {
        try {
          const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(cid)}`);
          const chartData = await chartRes.json().catch(() => ({}));
          if (!chartRes.ok) {
            setGenerateError({ chart: (chartData?.error ?? chartData?.message) || `Chart: ${chartRes.status}` });
            return;
          }
          birthForSnap = chartApiRecordToSandboxBirthWire(chartData);
          resolvePreviewBirthBySlotRef.current.set(onlyIdx, birthForSnap);
        } catch (e) {
          setGenerateError({ chart: e instanceof Error ? e.message : 'Chart fetch failed' });
          return;
        }
      }
      if (!birthForSnap) return;
      overridesNorm = normalizeSandboxOverrides(slot?.overrides ?? { planets: {} });
    }

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
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    snapshotSequenceRef.current++;

    try {
      const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth: birthForSnap, overrides: overridesNorm }),
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
  }, [canGenerate]);

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
    setListLoading(true);
    try {
      // Same-origin only: Next proxy injects session userId for engine owner isolation (see app/api/sandbox/[...path]/route.ts).
      const r = await fetch('/api/sandbox/compositions?limit=50');
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
      const composeFr = fr?.compose as { explanation?: { meta?: { canonical_object_hash?: string } } } | undefined;
      const aggFr = fr?.aggregate as { explanation?: { meta?: { canonical_object_hash?: string } } } | undefined;
      const object_identity_hash =
        composeFr?.explanation?.meta?.canonical_object_hash ??
        aggFr?.explanation?.meta?.canonical_object_hash ??
        null;
      const composition_type: 'A' | 'A+B' | 'A+B+N' =
        composition_mode === 'overlay'
          ? 'A+B'
          : composition_mode === 'pair_aggregate' || composition_mode === 'group_aggregate'
            ? 'A+B+N'
            : 'A';
      const r = await fetch('/api/sandbox/compositions', {
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
          source: 'sandbox',
          composition_type,
          object_identity_hash,
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
    const base = getApiBaseUrl() || '';
    try {
      const r = await fetch(`/api/sandbox/compositions/${id}`);
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

      resolvePreviewBirthBySlotRef.current.clear();

      setHasGenerated(true);
      setGenerateError(null);
      setSurfaceState('loading_base');

      const input = parsed.compositionInput;
      for (const i of getPopulatedSlotIndicesFromCompositionInput(input)) {
        const cid = typeof input.slots[i]?.chart_id === 'string' ? input.slots[i].chart_id.trim() : '';
        if (!cid) continue;
        try {
          const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(cid)}`);
          const chartData = await chartRes.json().catch(() => ({}));
          if (chartRes.ok) {
            resolvePreviewBirthBySlotRef.current.set(i, chartApiRecordToSandboxBirthWire(chartData));
          }
        } catch {
          /* best-effort: Generate can refetch if needed */
        }
      }

      const activeIdx = getActiveSlotIndexFromCompositionInput(input);
      const activeSlot = input.slots[activeIdx];

      function ephemFromSlot(s: (typeof input.slots)[number] | undefined) {
        const b = s?.ephemeris_birth;
        if (
          b &&
          typeof b.date === 'string' &&
          b.date.length >= 8 &&
          typeof b.time === 'string' &&
          b.time.length >= 4
        ) {
          return { birth: b, overrides: normalizeSandboxOverrides(s?.overrides ?? { planets: {} }) };
        }
        return null;
      }

      const ephem = ephemFromSlot(activeSlot);
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
        const cidLoad = typeof activeSlot?.chart_id === 'string' ? activeSlot.chart_id.trim() : '';
        if (cidLoad) {
          const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(cidLoad)}`);
          const chartData = await chartRes.json().catch(() => ({}));
          if (!chartRes.ok) {
            setSurfaceState('ready_builder');
            setError((chartData?.error ?? chartData?.message) || 'Chart not found for saved composition');
            return;
          }
          const wire = chartApiRecordToSandboxBirthWire(chartData);
          resolvePreviewBirthBySlotRef.current.set(activeIdx, wire);
          const ovLoad = normalizeSandboxOverrides(activeSlot?.overrides ?? { planets: {} });
          const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ birth: wire, overrides: ovLoad }),
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
      }
      setSurfaceState('ready_report');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  }, []);

  const handleExportJson = useCallback(() => {
    const lr = compositionModel.lastResolve;
    const bundle = {
      composition_input: compositionModel.compositionInput,
      combinedHashUsed: lastCombinedHashUsed ?? null,
      plan_sha256: planHash ?? null,
      export_id: exportId ?? null,
      provider: lastComposeProvider ?? null,
      createdAt: new Date().toISOString(),
      ...(lr?.source === 'live_resolve'
        ? {
            last_submitted_resolve_body: lr.lastSubmittedResolveBody,
            full_resolve_response:
              lr.fullResponse && Object.keys(lr.fullResponse).length > 0 ? lr.fullResponse : undefined,
          }
        : {}),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `astradio-sandbox-${lastCombinedHashUsed?.slice(0, 8) ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [compositionModel.compositionInput, compositionModel.lastResolve, lastCombinedHashUsed, planHash, exportId, lastComposeProvider]);

  useEffect(() => {
    if (
      surfaceState === 'ready_builder' ||
      surfaceState === 'ready_report' ||
      surfaceState === 'idle'
    ) {
      fetchSavedList();
    }
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

  const showComposerSurface =
    surfaceState === 'ready_builder' ||
    surfaceState === 'syncing_overrides' ||
    surfaceState === 'ready_report' ||
    surfaceState === 'idle';

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-text">Sandbox</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Composition workspace: build the chart on the wheel and degree panel, add birth data when you need natal houses and ephemeris for resolve, then{' '}
            <span className="text-text font-medium">Generate</span> to run the canonical pipeline for what you see.
          </p>
          <p className="text-xs text-subtext/80 max-w-xl mx-auto">
            Manual placement is the override layer. Canonical slot order for the composition is shown after resolve—not a substitute for the live wheel.
          </p>
        </motion.div>

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
                  setSurfaceState('ready_builder');
                  setError(null);
                  resolvePreviewBirthBySlotRef.current.clear();
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
            <summary className="cursor-pointer text-sm font-medium text-subtext hover:text-text">Snapshot verification</summary>
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

        {showComposerSurface && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <p className="text-sm font-semibold text-text mb-2">
                  Slots: <span className="font-normal text-subtext">{compositionModel.compositionInput.slots.length}</span> · active:{' '}
                  <span className="font-mono text-text">{compositionModel.compositionInput.active_slot_index}</span>
                </p>
                <button
                  type="button"
                  onClick={() => dispatchComposition({ type: 'add_slot' })}
                  className="mb-3 px-2 py-1 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text"
                >
                  Add slot
                </button>
                <div className="flex flex-wrap gap-2">
                  {slotProjectionRows.map((row) => {
                    const active = row.index === compositionModel.compositionInput.active_slot_index;
                    const nSlots = compositionModel.compositionInput.slots.length;
                    return (
                      <div
                        key={row.index}
                        className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 text-xs max-w-full ${
                          active ? 'border-primary bg-primary/10' : 'border-border bg-bgElev/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => dispatchComposition({ type: 'set_active_slot', index: row.index })}
                          className="text-left min-w-0 flex-1"
                        >
                          <span className="font-mono text-subtext">#{row.index}</span>{' '}
                          <span className="text-text capitalize">{row.kind}</span>
                          <span className="text-subtext"> · {row.summary}</span>
                        </button>
                        <button
                          type="button"
                          disabled={nSlots <= 1}
                          onClick={() => {
                            activeSlotPreviewSeqRef.current += 1;
                            resolvePreviewBirthBySlotRef.current.clear();
                            dispatchComposition({ type: 'remove_slot', index: row.index });
                          }}
                          className="shrink-0 px-1.5 py-0.5 rounded border border-border/80 bg-bgElev/80 hover:bg-bgElev disabled:opacity-40 text-subtext text-[10px]"
                          title="Remove slot"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            resolvePreviewBirthBySlotRef.current.delete(row.index);
                            dispatchComposition({ type: 'clear_slot', index: row.index });
                            if (row.index === compositionModel.compositionInput.active_slot_index) {
                              void syncPreviewToActiveSlot();
                            }
                          }}
                          className="shrink-0 px-1.5 py-0.5 rounded border border-border/80 bg-bgElev/80 hover:bg-bgElev text-subtext text-[10px]"
                          title="Clear slot"
                        >
                          Clear
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-subtext mt-3">Composition slots and resolve payload stay in sync; the wheel follows the active slot.</p>
                <div className="mt-4 pt-3 border-t border-border/60">
                  <p className="text-xs font-medium text-text mb-1">Import chart by ID</p>
                  <p className="text-xs text-subtext mb-2">
                    Uses the same stored chart as community compatibility (<code className="text-[10px]">GET /api/charts/:id</code>). The{' '}
                    <span className="font-medium text-text">active</span> slot stores <span className="font-medium text-text">chart_id</span> for resolve;
                    preview uses the same snapshot route as birth entry.
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      value={chartIdImportInput}
                      onChange={(e) => {
                        setChartIdImportInput(e.target.value);
                        if (importError) setImportError(null);
                      }}
                      placeholder="Chart id"
                      disabled={importLoading}
                      className="min-w-[12rem] flex-1 px-2 py-1.5 text-xs rounded-lg border border-border bg-bgElev text-text font-mono"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => void handleImportChartById()}
                      disabled={importLoading}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 disabled:opacity-50 text-text"
                    >
                      {importLoading ? 'Importing…' : 'Import'}
                    </button>
                  </div>
                  {importError ? <p className="text-xs text-red-400 mt-2">{importError}</p> : null}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text">Wheel</h2>
                    <p className="text-sm text-subtext mt-1">
                      Drag planets or use degree inputs. Without birth data, the wheel uses a neutral layout; after birth, house cusps follow the natal chart.
                    </p>
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
                <div className="mb-4">
                  <PlanetPalette
                    overrides={overrides}
                    selectedPlanet={paletteSelectedPlanet}
                    onSelectPlanet={setPaletteSelectedPlanet}
                  />
                </div>
                <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
                  <WheelCanvasBuilder
                    snapshot={currentSnapshot}
                    overrides={overrides}
                    onOverrideChange={(planet, lonDeg) => handleOverrideChange(planet, lonDeg)}
                    isUpdating={surfaceState === 'syncing_overrides'}
                    constrainToHouse={constrainToHouse}
                    showAspectLines={showAspectLines}
                    selectedPlanetForPlacement={paletteSelectedPlanet}
                  />
                </div>
              </div>

              {!birth && (
                <div className="card max-w-2xl">
                  <h2 className="text-xl font-semibold text-text mb-1">Birth data</h2>
                  <p className="text-sm text-subtext mb-4">
                    Needed before resolve: natal geometry, ephemeris, and preview hash. Optional order—you can place planets first; manual placements stay
                    when you submit this form.
                  </p>
                  <BirthDataForm onSubmit={handleBirthSubmit} />
                </div>
              )}

              <div className="card">
                <h2 className="text-xl font-semibold text-text mb-1">Resolve composition</h2>
                <p className="text-xs text-subtext mb-2">
                  <span className="font-medium text-text">Generate</span> runs unified resolve using every{' '}
                  <span className="font-medium text-text">occupied</span> slot in <span className="font-medium text-text">ascending slot index order</span>{' '}
                  (empty rows are ignored). Each slot may be a stored <span className="font-medium text-text">chart_id</span> or{' '}
                  <span className="font-medium text-text">ephemeris_birth</span>, with per-slot overrides applied for resolve. One slot → single compose; two
                  occupied slots → pair aggregate; three or more → group aggregate. The wheel preview still follows the active slot only.
                </p>
                {populatedSlotIndices.length > 0 ? (
                  <p className="text-xs text-subtext mb-4 font-mono">
                    Membership: {populatedSlotIndices.length} occupied (indices {populatedSlotIndices.join(', ')})
                    {isMultiChartAggregate ? ' · seed snapshot uses first occupied slot only; all slots participate in resolve' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-subtext mb-4">No occupied slots yet—add birth or import per slot above.</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate || generateLoading}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generateLoading ? 'Resolving…' : 'Generate from current composition'}
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
                    <p className="mb-1 text-text font-medium">Resolve unavailable until:</p>
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
                      From the last successful resolve. If you edited the wheel afterward, use <span className="font-medium text-text">Generate from current composition</span>{' '}
                      above—do not rely on this block as the live composition.
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
                  <details className="mt-6 border-t border-border/60 pt-4 text-xs text-subtext space-y-3 group">
                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 text-subtext hover:text-text [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold text-text">Provenance &amp; debug replay</span>
                      <span className="text-[10px] uppercase tracking-wide text-subtext/90 group-open:hidden">Show secondary tools</span>
                      <span className="text-[10px] uppercase tracking-wide text-subtext/90 hidden group-open:inline">Hide</span>
                    </summary>
                    <p className="mt-2 text-xs text-subtext">
                      Secondary only: export the last bundle or replay the <span className="font-medium text-text">exact JSON</span> from the previous resolve. This is not a second
                      Generate and does <span className="font-medium text-text">not</span> use your current wheel—use{' '}
                      <span className="font-medium text-text">Generate from current composition</span> for that.
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <button onClick={handleExportJson} className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
                        Export JSON
                      </button>
                      <button
                        onClick={handleReplay}
                        disabled={replayLoading || !replayNeedsSnapshot}
                        className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-border/80 bg-bgElev/60 hover:bg-bgElev/80 disabled:opacity-50 disabled:cursor-not-allowed text-subtext"
                      >
                        {replayLoading ? 'Replaying…' : 'Replay last resolve payload'}
                      </button>
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
                  </details>
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
