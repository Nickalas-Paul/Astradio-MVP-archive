'use client';

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getApiBaseUrl } from '../core/api-base';
import { activeSlotBirth, activeSlotOverrides } from '../../app/sandbox/page-helpers';
import type { SandboxBirth, EphemerisSnapshot, SandboxSnapshotMeta, PlanetKey, SandboxOverrides } from '../types/sandbox';
import {
  normalizeSandboxOverrides,
  roundSandboxDegree,
  getActiveSlotIndexFromCompositionInput,
  slotWirePopulationKind,
  type SandboxCompositionModelState,
  type SandboxCompositionAction,
} from '../lib/sandbox-composition-state';
import { chartApiRecordToSandboxBirthWire } from '../lib/sandbox-bff-wire';
import {
  chartApiRecordHasEngineBirthFields,
  applySandboxOverridesToSnapshotLite,
  previewMetaForChartIdImport,
  CHART_IMPORT_UNAVAILABLE_MSG,
} from '../lib/sandbox-chart-import';

export type SandboxSurfaceState =
  | 'idle'
  | 'loading_base'
  | 'ready_builder'
  | 'syncing_overrides'
  | 'ready_report'
  | 'generating'
  | 'error';

export interface UseSandboxPreviewSyncArgs {
  compositionModel: SandboxCompositionModelState;
  dispatchComposition: Dispatch<SandboxCompositionAction>;
  compositionRef: MutableRefObject<SandboxCompositionModelState>;
  resolvePreviewBirthBySlotRef: MutableRefObject<Map<number, SandboxBirth>>;
  setSurfaceState: Dispatch<SetStateAction<SandboxSurfaceState>>;
  setError: Dispatch<SetStateAction<string | null>>;
  onClearGenerateError?: () => void;
}

export interface UseSandboxPreviewSyncReturn {
  handleOverrideChange: (planet: PlanetKey, lonDeg: number | null) => void;
  handleBirthSubmit: (birth: SandboxBirth, options?: { chartDisplayName?: string }) => Promise<void>;
  handleResetAllOverrides: () => void;
  handleRemoveSlot: (index: number) => void;
  handleClearSlot: (index: number) => void;
  previewSyncError: string | null;
  isSyncing: boolean;
  cancelPendingSnapshotSync: () => void;
}

export function useSandboxPreviewSync({
  compositionModel,
  dispatchComposition,
  compositionRef,
  resolvePreviewBirthBySlotRef,
  setSurfaceState,
  setError,
  onClearGenerateError,
}: UseSandboxPreviewSyncArgs): UseSandboxPreviewSyncReturn {
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const snapshotSequenceRef = useRef(0);
  const activeSlotPreviewSeqRef = useRef(0);

  const cancelPendingSnapshotSync = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    snapshotSequenceRef.current++;
  }, []);

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
    [dispatchComposition, setError, setSurfaceState],
  );

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
        const chartRes = await fetch(`${baseUrl}/api/charts/${encodeURIComponent(cid)}`, {
          credentials: 'same-origin',
        });
        const chartData = await chartRes.json().catch(() => ({}));
        if (!chartRes.ok) {
          if (seq !== activeSlotPreviewSeqRef.current) return;
          dispatchComposition({
            type: 'preview_sync_error',
            message:
              chartRes.status === 403
                ? CHART_IMPORT_UNAVAILABLE_MSG
                : (chartData?.error ?? chartData?.message) || `Chart: ${chartRes.status}`,
          });
          return;
        }
        if (chartApiRecordHasEngineBirthFields(chartData as Record<string, unknown>)) {
          const wire = chartApiRecordToSandboxBirthWire(chartData);
          resolvePreviewBirthBySlotRef.current.set(idx, wire);
          b = wire;
        } else {
          const snapRes = await fetch(`${baseUrl}/api/charts/${encodeURIComponent(cid)}/snapshot`, {
            credentials: 'same-origin',
          });
          const snapData = await snapRes.json().catch(() => ({}));
          if (!snapRes.ok) {
            if (seq !== activeSlotPreviewSeqRef.current) return;
            dispatchComposition({
              type: 'preview_sync_error',
              message:
                snapRes.status === 403
                  ? CHART_IMPORT_UNAVAILABLE_MSG
                  : (snapData?.error ?? snapData?.message) || `Chart snapshot: ${snapRes.status}`,
            });
            return;
          }
          const serverSnapshot = snapData.snapshot as EphemerisSnapshot | undefined;
          if (!serverSnapshot || !Array.isArray(serverSnapshot.planets)) {
            if (seq !== activeSlotPreviewSeqRef.current) return;
            dispatchComposition({
              type: 'preview_sync_error',
              message: 'Chart snapshot response missing ephemeris data',
            });
            return;
          }
          const effectiveSnapshot = applySandboxOverridesToSnapshotLite(serverSnapshot, overridesToUse);
          const meta = await previewMetaForChartIdImport(cid, overridesToUse);
          const hasPreserved = Object.keys(overridesToUse.planets).length > 0;
          if (seq !== activeSlotPreviewSeqRef.current) return;
          dispatchComposition({
            type: 'preview_restore',
            snapshot: effectiveSnapshot,
            meta,
            ...(hasPreserved ? { baseSnapshot: serverSnapshot } : {}),
          });
          return;
        }
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
  }, [compositionRef, dispatchComposition, resolvePreviewBirthBySlotRef, setError, setSurfaceState]);

  useEffect(() => {
    void syncPreviewToActiveSlot();
  }, [compositionModel.compositionInput.active_slot_index, syncPreviewToActiveSlot]);

  const handleBirthSubmit = useCallback(
    async (b: SandboxBirth, options?: { chartDisplayName?: string }) => {
      setSurfaceState('loading_base');
      setError(null);
      onClearGenerateError?.();
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
          ...(options?.chartDisplayName ? { chartDisplayName: options.chartDisplayName } : {}),
        });
        resolvePreviewBirthBySlotRef.current.set(
          getActiveSlotIndexFromCompositionInput(compositionRef.current.compositionInput),
          b,
        );
        setSurfaceState('ready_builder');
      } catch (err) {
        setSurfaceState('error');
        setError(err instanceof Error ? err.message : 'Failed to load birth data');
        throw err;
      }
    },
    [compositionRef, dispatchComposition, onClearGenerateError, resolvePreviewBirthBySlotRef, setError, setSurfaceState],
  );

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
            p.name === planet ? { ...p, lon: lonDeg !== null ? roundSandboxDegree(lonDeg) : p.lon } : p,
          ),
        };
      }

      dispatchComposition({
        type: 'overrides_changed',
        overrides: normalized,
        optimisticSnapshot: optimistic ?? undefined,
      });
      if (model.preview.overriddenSnapshot && b != null) {
        void updateSnapshot(b, normalized);
      }
    },
    [compositionRef, dispatchComposition, resolvePreviewBirthBySlotRef, updateSnapshot],
  );

  const handleResetAllOverrides = useCallback(() => {
    const model = compositionRef.current;
    const idx = getActiveSlotIndexFromCompositionInput(model.compositionInput);
    const emptyOverrides = { planets: {} };
    const hasBase = Boolean(model.preview.baseSnapshot);
    const bReset =
      model.compositionInput.slots[idx]?.ephemeris_birth ??
      resolvePreviewBirthBySlotRef.current.get(idx) ??
      undefined;
    const slotKind = slotWirePopulationKind(model.compositionInput.slots[idx] ?? { overrides: { planets: {} } });
    const isFreeBuildSlot = slotKind === 'empty' || slotKind === 'blank_canvas';

    dispatchComposition({ type: 'reset_overrides_to_base' });
    if (isFreeBuildSlot) {
      dispatchComposition({ type: 'free_build_asc_changed', lonDeg: 0, slotIndex: idx });
    }

    if (hasBase && bReset) {
      void updateSnapshot(bReset, emptyOverrides);
    }
    setSurfaceState('ready_builder');
  }, [compositionRef, dispatchComposition, resolvePreviewBirthBySlotRef, setSurfaceState, updateSnapshot]);

  const handleRemoveSlot = useCallback(
    (index: number) => {
      activeSlotPreviewSeqRef.current += 1;
      resolvePreviewBirthBySlotRef.current.clear();
      dispatchComposition({ type: 'remove_slot', index });
    },
    [dispatchComposition, resolvePreviewBirthBySlotRef],
  );

  const handleClearSlot = useCallback(
    (index: number) => {
      resolvePreviewBirthBySlotRef.current.delete(index);
      dispatchComposition({ type: 'clear_slot', index });
      if (index === compositionRef.current.compositionInput.active_slot_index) {
        void syncPreviewToActiveSlot();
      }
    },
    [compositionRef, dispatchComposition, resolvePreviewBirthBySlotRef, syncPreviewToActiveSlot],
  );

  const previewSyncError =
    compositionModel.preview.syncStatus === 'error' && compositionModel.preview.error
      ? compositionModel.preview.error
      : null;

  const isSyncing = compositionModel.preview.syncStatus === 'syncing';

  return {
    handleOverrideChange,
    handleBirthSubmit,
    handleResetAllOverrides,
    handleRemoveSlot,
    handleClearSlot,
    previewSyncError,
    isSyncing,
    cancelPendingSnapshotSync,
  };
}
