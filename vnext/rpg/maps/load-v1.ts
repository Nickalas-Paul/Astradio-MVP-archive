// vnext/rpg/maps/load-v1.ts
// Helper to load and validate v1 mapping tables for RPGEffectsBundle.

import fs from 'fs';
import path from 'path';
import type { BodyId } from '../contracts';

export interface RpgV1Maps {
  bodyOrder: BodyId[];
  bodyBase: any;
  signStyle: any;
  houseArena: Record<string, string>;
  domainResolverNatal: any[];
  domainResolverTransit: any[];
  placementOverrides: any[];
  turnTemplates: any[];
  scenarioTemplates: any[];
  choiceTemplates: any[];
}

function readJson(relativePath: string): any {
  const full = path.join(__dirname, relativePath);
  if (!fs.existsSync(full)) {
    throw new Error(`[rpg-maps] Missing mapping file: ${relativePath}`);
  }
  const raw = fs.readFileSync(full, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`[rpg-maps] Invalid JSON in ${relativePath}: ${(e as Error).message}`);
  }
}

export function loadRpgV1Maps(): RpgV1Maps {
  const bodyOrder = readJson('v1/BODY_ORDER.json') as string[];
  const bodyBase = readJson('v1/body_base.json');
  const signStyle = readJson('v1/sign_style.json');
  const houseArena = readJson('v1/house_arena.json') as Record<string, string>;
  const domainResolverNatal = readJson('v1/domain_resolver_natal.json') as any[];
  const domainResolverTransit = readJson('v1/domain_resolver_transit.json') as any[];
  const placementOverrides = readJson('v1/placement_overrides.json') as any[];
  const turnTemplates = readJson('v1/turn_templates.json') as any[];
  const scenarioTemplates = readJson('v1/scenario_templates.json') as any[];
  const choiceTemplates = readJson('v1/choice_templates.json') as any[];

  if (!Array.isArray(bodyOrder) || bodyOrder.length === 0) {
    throw new Error('[rpg-maps] BODY_ORDER.json must be a non-empty array');
  }

  const requiredBodies: BodyId[] = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'ceres',
    'pallas',
    'juno',
    'vesta',
    'chiron',
  ];

  for (const b of requiredBodies) {
    if (!bodyOrder.includes(b)) {
      throw new Error(`[rpg-maps] BODY_ORDER.json missing required body: ${b}`);
    }
  }

  if (typeof bodyBase !== 'object' || bodyBase == null) {
    throw new Error('[rpg-maps] body_base.json must be an object');
  }

  if (typeof signStyle !== 'object' || signStyle == null) {
    throw new Error('[rpg-maps] sign_style.json must be an object');
  }

  if (typeof houseArena !== 'object' || houseArena == null) {
    throw new Error('[rpg-maps] house_arena.json must be an object');
  }

  if (!Array.isArray(domainResolverNatal)) {
    throw new Error('[rpg-maps] domain_resolver_natal.json must be an array');
  }

  if (!Array.isArray(domainResolverTransit)) {
    throw new Error('[rpg-maps] domain_resolver_transit.json must be an array');
  }

  if (!Array.isArray(placementOverrides)) {
    throw new Error('[rpg-maps] placement_overrides.json must be an array');
  }

  if (!Array.isArray(turnTemplates) || turnTemplates.length === 0) {
    throw new Error('[rpg-maps] turn_templates.json must be a non-empty array');
  }

  if (!Array.isArray(scenarioTemplates) || scenarioTemplates.length === 0) {
    throw new Error('[rpg-maps] scenario_templates.json must be a non-empty array');
  }

  if (!Array.isArray(choiceTemplates) || choiceTemplates.length === 0) {
    throw new Error('[rpg-maps] choice_templates.json must be a non-empty array');
  }

  return {
    bodyOrder: bodyOrder as BodyId[],
    bodyBase,
    signStyle,
    houseArena,
    domainResolverNatal,
    domainResolverTransit,
    placementOverrides,
    turnTemplates,
    scenarioTemplates,
    choiceTemplates,
  };
}

