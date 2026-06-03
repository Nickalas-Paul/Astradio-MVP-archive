'use client';

import { useState, useCallback, useEffect, useMemo, type Dispatch, type MutableRefObject, type RefObject } from 'react';
import { getApiBaseUrl } from '../core/api-base';
import { getPlayableLyriaUrl } from '../core/audio/lyria-playback';
import { extractSandboxResolvePayload } from '../../app/sandbox/page-helpers';
import type { SandboxBirth, EphemerisSnapshot, SandboxReport, SandboxOverrides } from '../types/sandbox';
import {
  normalizeSandboxOverrides,
  serializeSandboxResolveRequestBody,
  getPopulatedSlotIndicesFromCompositionInput,
  getActiveSlotIndexFromCompositionInput,
  compositionHasInvalidSlotWire,
  compositionHasIncompleteBirthSlot,
  populatedSlotsAreAggregateEligible,
  slotWirePopulationKind,
  compositionOnlyBlankCanvasPopulated,
  blankCanvasSlotHasPlacedPlanets,
  isBlankCanvasSlot,
  type SandboxCompositionModelState,
  type SandboxCompositionAction,
} from '../lib/sandbox-composition-state';
import { dailyTransitBirthForBlankCanvas, applyBlankCanvasEqualHouses } from '../lib/sandbox-transit-birth';
import {
  fingerprintCompositionInputExcludingSeed,
  fingerprintResolveBodyExcludingSeed,
} from '../lib/sandbox-resolve-fingerprint';
import { chartApiRecordToSandboxBirthWire } from '../lib/sandbox-bff-wire';
import type { SandboxSurfaceState } from './useSandboxPreviewSync';

export interface UseSandboxGenerateArgs {
  compositionModel: SandboxCompositionModelState;
  dispatchComposition: Dispatch<SandboxCompositionAction>;
  compositionRef: MutableRefObject<SandboxCompositionModelState>;
  resolvePreviewBirthBySlotRef: MutableRefObject<Map<number, SandboxBirth>>;
  audioRef: RefObject<HTMLAudioElement | null>;
  surfaceState: SandboxSurfaceState;
  cancelPendingSnapshotSync: () => void;
}

export interface UseSandboxGenerateReturn {
  canGenerate: boolean;
  generateDisabledReasons: string[];
  generateLoading: boolean;
  generateError: { chart?: string; report?: string; audio?: string } | null;
  hasGenerated: boolean;
  sandboxAudioSrc: string | null;
  lastResolveSeedSlotIndex: number | null;
  lastResolveSeedCombinedHash: string | null;
  compositionFingerprintAtLastSeed: string | null;
  handleGenerate: () => void;
  clearGenerateError: () => void;
  clearSeedFingerprintState: () => void;
  prepareForLoad: () => void;
  showRelationalClassification: boolean;
  commitRelationalClassification: boolean;
  onToggleRelationalClassification: (value: boolean) => void;
  populatedSlotIndices: number[];
  isMultiChartAggregate: boolean;
  resolveOutputStaleVsPreview: boolean;
  resolveDocumentStaleVsLastResolve: boolean;
  audioGenerateLoading: boolean;
  audioGenerateError: string | null;
  handleGenerateAudio: () => void;
  clearAudioGenerateError: () => void;
}

export function useSandboxGenerate({
  compositionModel,
  dispatchComposition,
  compositionRef,
  resolvePreviewBirthBySlotRef,
  audioRef,
  surfaceState,
  cancelPendingSnapshotSync,
}: UseSandboxGenerateArgs): UseSandboxGenerateReturn {
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<{ chart?: string; report?: string; audio?: string } | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [sandboxAudioSrc, setSandboxAudioSrc] = useState<string | null>(null);
  const [lastResolveSeedSlotIndex, setLastResolveSeedSlotIndex] = useState<number | null>(null);
  const [lastResolveSeedCombinedHash, setLastResolveSeedCombinedHash] = useState<string | null>(null);
  const [compositionFingerprintAtLastSeed, setCompositionFingerprintAtLastSeed] = useState<string | null>(null);
  const [audioGenerateLoading, setAudioGenerateLoading] = useState(false);
  const [audioGenerateError, setAudioGenerateError] = useState<string | null>(null);

  const preview = compositionModel.preview;
  const exportId = compositionModel.lastResolve?.exportId ?? null;

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

  const clearGenerateError = useCallback(() => setGenerateError(null), []);

  const clearAudioGenerateError = useCallback(() => setAudioGenerateError(null), []);

  const clearSeedFingerprintState = useCallback(() => {
    setLastResolveSeedSlotIndex(null);
    setLastResolveSeedCombinedHash(null);
    setCompositionFingerprintAtLastSeed(null);
  }, []);

  const prepareForLoad = useCallback(() => {
    clearSeedFingerprintState();
    setHasGenerated(true);
    setGenerateError(null);
  }, [clearSeedFingerprintState]);

  const populatedSlotIndices = useMemo(
    () => getPopulatedSlotIndicesFromCompositionInput(compositionModel.compositionInput),
    [compositionModel.compositionInput],
  );

  const activeSlotIndex = getActiveSlotIndexFromCompositionInput(compositionModel.compositionInput);
  const activeSlot = compositionModel.compositionInput.slots[activeSlotIndex];
  const onlyBlankCanvasPopulated = compositionOnlyBlankCanvasPopulated(compositionModel.compositionInput);

  const aggregateEligible = populatedSlotsAreAggregateEligible(compositionModel.compositionInput, populatedSlotIndices);
  const hasInvalidSlotWire = compositionHasInvalidSlotWire(compositionModel.compositionInput);
  const isMultiChartAggregate = populatedSlotIndices.length >= 2 && aggregateEligible;
  const hasResolveSource = Boolean(
    populatedSlotIndices.length > 0 &&
      !hasInvalidSlotWire &&
      (populatedSlotIndices.length >= 2 ? aggregateEligible : true),
  );
  const previewReadyForSeed = Boolean(
    onlyBlankCanvasPopulated ||
      isMultiChartAggregate ||
      ((preview.overriddenSnapshot || preview.baseSnapshot) && preview.snapshotMeta?.combinedHash),
  );
  const canGenerate = Boolean(
    hasResolveSource && (isMultiChartAggregate || previewReadyForSeed) && surfaceState !== 'syncing_overrides',
  );

  const generateDisabledReasons: string[] = [];
  if (hasInvalidSlotWire) {
    generateDisabledReasons.push(
      'A slot has both chart ID and birth data—clear one or split them so each slot is either a stored chart or ephemeris birth.',
    );
  }
  if (compositionHasIncompleteBirthSlot(compositionModel.compositionInput)) {
    generateDisabledReasons.push(
      'A slot has date/time but no coordinates—select a full location (lat/lon) for each birth slot before resolve.',
    );
  }
  if (!hasResolveSource && !hasInvalidSlotWire) {
    if (
      activeSlot &&
      isBlankCanvasSlot(activeSlot) &&
      !blankCanvasSlotHasPlacedPlanets(activeSlot)
    ) {
      generateDisabledReasons.push('Place at least one planet on the wheel to build this composition.');
    } else if (
      activeSlot?.entry_mode === 'birth_data' &&
      slotWirePopulationKind(activeSlot) === 'empty'
    ) {
      generateDisabledReasons.push('Enter birth data for this slot before you can generate.');
    } else if (populatedSlotIndices.length >= 2 && !aggregateEligible) {
      generateDisabledReasons.push(
        'Two or more occupied slots must each be a stored chart, birth data, or a blank chart with planets placed.',
      );
    } else if (activeSlot?.entry_mode == null && slotWirePopulationKind(activeSlot ?? { overrides: { planets: {} } }) === 'empty') {
      generateDisabledReasons.push(
        'Choose how to start above—blank chart or birth data—or import a stored chart.',
      );
    } else {
      generateDisabledReasons.push(
        'Add birth data or import a stored chart ID (engine GET /api/charts/:id). You can draft on the wheel first; planet placements stay when you add birth data or import.',
      );
    }
  }
  if (
    hasResolveSource &&
    !onlyBlankCanvasPopulated &&
    !isMultiChartAggregate &&
    !preview.baseSnapshot &&
    !preview.overriddenSnapshot
  ) {
    generateDisabledReasons.push('Wait for the chart preview to finish loading.');
  }
  if (
    hasResolveSource &&
    !onlyBlankCanvasPopulated &&
    !isMultiChartAggregate &&
    !preview.snapshotMeta?.combinedHash
  ) {
    generateDisabledReasons.push('Wait for the preview hash to finish updating after the last edit (required for resolve).');
  }
  if (surfaceState === 'syncing_overrides') {
    generateDisabledReasons.push('Wait until your planet edits finish syncing to the preview.');
  }

  const showRelationalClassification = useMemo(() => {
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
    const activeIdx = getActiveSlotIndexFromCompositionInput(input);

    setLastResolveSeedSlotIndex(null);
    setLastResolveSeedCombinedHash(null);
    setCompositionFingerprintAtLastSeed(null);

    const base = getApiBaseUrl();
    const populated = getPopulatedSlotIndicesFromCompositionInput(input);
    if (populated.length === 0) return;

    if (populated.length >= 2 && !populatedSlotsAreAggregateEligible(input, populated)) {
      setGenerateError({
        report:
          'Two or more occupied slots must each be a stored chart, birth data, or a blank chart with planets placed.',
      });
      return;
    }

    const transientBirthMap: Record<number, SandboxBirth> = {};
    for (const idx of populated) {
      const slot = input.slots[idx];
      if (slot && slotWirePopulationKind(slot) === 'blank_canvas') {
        const transitBirth = dailyTransitBirthForBlankCanvas();
        transientBirthMap[idx] = transitBirth;
        resolvePreviewBirthBySlotRef.current.set(idx, transitBirth);
      }
    }

    const seedIdx = populated[0]!;
    const seedSlot = input.slots[seedIdx];
    const overridesNorm = normalizeSandboxOverrides(seedSlot?.overrides ?? { planets: {} });
    const seedKind = slotWirePopulationKind(seedSlot ?? { overrides: { planets: {} } });
    let birthForSnap: SandboxBirth | null = null;

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
        birthForSnap = seedSlot?.ephemeris_birth ?? resolvePreviewBirthBySlotRef.current.get(seedIdx) ?? null;
        if (!birthForSnap) {
          setGenerateError({ chart: 'First occupied slot needs complete birth data for resolve seed snapshot.' });
          return;
        }
      } else if (seedKind === 'blank_canvas') {
        birthForSnap = transientBirthMap[seedIdx] ?? null;
        if (!birthForSnap) {
          setGenerateError({ chart: 'Blank chart slot is missing transit birth for resolve.' });
          return;
        }
      } else {
        setGenerateError({ chart: 'First occupied slot is invalid for resolve seed.' });
        return;
      }
    } catch (e) {
      setGenerateError({ chart: e instanceof Error ? e.message : 'Chart fetch failed' });
      return;
    }

    setHasGenerated(true);
    setGenerateLoading(true);
    setGenerateError(null);
    setAudioGenerateError(null);
    dispatchComposition({ type: 'resolve_cleared' });
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    cancelPendingSnapshotSync();

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
      let snapshotUsed = snapData.snapshot as EphemerisSnapshot | null;
      const combinedHashUsed = (snapData.meta && snapData.meta.combinedHash) || null;
      if (!snapshotUsed || !combinedHashUsed) {
        setGenerateError({ chart: 'Snapshot response missing snapshot or combinedHash' });
        setGenerateLoading(false);
        return;
      }

      if (seedKind === 'blank_canvas') {
        const slot = compositionRef.current.compositionInput.slots[seedIdx];
        const userAsc =
          typeof slot?.free_build_asc_deg === 'number' && Number.isFinite(slot.free_build_asc_deg)
            ? slot.free_build_asc_deg
            : 0;
        snapshotUsed = applyBlankCanvasEqualHouses(snapshotUsed, userAsc);
      }

      const resolveBody = serializeSandboxResolveRequestBody(
        compositionRef.current,
        combinedHashUsed,
        {
          ...(Object.keys(transientBirthMap).length > 0
            ? { transientEphemerisBirthBySlotIndex: transientBirthMap }
            : {}),
          generateAudio: false,
        },
      );

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
        ...(resolved.sandboxSynastryReport ? { sandboxSynastryReport: resolved.sandboxSynastryReport } : {}),
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
      const exportUnavailableReasonNext: { summary: string; step?: string; message?: string } | null = null;
      const lastComposeProviderNext: string | null = null;
      const planSha256 = resolved.planSha256;

      const fpAtResolve = fingerprintResolveBodyExcludingSeed(resolveBody as Record<string, unknown>);
      if (fpAtResolve) {
        setCompositionFingerprintAtLastSeed(fpAtResolve);
      }
      const seedSlotIndex = seedIdx ?? activeIdx;
      setLastResolveSeedSlotIndex(seedSlotIndex);
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
      setGenerateError({ report: e instanceof Error ? e.message : 'Generate failed' });
    } finally {
      setGenerateLoading(false);
    }
  }, [audioRef, cancelPendingSnapshotSync, canGenerate, compositionRef, dispatchComposition, resolvePreviewBirthBySlotRef]);

  const handleGenerateAudio = useCallback(async () => {
    const model = compositionRef.current;
    const lr = model.lastResolve;
    if (lr?.source !== 'live_resolve' || !lr.lastSubmittedResolveBody) {
      setAudioGenerateError('Generate a text reading first.');
      return;
    }
    if (!lr.planSha256 || !lr.canonicalObjectHash) {
      setAudioGenerateError('Missing plan hash from the last text resolve.');
      return;
    }

    setAudioGenerateLoading(true);
    setAudioGenerateError(null);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }

    try {
      const base = getApiBaseUrl();
      const audioBody = {
        ...lr.lastSubmittedResolveBody,
        generateAudio: true,
        expectedPlanSha256: lr.planSha256,
        expectedObjectIdentityHash: lr.canonicalObjectHash,
      };
      const resolveRes = await fetch(`${base}/api/sandbox/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audioBody),
      });
      const resolveData = (await resolveRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!resolveRes.ok || resolveData.ok === false) {
        const msg =
          (resolveData.error as string) ||
          (resolveData.message as string) ||
          (typeof resolveData.code === 'string' ? resolveData.code : null) ||
          `Audio resolve: ${resolveRes.status}`;
        setAudioGenerateError(String(msg));
        dispatchComposition({
          type: 'resolve_audio_update',
          exportId: null,
          exportUnavailableReason: { summary: 'Audio generation failed', message: String(msg) },
        });
        return;
      }

      const resolved = extractSandboxResolvePayload(resolveData);
      const exportIdNext = resolved?.exportId ?? null;
      if (!exportIdNext) {
        setAudioGenerateError('Audio export unavailable.');
        dispatchComposition({
          type: 'resolve_audio_update',
          exportId: null,
          exportUnavailableReason: { summary: 'Export unavailable' },
        });
        return;
      }

      dispatchComposition({
        type: 'resolve_audio_update',
        exportId: exportIdNext,
        exportUnavailableReason: null,
      });
    } catch (e) {
      setAudioGenerateError(e instanceof Error ? e.message : 'Audio generation failed');
    } finally {
      setAudioGenerateLoading(false);
    }
  }, [audioRef, compositionRef, dispatchComposition]);

  const onToggleRelationalClassification = useCallback(
    (value: boolean) => {
      dispatchComposition({ type: 'set_commit_relational_classification', value });
    },
    [dispatchComposition],
  );

  return {
    canGenerate,
    generateDisabledReasons,
    generateLoading,
    generateError,
    hasGenerated,
    sandboxAudioSrc,
    lastResolveSeedSlotIndex,
    lastResolveSeedCombinedHash,
    compositionFingerprintAtLastSeed,
    handleGenerate,
    clearGenerateError,
    clearSeedFingerprintState,
    prepareForLoad,
    showRelationalClassification,
    commitRelationalClassification: compositionModel.compositionInput.commit_relational_classification === true,
    onToggleRelationalClassification,
    populatedSlotIndices,
    isMultiChartAggregate,
    resolveOutputStaleVsPreview,
    resolveDocumentStaleVsLastResolve,
    audioGenerateLoading,
    audioGenerateError,
    handleGenerateAudio,
    clearAudioGenerateError,
  };
}
