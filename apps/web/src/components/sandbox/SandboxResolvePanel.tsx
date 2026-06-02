'use client';

import type { SandboxCompositionInputState, SandboxReport } from '../../types/sandbox';

export interface SandboxResolvePanelProps {
  canGenerate: boolean;
  generateDisabledReasons: string[];
  generateLoading: boolean;
  generateError: { chart?: string; report?: string; audio?: string } | null;
  hasGenerated: boolean;
  compositionInput: SandboxCompositionInputState;
  saveLoading: boolean;
  saveError: string | null;
  canSave: boolean;
  displayReport: SandboxReport | null;
  exportId: string | null;
  populatedSlotIndices: number[];
  isMultiChartAggregate: boolean;
  canonicalSlotOrder: string[] | null;
  canonicalInputHash: string | null;
  lastResolveSeedSlotIndex: number | null;
  lastResolveSeedCombinedHash: string | null;
  compositionFingerprintAtLastSeed: string | null;
  resolveOutputStaleVsPreview: boolean;
  resolveDocumentStaleVsLastResolve: boolean;
  showRelationalClassification: boolean;
  commitRelationalClassification: boolean;
  onToggleRelationalClassification: (value: boolean) => void;
  onGenerate: () => void;
  onSave: () => void;
  /** Primary action label when idle (loading always "Resolving…"). */
  generateButtonLabel?: string;
  /** Simplified resolve copy for blank-canvas (Path A) vs standard multi-slot / birth flows. */
  resolveUiMode?: 'blank_canvas' | 'standard';
}

export function SandboxResolvePanel({
  canGenerate,
  generateDisabledReasons,
  generateLoading,
  generateError,
  hasGenerated,
  compositionInput,
  saveLoading,
  saveError,
  canSave,
  displayReport,
  exportId,
  populatedSlotIndices,
  isMultiChartAggregate,
  canonicalSlotOrder,
  canonicalInputHash,
  lastResolveSeedSlotIndex,
  lastResolveSeedCombinedHash,
  compositionFingerprintAtLastSeed,
  resolveOutputStaleVsPreview,
  resolveDocumentStaleVsLastResolve,
  showRelationalClassification,
  commitRelationalClassification,
  onToggleRelationalClassification,
  onGenerate,
  onSave,
  generateButtonLabel = 'Generate from current composition',
  resolveUiMode = 'standard',
}: SandboxResolvePanelProps) {
  const isBlankCanvasUi = resolveUiMode === 'blank_canvas';

  return (
    <>
      <h2 className="text-xl font-semibold text-text mb-1">
        {isBlankCanvasUi ? 'Build composition' : 'Resolve composition'}
      </h2>
      {isBlankCanvasUi ? (
        <p className="text-sm text-subtext mb-4">
          Build a reading from the chart you&apos;ve composed on the wheel.
        </p>
      ) : (
        <>
          <p className="text-xs text-subtext mb-2">
            <span className="font-medium text-text">Generate</span> runs unified resolve using every{' '}
            <span className="font-medium text-text">occupied</span> slot in{' '}
            <span className="font-medium text-text">ascending slot index order</span> (empty rows are ignored). Each slot may be a stored{' '}
            <span className="font-medium text-text">chart_id</span> or <span className="font-medium text-text">ephemeris_birth</span>, with per-slot
            overrides applied for resolve. One slot → single compose; two occupied slots → pair aggregate; three or more → group aggregate. The wheel
            preview still follows the active slot only.
          </p>
          {populatedSlotIndices.length > 0 ? (
            <p className="text-xs text-subtext mb-4 font-mono">
              Membership: {populatedSlotIndices.length} occupied (indices {populatedSlotIndices.join(', ')})
              {isMultiChartAggregate ? ' · seed snapshot uses first occupied slot only; all slots participate in resolve' : ''}
            </p>
          ) : (
            <p className="text-xs text-subtext mb-4">No occupied slots yet—add birth or import per slot above.</p>
          )}
        </>
      )}
      {showRelationalClassification && (
        <label className="flex items-start gap-2 mb-3 text-xs text-subtext cursor-pointer select-none max-w-xl">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={commitRelationalClassification === true}
            onChange={(e) => onToggleRelationalClassification(e.target.checked)}
          />
          <span>
            Commit relational classification (Friend/Lover lens). Off for preview; turn on when generating a full reading so compatibility classification runs on two saved charts.
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onGenerate}
          disabled={!canGenerate || generateLoading}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generateLoading ? 'Resolving…' : generateButtonLabel}
        </button>
        {canSave && (
          <button
            onClick={onSave}
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
            {generateLoading ? 'Generating…' : generateError?.audio ? 'Failed' : exportId ? 'Ready' : 'Not generated'}
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
            From the last successful resolve. If you edited the wheel afterward, use{' '}
            <span className="font-medium text-text">{generateButtonLabel}</span> above—do not rely on this block as the live composition.
          </p>
          {(resolveOutputStaleVsPreview || resolveDocumentStaleVsLastResolve) && (
            <p className="text-xs text-amber-500/90">
              {resolveDocumentStaleVsLastResolve
                ? 'Composition document changed since last resolve—Generate again before trusting this output.'
                : 'Output does not reflect current preview.'}
            </p>
          )}
          {compositionFingerprintAtLastSeed != null &&
            lastResolveSeedSlotIndex != null &&
            lastResolveSeedCombinedHash != null && (
              <div className="mt-2 rounded border border-border/60 bg-bgElev/40 p-2 font-mono text-caption text-subtext space-y-1">
                <p>
                  <span className="font-medium text-text">Resolve seed snapshot</span> used slot{' '}
                  <span className="text-text">{lastResolveSeedSlotIndex}</span>
                  {compositionInput.active_slot_index !== lastResolveSeedSlotIndex ? (
                    <span className="text-amber-400/90">
                      {' '}
                      (active slot is {compositionInput.active_slot_index}; wheel preview follows active slot.)
                    </span>
                  ) : null}
                </p>
                <p>
                  <span className="font-medium text-text">Seed combined hash:</span>{' '}
                  <code className="break-all text-caption">{lastResolveSeedCombinedHash}</code>
                </p>
              </div>
            )}
        </div>
      )}
    </>
  );
}
