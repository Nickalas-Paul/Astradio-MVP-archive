/**
 * Classify persisted sandbox_state rows before hydrate.
 * Only full composition_input or legacy birth rows are loadable in Sandbox.
 */

import type { SandboxBirth } from '../types/sandbox';

export type SandboxPersistedClassification =
  | { kind: 'full_composition' }
  | { kind: 'legacy_birth' }
  | { kind: 'unsupported'; reason: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function legacyBirthLooksUsable(birth: unknown): birth is SandboxBirth {
  if (!isRecord(birth)) return false;
  if (typeof birth.date !== 'string' || birth.date.length < 8) return false;
  if (typeof birth.time !== 'string' || birth.time.length < 4) return false;
  const lat =
    typeof birth.lat === 'number' && Number.isFinite(birth.lat)
      ? birth.lat
      : isRecord(birth.location) && typeof birth.location.lat === 'number' && Number.isFinite(birth.location.lat)
        ? birth.location.lat
        : null;
  const lon =
    typeof birth.lon === 'number' && Number.isFinite(birth.lon)
      ? birth.lon
      : isRecord(birth.location) && typeof birth.location.lon === 'number' && Number.isFinite(birth.location.lon)
        ? birth.location.lon
        : null;
  return lat != null && lon != null;
}

/**
 * Allow hydration only for Sandbox-native rows.
 */
export function classifySandboxPersistedState(rowState: unknown): SandboxPersistedClassification {
  if (!isRecord(rowState)) {
    return { kind: 'unsupported', reason: 'Missing or invalid saved state.' };
  }

  if ('composition_input' in rowState && rowState.composition_input != null) {
    const ci = rowState.composition_input;
    if (!isRecord(ci)) {
      return { kind: 'unsupported', reason: 'composition_input must be an object.' };
    }
    if (!Array.isArray(ci.slots) || ci.slots.length === 0) {
      return { kind: 'unsupported', reason: 'composition_input.slots must be a non-empty array.' };
    }
    return { kind: 'full_composition' };
  }

  if (legacyBirthLooksUsable(rowState.birth)) {
    return { kind: 'legacy_birth' };
  }

  if ('kind' in rowState && typeof rowState.kind === 'string') {
    return {
      kind: 'unsupported',
      reason: `This saved entry is not a Sandbox composition (${String(rowState.kind)}). Open it from the surface that created it.`,
    };
  }

  return {
    kind: 'unsupported',
    reason: 'This saved entry is not a Sandbox composition (missing composition_input and legacy birth).',
  };
}
