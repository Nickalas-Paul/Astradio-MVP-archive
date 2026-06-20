'use client';

export interface SandboxResolvePanelProps {
  canGenerate: boolean;
  generateDisabledReasons: string[];
  generateLoading: boolean;
  generateError: { chart?: string; report?: string; audio?: string } | null;
  saveLoading: boolean;
  saveError: string | null;
  canSave: boolean;
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
  onGenerate,
  onSave,
  generateButtonLabel = 'Compose from current',
  resolveUiMode = 'standard',
}: SandboxResolvePanelProps) {
  const isBlankCanvasUi = resolveUiMode === 'blank_canvas';

  return (
    <>
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        {isBlankCanvasUi ? 'Build composition' : 'Resolve composition'}
      </h2>
      {isBlankCanvasUi ? (
        <p className="text-sm text-text-secondary mb-4 -mt-2">
          Build a reading from the chart you&apos;ve composed on the wheel.
        </p>
      ) : null}
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
            className="px-4 py-2 bg-bgElev border border-border rounded-lg font-medium hover:bg-bgElev/80 disabled:opacity-50 text-text-primary"
          >
            {saveLoading ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}
      {!canGenerate && (
        <div className="mt-3 text-xs text-text-secondary">
          <p className="mb-1 text-text-primary font-medium">Resolve unavailable until:</p>
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
