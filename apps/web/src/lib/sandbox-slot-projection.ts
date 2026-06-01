/**
 * Read-only projection of compositionInput.slots for display. No state, no engine duplication.
 */

import type { SandboxCompositionInputState } from '../types/sandbox';
import { slotWirePopulationKind } from './sandbox-composition-state';

export type SlotContentKind = 'empty' | 'birth' | 'chart' | 'incomplete' | 'invalid_wire';

export type SlotProjectionRow = {
  index: number;
  kind: SlotContentKind;
  /** Short chip title (Chart, Birth, Free build, …). */
  chipLabel: string;
  /** Detail after the middle dot; omit when empty. */
  summary: string;
};

function slotHasPlanetOverrides(slot: SandboxCompositionInputState['slots'][number]): boolean {
  return Object.keys(slot.overrides?.planets ?? {}).length > 0;
}

function chartSlotDisplaySummary(slot: SandboxCompositionInputState['slots'][number]): string {
  const stored = typeof slot.chart_display_name === 'string' ? slot.chart_display_name.trim() : '';
  if (stored) return stored;
  return 'Imported chart';
}

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
        chipLabel: 'Invalid',
        summary: 'chart + birth',
      };
    }
    if (k === 'chart_id') {
      return {
        index,
        kind: 'chart' as const,
        chipLabel: 'Chart',
        summary: chartSlotDisplaySummary(slot),
      };
    }
    if (k === 'birth_incomplete') {
      const b = slot.ephemeris_birth;
      const timeShort = b && b.time.length >= 5 ? b.time.slice(0, 5) : (b?.time ?? '');
      return {
        index,
        kind: 'incomplete' as const,
        chipLabel: 'Birth',
        summary: b ? `${b.date} ${timeShort} (add location)` : 'Incomplete birth',
      };
    }
    if (k === 'ephemeris_birth') {
      const b = slot.ephemeris_birth!;
      const timeShort = b.time.length >= 5 ? b.time.slice(0, 5) : b.time;
      return {
        index,
        kind: 'birth' as const,
        chipLabel: 'Birth',
        summary: `${b.date} ${timeShort}`,
      };
    }
    if (slotHasPlanetOverrides(slot)) {
      return {
        index,
        kind: 'empty' as const,
        chipLabel: 'Free build',
        summary: '',
      };
    }
    return {
      index,
      kind: 'empty' as const,
      chipLabel: 'Manual',
      summary: '',
    };
  });
}
