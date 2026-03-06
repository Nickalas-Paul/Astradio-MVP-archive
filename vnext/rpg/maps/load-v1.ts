// vnext/rpg/maps/load-v1.ts
// Helper to load and validate v1 mapping tables for RPGEffectsBundle.
// Uses static JSON imports so assets are bundled (works in Next.js/Vercel server runtime).

import type { BodyId } from '../contracts';

import bodyOrderData from './v1/BODY_ORDER.json';
import bodyBaseData from './v1/body_base.json';
import signStyleData from './v1/sign_style.json';
import houseArenaData from './v1/house_arena.json';
import domainResolverNatalData from './v1/domain_resolver_natal.json';
import domainResolverTransitData from './v1/domain_resolver_transit.json';
import placementOverridesData from './v1/placement_overrides.json';
import turnTemplatesData from './v1/turn_templates.json';
import scenarioTemplatesData from './v1/scenario_templates.json';
import choiceTemplatesData from './v1/choice_templates.json';

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

export function loadRpgV1Maps(): RpgV1Maps {
  const bodyOrder = bodyOrderData as string[];
  const bodyBase = bodyBaseData;
  const signStyle = signStyleData;
  const houseArena = houseArenaData as Record<string, string>;
  const domainResolverNatal = domainResolverNatalData as any[];
  const domainResolverTransit = domainResolverTransitData as any[];
  const placementOverrides = placementOverridesData as any[];
  const turnTemplates = turnTemplatesData as any[];
  const scenarioTemplates = scenarioTemplatesData as any[];
  const choiceTemplates = choiceTemplatesData as any[];

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

