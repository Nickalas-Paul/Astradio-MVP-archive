// vnext/rpg/campaign/state-machine.ts
// Pure, deterministic campaign state representation and evolution.

import type { RPGEffectsBundle, RPGDomainScore } from '../contracts';
import { canonicalize } from '../hash/json-hash';

export interface RPGCampaignState {
  tone_track: Record<string, number>;
  domain_track: Record<string, number>;
  chapter: number;
  flags: string[];
  history?: string[];
}

export interface RpgOutcome {
  turn_id: string;
  choice_id: string;
  outcome_patch_id: string;
  primary_domain?: string;
  tone_tag?: string;
}

export function initialCampaignState(bundle: RPGEffectsBundle): RPGCampaignState {
  const tone_track: Record<string, number> = {};
  const domain_track: Record<string, number> = {};

  for (const d of bundle.domainSummary) {
    if (d.score > 0) {
      domain_track[d.domain] = d.normalizedScore || d.score;
    }
  }

  tone_track['neutral'] = 1;

  const flags: string[] = ['seeded_from_bundle'];

  return {
    tone_track,
    domain_track,
    chapter: 1,
    flags: flags.sort(),
  };
}

export function applyOutcome(state: RPGCampaignState, outcome: RpgOutcome, domains?: RPGDomainScore[]): RPGCampaignState {
  const next: RPGCampaignState = {
    tone_track: { ...state.tone_track },
    domain_track: { ...state.domain_track },
    chapter: state.chapter,
    flags: [...state.flags],
    history: state.history ? [...state.history] : [],
  };

  const patch = outcome.outcome_patch_id || 'generic';

  switch (patch) {
    case 'patch_increase_identity_resolve':
      next.domain_track['identity_heat'] = (next.domain_track['identity_heat'] ?? 0) + 0.2;
      break;
    case 'patch_defer_decision':
      next.domain_track['fog_ambiguity'] = (next.domain_track['fog_ambiguity'] ?? 0) + 0.2;
      break;
    case 'patch_strengthen_bond':
      next.domain_track['community_cohesion'] = (next.domain_track['community_cohesion'] ?? 0) + 0.2;
      break;
    default:
      break;
  }

  if (outcome.tone_tag) {
    next.tone_track[outcome.tone_tag] = (next.tone_track[outcome.tone_tag] ?? 0) + 0.5;
  }

  if (next.history) {
    next.history.push(outcome.outcome_patch_id);
    if (next.history.length > 10) {
      next.history = next.history.slice(-10);
    }
  }

  next.chapter = state.chapter + 1;

  const uniqueFlags = Array.from(new Set(next.flags));
  uniqueFlags.push(`seen:${outcome.outcome_patch_id}`);
  next.flags = Array.from(new Set(uniqueFlags)).sort();

  const canon = canonicalize(next) as RPGCampaignState;
  return canon;
}

