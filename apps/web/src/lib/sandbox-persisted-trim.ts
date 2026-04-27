export function trimResolveResponseForPersistence(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = structuredClone(input) as Record<string, unknown> & {
    compose?: { audio?: unknown; audio_debug?: unknown };
    aggregate?: { audio?: unknown; audio_debug?: unknown };
  };
  if (out.compose && typeof out.compose === 'object') {
    delete out.compose.audio;
    delete out.compose.audio_debug;
  }
  if (out.aggregate && typeof out.aggregate === 'object') {
    delete out.aggregate.audio;
    delete out.aggregate.audio_debug;
  }
  return out;
}

export function filterSandboxSavedRows<T extends { source?: unknown }>(
  rows: T[]
): T[] {
  return rows.filter((row) => row?.source === 'sandbox');
}

export function loadTerminalSurfaceState(loadSucceeded: boolean): 'ready_report' | 'error' {
  return loadSucceeded ? 'ready_report' : 'error';
}
