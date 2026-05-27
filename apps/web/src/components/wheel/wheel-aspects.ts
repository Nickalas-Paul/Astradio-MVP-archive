import type { WheelAspect } from './wheel-constants';

export function extractAspects(raw: unknown): WheelAspect[] | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const aspects = (raw as { aspects?: unknown }).aspects;
  if (!Array.isArray(aspects) || aspects.length === 0) return undefined;
  return aspects as WheelAspect[];
}
