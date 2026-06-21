/**
 * Connection / ensemble preface — private to rule layer; only called from assemble-sections.
 * **Proj:** sentence-bundle step (legacy “Phase 2” wording in older notes) — fixed bundles only (deterministic); not Product:Phase-2.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import { lonToSign } from '../../astro/profile-from-snapshot';
import type { EphemerisSnapshot } from '../../contracts';
import {
  getConnectionOpeningPool,
  type ConnectionOpeningMode,
  type ConnectionOpeningSlot,
} from '../insight-library/connection-opening-pool';
import { taggedSectionBodyFromText } from '../tagged-text';
import type { ConnectionMode, ExpansionTier, ProjectedExplanationSection, ProjectionSurface } from '../projection-types';

const SIGN_TO_ELEMENT: Record<string, string> = {
  Aries: 'fire',
  Taurus: 'earth',
  Gemini: 'air',
  Cancer: 'water',
  Leo: 'fire',
  Virgo: 'earth',
  Libra: 'air',
  Scorpio: 'water',
  Sagittarius: 'fire',
  Capricorn: 'earth',
  Aquarius: 'air',
  Pisces: 'water',
};

const SIGN_TO_MODALITY: Record<string, string> = {
  Aries: 'cardinal',
  Taurus: 'fixed',
  Gemini: 'mutable',
  Cancer: 'cardinal',
  Leo: 'fixed',
  Virgo: 'mutable',
  Libra: 'cardinal',
  Scorpio: 'fixed',
  Sagittarius: 'mutable',
  Capricorn: 'cardinal',
  Aquarius: 'fixed',
  Pisces: 'mutable',
};

function resolveOpeningMode(connectionMode?: ConnectionMode): ConnectionOpeningMode {
  if (connectionMode === 'lovers' || (connectionMode as string) === 'romantic') {
    return 'romantic';
  }
  return 'friendship';
}

function seedSlotIndex(seed: string, slot: ConnectionOpeningSlot, length: number): number {
  if (length <= 0) return 0;
  let h = 0;
  const key = `${seed}:connection_opening:${slot}`;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) >>> 0;
  }
  return h % length;
}

function sunSignFromSnapshot(snapshot: EphemerisSnapshot): string | null {
  const sun = snapshot.planets?.find((p) => String(p.name || '').toLowerCase() === 'sun');
  if (!sun || typeof sun.lon !== 'number' || !Number.isFinite(sun.lon)) return null;
  return lonToSign(sun.lon).sign;
}

type ChartInterpolation = {
  seekerSun: string;
  targetSun: string;
  seekerElement: string;
  targetElement: string;
  seekerModality: string;
  targetModality: string;
};

function chartInterpolationFromSnapshots(
  seekerSnapshot: EphemerisSnapshot,
  targetSnapshot: EphemerisSnapshot
): ChartInterpolation | null {
  const seekerSign = sunSignFromSnapshot(seekerSnapshot);
  const targetSign = sunSignFromSnapshot(targetSnapshot);
  if (!seekerSign || !targetSign) return null;
  const seekerElement = SIGN_TO_ELEMENT[seekerSign];
  const targetElement = SIGN_TO_ELEMENT[targetSign];
  const seekerModality = SIGN_TO_MODALITY[seekerSign];
  const targetModality = SIGN_TO_MODALITY[targetSign];
  if (!seekerElement || !targetElement || !seekerModality || !targetModality) return null;
  return {
    seekerSun: seekerSign,
    targetSun: targetSign,
    seekerElement,
    targetElement,
    seekerModality,
    targetModality,
  };
}

function interpolateDynamicSentence(template: string, vars: ChartInterpolation): string {
  return template
    .replace(/\{seekerSun\}/g, vars.seekerSun)
    .replace(/\{targetSun\}/g, vars.targetSun)
    .replace(/\{seekerElement\}/g, vars.seekerElement)
    .replace(/\{targetElement\}/g, vars.targetElement)
    .replace(/\{seekerModality\}/g, vars.seekerModality)
    .replace(/\{targetModality\}/g, vars.targetModality);
}

export function applyConnectionPreface(
  sections: ProjectedExplanationSection[],
  opts: {
    surface: ProjectionSurface;
    connectionMode?: ConnectionMode;
    participantCount?: number;
    tier: ExpansionTier;
    seed: string;
    suppressEnsembleFraming?: boolean;
    seekerSnapshot?: EphemerisSnapshot;
    targetSnapshot?: EphemerisSnapshot;
    compatClassCode?: string;
  }
): ProjectedExplanationSection[] {
  if (opts.surface !== 'compat_pair') {
    return [...sections];
  }

  const classCode = opts.compatClassCode?.trim();
  if (!classCode) {
    return [...sections];
  }

  const mode = resolveOpeningMode(opts.connectionMode);
  const pool = getConnectionOpeningPool(classCode, mode);
  if (!pool) {
    return [...sections];
  }

  const hook = pool.hook[seedSlotIndex(opts.seed, 'hook', pool.hook.length)] ?? '';
  const frame = pool.frame[seedSlotIndex(opts.seed, 'frame', pool.frame.length)] ?? '';

  const parts: string[] = [];
  if (hook.trim()) parts.push(hook.trim());

  const vars =
    opts.seekerSnapshot && opts.targetSnapshot
      ? chartInterpolationFromSnapshots(opts.seekerSnapshot, opts.targetSnapshot)
      : null;
  if (vars) {
    const dynamicTemplate =
      pool.dynamic[seedSlotIndex(opts.seed, 'dynamic', pool.dynamic.length)] ?? '';
    if (dynamicTemplate.trim()) {
      parts.push(interpolateDynamicSentence(dynamicTemplate.trim(), vars));
    }
  }

  if (frame.trim()) parts.push(frame.trim());

  const prefaceText = parts.join(' ').trim();
  if (!prefaceText) {
    return [...sections];
  }

  const prefaceSection: ProjectedExplanationSection = {
    id: 'connection_structure',
    title: '',
    text: prefaceText,
    bullets: [],
    meta: {
      tagged: taggedSectionBodyFromText(prefaceText, 'preface'),
      phaseD: true,
    },
  };

  return [prefaceSection, ...sections];
}
