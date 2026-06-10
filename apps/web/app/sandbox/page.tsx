'use client';

import { useState, useCallback, useRef, useReducer, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { Card } from '../../src/components/shared/Card';
import { PlacementHighlightProvider } from '../../src/core/PlacementHighlightContext';
import { DegreePanel } from '../../src/components/sandbox/DegreePanel';
import { SandboxReportSections } from '../../src/components/sandbox/SandboxReportSections';
import { SandboxSavedCompositions } from '../../src/components/sandbox/SandboxSavedCompositions';
import { SandboxWheelPanel } from '../../src/components/sandbox/SandboxWheelPanel';
import { SandboxSlotComposer } from '../../src/components/sandbox/SandboxSlotComposer';
import { SandboxEntryCards, type SandboxEntryMode } from '../../src/components/sandbox/SandboxEntryCards';
import { SandboxResolvePanel } from '../../src/components/sandbox/SandboxResolvePanel';
import { SandboxAudioPanel } from '../../src/components/sandbox/SandboxAudioPanel';
import { SandboxProvenancePanel } from '../../src/components/sandbox/SandboxProvenancePanel';
import { useSandboxDebugUi } from '../../src/hooks/useSandboxDebugUi';
import {
  activeSlotBirth,
  activeSlotOverrides,
  extractPlanSha256FromResolveResponse,
} from './page-helpers';
import type { SandboxBirth, PlanetKey } from '../../src/types/sandbox';
import { getApiBaseUrl } from '../../src/core/api-base';
import {
  createInitialSandboxCompositionModelState,
  normalizeSandboxOverrides,
  sandboxCompositionReducer,
  getActiveSlotIndexFromCompositionInput,
  slotWirePopulationKind,
  compositionOnlyBlankCanvasPopulated,
  compositionHasExistingData,
} from '../../src/lib/sandbox-composition-state';
import { projectSlotsFromCompositionInput } from '../../src/lib/sandbox-slot-projection';
import { equalHouseCuspsFromAscendant } from '../../src/lib/equal-house-cusps';
import { chartApiOwnerDisplayLabel, chartApiRecordToSandboxBirthWire } from '../../src/lib/sandbox-bff-wire';
import { useSandboxPreviewSync, type SandboxSurfaceState } from '../../src/hooks/useSandboxPreviewSync';
import { useSandboxGenerate } from '../../src/hooks/useSandboxGenerate';
import { useSandboxPersistence } from '../../src/hooks/useSandboxPersistence';
import type { EphemerisSnapshot, SandboxSnapshotMeta } from '../../src/types/sandbox';

export default function SandboxPage() {
  const sandboxDebug = useSandboxDebugUi();
  const [compositionModel, dispatchComposition] = useReducer(
    sandboxCompositionReducer,
    createInitialSandboxCompositionModelState(),
  );
  const compositionRef = useRef(compositionModel);
  compositionRef.current = compositionModel;

  const [surfaceState, setSurfaceState] = useState<SandboxSurfaceState>('ready_builder');
  const [error, setError] = useState<string | null>(null);
  const [entryLayer, setEntryLayer] = useState<'entry' | 'workbench'>('entry');
  const entryAutoSkipRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvePreviewBirthBySlotRef = useRef<Map<number, SandboxBirth>>(new Map());

  const clearGenerateErrorRef = useRef<() => void>(() => {});
  const cancelPreviewSyncRef = useRef<() => void>(() => {});

  const previewSync = useSandboxPreviewSync({
    compositionModel,
    dispatchComposition,
    compositionRef,
    resolvePreviewBirthBySlotRef,
    setSurfaceState,
    setError,
    onClearGenerateError: () => clearGenerateErrorRef.current(),
  });

  const generate = useSandboxGenerate({
    compositionModel,
    dispatchComposition,
    compositionRef,
    resolvePreviewBirthBySlotRef,
    audioRef,
    surfaceState,
    cancelPendingSnapshotSync: () => cancelPreviewSyncRef.current(),
  });

  clearGenerateErrorRef.current = generate.clearGenerateError;
  cancelPreviewSyncRef.current = previewSync.cancelPendingSnapshotSync;

  const persistence = useSandboxPersistence({
    compositionModel,
    dispatchComposition,
    resolvePreviewBirthBySlotRef,
    setSurfaceState,
    setError,
    surfaceState,
    hasGenerated: generate.hasGenerated,
    prepareForLoad: generate.prepareForLoad,
  });

  const preview = compositionModel.preview;
  const lastResolve = compositionModel.lastResolve;

  const displayReport = lastResolve?.report ?? null;
  const planHash = lastResolve?.planSha256 ?? null;
  const exportId = lastResolve?.exportId ?? null;
  const exportUnavailableReason = lastResolve?.source === 'live_resolve' ? lastResolve.exportUnavailableReason : null;
  const lastCombinedHashUsed = lastResolve?.combinedHashUsed ?? preview.snapshotMeta?.combinedHash ?? null;

  const birth = activeSlotBirth(compositionModel);
  const overrides = activeSlotOverrides(compositionModel);

  const slotProjectionRows = useMemo(
    () => projectSlotsFromCompositionInput(compositionModel.compositionInput),
    [compositionModel.compositionInput],
  );

  const hasExistingComposition = useMemo(
    () => compositionHasExistingData(compositionModel),
    [compositionModel]
  );

  useEffect(() => {
    if (!entryAutoSkipRef.current && hasExistingComposition) {
      setEntryLayer('workbench');
      entryAutoSkipRef.current = true;
    }
  }, [hasExistingComposition]);

  const handleEntrySelect = useCallback(
    (mode: SandboxEntryMode, slotCount: number) => {
      previewSync.cancelPendingSnapshotSync();
      resolvePreviewBirthBySlotRef.current.clear();
      generate.clearSeedFingerprintState();
      setError(null);
      setSurfaceState('ready_builder');

      dispatchComposition({ type: 'reset_all' });

      for (let i = 1; i < slotCount; i++) {
        dispatchComposition({ type: 'add_slot' });
      }
      if (slotCount > 1) {
        dispatchComposition({ type: 'set_active_slot', index: 0 });
      }

      if (mode === 'whatif') {
        dispatchComposition({ type: 'set_entry_mode', entryMode: 'blank_canvas' });
      }

      setEntryLayer('workbench');
      entryAutoSkipRef.current = true;
    },
    [generate, previewSync]
  );

  const handleEntryContinue = useCallback(() => {
    setEntryLayer('workbench');
  }, []);

  const handleImportChartById = useCallback(
    async (rawId: string) => {
      const trimmed = rawId.trim();
      if (!trimmed) {
        throw new Error('Search for a chart and pick a result, or paste a chart ID');
      }
      generate.clearGenerateError();
      setSurfaceState('loading_base');
      try {
        const base = getApiBaseUrl();
        const chartRes = await fetch(`${base}/api/charts/${encodeURIComponent(trimmed)}`, {
          credentials: 'same-origin',
        });
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
          chartData && typeof chartData === 'object' ? (chartData as Record<string, unknown>) : {},
        );
        const wire = chartApiRecordToSandboxBirthWire(chartData);
        if (
          !Number.isFinite(wire.location.lat) ||
          !Number.isFinite(wire.location.lon) ||
          !wire.date ||
          !wire.time
        ) {
          setSurfaceState('ready_builder');
          throw new Error(
            'This chart’s birth data is not available for wheel preview. Use Birth Data for manual entry, or import your own saved chart.',
          );
        }
        resolvePreviewBirthBySlotRef.current.set(
          getActiveSlotIndexFromCompositionInput(compositionRef.current.compositionInput),
          wire,
        );
        const overridesToUse = normalizeSandboxOverrides(activeSlotOverrides(compositionRef.current));
        const hasPreservedPlanetOverrides = Object.keys(overridesToUse.planets).length > 0;
        const snapRes = await fetch(`${base}/api/sandbox/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
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
    },
    [generate],
  );

  const handleAscendantChange = useCallback((lonDeg: number) => {
    dispatchComposition({ type: 'free_build_asc_changed', lonDeg });
  }, []);

  const handleResetPlanet = useCallback(
    (planet: PlanetKey) => previewSync.handleOverrideChange(planet, null),
    [previewSync.handleOverrideChange],
  );

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

  const resolveSynastryNotice =
    compositionModel.lastResolve?.source === 'live_resolve'
      ? (compositionModel.lastResolve.fullResponse.synastryNotice as string | undefined)
      : undefined;

  const currentSnapshot = preview.overriddenSnapshot || preview.baseSnapshot;
  const basePositions: Record<string, number> = {};
  if (preview.baseSnapshot) for (const p of preview.baseSnapshot.planets) basePositions[p.name] = p.lon;
  const cusps = currentSnapshot?.houses ?? [];

  const activeSlotIdx = getActiveSlotIndexFromCompositionInput(compositionModel.compositionInput);
  const activeSlotWire = compositionModel.compositionInput.slots[activeSlotIdx];
  const activeSlotKind = slotWirePopulationKind(activeSlotWire ?? { overrides: { planets: {} } });
  const isFreeBuildWheel = activeSlotKind === 'empty' || activeSlotKind === 'blank_canvas';
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

  const activeEntryMode = activeSlotWire?.entry_mode ?? null;
  const onlyBlankCanvasPopulated = compositionOnlyBlankCanvasPopulated(compositionModel.compositionInput);

  const generateButtonLabel = onlyBlankCanvasPopulated
    ? 'Build this composition'
    : 'Generate from current composition';

  const birthFormLoading = surfaceState === 'loading_base';

  const workbenchSubtitle = useMemo(() => {
    if (onlyBlankCanvasPopulated) {
      return 'Place planets on the wheel, then build a reading from your composition.';
    }
    return 'Compose a chart, then generate a reading and soundtrack.';
  }, [onlyBlankCanvasPopulated]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        {entryLayer === 'entry' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-h1 font-serif font-bold text-text-primary">Sandbox</h1>
              <p className="text-body text-text-secondary max-w-lg mx-auto">
                Build charts, explore connections, and hear what the configurations sound like.
              </p>
            </div>
            <SandboxEntryCards
              onSelect={handleEntrySelect}
              onContinue={handleEntryContinue}
              hasExistingComposition={hasExistingComposition}
            />
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setEntryLayer('entry')}
                className="text-body-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                ← Back to options
              </button>
              <div className="text-center space-y-4">
                <h1 className="text-h1 font-serif font-bold text-text-primary">Sandbox</h1>
                <p className="text-lg text-text-secondary max-w-2xl mx-auto">{workbenchSubtitle}</p>
              </div>
            </motion.div>

        {surfaceState === 'loading_base' && (
          <Card className="max-w-2xl mx-auto text-center">
            <p className="text-text-secondary">Loading chart...</p>
          </Card>
        )}

        {surfaceState === 'error' && error && (
          <Card className="max-w-2xl mx-auto">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => {
                  setSurfaceState('ready_builder');
                  setError(null);
                  resolvePreviewBirthBySlotRef.current.clear();
                  generate.clearSeedFingerprintState();
                  dispatchComposition({ type: 'reset_all' });
                }}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm"
              >
                Reset
              </button>
            </div>
          </Card>
        )}

        {sandboxDebug &&
          (surfaceState === 'ready_builder' || surfaceState === 'syncing_overrides' || surfaceState === 'ready_report') &&
          currentSnapshot && (
          <details className="rounded-xl border border-border bg-surface-1 shadow-md p-4 mt-4">
            <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary">Snapshot verification</summary>
            <div className="mt-3 text-xs font-mono text-text-secondary space-y-1">
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
          <PlacementHighlightProvider>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <SandboxSlotComposer
                compositionInput={compositionModel.compositionInput}
                slotProjectionRows={slotProjectionRows}
                onSetActiveSlot={(i) => dispatchComposition({ type: 'set_active_slot', index: i })}
                onAddSlot={() => dispatchComposition({ type: 'add_slot' })}
                onRemoveSlot={previewSync.handleRemoveSlot}
                onClearSlot={previewSync.handleClearSlot}
                onImportChart={handleImportChartById}
                activeSlotEntryMode={activeEntryMode}
                activeSlotHasBirth={!!birth}
                activeSlotHasChartId={!!activeSlotWire?.chart_id}
                onSetEntryMode={(mode) => dispatchComposition({ type: 'set_entry_mode', entryMode: mode })}
                onBirthSubmit={previewSync.handleBirthSubmit}
                birthFormLoading={birthFormLoading}
              />

              <SandboxWheelPanel
                currentSnapshot={currentSnapshot}
                overrides={overrides}
                isUpdating={surfaceState === 'syncing_overrides'}
                synastryNotice={resolveSynastryNotice ?? null}
                freeBuild={isFreeBuildWheel}
                ascendantOverrideDeg={freeBuildAscDeg}
                activeSlotIndex={compositionModel.compositionInput.active_slot_index}
                previewSyncError={previewSync.previewSyncError}
                onOverrideChange={previewSync.handleOverrideChange}
                onResetAll={previewSync.handleResetAllOverrides}
                entryMode={activeEntryMode}
              />

              <Card>
                <SandboxResolvePanel
                  canGenerate={generate.canGenerate}
                  generateDisabledReasons={generate.generateDisabledReasons}
                  generateLoading={generate.generateLoading}
                  generateError={generate.generateError}
                  saveLoading={persistence.saveLoading}
                  saveError={persistence.saveError}
                  canSave={persistence.canSave}
                  onGenerate={generate.handleGenerate}
                  onSave={persistence.handleSave}
                  generateButtonLabel={generateButtonLabel}
                  resolveUiMode={onlyBlankCanvasPopulated ? 'blank_canvas' : 'standard'}
                />
                <SandboxReportSections displayReport={displayReport} />
                {displayReport && (
                  <SandboxAudioPanel
                    displayReport={displayReport}
                    exportId={exportId}
                    sandboxAudioSrc={generate.sandboxAudioSrc}
                    exportUnavailableReason={exportUnavailableReason}
                    audioRef={audioRef}
                    audioGenerateLoading={generate.audioGenerateLoading}
                    audioGenerateError={generate.audioGenerateError}
                    onGenerateAudio={generate.handleGenerateAudio}
                  />
                )}
                {sandboxDebug && generate.hasGenerated && (
                  <SandboxProvenancePanel
                    lastResolve={lastResolve}
                    planHash={planHash}
                    lastCombinedHashUsed={lastCombinedHashUsed}
                    exportId={exportId}
                    onExportJson={persistence.handleExportJson}
                    onReplay={handleReplay}
                  />
                )}
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <Card>
                <DegreePanel
                  overrides={overrides}
                  basePositions={basePositions}
                  cusps={displayCusps}
                  ascendantLon={ascendantLonForPanel}
                  ascendantEditable={isFreeBuildWheel}
                  onAscendantChange={handleAscendantChange}
                  onOverrideChange={previewSync.handleOverrideChange}
                  onResetPlanet={handleResetPlanet}
                  entryMode={activeEntryMode}
                />
              </Card>
              <SandboxSavedCompositions
                savedList={persistence.savedList}
                listLoading={persistence.listLoading}
                listError={persistence.listError}
                onRefresh={persistence.fetchSavedList}
                onLoad={persistence.handleLoadComposition}
              />
            </motion.div>
          </div>
          </PlacementHighlightProvider>
        )}
          </>
        )}
      </div>
    </AppShell>
  );
}
