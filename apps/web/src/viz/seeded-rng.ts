/**
 * Seeded RNG — no Math.random(). Deterministic from seed string.
 */
export function createSeededRNG(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state ^ seed.charCodeAt(i)) >>> 0;
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 0) / 0xffffffff;
  };
}
