/**
 * Read-only projection of compositionInput.slots for display. No state, no engine duplication.
 */

import type { SandboxCompositionInputState, SandboxCompositionSlotWire } from '../types/sandbox';

export type SlotContentKind = 'empty' | 'birth' | 'chart';

export type SlotProjectionRow = {
  index: number;
  kind: SlotContentKind;
  /** Short label for UI; not a second identity. */
  summary: string;
};

function hasChartId(slot: SandboxCompositionSlotWire): boolean {
  return typeof slot.chart_id === 'string' && slot.chart_id.trim().length > 0;
}

function hasEphemerisBirth(slot: SandboxCompositionSlotWire): boolean {
  const b = slot.ephemeris_birth;
  return !!(
    b &&
    typeof b.date === 'string' &&
    b.date.length >= 8 &&
    typeof b.time === 'string' &&
    b.time.length >= 4
  );
}

/**
 * Derive one row per slot from the composition document only.
 */
export function projectSlotsFromCompositionInput(input: SandboxCompositionInputState): SlotProjectionRow[] {
  const { slots } = input;
  return slots.map((slot, index) => {
    if (hasChartId(slot)) {
      const id = String(slot.chart_id).trim();
      return {
        index,
        kind: 'chart' as const,
        summary: id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id,
      };
    }
    if (hasEphemerisBirth(slot)) {
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
