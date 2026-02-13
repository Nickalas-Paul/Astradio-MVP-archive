/**
 * Deterministic transformations for hook motifs to create novelty.
 * All transformations seeded from payload.hash + feature-driven keys.
 */

import type { Hook, HookNote } from './libraries';

/**
 * Deterministic PRNG from seed + key
 */
function hashU32(seed: string, key: string): number {
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

function rand01(seed: string, key: string): number {
  return hashU32(seed, key) / 0x100000000;
}

function randInt(seed: string, key: string, max: number): number {
  return Math.floor(rand01(seed, key) * max);
}

/**
 * Transformation types
 */
export type TransformationType =
  | 'transpose'
  | 'rhythmic_shift'
  | 'invert'
  | 'octave_displace'
  | 'truncate'
  | 'extend'
  | 'add_pickup'
  | 'add_rest_before_cadence'
  | 'ornament';

/**
 * Apply transformation to a hook motif
 */
export function applyTransformation(
  hook: Hook,
  type: TransformationType,
  seed: string,
  key: string,
  intensity: number = 0.5
): Hook {
  switch (type) {
    case 'transpose':
      return transposeHook(hook, seed, key, intensity);
    case 'rhythmic_shift':
      return rhythmicShiftHook(hook, seed, key, intensity);
    case 'invert':
      return invertHook(hook, seed, key);
    case 'octave_displace':
      return octaveDisplaceHook(hook, seed, key);
    case 'truncate':
      return truncateHook(hook, seed, key);
    case 'extend':
      return extendHook(hook, seed, key);
    case 'add_pickup':
      return addPickupHook(hook, seed, key);
    case 'add_rest_before_cadence':
      return addRestBeforeCadenceHook(hook, seed, key);
    case 'ornament':
      return ornamentHook(hook, seed, key, intensity);
    default:
      return hook.map(n => ({ ...n }));
  }
}

/**
 * Transpose within key (scale degrees, not semitones)
 */
function transposeHook(hook: Hook, seed: string, key: string, intensity: number): Hook {
  const delta = randInt(seed, key + '_transpose', 5) - 2; // -2 to +2 degrees
  return hook.map(n => ({
    ...n,
    degree: n.degree < 0 ? n.degree : ((n.degree + delta) % 8 + 8) % 8,
  }));
}

/**
 * Rhythmic shift (swing-safe, within bar)
 */
function rhythmicShiftHook(hook: Hook, seed: string, key: string, intensity: number): Hook {
  const shift = randInt(seed, key + '_rhythm', 4) - 1; // -1 to +2 pos16
  return hook.map(n => ({
    ...n,
    pos16: Math.max(0, Math.min(15, n.pos16 + shift)),
  }));
}

/**
 * Invert around a scale degree
 */
function invertHook(hook: Hook, seed: string, key: string): Hook {
  const pivot = randInt(seed, key + '_invert', 8); // 0-7
  return hook.map(n => {
    if (n.degree < 0) return { ...n };
    const delta = n.degree - pivot;
    const inverted = ((pivot - delta) % 8 + 8) % 8;
    return { ...n, degree: inverted };
  });
}

/**
 * Octave displacement (move some notes up/down an octave, keep degrees)
 */
function octaveDisplaceHook(hook: Hook, seed: string, key: string): Hook {
  const notesToDisplace = Math.max(1, Math.floor(hook.length * 0.3));
  const indices: number[] = [];
  for (let i = 0; i < hook.length; i++) {
    if (hook[i].degree >= 0 && rand01(seed, key + '_oct_' + i) < 0.3) {
      indices.push(i);
    }
  }
  if (indices.length === 0) indices.push(0);
  
  return hook.map((n, i) => {
    if (indices.includes(i) && n.degree >= 0) {
      // Mark for octave displacement (will be handled in planner when converting to pitch)
      return { ...n, degree: n.degree + (rand01(seed, key + '_oct_dir_' + i) > 0.5 ? 8 : -8) };
    }
    return { ...n };
  });
}

/**
 * Truncate hook (remove last notes)
 */
function truncateHook(hook: Hook, seed: string, key: string): Hook {
  const keepCount = Math.max(2, Math.floor(hook.length * (0.6 + rand01(seed, key + '_trunc') * 0.3)));
  return hook.slice(0, keepCount);
}

/**
 * Extend hook (add notes at end)
 */
function extendHook(hook: Hook, seed: string, key: string): Hook {
  const lastNote = hook[hook.length - 1];
  if (!lastNote || lastNote.degree < 0) return hook;
  
  const extendCount = randInt(seed, key + '_extend', 3) + 1; // 1-3 notes
  const extended: HookNote[] = [...hook];
  
  for (let i = 0; i < extendCount; i++) {
    const pos16 = Math.min(15, lastNote.pos16 + lastNote.dur16 + (i + 1) * 2);
    const degree = lastNote.degree; // Repeat or step
    const dur16 = 2;
    extended.push({ pos16, degree, dur16 });
  }
  
  return extended;
}

/**
 * Add pickup note(s) before first note
 */
function addPickupHook(hook: Hook, seed: string, key: string): Hook {
  const firstNote = hook[0];
  if (!firstNote || firstNote.pos16 === 0) return hook;
  
  const pickupCount = randInt(seed, key + '_pickup', 2) + 1; // 1-2 notes
  const pickups: HookNote[] = [];
  
  for (let i = 0; i < pickupCount; i++) {
    const pos16 = Math.max(0, firstNote.pos16 - (pickupCount - i) * 2);
    const degree = firstNote.degree; // Same or step
    const dur16 = 1;
    pickups.push({ pos16, degree, dur16 });
  }
  
  return [...pickups, ...hook];
}

/**
 * Add rest before cadence (last note)
 */
function addRestBeforeCadenceHook(hook: Hook, seed: string, key: string): Hook {
  if (hook.length < 2) return hook;
  
  const lastNote = hook[hook.length - 1];
  const secondLast = hook[hook.length - 2];
  
  const restPos16 = secondLast.pos16 + secondLast.dur16;
  const restDur16 = Math.min(2, lastNote.pos16 - restPos16);
  
  if (restDur16 <= 0) return hook;
  
  const newLastNote = { ...lastNote, pos16: lastNote.pos16 + restDur16 };
  return [...hook.slice(0, -1), { pos16: restPos16, degree: -1, dur16: restDur16 }, newLastNote];
}

/**
 * Add ornamentation (passing tones, neighbor tones)
 */
function ornamentHook(hook: Hook, seed: string, key: string, intensity: number): Hook {
  const ornamentCount = Math.max(1, Math.floor(hook.length * intensity * 0.5));
  const ornamented: HookNote[] = [];
  
  for (let i = 0; i < hook.length; i++) {
    ornamented.push(hook[i]);
    
    if (i < hook.length - 1 && rand01(seed, key + '_orn_' + i) < intensity) {
      const current = hook[i];
      const next = hook[i + 1];
      if (current.degree >= 0 && next.degree >= 0) {
        const midPos16 = Math.floor((current.pos16 + current.dur16 + next.pos16) / 2);
        const midDegree = Math.floor((current.degree + next.degree) / 2);
        ornamented.push({ pos16: midPos16, degree: midDegree, dur16: 1 });
      }
    }
  }
  
  return ornamented;
}

/**
 * Select transformation sequence (2-4 transformations) based on seed + features
 */
export function selectTransformationSequence(
  seed: string,
  elementBlend?: { fire?: number; air?: number; water?: number; earth?: number },
  mercuryAgility?: number
): TransformationType[] {
  const agility = mercuryAgility ?? 0.5;
  const fire = elementBlend?.fire ?? 0.25;
  const air = elementBlend?.air ?? 0.25;
  
  const count = 2 + randInt(seed, 'transform_count', 3); // 2-4 transformations
  
  const available: TransformationType[] = [
    'transpose',
    'rhythmic_shift',
    'invert',
    'octave_displace',
    'truncate',
    'extend',
    'add_pickup',
    'add_rest_before_cadence',
    'ornament',
  ];
  
  // Prefer rhythmic/ornamental for high agility
  const preferred = agility > 0.6
    ? ['rhythmic_shift', 'ornament', 'add_pickup']
    : fire + air > 0.6
    ? ['transpose', 'octave_displace', 'extend']
    : ['transpose', 'rhythmic_shift', 'invert'];
  
  const sequence: TransformationType[] = [];
  const used = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    const candidates = i < preferred.length
      ? available.filter(t => !used.has(t) && preferred.includes(t))
      : available.filter(t => !used.has(t));
    
    if (candidates.length === 0) break;
    
    const idx = randInt(seed, 'transform_' + i, candidates.length);
    const selected = candidates[idx];
    sequence.push(selected);
    used.add(selected);
  }
  
  return sequence;
}

/**
 * Apply transformation sequence to hook
 */
export function applyTransformationSequence(
  hook: Hook,
  sequence: TransformationType[],
  seed: string,
  baseKey: string,
  intensity: number = 0.5
): Hook {
  let result = hook.map(n => ({ ...n }));
  
  for (let i = 0; i < sequence.length; i++) {
    const transform = sequence[i];
    const key = baseKey + '_seq_' + i;
    result = applyTransformation(result, transform, seed, key, intensity);
  }
  
  return result;
}
