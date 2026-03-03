// vnext/rpg/hash/json-hash.ts
// Canonical JSON serialization + SHA256 hashing for deterministic seeds and state.

import crypto from 'crypto';

// Canonicalize a JSON-compatible value by:
// - Sorting object keys lexicographically
// - Recursing into objects/arrays
// - Preserving array order (arrays are intentionally ordered)
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    out[key] = canonicalize(obj[key]);
  }
  return out;
}

export function canonicalJsonString(value: unknown): string {
  const canon = canonicalize(value);
  return JSON.stringify(canon);
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashCanonicalJson(value: unknown): string {
  const json = canonicalJsonString(value);
  return sha256Hex(json);
}

