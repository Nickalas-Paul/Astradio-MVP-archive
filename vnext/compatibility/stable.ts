import crypto from 'crypto';
import { stableStringify } from '../canonical/stable-json';

export const COMPAT_NUM_PRECISION = 1e6;

export function roundCompat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * COMPAT_NUM_PRECISION) / COMPAT_NUM_PRECISION;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, roundCompat(value)));
}

export function stableSha256(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

export function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'en'));
}
