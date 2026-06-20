import { useCallback } from 'react';
import {
  CHART_IMPORT_UNAVAILABLE_MSG,
  chartApiRecordHasEngineBirthFields,
  chartApiRecordToBirthWire,
  combinedChartIdOverridesSeed,
} from '../lib/sandbox-chart-import';
import { formatApiError } from '../lib/format-api-error';
import {
  fetchChartRecord,
  fetchChartSnapshot,
  postSnapshot,
  resolveComposition,
  saveComposition,
} from '../lib/sandbox-fetch';
import { dailyTransitBirthForBlankCanvas } from '../lib/sandbox-blank-canvas';
import {
  buildReportFromResolve,
  compositionCanGenerate,
  extractSandboxResolvePayload,
  getPopulatedSlotIndices,
  metaCombinedHash,
  overridesToWire,
  serializeSandboxResolveRequestBody,
} from '../lib/sandbox-resolve';
import { getSlotPopulationKind } from '../lib/sandbox-slot-utils';
import { useAuthStore } from '../store/auth';
import { useSandboxStore } from '../store/sandbox';
import type { SandboxResolveReport } from '../types/sandbox';

function birthWireForSnapshot(slot: ReturnType<typeof useSandboxStore.getState>['slots'][number]) {
  const b = slot.birth;
  if (!b) return null;
  return {
    date: b.date,
    time: b.time.length >= 5 ? b.time.slice(0, 5) : b.time,
    lat: b.lat,
    lon: b.lon,
    tz: b.timezone,
    houseSystem: b.houseSystem ?? 'placidus',
    location: {
      label: b.locationLabel ?? 'Birth location',
      lat: b.lat,
      lon: b.lon,
      timezone: b.timezone,
    },
  };
}

export function useSandboxGenerate(onSaved?: () => void) {
  const userId = useAuthStore((s) => s.user?.id);
  const slots = useSandboxStore((s) => s.slots);
  const setSurfaceState = useSandboxStore((s) => s.setSurfaceState);
  const setErrorMessage = useSandboxStore((s) => s.setErrorMessage);
  const setGenerateLoading = useSandboxStore((s) => s.setGenerateLoading);
  const setSaveLoading = useSandboxStore((s) => s.setSaveLoading);
  const setAudioLoading = useSandboxStore((s) => s.setAudioLoading);
  const setResolveSession = useSandboxStore((s) => s.setResolveSession);
  const setExportJobId = useSandboxStore((s) => s.setExportJobId);
  const markSaved = useSandboxStore((s) => s.markSaved);
  const generateLoading = useSandboxStore((s) => s.generateLoading);
  const saveLoading = useSandboxStore((s) => s.saveLoading);
  const audioLoading = useSandboxStore((s) => s.audioLoading);
  const canSave = useSandboxStore((s) => s.canSave);
  const savedThisSession = useSandboxStore((s) => s.savedThisSession);
  const planHash = useSandboxStore((s) => s.planHash);
  const combinedHash = useSandboxStore((s) => s.combinedHash);
  const canonicalObjectHash = useSandboxStore((s) => s.canonicalObjectHash);
  const lastResolveBody = useSandboxStore((s) => s.lastResolveBody);
  const resolveResult = useSandboxStore((s) => s.resolveResult);
  const exportJobId = useSandboxStore((s) => s.exportJobId);

  const canGenerate = compositionCanGenerate(slots);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || generateLoading) return;
    setGenerateLoading(true);
    setSurfaceState('loading_base');
    setErrorMessage(null);

    try {
      const state = useSandboxStore.getState();
      const populated = getPopulatedSlotIndices(state.slots);
      if (populated.length === 0) {
        throw new Error('Populate at least one slot before composing.');
      }

      const seedIdx = populated[0]!;
      const seedSlot = state.slots[seedIdx]!;
      const seedKind = getSlotPopulationKind(seedSlot);
      const transientBirthBySlot: Record<number, ReturnType<typeof dailyTransitBirthForBlankCanvas>> =
        {};

      for (const idx of populated) {
        const slot = state.slots[idx]!;
        if (getSlotPopulationKind(slot) === 'blank_canvas') {
          transientBirthBySlot[idx] = dailyTransitBirthForBlankCanvas();
        }
      }

      let combinedHashUsed: string | null = null;

      if (seedKind === 'chart_id') {
        const cid = String(seedSlot.chartId ?? '').trim();
        if (!cid) throw new Error('Chart import is incomplete.');
        const chartData = await fetchChartRecord(cid);
        if (chartApiRecordHasEngineBirthFields(chartData)) {
          const wire = chartApiRecordToBirthWire(chartData);
          const snapRes = await postSnapshot(wire, overridesToWire(seedSlot.overrides));
          combinedHashUsed = metaCombinedHash(snapRes.meta);
        } else {
          const serverSnap = await fetchChartSnapshot(cid);
          if (!serverSnap) throw new Error(CHART_IMPORT_UNAVAILABLE_MSG);
          combinedHashUsed = await combinedChartIdOverridesSeed(cid, seedSlot.overrides);
        }
      } else if (seedKind === 'ephemeris_birth') {
        const birth = birthWireForSnapshot(seedSlot);
        if (!birth) throw new Error('First occupied slot needs complete birth data.');
        const snapRes = await postSnapshot(birth, overridesToWire(seedSlot.overrides));
        combinedHashUsed = metaCombinedHash(snapRes.meta);
      } else if (seedKind === 'blank_canvas') {
        const birth = transientBirthBySlot[seedIdx] ?? dailyTransitBirthForBlankCanvas();
        const snapRes = await postSnapshot(birth, overridesToWire(seedSlot.overrides));
        combinedHashUsed = metaCombinedHash(snapRes.meta);
      } else {
        throw new Error('First occupied slot is invalid for resolve seed.');
      }

      if (!combinedHashUsed) {
        throw new Error('Snapshot response missing combined hash');
      }

      const resolveBody = serializeSandboxResolveRequestBody(
        state.slots,
        state.activeSlotIndex,
        combinedHashUsed,
        { generateAudio: false, transientBirthBySlot }
      );

      const resolveData = await resolveComposition(resolveBody);
      if (resolveData.ok === false) {
        throw new Error(String(resolveData.error ?? resolveData.message ?? 'Resolve failed'));
      }

      const resolved = extractSandboxResolvePayload(resolveData);
      if (!resolved) {
        throw new Error('Resolve response missing explanation or plan hash');
      }

      const report = buildReportFromResolve(
        resolveData,
        combinedHashUsed
      ) as SandboxResolveReport;
      const canonicalObjectHashNext =
        (resolveData.canonical_object_hash as string | undefined) ??
        report.meta?.canonical_object_hash ??
        null;

      setResolveSession({
        report,
        planHash: resolved.planSha256,
        combinedHash: combinedHashUsed,
        canonicalObjectHash: canonicalObjectHashNext,
        exportJobId: resolved.exportId,
        lastResolveBody: resolveBody,
      });
    } catch (e) {
      setSurfaceState('error');
      setErrorMessage(formatApiError(e, e instanceof Error ? e.message : 'Composition failed'));
    } finally {
      setGenerateLoading(false);
    }
  }, [
    canGenerate,
    generateLoading,
    setErrorMessage,
    setGenerateLoading,
    setResolveSession,
    setSurfaceState,
  ]);

  const handleSave = useCallback(async () => {
    if (!canSave || !userId || !planHash || !combinedHash || !resolveResult || saveLoading) return;
    setSaveLoading(true);
    setErrorMessage(null);
    try {
      const state = useSandboxStore.getState();
      const compositionInput = {
        schema_version: '1',
        slots: state.slots.map((slot) => ({
          ...(slot.chartId ? { chart_id: slot.chartId, chart_display_name: slot.chartDisplayName } : {}),
          ...(slot.birth
            ? {
                ephemeris_birth: {
                  date: slot.birth.date,
                  time: slot.birth.time,
                  location: {
                    label: slot.birth.locationLabel ?? 'Birth',
                    lat: slot.birth.lat,
                    lon: slot.birth.lon,
                    timezone: slot.birth.timezone,
                  },
                },
              }
            : {}),
          ...(slot.entryMode === 'blank_canvas' ? { entry_mode: 'blank_canvas' as const } : {}),
          overrides: overridesToWire(slot.overrides),
        })),
        active_slot_index: state.activeSlotIndex,
        compose_controls: {},
        output_kind: 'full',
      };

      await saveComposition(
        {
          sandbox_state: {
            composition_input: compositionInput,
            last_submitted_resolve_body: lastResolveBody,
          },
          vector_hash: combinedHash,
          seed: combinedHash,
          plan_hash: planHash,
          report: resolveResult,
          provider: null,
          provider_version: null,
          export_id: exportJobId,
          source: 'sandbox',
          composition_type:
            state.slots.filter(
              (s) => s.chartId || s.birth || getSlotPopulationKind(s) === 'blank_canvas'
            ).length >= 2
              ? 'A+B+N'
              : 'A',
          object_identity_hash: canonicalObjectHash,
        },
        userId
      );
      markSaved();
      onSaved?.();
    } catch (e) {
      setErrorMessage(formatApiError(e, 'Save failed'));
    } finally {
      setSaveLoading(false);
    }
  }, [
    canSave,
    combinedHash,
    canonicalObjectHash,
    exportJobId,
    lastResolveBody,
    markSaved,
    onSaved,
    planHash,
    resolveResult,
    saveLoading,
    setErrorMessage,
    setSaveLoading,
    userId,
  ]);

  const handleGenerateAudio = useCallback(async () => {
    if (!lastResolveBody || !planHash || !canonicalObjectHash || audioLoading) return;
    setAudioLoading(true);
    setErrorMessage(null);
    try {
      const audioBody = {
        ...lastResolveBody,
        generateAudio: true,
        expectedPlanSha256: planHash,
        expectedObjectIdentityHash: canonicalObjectHash,
      };
      const resolveData = await resolveComposition(audioBody);
      if (resolveData.ok === false) {
        throw new Error(String(resolveData.error ?? resolveData.message ?? 'Audio composition failed'));
      }
      const resolved = extractSandboxResolvePayload(resolveData);
      if (!resolved?.exportId) {
        throw new Error('Audio export unavailable');
      }
      setExportJobId(resolved.exportId);
    } catch (e) {
      setErrorMessage(formatApiError(e, 'Audio composition failed'));
    } finally {
      setAudioLoading(false);
    }
  }, [
    audioLoading,
    canonicalObjectHash,
    lastResolveBody,
    planHash,
    setAudioLoading,
    setErrorMessage,
    setExportJobId,
  ]);

  return {
    canGenerate,
    generateLoading,
    saveLoading,
    audioLoading,
    canSave,
    savedThisSession,
    exportJobId,
    handleGenerate,
    handleSave,
    handleGenerateAudio,
  };
}
