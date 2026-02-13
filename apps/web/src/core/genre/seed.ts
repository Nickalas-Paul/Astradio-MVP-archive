/**
 * Browser-safe deterministic PRNG from seed + key.
 * No Math.random; same inputs => same outputs for reproducible playback.
 */

export function hashU32(seed: string, key: string): number {
  let h = 0;
  const s = seed + '\0' + key;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** [0, 1) from seed + key. Deterministic. */
export function rand01(seed: string, key: string): number {
  return hashU32(seed, key) / 0x100000000;
}

/** (-1, 1) from seed + key. */
export function randSigned(seed: string, key: string): number {
  return rand01(seed, key) * 2 - 1;
}

/** Lerp between lo and hi using deterministic t in [0,1]. */
export function lerpFromSeed(seed: string, key: string, lo: number, hi: number): number {
  return lo + rand01(seed, key) * (hi - lo);
}
