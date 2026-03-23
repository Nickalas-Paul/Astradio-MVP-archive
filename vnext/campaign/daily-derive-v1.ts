/**
 * Bounded deterministic campaign daily derivation — allowlisted snapshot fields + lookup tables only.
 */

import type { EphemerisSnapshot } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';
import * as crypto from 'crypto';

const ELEMENT_ORDER = ['air', 'earth', 'fire', 'water'] as const;
type ElementToken = (typeof ELEMENT_ORDER)[number];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function dominantElementToken(de: EphemerisSnapshot['dominantElements']): ElementToken {
  const scores: Record<ElementToken, number> = {
    air: de.air,
    earth: de.earth,
    fire: de.fire,
    water: de.water,
  };
  let max = -Infinity;
  for (const k of ELEMENT_ORDER) {
    const v = Number.isFinite(scores[k]) ? scores[k] : 0;
    if (v > max) max = v;
  }
  for (const k of ELEMENT_ORDER) {
    const v = Number.isFinite(scores[k]) ? scores[k] : 0;
    if (v === max) return k;
  }
  return 'fire';
}

function sunSignIndex(snap: EphemerisSnapshot): number {
  const sun = snap.planets.find((p) => String(p.name).toLowerCase() === 'sun');
  if (!sun || !Number.isFinite(sun.lon)) return 0;
  const lon = ((sun.lon % 360) + 360) % 360;
  return Math.floor(lon / 30) % 12;
}

function moonPhaseBucket(moonPhase: number): number {
  if (!Number.isFinite(moonPhase)) return 0;
  const x = Math.max(0, Math.min(1, moonPhase));
  return Math.min(7, Math.floor(x * 8));
}

function tensionBucket(aspectTension: number): 0 | 1 | 2 {
  if (!Number.isFinite(aspectTension)) return 1;
  const t = Math.max(0, Math.min(1, aspectTension));
  if (t < 1 / 3) return 0;
  if (t < 2 / 3) return 1;
  return 2;
}

export type PressureAxis = 'communication' | 'emotion' | 'control' | 'structure' | 'momentum';

const PRESSURE_SOLO: Record<string, PressureAxis> = {};
for (let n = 0; n < 12; n++) {
  for (let t = 0; t < 12; t++) {
    const k = `${n}_${t}`;
    const idx = (n + t) % 5;
    const axes: PressureAxis[] = ['communication', 'emotion', 'control', 'structure', 'momentum'];
    PRESSURE_SOLO[k] = axes[idx];
  }
}

const MODALITY_SET = new Set(['cardinal', 'fixed', 'mutable']);

const PRESSURE_GROUP_MOD: Record<string, PressureAxis> = {
  'cardinal_fire': 'momentum',
  'cardinal_earth': 'structure',
  'cardinal_air': 'communication',
  'cardinal_water': 'emotion',
  'fixed_fire': 'control',
  'fixed_earth': 'structure',
  'fixed_air': 'communication',
  'fixed_water': 'emotion',
  'mutable_fire': 'momentum',
  'mutable_earth': 'structure',
  'mutable_air': 'communication',
  'mutable_water': 'emotion',
};

function pressureAxisSolo(natalSun: number, transitSun: number): PressureAxis {
  return PRESSURE_SOLO[`${natalSun}_${transitSun}`] ?? 'structure';
}

function pressureAxisGroup(modality: string, transitEl: ElementToken): PressureAxis {
  const m = MODALITY_SET.has(modality) ? modality : 'cardinal';
  const k = `${m}_${transitEl}`;
  return PRESSURE_GROUP_MOD[k] ?? 'communication';
}

function challengeThemeSolo(
  natalEl: ElementToken,
  transitEl: ElementToken,
  moonB: number
): string {
  return `solo_${natalEl}_${transitEl}_m${moonB}`;
}

function challengeThemeGroup(elDom: string, tb: 0 | 1 | 2, moonB: number): string {
  return `group_${elDom}_${tb}_m${moonB}`;
}

function reflectionPrompts(theme: string, axis: PressureAxis): [string, string, string] {
  return [
    `reflect_${theme}_axis_${axis}_a`,
    `reflect_${theme}_axis_${axis}_b`,
    `reflect_${theme}_axis_${axis}_c`,
  ];
}

export interface CampaignDailyDerivedV1 {
  engine_version: string;
  mode: 'solo' | 'group' | 'auto';
  challenge_theme: string;
  pressure_axis: PressureAxis;
  reflection_prompts: [string, string, string];
  narrative_framing: {
    template_id: string;
    tokens: { theme_label: string; axis_label: string; moon_phase_bucket: string };
  };
}

export function deriveCampaignDailySoloV1(params: {
  natal: EphemerisSnapshot;
  transit: EphemerisSnapshot;
  engineVersion: string;
}): { derived: CampaignDailyDerivedV1; derivationInputsFingerprint: string } {
  const { natal, transit, engineVersion } = params;
  const natalEl = dominantElementToken(natal.dominantElements);
  const transitEl = dominantElementToken(transit.dominantElements);
  const moonB = moonPhaseBucket(transit.moonPhase);
  const nSun = sunSignIndex(natal);
  const tSun = sunSignIndex(transit);
  const axis = pressureAxisSolo(nSun, tSun);
  const theme = challengeThemeSolo(natalEl, transitEl, moonB);
  const prompts = reflectionPrompts(theme, axis);
  const derived: CampaignDailyDerivedV1 = {
    engine_version: engineVersion,
    mode: 'solo',
    challenge_theme: theme,
    pressure_axis: axis,
    reflection_prompts: prompts,
    narrative_framing: {
      template_id: `nf_solo_v1`,
      tokens: {
        theme_label: theme,
        axis_label: axis,
        moon_phase_bucket: String(moonB),
      },
    },
  };
  const fp = sha256(
    canonicalJson({
      v: 'campaign_daily_derive_inputs_v1',
      mode: 'solo',
      natal: {
        de: natal.dominantElements,
        moonPhase: natal.moonPhase,
        sunLon: natal.planets.find((p) => String(p.name).toLowerCase() === 'sun')?.lon,
      },
      transit: {
        de: transit.dominantElements,
        moonPhase: transit.moonPhase,
        sunLon: transit.planets.find((p) => String(p.name).toLowerCase() === 'sun')?.lon,
      },
      engineVersion,
    })
  );
  return { derived, derivationInputsFingerprint: fp };
}

export function deriveCampaignDailyGroupV1(params: {
  control: Pick<ControlSurfacePayload, 'element_dominance' | 'aspect_tension' | 'modality' | 'hash'>;
  transit: EphemerisSnapshot;
  engineVersion: string;
}): { derived: CampaignDailyDerivedV1; derivationInputsFingerprint: string } {
  const { control, transit, engineVersion } = params;
  const elDom = String(control.element_dominance || 'fire').toLowerCase();
  const tb = tensionBucket(control.aspect_tension);
  const modality = String(control.modality || 'cardinal').toLowerCase();
  const transitEl = dominantElementToken(transit.dominantElements);
  const moonB = moonPhaseBucket(transit.moonPhase);
  const axis = pressureAxisGroup(modality, transitEl);
  const theme = challengeThemeGroup(elDom, tb, moonB);
  const prompts = reflectionPrompts(theme, axis);
  const derived: CampaignDailyDerivedV1 = {
    engine_version: engineVersion,
    mode: 'group',
    challenge_theme: theme,
    pressure_axis: axis,
    reflection_prompts: prompts,
    narrative_framing: {
      template_id: `nf_group_v1`,
      tokens: {
        theme_label: theme,
        axis_label: axis,
        moon_phase_bucket: String(moonB),
      },
    },
  };
  const fp = sha256(
    canonicalJson({
      v: 'campaign_daily_derive_inputs_v1',
      mode: 'group',
      control: {
        element_dominance: control.element_dominance,
        aspect_tension: control.aspect_tension,
        modality: control.modality,
        hash: control.hash,
      },
      transit: {
        de: transit.dominantElements,
        moonPhase: transit.moonPhase,
        sunLon: transit.planets.find((p) => String(p.name).toLowerCase() === 'sun')?.lon,
      },
      engineVersion,
    })
  );
  return { derived, derivationInputsFingerprint: fp };
}

export function dailyStateBodyHash(derived: CampaignDailyDerivedV1): string {
  return sha256(canonicalJson(derived));
}
