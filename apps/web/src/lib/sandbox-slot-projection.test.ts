/**
 * Run: npx tsx apps/web/src/lib/sandbox-slot-projection.test.ts
 */
import assert from 'node:assert';
import type { SandboxCompositionInputState } from '../types/sandbox';
import { projectSlotsFromCompositionInput } from './sandbox-slot-projection';

function input(slots: SandboxCompositionInputState['slots']): SandboxCompositionInputState {
  return {
    schema_version: '1',
    slots,
    active_slot_index: 0,
    compose_controls: {},
    output_kind: 'full',
  };
}

function chartSlot(id: string, name: string) {
  return { chart_id: id, chart_display_name: name, overrides: { planets: {} } };
}

function emptySlot() {
  return { overrides: { planets: {} } };
}

// Imported charts: display name only, no #N Chart · prefix
{
  const rows = projectSlotsFromCompositionInput(
    input([chartSlot('c1', 'Nickster'), chartSlot('c2', 'Wixbu'), chartSlot('c3', 'Nico')])
  );
  assert.deepStrictEqual(
    rows.map((r) => r.chipText),
    ['Nickster', 'Wixbu', 'Nico']
  );
  assert.ok(rows.every((r) => !r.chipText.includes('#')), 'no slot index in chip');
  assert.ok(rows.every((r) => !r.chipText.includes('Chart ·')), 'no Chart · prefix');
}

// One manual slot → "Manual"
{
  const rows = projectSlotsFromCompositionInput(
    input([chartSlot('c1', 'Nickster'), emptySlot()])
  );
  assert.strictEqual(rows[1]!.chipText, 'Manual');
  assert.strictEqual(rows[1]!.isManualStyle, true);
}

// Two manual slots → Manual 1, Manual 2 (ordinal among manual only)
{
  const rows = projectSlotsFromCompositionInput(
    input([emptySlot(), chartSlot('c1', 'Nickster'), emptySlot()])
  );
  assert.strictEqual(rows[0]!.chipText, 'Manual 1');
  assert.strictEqual(rows[2]!.chipText, 'Manual 2');
  assert.strictEqual(rows[1]!.chipText, 'Nickster');
}

// Remove manual slot: one manual left → "Manual" without number
{
  const rows = projectSlotsFromCompositionInput(input([emptySlot(), chartSlot('c1', 'Nickster')]));
  assert.strictEqual(rows[0]!.chipText, 'Manual');
}

// Chart without stored display name → fallback
{
  const rows = projectSlotsFromCompositionInput(input([{ chart_id: 'abc', overrides: { planets: {} } }]));
  assert.strictEqual(rows[0]!.chipText, 'Imported chart');
}

console.log('OK: sandbox-slot-projection tests passed');
