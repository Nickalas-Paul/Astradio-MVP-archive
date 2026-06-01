'use client';

import { useState, useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getApiBaseUrl } from '../core/api-base';
import { buildLastResolveFromLoadedRow } from '../../app/sandbox/page-helpers';
import type { SandboxBirth, EphemerisSnapshot, SandboxReport, SandboxSnapshotMeta } from '../types/sandbox';
import {
  normalizeSandboxOverrides,
  getActiveSlotIndexFromCompositionInput,
  getPopulatedSlotIndicesFromCompositionInput,
  slotWirePopulationKind,
  parsePersistedSandboxState,
  type SandboxCompositionModelState,
  type SandboxCompositionAction,
} from '../lib/sandbox-composition-state';
import { chartApiRecordToSandboxBirthWire } from '../lib/sandbox-bff-wire';
import { classifySandboxPersistedState } from '../lib/sandbox-persisted-classify';
import { trimResolveResponseForPersistence, filterSandboxSavedRows, loadTerminalSurfaceState } from '../lib/sandbox-persisted-trim';
import type { SavedComposition } from '../components/sandbox/SandboxSavedCompositions';
import type { SandboxSurfaceState } from './useSandboxPreviewSync';

export interface UseSandboxPersistenceArgs {
  compositionModel: SandboxCompositionModelState;
  dispatchComposition: Dispatch<SandboxCompositionAction>;
  resolvePreviewBirthBySlotRef: MutableRefObject<Map<number, SandboxBirth>>;
  setSurfaceState: Dispatch<SetStateAction<SandboxSurfaceState>>;
  setError: Dispatch<SetStateAction<string | null>>;
  surfaceState: SandboxSurfaceState;
  hasGenerated: boolean;
  prepareForLoad: () => void;
}

export interface UseSandboxPersistenceReturn {
  savedList: SavedComposition[];
  listLoading: boolean;
  listError: string | null;
  saveLoading: boolean;
  saveError: string | null;
  canSave: boolean;
  fetchSavedList: () => void;
  handleSave: () => void;
  handleLoadComposition: (compositionId: string) => void;
  handleExportJson: () => void;
}

export function useSandboxPersistence({
  compositionModel,
  dispatchComposition,
  resolvePreviewBirthBySlotRef,
  setSurfaceState,
  setError,
  surfaceState,
  hasGenerated,
  prepareForLoad,
}: UseSandboxPersistenceArgs): UseSandboxPersistenceReturn {
  const [savedList, setSavedList] = useState<SavedComposition[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const preview = compositionModel.preview;
  const lastResolve = compositionModel.lastResolve;
  const displayReport = lastResolve?.report ?? null;
  const planHash = lastResolve?.planSha256 ?? null;
  const exportId = lastResolve?.exportId ?? null;
  const lastComposeProvider = lastResolve?.source === 'live_resolve' ? lastResolve.lastComposeProvider : null;
  const canonicalSlotOrder = lastResolve?.source === 'live_resolve' ? lastResolve.canonicalSlotOrder : null;
  const canonicalInputHash = lastResolve?.source === 'live_resolve' ? lastResolve.canonicalInputHash : null;
  const lastCombinedHashUsed = lastResolve?.combinedHashUsed ?? preview.snapshotMeta?.combinedHash ?? null;

  const canSave = Boolean(hasGenerated && lastCombinedHashUsed && planHash && displayReport != null);

  const fetchSavedList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
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

  const handleLoadComposition = useCallback(
    async (id: string) => {
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
        prepareForLoad();
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
          const loadedLastResolve = buildLastResolveFromLoadedRow(compRec, parsed, snapshot);
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
            lastResolve: loadedLastResolve,
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
            const loadedLastResolve = buildLastResolveFromLoadedRow(compRec, parsed, snapshot);
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
              lastResolve: loadedLastResolve,
            });
            loadSucceeded = true;
          } else {
            const loadedLastResolve = buildLastResolveFromLoadedRow(compRec, parsed, null);
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
              lastResolve: loadedLastResolve,
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
    },
    [dispatchComposition, prepareForLoad, resolvePreviewBirthBySlotRef, setError, setSurfaceState],
  );

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
    if (surfaceState === 'ready_builder' || surfaceState === 'ready_report' || surfaceState === 'idle') {
      void fetchSavedList();
    }
  }, [surfaceState, fetchSavedList]);

  return {
    savedList,
    listLoading,
    listError,
    saveLoading,
    saveError,
    canSave,
    fetchSavedList,
    handleSave,
    handleLoadComposition,
    handleExportJson,
  };
}
