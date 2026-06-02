'use client';

export interface SandboxResolvePanelProps {
  canGenerate: boolean;
  generateDisabledReasons: string[];
  generateLoading: boolean;
  generateError: { chart?: string; report?: string; audio?: string } | null;
  saveLoading: boolean;
  saveError: string | null;
  canSave: boolean;
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
  saveLoading,
  saveError,
  canSave,
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
      <h2 className="text-xl font-semibold text-text mb-4">
        {isBlankCanvasUi ? 'Build composition' : 'Resolve composition'}
      </h2>
      {isBlankCanvasUi ? (
        <p className="text-sm text-subtext mb-4 -mt-2">
          Build a reading from the chart you&apos;ve composed on the wheel.
        </p>
      ) : null}
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
      {generateError && (generateError.chart || generateError.report || generateError.audio) && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {generateError.chart && <p>{generateError.chart}</p>}
          {generateError.report && <p>{generateError.report}</p>}
          {generateError.audio && <p>{generateError.audio}</p>}
        </div>
      )}
    </>
  );
}
