'use client';

import { useState, useCallback } from 'react';
import { ChartSearchCombobox } from './ChartSearchCombobox';
import { SANDBOX_MAX_SLOTS } from '../../lib/sandbox-composition-state';
import type { SandboxCompositionInputState } from '../../types/sandbox';
import type { SlotProjectionRow } from '../../lib/sandbox-slot-projection';

export interface SandboxSlotComposerProps {
  compositionInput: SandboxCompositionInputState;
  slotProjectionRows: SlotProjectionRow[];
  onSetActiveSlot: (index: number) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onClearSlot: (index: number) => void;
  onImportChart: (chartId: string) => Promise<void>;
}

export function SandboxSlotComposer({
  compositionInput,
  slotProjectionRows,
  onSetActiveSlot,
  onAddSlot,
  onRemoveSlot,
  onClearSlot,
  onImportChart,
}: SandboxSlotComposerProps) {
  const [chartIdImportInput, setChartIdImportInput] = useState('');
  const [pendingImportChartId, setPendingImportChartId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    const fromPending = pendingImportChartId?.trim() ?? '';
    const fromInput = chartIdImportInput.trim();
    const rawId = fromPending || (fromInput.startsWith('chart_') ? fromInput : '');
    if (!rawId) {
      setImportError('Search for a chart and pick a result, or paste a chart ID');
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      await onImportChart(rawId);
      setChartIdImportInput('');
      setPendingImportChartId(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }, [chartIdImportInput, pendingImportChartId, onImportChart]);

  return (
    <div className="card">
      <p className="text-sm font-semibold text-text mb-2">
        Slots: <span className="font-normal text-subtext">{compositionInput.slots.length}</span> · active:{' '}
        <span className="font-mono text-text">{compositionInput.active_slot_index}</span>
      </p>
      <button
        type="button"
        disabled={compositionInput.slots.length >= SANDBOX_MAX_SLOTS}
        onClick={onAddSlot}
        className="mb-3 px-2 py-1 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text disabled:opacity-50"
        title={
          compositionInput.slots.length >= SANDBOX_MAX_SLOTS
            ? `Maximum ${SANDBOX_MAX_SLOTS} slots`
            : undefined
        }
      >
        Add slot
      </button>
      <div className="flex flex-wrap gap-2">
        {slotProjectionRows.map((row) => {
          const active = row.index === compositionInput.active_slot_index;
          const nSlots = compositionInput.slots.length;
          return (
            <div
              key={row.index}
              className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 text-xs max-w-full ${
                active
                  ? row.isManualStyle
                    ? 'border-primary border-dashed bg-primary/5'
                    : 'border-primary bg-primary/10'
                  : row.isManualStyle
                    ? 'border-dashed border-border/80 bg-transparent'
                    : 'border-border bg-bgElev/50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSetActiveSlot(row.index)}
                className="text-left min-w-0 flex-1 truncate"
              >
                <span className="text-text">{row.chipText}</span>
              </button>
              <button
                type="button"
                disabled={nSlots <= 1}
                onClick={() => onRemoveSlot(row.index)}
                className="shrink-0 px-1.5 py-0.5 rounded border border-border/80 bg-bgElev/80 hover:bg-bgElev disabled:opacity-40 text-subtext text-caption"
                title="Remove slot"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => onClearSlot(row.index)}
                className="shrink-0 px-1.5 py-0.5 rounded border border-border/80 bg-bgElev/80 hover:bg-bgElev text-subtext text-caption"
                title="Clear slot"
              >
                Clear
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-subtext mt-3">Composition slots and resolve payload stay in sync; the wheel follows the active slot.</p>
      <div className="mt-4 pt-3 border-t border-border/60">
        <p className="text-xs font-medium text-text mb-1">Import chart</p>
        <p className="text-xs text-subtext mb-2">
          Search by name or handle, then import into the active slot. After a successful import, a new empty slot is added so you can load another chart.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <ChartSearchCombobox
            value={chartIdImportInput}
            onChange={(v) => {
              setChartIdImportInput(v);
              setPendingImportChartId(null);
              if (importError) setImportError(null);
            }}
            onSelectChartId={(id) => setPendingImportChartId(id)}
            disabled={importLoading}
          />
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={importLoading}
            className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 disabled:opacity-50 text-text shrink-0"
          >
            {importLoading ? 'Importing…' : 'Import'}
          </button>
        </div>
        {importError ? <p className="text-xs text-red-400 mt-2">{importError}</p> : null}
      </div>
    </div>
  );
}
