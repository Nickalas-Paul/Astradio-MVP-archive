/**
 * Read-only projection of compositionInput.slots for display. No state, no engine duplication.
 */

import type { SandboxCompositionInputState } from '../types/sandbox';
import { slotWirePopulationKind } from './sandbox-composition-state';

export type SlotContentKind = 'empty' | 'birth' | 'chart' | 'incomplete' | 'invalid_wire';

export type SlotProjectionRow = {
  index: number;
  kind: SlotContentKind;
  /** Short label for UI; not a second identity. */
  summary: string;
};

/**
 * Derive one row per slot from the composition document only.
 */
export function projectSlotsFromCompositionInput(input: SandboxCompositionInputState): SlotProjectionRow[] {
  const { slots } = input;
  return slots.map((slot, index) => {
    const k = slotWirePopulationKind(slot);
    if (k === 'invalid') {
      return {
        index,
        kind: 'invalid_wire' as const,
        summary: 'Invalid (chart + birth)',
      };
    }
    if (k === 'chart_id') {
      const id = String(slot.chart_id).trim();
      return {
        index,
        kind: 'chart' as const,
        summary: id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id,
      };
    }
    if (k === 'birth_incomplete') {
      const b = slot.ephemeris_birth;
      const timeShort = b && b.time.length >= 5 ? b.time.slice(0, 5) : (b?.time ?? '');
      return {
        index,
        kind: 'incomplete' as const,
        summary: b ? `${b.date} ${timeShort} (add location)` : 'Incomplete birth',
      };
    }
    if (k === 'ephemeris_birth') {
      const b = slot.ephemeris_birth!;
      const timeShort = b.time.length >= 5 ? b.time.slice(0, 5) : b.time;
      return {
        index,
        kind: 'birth' as const,
        summary: `${b.date} ${timeShort}`,
      };
    }
    return {
      index,
      kind: 'empty' as const,
      summary: '—',
    };
  });
}
