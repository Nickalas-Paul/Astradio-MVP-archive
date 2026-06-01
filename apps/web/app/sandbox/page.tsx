'use client';

import { useState, useCallback, useRef, useEffect, useReducer, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { BirthDataForm } from '../../src/components/sandbox/BirthDataForm';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import { SandboxReportSections } from '../../src/components/sandbox/SandboxReportSections';
import { SandboxSavedCompositions } from '../../src/components/sandbox/SandboxSavedCompositions';
import { SandboxWheelPanel } from '../../src/components/sandbox/SandboxWheelPanel';
import { SandboxSlotComposer } from '../../src/components/sandbox/SandboxSlotComposer';
import { SandboxResolvePanel } from '../../src/components/sandbox/SandboxResolvePanel';
import { SandboxAudioPanel } from '../../src/components/sandbox/SandboxAudioPanel';
import { SandboxProvenancePanel } from '../../src/components/sandbox/SandboxProvenancePanel';
import {
  activeSlotBirth,
  activeSlotOverrides,
  buildLastResolveFromLoadedRow,
  extractSandboxResolvePayload,
  extractPlanSha256FromResolveResponse,
} from './page-helpers';
import type {
  SandboxBirth,
  SandboxOverrides,
  PlanetKey,
  EphemerisSnapshot,
  SandboxReport,
  SandboxSnapshotMeta,
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
  compositionHasIncompleteBirthSlot,
  populatedSlotsAreAggregateEligible,
  slotWirePopulationKind,
  parsePersistedSandboxState,
} from '../../src/lib/sandbox-composition-state';
import { projectSlotsFromCompositionInput } from '../../src/lib/sandbox-slot-projection';
import { equalHouseCuspsFromAscendant } from '../../src/lib/equal-house-cusps';
import { chartApiOwnerDisplayLabel, chartApiRecordToSandboxBirthWire } from '../../src/lib/sandbox-bff-wire';
import {
  fingerprintCompositionInputExcludingSeed,
  fingerprintResolveBodyExcludingSeed,
} from '../../src/lib/sandbox-resolve-fingerprint';
import { classifySandboxPersistedState } from '../../src/lib/sandbox-persisted-classify';
import {
  trimResolveResponseForPersistence,
  filterSandboxSavedRows,
  loadTerminalSurfaceState,
} from '../../src/lib/sandbox-persisted-trim';

type SandboxSurfaceState =
  | 'idle'
  | 'loading_base'
  | 'ready_builder'
  | 'syncing_overrides'
  | 'ready_report'
  | 'generating'
  | 'error';

export default function SandboxPage() {
  const [compositionModel, dispatchComposition] = useReducer(sandboxCompositionReducer, createInitialSandboxCompositionModelState());
  const compositionRef = useRef(compositionModel);
  compositionRef.current = compositionModel;

  const [surfaceState, setSurfaceState] = useState<SandboxSurfaceState>('ready_builder');
  const [error, setError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<{ chart?: string; report?: string; audio?: string } | null>(null);
  const [savedList, setSavedList] = useState<Array<{ id: string; plan_hash: string; vector_hash: string; created_at: string; export_id?: string | null; source?: string | null }>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [sandboxAudioSrc, setSandboxAudioSrc] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  /** Last successful Generate: which slot supplied the preflight snapshot seed (first populated index). */
  const [lastResolveSeedSlotIndex, setLastResolveSeedSlotIndex] = useState<number | null>(null);
  /** Combined hash from that snapshot (matches POST body `seed`). */
  const [lastResolveSeedCombinedHash, setLastResolveSeedCombinedHash] = useState<string | null>(null);
  /** Fingerprint of resolve input (excluding seed) when seed display was valid — cleared when composition diverges. */
  const [compositionFingerprintAtLastSeed, setCompositionFingerprintAtLastSeed] = useState<string | null>(null);

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

    const popKind = slot ? slotWirePopulationKind(slot) : 'empty';
    const isResolvableBirth = popKind === 'ephemeris_birth';
    const isChartSlot = popKind === 'chart_id';

    if (!isResolvableBirth && !isChartSlot) {
      if (seq !== activeSlotPreviewSeqRef.current) return;
      dispatchComposition({ type: 'preview_clear' });
      return;
    }

    dispatchComposition({ type: 'preview_sync_start' });

    try {
      let b: SandboxBirth;
      if (isResolvableBirth && birth) {
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
        const msg = (data?.error ?? data?.message) || `Snapshot failed: ${res.status}`;
        if (res.status === 422) {
          setSurfaceState('error');
          setError(String(msg));
        }
        dispatchComposition({
          type: 'preview_sync_error',
          message: String(msg),
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
      if (isResolvableBirth) resolvePreviewBirthBySlotRef.current.set(idx, b);
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

  const handleImportChartById = useCallback(async (rawId: string) => {
    const trimmed = rawId.trim();
    if (!trimmed) {
      throw new Error('Search for a chart and pick a result, or paste a chart ID');
    }
    setGenerateError(null);
    setSurfaceState('loading_base');
    try {
      const base = getApiBaseUrl();
      const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(trimmed)}`);
      const chartData = await chartRes.json().catch(() => ({}));
      if (!chartRes.ok) {
        setSurfaceState('ready_builder');
        throw new Error(
          (typeof chartData?.error === 'string' && chartData.error) ||
            (typeof chartData?.message === 'string' && chartData.message) ||
            `Chart request failed (${chartRes.status})`,
        );
      }
      const chartIdCanonical = typeof chartData?.id === 'string' && chartData.id.trim() ? chartData.id.trim() : trimmed;
      const chartDisplayName = chartApiOwnerDisplayLabel(
        chartData && typeof chartData === 'object' ? (chartData as Record<string, unknown>) : {}
      );
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
        throw new Error((snapData?.error ?? snapData?.message) || 'Snapshot failed after import');
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
          throw new Error((baseD?.error ?? baseD?.message) || 'Natal snapshot failed for import');
        }
        baseSnapshot = baseD.snapshot as EphemerisSnapshot;
      }
      dispatchComposition({
        type: 'import_chart_id_success',
        chartId: chartIdCanonical,
        chartDisplayName,
        snapshot: snapData.snapshot as EphemerisSnapshot,
        meta: snapData.meta as SandboxSnapshotMeta,
        ...(baseSnapshot ? { baseSnapshot } : {}),
        advanceToNewSlot: true,
      });
      setSurfaceState('ready_builder');
    } catch (e) {
      setSurfaceState('ready_builder');
      throw e instanceof Error ? e : new Error('Import failed');
    }
  }, []);

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

  const handleAscendantChange = useCallback((lonDeg: number) => {
    dispatchComposition({ type: 'free_build_asc_changed', lonDeg });
  }, []);

  const handleResetAllOverrides = useCallback(() => {
    const model = compositionRef.current;
    const idx = getActiveSlotIndexFromCompositionInput(model.compositionInput);
    const emptyOverrides = { planets: {} };
    const hasBase = Boolean(model.preview.baseSnapshot);
    const bReset =
      model.compositionInput.slots[idx]?.ephemeris_birth ??
      resolvePreviewBirthBySlotRef.current.get(idx) ?? undefined;
    const isFreeBuildSlot = slotWirePopulationKind(model.compositionInput.slots[idx] ?? { overrides: { planets: {} } }) === 'empty';

    dispatchComposition({ type: 'reset_overrides_to_base' });
    if (isFreeBuildSlot) {
      dispatchComposition({ type: 'free_build_asc_changed', lonDeg: 0, slotIndex: idx });
    }

    if (hasBase && bReset) {
      void updateSnapshot(bReset, emptyOverrides);
    }
    setSurfaceState('ready_builder');
  }, [updateSnapshot]);

  const handleResetPlanet = useCallback((planet: PlanetKey) => handleOverrideChange(planet, null), [handleOverrideChange]);

  const handleRemoveSlot = useCallback((index: number) => {
    activeSlotPreviewSeqRef.current += 1;
    resolvePreviewBirthBySlotRef.current.clear();
    dispatchComposition({ type: 'remove_slot', index });
  }, []);

  const handleClearSlot = useCallback(
    (index: number) => {
      resolvePreviewBirthBySlotRef.current.delete(index);
      dispatchComposition({ type: 'clear_slot', index });
      if (index === compositionRef.current.compositionInput.active_slot_index) {
        void syncPreviewToActiveSlot();
      }
    },
    [syncPreviewToActiveSlot],
  );

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
  if (compositionHasIncompleteBirthSlot(compositionModel.compositionInput)) {
    generateDisabledReasons.push(
      'A slot has date/time but no coordinates—select a full location (lat/lon) for each birth slot before resolve.',
    );
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

  const pairAggregateWithTwoChartIds = useMemo(() => {
    if (populatedSlotIndices.length !== 2) return false;
    const slots = compositionModel.compositionInput.slots;
    const a = slots[populatedSlotIndices[0]!];
    const b = slots[populatedSlotIndices[1]!];
    const idA = typeof a?.chart_id === 'string' && a.chart_id.trim() ? a.chart_id : null;
    const idB = typeof b?.chart_id === 'string' && b.chart_id.trim() ? b.chart_id : null;
    if (!idA || !idB) return false;
    if (a?.ephemeris_birth || b?.ephemeris_birth) return false;
    return true;
  }, [compositionModel.compositionInput, populatedSlotIndices]);

  const resolveSynastryNotice =
    compositionModel.lastResolve?.source === 'live_resolve'
      ? (compositionModel.lastResolve.fullResponse.synastryNotice as string | undefined)
      : undefined;

  const previewCombinedHash = preview.snapshotMeta?.combinedHash;
  const lastResolveCombinedHash = compositionModel.lastResolve?.combinedHashUsed ?? null;
  const resolveOutputStaleVsPreview = Boolean(
    !isMultiChartAggregate &&
      lastResolveCombinedHash &&
      previewCombinedHash &&
      lastResolveCombinedHash !== previewCombinedHash,
  );

  const resolveDocumentStaleVsLastResolve = useMemo(() => {
    const lr = compositionModel.lastResolve;
    if (!lr || lr.source !== 'live_resolve' || !lr.lastSubmittedResolveBody) return false;
    const fpLast = fingerprintResolveBodyExcludingSeed(lr.lastSubmittedResolveBody);
    const fpNow = fingerprintCompositionInputExcludingSeed(compositionModel.compositionInput);
    if (!fpLast || !fpNow) return false;
    return fpLast !== fpNow;
  }, [compositionModel.lastResolve, compositionModel.compositionInput]);

  useEffect(() => {
    if (compositionFingerprintAtLastSeed == null) return;
    const now = fingerprintCompositionInputExcludingSeed(compositionModel.compositionInput);
    if (now !== compositionFingerprintAtLastSeed) {
      setCompositionFingerprintAtLastSeed(null);
      setLastResolveSeedSlotIndex(null);
      setLastResolveSeedCombinedHash(null);
    }
  }, [compositionModel.compositionInput, compositionFingerprintAtLastSeed]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    const modelPre = compositionRef.current;
    const input = modelPre.compositionInput;
    const populated = getPopulatedSlotIndicesFromCompositionInput(input);
    if (populated.length === 0) return;

    setLastResolveSeedSlotIndex(null);
    setLastResolveSeedCombinedHash(null);
    setCompositionFingerprintAtLastSeed(null);

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

      const fpAtResolve = fingerprintResolveBodyExcludingSeed(resolveBody as Record<string, unknown>);
      if (fpAtResolve) {
        setCompositionFingerprintAtLastSeed(fpAtResolve);
      }
      setLastResolveSeedSlotIndex(populated[0]);
      setLastResolveSeedCombinedHash(combinedHashUsed);

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

  const handleReplay = useCallback(async (): Promise<'match' | 'mismatch'> => {
    const lr = compositionModel.lastResolve;
    const body = lr?.source === 'live_resolve' ? lr.lastSubmittedResolveBody : null;
    if (!planHash || !body) {
      throw new Error('Replay unavailable: missing last composition payload or plan hash from last generate.');
    }
    const base = getApiBaseUrl();
    const resolveRes = await fetch(`${base}/api/sandbox/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const resolveData = await resolveRes.json().catch(() => ({}));
    if (!resolveRes.ok || resolveData.ok === false) {
      throw new Error((resolveData.error ?? resolveData.message) || `Replay resolve: ${resolveRes.status}`);
    }
    const replayPlan = extractPlanSha256FromResolveResponse(resolveData as Record<string, unknown>);
    if (!replayPlan) {
      throw new Error('Replay resolve response missing plan_sha256');
    }
    return replayPlan !== planHash ? 'mismatch' : 'match';
  }, [planHash, compositionModel.lastResolve]);

  const fetchSavedList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      // Same-origin only: Next proxy injects session userId for engine owner isolation (see app/api/sandbox/[...path]/route.ts).
      const r = await fetch('/api/sandbox/compositions?limit=50');
      const data = await r.json().catch(() => []);
      if (!r.ok) {
        setSavedList([]);
        setListError((data?.error ?? data?.message) || `Failed to load saved compositions (${r.status})`);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setSavedList(filterSandboxSavedRows(rows));
    } catch (e) {
      setSavedList([]);
      setListError(e instanceof Error ? e.message : 'Failed to load saved compositions');
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
            full_resolve_response:
              lr?.source === 'live_resolve' ? trimResolveResponseForPersistence(lr.fullResponse as Record<string, unknown>) : null,
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
    let loadSucceeded = false;
    let loadErrorMessage: string | null = null;
    setError(null);
    try {
      const r = await fetch(`/api/sandbox/compositions/${id}`);
      const comp = await r.json().catch(() => null);
      if (!r.ok || !comp) {
        loadErrorMessage = comp?.error ?? 'Failed to load composition';
        return;
      }
      const compRec = comp as Record<string, unknown>;
      const rowState = compRec.sandbox_state;
      const classified = classifySandboxPersistedState(rowState);
      if (classified.kind === 'unsupported') {
        loadErrorMessage = classified.reason;
        return;
      }
      const parsed = parsePersistedSandboxState(rowState);

      resolvePreviewBirthBySlotRef.current.clear();
      setLastResolveSeedSlotIndex(null);
      setLastResolveSeedCombinedHash(null);
      setCompositionFingerprintAtLastSeed(null);

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
        if (s && slotWirePopulationKind(s) === 'ephemeris_birth' && s.ephemeris_birth) {
          return { birth: s.ephemeris_birth, overrides: normalizeSandboxOverrides(s?.overrides ?? { planets: {} }) };
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
          loadErrorMessage = (snapData?.error ?? snapData?.message) || 'Snapshot failed after load';
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
        loadSucceeded = true;
      } else {
        const cidLoad = typeof activeSlot?.chart_id === 'string' ? activeSlot.chart_id.trim() : '';
        if (cidLoad) {
          const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(cidLoad)}`);
          const chartData = await chartRes.json().catch(() => ({}));
          if (!chartRes.ok) {
            loadErrorMessage = (chartData?.error ?? chartData?.message) || 'Chart not found for saved composition';
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
            loadErrorMessage = (snapData?.error ?? snapData?.message) || 'Snapshot failed after load';
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
          loadSucceeded = true;
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
          loadSucceeded = true;
        }
      }
    } catch (e) {
      loadErrorMessage = e instanceof Error ? e.message : 'Load failed';
    } finally {
      if (loadTerminalSurfaceState(loadSucceeded) === 'ready_report') {
        setSurfaceState('ready_report');
        setError(null);
        return;
      }
      setSurfaceState(loadTerminalSurfaceState(loadSucceeded));
      setError(loadErrorMessage ?? 'Load failed');
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

  const activeSlotIdx = getActiveSlotIndexFromCompositionInput(compositionModel.compositionInput);
  const activeSlotWire = compositionModel.compositionInput.slots[activeSlotIdx];
  const activeSlotKind = slotWirePopulationKind(activeSlotWire ?? { overrides: { planets: {} } });
  const isFreeBuildWheel = activeSlotKind === 'empty';
  const freeBuildAscDeg =
    typeof activeSlotWire?.free_build_asc_deg === 'number' && Number.isFinite(activeSlotWire.free_build_asc_deg)
      ? activeSlotWire.free_build_asc_deg
      : 0;
  const displayCusps: number[] | undefined = isFreeBuildWheel
    ? equalHouseCuspsFromAscendant(freeBuildAscDeg)
    : cusps.length === 12
      ? cusps
      : undefined;
  const ascendantLonForPanel = isFreeBuildWheel
    ? freeBuildAscDeg
    : displayCusps != null
      ? displayCusps[0]!
      : undefined;

  const showComposerSurface =
    surfaceState === 'ready_builder' ||
    surfaceState === 'syncing_overrides' ||
    surfaceState === 'ready_report' ||
    surfaceState === 'idle';

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <h1 className="text-h1 font-bold text-text">Sandbox</h1>
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
                  setLastResolveSeedSlotIndex(null);
                  setLastResolveSeedCombinedHash(null);
                  setCompositionFingerprintAtLastSeed(null);
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <SandboxSlotComposer
                compositionInput={compositionModel.compositionInput}
                slotProjectionRows={slotProjectionRows}
                onSetActiveSlot={(i) => dispatchComposition({ type: 'set_active_slot', index: i })}
                onAddSlot={() => dispatchComposition({ type: 'add_slot' })}
                onRemoveSlot={handleRemoveSlot}
                onClearSlot={handleClearSlot}
                onImportChart={handleImportChartById}
              />

              <SandboxWheelPanel
                currentSnapshot={currentSnapshot}
                overrides={overrides}
                isUpdating={surfaceState === 'syncing_overrides'}
                synastryNotice={resolveSynastryNotice ?? null}
                freeBuild={isFreeBuildWheel}
                ascendantOverrideDeg={freeBuildAscDeg}
                activeSlotIndex={compositionModel.compositionInput.active_slot_index}
                previewSyncError={preview.syncStatus === 'error' && preview.error ? preview.error : null}
                onOverrideChange={handleOverrideChange}
                onResetAll={handleResetAllOverrides}
              />

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
              <SandboxResolvePanel
                canGenerate={canGenerate}
                generateDisabledReasons={generateDisabledReasons}
                generateLoading={generateLoading}
                generateError={generateError}
                hasGenerated={hasGenerated}
                compositionInput={compositionModel.compositionInput}
                saveLoading={saveLoading}
                saveError={saveError}
                canSave={canSave}
                displayReport={displayReport}
                exportId={exportId}
                populatedSlotIndices={populatedSlotIndices}
                isMultiChartAggregate={isMultiChartAggregate}
                canonicalSlotOrder={canonicalSlotOrder}
                canonicalInputHash={canonicalInputHash}
                lastResolveSeedSlotIndex={lastResolveSeedSlotIndex}
                lastResolveSeedCombinedHash={lastResolveSeedCombinedHash}
                compositionFingerprintAtLastSeed={compositionFingerprintAtLastSeed}
                resolveOutputStaleVsPreview={resolveOutputStaleVsPreview}
                resolveDocumentStaleVsLastResolve={resolveDocumentStaleVsLastResolve}
                showRelationalClassification={pairAggregateWithTwoChartIds}
                commitRelationalClassification={compositionModel.compositionInput.commit_relational_classification === true}
                onToggleRelationalClassification={(value) =>
                  dispatchComposition({ type: 'set_commit_relational_classification', value })
                }
                onGenerate={handleGenerate}
                onSave={handleSave}
              />
                <SandboxReportSections displayReport={displayReport} />
                {hasGenerated && (
                  <SandboxAudioPanel
                    exportId={exportId}
                    sandboxAudioSrc={sandboxAudioSrc}
                    planHash={planHash}
                    exportUnavailableReason={exportUnavailableReason}
                    audioRef={audioRef}
                  />
                )}
                {hasGenerated && (
                  <SandboxProvenancePanel
                    lastResolve={lastResolve}
                    planHash={planHash}
                    lastCombinedHashUsed={lastCombinedHashUsed}
                    exportId={exportId}
                    onExportJson={handleExportJson}
                    onReplay={handleReplay}
                  />
                )}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="card">
                <DegreePanel
                  overrides={overrides}
                  basePositions={basePositions}
                  cusps={displayCusps}
                  ascendantLon={ascendantLonForPanel}
                  ascendantEditable={isFreeBuildWheel}
                  onAscendantChange={handleAscendantChange}
                  onOverrideChange={handleOverrideChange}
                  onResetPlanet={handleResetPlanet}
                />
              </div>
              <SandboxSavedCompositions
                savedList={savedList}
                listLoading={listLoading}
                listError={listError}
                onRefresh={fetchSavedList}
                onLoad={handleLoad}
              />
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
