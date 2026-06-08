'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChartSearchCombobox } from './ChartSearchCombobox';
import { BirthDataForm } from './BirthDataForm';
import { Button } from '../shared/Button';
import { SANDBOX_MAX_SLOTS } from '../../lib/sandbox-composition-state';
import type { SandboxCompositionInputState, SandboxBirth, SandboxSlotEntryMode } from '../../types/sandbox';
import type { SlotProjectionRow } from '../../lib/sandbox-slot-projection';

export interface SandboxSlotComposerProps {
  compositionInput: SandboxCompositionInputState;
  slotProjectionRows: SlotProjectionRow[];
  onSetActiveSlot: (index: number) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onClearSlot: (index: number) => void;
  onImportChart: (chartId: string) => Promise<void>;
  activeSlotEntryMode: SandboxSlotEntryMode | null;
  activeSlotHasBirth: boolean;
  activeSlotHasChartId: boolean;
  onSetEntryMode: (mode: SandboxSlotEntryMode) => void;
  onBirthSubmit: (birth: SandboxBirth) => Promise<void>;
  birthFormLoading?: boolean;
}

export function SandboxSlotComposer({
  compositionInput,
  slotProjectionRows,
  onSetActiveSlot,
  onAddSlot,
  onRemoveSlot,
  onClearSlot,
  onImportChart,
  activeSlotEntryMode,
  activeSlotHasBirth,
  activeSlotHasChartId,
  onSetEntryMode,
  onBirthSubmit,
  birthFormLoading = false,
}: SandboxSlotComposerProps) {
  const [chartIdImportInput, setChartIdImportInput] = useState('');
  const [pendingImportChartId, setPendingImportChartId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportSearch, setShowImportSearch] = useState(false);

  const activeIndex = compositionInput.active_slot_index;
  const slotNeedsEntry = !activeSlotHasChartId && !activeSlotHasBirth && activeSlotEntryMode == null;
  const showBirthForm = activeSlotEntryMode === 'birth_data' && !activeSlotHasBirth && !activeSlotHasChartId;

  useEffect(() => {
    setShowImportSearch(false);
    setImportError(null);
    setChartIdImportInput('');
    setPendingImportChartId(null);
  }, [activeIndex, activeSlotEntryMode, activeSlotHasBirth, activeSlotHasChartId]);

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
      setShowImportSearch(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }, [chartIdImportInput, pendingImportChartId, onImportChart]);

  const showBottomSection = slotNeedsEntry || showBirthForm;

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">Astrology Composition</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {compositionInput.slots.length} slot{compositionInput.slots.length === 1 ? '' : 's'} · editing slot{' '}
            {activeIndex + 1}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={compositionInput.slots.length >= SANDBOX_MAX_SLOTS}
          onClick={onAddSlot}
          title={
            compositionInput.slots.length >= SANDBOX_MAX_SLOTS
              ? `Maximum ${SANDBOX_MAX_SLOTS} slots`
              : undefined
          }
        >
          Add slot
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {slotProjectionRows.map((row) => {
          const active = row.index === activeIndex;
          const nSlots = compositionInput.slots.length;
          return (
            <div
              key={row.index}
              className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 text-xs max-w-full transition-colors ${
                active
                  ? row.isManualStyle
                    ? 'border-primary ring-2 ring-primary/25 bg-primary/10'
                    : 'border-primary ring-2 ring-primary/25 bg-primary/10'
                  : row.isManualStyle
                    ? 'border-dashed border-border/80 bg-transparent hover:border-border'
                    : 'border-border bg-bgElev/50 hover:border-border/80'
              }`}
            >
              <button
                type="button"
                onClick={() => onSetActiveSlot(row.index)}
                className="text-left min-w-0 flex-1 truncate"
              >
                <span className={active ? 'font-medium text-text-primary' : 'text-text-primary'}>{row.chipText}</span>
              </button>
              <button
                type="button"
                disabled={nSlots <= 1}
                onClick={() => onRemoveSlot(row.index)}
                className="shrink-0 px-1.5 py-0.5 rounded border border-border/80 bg-bgElev/80 hover:bg-bgElev disabled:opacity-40 text-text-secondary text-caption"
                title="Remove slot"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => onClearSlot(row.index)}
                className="shrink-0 px-1.5 py-0.5 rounded border border-border/80 bg-bgElev/80 hover:bg-bgElev text-text-secondary text-caption"
                title="Clear slot"
              >
                Clear
              </button>
            </div>
          );
        })}
      </div>

      {showBottomSection ? (
        <div className="mt-6 pt-6 border-t border-border/60">
          {showBirthForm ? (
            <div className="space-y-4 max-w-xl">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Birth data</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Enter a date, time, and location to load a chart. You can move planets afterward.
                </p>
              </div>
              <BirthDataForm
                key={`birth-${activeIndex}`}
                onSubmit={onBirthSubmit}
                isLoading={birthFormLoading}
              />
            </div>
          ) : slotNeedsEntry && showImportSearch ? (
            <div className="space-y-3 max-w-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-text-primary">Import chart</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportSearch(false);
                    setImportError(null);
                  }}
                  className="text-xs text-text-secondary hover:text-text-primary underline-offset-2 hover:underline"
                >
                  Back
                </button>
              </div>
              <p className="text-sm text-text-secondary">
                Search by name or handle, then import into this slot. After a successful import, a new empty slot is
                added automatically.
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleImport()}
                  disabled={importLoading}
                  loading={importLoading}
                >
                  {importLoading ? 'Importing…' : 'Import'}
                </Button>
              </div>
              {importError ? <p className="text-xs text-red-400">{importError}</p> : null}
            </div>
          ) : slotNeedsEntry ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setShowImportSearch(true)}
                className="flex flex-col items-start text-left p-4 rounded-xl border border-border bg-bgElev hover:border-primary/40 hover:bg-primary/5 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[88px]"
              >
                <span className="text-sm font-semibold text-text-primary">Import</span>
                <span className="text-xs text-text-secondary mt-2 leading-relaxed">Search for a saved chart</span>
              </button>
              <button
                type="button"
                onClick={() => onSetEntryMode('birth_data')}
                className="flex flex-col items-start text-left p-4 rounded-xl border border-border bg-bgElev hover:border-primary/40 hover:bg-primary/5 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[88px]"
              >
                <span className="text-sm font-semibold text-text-primary">Birth Data</span>
                <span className="text-xs text-text-secondary mt-2 leading-relaxed">Enter date, time &amp; location</span>
              </button>
              <button
                type="button"
                onClick={() => onSetEntryMode('blank_canvas')}
                className="flex flex-col items-start text-left p-4 rounded-xl border border-border bg-bgElev hover:border-primary/40 hover:bg-primary/5 transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[88px]"
              >
                <span className="text-sm font-semibold text-text-primary">Blank Chart</span>
                <span className="text-xs text-text-secondary mt-2 leading-relaxed">Start with an empty wheel</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
