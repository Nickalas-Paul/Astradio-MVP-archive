'use client';

import { useState, useCallback, useRef, useReducer, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { Button } from '../../src/components/shared/Button';
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
} from '../../src/lib/sandbox-composition-state';
import { projectSlotsFromCompositionInput } from '../../src/lib/sandbox-slot-projection';
import { equalHouseCuspsFromAscendant } from '../../src/lib/equal-house-cusps';
import { chartApiOwnerDisplayLabel, chartApiRecordToSandboxBirthWire } from '../../src/lib/sandbox-bff-wire';
import { useSandboxPreviewSync, type SandboxSurfaceState } from '../../src/hooks/useSandboxPreviewSync';
import { useSandboxGenerate } from '../../src/hooks/useSandboxGenerate';
import { useSandboxPersistence } from '../../src/hooks/useSandboxPersistence';
import type { EphemerisSnapshot, SandboxSnapshotMeta } from '../../src/types/sandbox';

export default function SandboxPage() {
  const [compositionModel, dispatchComposition] = useReducer(
    sandboxCompositionReducer,
    createInitialSandboxCompositionModelState(),
  );
  const compositionRef = useRef(compositionModel);
  compositionRef.current = compositionModel;

  const [surfaceState, setSurfaceState] = useState<SandboxSurfaceState>('ready_builder');
  const [error, setError] = useState<string | null>(null);

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
  const canonicalSlotOrder = lastResolve?.source === 'live_resolve' ? lastResolve.canonicalSlotOrder : null;
  const canonicalInputHash = lastResolve?.source === 'live_resolve' ? lastResolve.canonicalInputHash : null;
  const lastCombinedHashUsed = lastResolve?.combinedHashUsed ?? preview.snapshotMeta?.combinedHash ?? null;

  const birth = activeSlotBirth(compositionModel);
  const overrides = activeSlotOverrides(compositionModel);

  const slotProjectionRows = useMemo(
    () => projectSlotsFromCompositionInput(compositionModel.compositionInput),
    [compositionModel.compositionInput],
  );

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
          chartData && typeof chartData === 'object' ? (chartData as Record<string, unknown>) : {},
        );
        const wire = chartApiRecordToSandboxBirthWire(chartData);
        resolvePreviewBirthBySlotRef.current.set(
          getActiveSlotIndexFromCompositionInput(compositionRef.current.compositionInput),
          wire,
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

  const activeEntryMode = activeSlotWire?.entry_mode ?? null;
  const slotNeedsWorkflowChoice =
    !birth && activeSlotKind !== 'chart_id' && activeEntryMode == null;
  const showBirthDataForm = !birth && activeSlotKind !== 'chart_id' && activeEntryMode === 'birth_data';
  const isBlankCanvasActive = activeEntryMode === 'blank_canvas' && activeSlotKind === 'empty';

  const generateButtonLabel = isBlankCanvasActive
    ? 'Build this composition'
    : 'Generate from current composition';

  const heroLead = useMemo(() => {
    if (isBlankCanvasActive) {
      return 'Place planets on the wheel, then build a reading from your composition.';
    }
    if (activeSlotKind === 'chart_id' || activeEntryMode === 'birth_data' || birth) {
      return 'Load a chart, make adjustments if you want, then generate a reading.';
    }
    return 'Build a chart on the wheel and degree panel, then generate a reading for what you see.';
  }, [activeSlotKind, activeEntryMode, birth, isBlankCanvasActive]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <h1 className="text-h1 font-bold text-text">Sandbox</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">{heroLead}</p>
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
                  generate.clearSeedFingerprintState();
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
                onRemoveSlot={previewSync.handleRemoveSlot}
                onClearSlot={previewSync.handleClearSlot}
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
                previewSyncError={previewSync.previewSyncError}
                onOverrideChange={previewSync.handleOverrideChange}
                onResetAll={previewSync.handleResetAllOverrides}
              />

              {slotNeedsWorkflowChoice && (
                <div className="card max-w-2xl">
                  <h2 className="text-xl font-semibold text-text mb-2">How do you want to start?</h2>
                  <p className="text-sm text-subtext mb-6">
                    Build a chart from scratch or start from a specific date, time, and location.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      className="flex-1"
                      onClick={() =>
                        dispatchComposition({ type: 'set_entry_mode', entryMode: 'blank_canvas' })
                      }
                    >
                      Start with a blank chart
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() =>
                        dispatchComposition({ type: 'set_entry_mode', entryMode: 'birth_data' })
                      }
                    >
                      Enter birth data
                    </Button>
                  </div>
                </div>
              )}

              {showBirthDataForm && (
                <div className="card max-w-2xl">
                  <h2 className="text-xl font-semibold text-text mb-1">Birth data</h2>
                  <p className="text-sm text-subtext mb-4">
                    Enter a date, time, and location to load a chart. You can move planets afterward.
                  </p>
                  <BirthDataForm onSubmit={previewSync.handleBirthSubmit} />
                </div>
              )}

              <div className="card">
                <SandboxResolvePanel
                  canGenerate={generate.canGenerate}
                  generateDisabledReasons={generate.generateDisabledReasons}
                  generateLoading={generate.generateLoading}
                  generateError={generate.generateError}
                  hasGenerated={generate.hasGenerated}
                  compositionInput={compositionModel.compositionInput}
                  saveLoading={persistence.saveLoading}
                  saveError={persistence.saveError}
                  canSave={persistence.canSave}
                  displayReport={displayReport}
                  exportId={exportId}
                  populatedSlotIndices={generate.populatedSlotIndices}
                  isMultiChartAggregate={generate.isMultiChartAggregate}
                  canonicalSlotOrder={canonicalSlotOrder}
                  canonicalInputHash={canonicalInputHash}
                  lastResolveSeedSlotIndex={generate.lastResolveSeedSlotIndex}
                  lastResolveSeedCombinedHash={generate.lastResolveSeedCombinedHash}
                  compositionFingerprintAtLastSeed={generate.compositionFingerprintAtLastSeed}
                  resolveOutputStaleVsPreview={generate.resolveOutputStaleVsPreview}
                  resolveDocumentStaleVsLastResolve={generate.resolveDocumentStaleVsLastResolve}
                  showRelationalClassification={generate.showRelationalClassification}
                  commitRelationalClassification={generate.commitRelationalClassification}
                  onToggleRelationalClassification={generate.onToggleRelationalClassification}
                  onGenerate={generate.handleGenerate}
                  onSave={persistence.handleSave}
                  generateButtonLabel={generateButtonLabel}
                  resolveUiMode={isBlankCanvasActive ? 'blank_canvas' : 'standard'}
                />
                <SandboxReportSections displayReport={displayReport} />
                {displayReport && (
                  <SandboxAudioPanel
                    displayReport={displayReport}
                    exportId={exportId}
                    sandboxAudioSrc={generate.sandboxAudioSrc}
                    planHash={planHash}
                    exportUnavailableReason={exportUnavailableReason}
                    audioRef={audioRef}
                    audioGenerateLoading={generate.audioGenerateLoading}
                    audioGenerateError={generate.audioGenerateError}
                    onGenerateAudio={generate.handleGenerateAudio}
                  />
                )}
                {generate.hasGenerated && (
                  <SandboxProvenancePanel
                    lastResolve={lastResolve}
                    planHash={planHash}
                    lastCombinedHashUsed={lastCombinedHashUsed}
                    exportId={exportId}
                    onExportJson={persistence.handleExportJson}
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
                  onOverrideChange={previewSync.handleOverrideChange}
                  onResetPlanet={handleResetPlanet}
                />
              </div>
              <SandboxSavedCompositions
                savedList={persistence.savedList}
                listLoading={persistence.listLoading}
                listError={persistence.listError}
                onRefresh={persistence.fetchSavedList}
                onLoad={persistence.handleLoadComposition}
              />
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
