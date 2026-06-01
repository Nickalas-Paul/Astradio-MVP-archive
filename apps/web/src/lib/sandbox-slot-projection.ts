/**
 * Read-only projection of compositionInput.slots for display. No state, no engine duplication.
 */

import type { SandboxCompositionInputState } from '../types/sandbox';
import { slotWirePopulationKind } from './sandbox-composition-state';

export type SlotContentKind = 'empty' | 'birth' | 'chart' | 'incomplete' | 'invalid_wire';

export type SlotProjectionRow = {
  index: number;
  kind: SlotContentKind;
  /** Single user-facing label on the chip (no slot index or "Chart ·" prefix). */
  chipText: string;
  /** Outlined chip style for manual / free-build slots. */
  isManualStyle?: boolean;
};

function chartSlotDisplayName(slot: SandboxCompositionInputState['slots'][number]): string {
  const stored = typeof slot.chart_display_name === 'string' ? slot.chart_display_name.trim() : '';
  if (stored) return stored;
  return 'Imported chart';
}

function manualChipText(manualOrdinal: number, manualCount: number): string {
  if (manualCount <= 1) return 'Manual';
  return `Manual ${manualOrdinal}`;
}

/**
 * Derive one row per slot from the composition document only.
 */
export function projectSlotsFromCompositionInput(input: SandboxCompositionInputState): SlotProjectionRow[] {
  const { slots } = input;

  const manualIndices: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slotWirePopulationKind(slots[i]) === 'empty') manualIndices.push(i);
  }
  const manualCount = manualIndices.length;

  return slots.map((slot, index) => {
    const k = slotWirePopulationKind(slot);
    if (k === 'invalid') {
      return {
        index,
        kind: 'invalid_wire' as const,
        chipText: 'Invalid',
      };
    }
    if (k === 'chart_id') {
      return {
        index,
        kind: 'chart' as const,
        chipText: chartSlotDisplayName(slot),
      };
    }
    if (k === 'birth_incomplete') {
      const b = slot.ephemeris_birth;
      const timeShort = b && b.time.length >= 5 ? b.time.slice(0, 5) : (b?.time ?? '');
      return {
        index,
        kind: 'incomplete' as const,
        chipText: b ? `${b.date} ${timeShort} (add location)` : 'Incomplete birth',
      };
    }
    if (k === 'ephemeris_birth') {
      const b = slot.ephemeris_birth!;
      const timeShort = b.time.length >= 5 ? b.time.slice(0, 5) : b.time;
      return {
        index,
        kind: 'birth' as const,
        chipText: `${b.date} ${timeShort}`,
      };
    }
    const manualOrdinal = manualIndices.indexOf(index) + 1;
    return {
      index,
      kind: 'empty' as const,
      chipText: manualChipText(manualOrdinal, manualCount),
      isManualStyle: true,
    };
  });
}
