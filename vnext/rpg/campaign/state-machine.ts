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
  members?: Record<string, RPGCampaignMemberState>;
}

export interface RPGCampaignMemberState {
  tone_track: Record<string, number>;
  domain_track: Record<string, number>;
  flags: string[];
  history?: string[];
}

export interface RpgOutcome {
  turn_id: string;
  choice_id: string;
  outcome_patch_id: string;
  primary_domain?: string;
  tone_tag?: string;
  actor_chart_id?: string;
}

type PatchDirection =
  | 'assert_define'
  | 'engage_advance'
  | 'observe_hold'
  | 'withdraw_protect'
  | 'support_connect'
  | 'offer_restore'
  | 'reframe_integrate'
  | 'contain_limit'
  | 'legacy_identity'
  | 'legacy_defer'
  | 'legacy_bond';

function parsePatch(patch: string): { direction: PatchDirection; domain: string } {
  if (patch === 'patch_increase_identity_resolve') {
    return { direction: 'legacy_identity', domain: 'self' };
  }
  if (patch === 'patch_defer_decision') {
    return { direction: 'legacy_defer', domain: 'subconscious' };
  }
  if (patch === 'patch_strengthen_bond') {
    return { direction: 'legacy_bond', domain: 'partnership' };
  }
  const match = /^patch_([a-z]+_[a-z]+)_([a-z_]+)$/.exec(patch);
  if (!match) {
    return { direction: 'legacy_defer', domain: 'self' };
  }
  return {
    direction: match[1] as PatchDirection,
    domain: match[2],
  };
}

function applyPatchMutation(
  target: { domain_track: Record<string, number>; tone_track?: Record<string, number> },
  patch: string,
) {
  const { direction, domain } = parsePatch(patch);
  const bump = (key: string, amount = 0.2) => {
    target.domain_track[key] = (target.domain_track[key] ?? 0) + amount;
  };
  const toneBump = (key: string, amount = 0.25) => {
    if (!target.tone_track) return;
    target.tone_track[key] = (target.tone_track[key] ?? 0) + amount;
  };

  bump(`domain:${domain}:pressure`, 0.1);

  switch (direction) {
    case 'assert_define':
    case 'legacy_identity':
      bump('identity_heat');
      bump(`domain:${domain}:clarity`);
      bump(`domain:${domain}:agency`);
      toneBump('clarity');
      break;
    case 'engage_advance':
      bump(`domain:${domain}:momentum`);
      bump(`domain:${domain}:agency`);
      toneBump('momentum');
      break;
    case 'observe_hold':
    case 'legacy_defer':
      bump('fog_ambiguity');
      bump(`domain:${domain}:reflection`);
      bump(`domain:${domain}:latency`);
      toneBump('ambiguity');
      break;
    case 'withdraw_protect':
      bump(`domain:${domain}:protection`);
      bump(`domain:${domain}:distance`);
      toneBump('containment');
      break;
    case 'support_connect':
    case 'legacy_bond':
      bump('community_cohesion');
      bump(`domain:${domain}:cohesion`);
      bump(`domain:${domain}:trust`);
      toneBump('cohesion');
      break;
    case 'offer_restore':
      bump(`domain:${domain}:repair`);
      bump(`domain:${domain}:care`);
      toneBump('repair');
      break;
    case 'reframe_integrate':
      bump(`domain:${domain}:integration`);
      bump(`domain:${domain}:adaptation`);
      toneBump('integration');
      break;
    case 'contain_limit':
      bump(`domain:${domain}:boundary`);
      bump(`domain:${domain}:stability`);
      toneBump('containment');
      break;
    default:
      break;
  }
}

function applyToneMutation(
  target: { tone_track: Record<string, number> },
  toneTag?: string,
) {
  if (!toneTag) return;
  target.tone_track[toneTag] = (target.tone_track[toneTag] ?? 0) + 0.5;
}

function applyHistoryMutation(
  target: { history?: string[] },
  patch: string,
) {
  if (!target.history) return;
  target.history.push(patch);
  if (target.history.length > 10) {
    target.history = target.history.slice(-10);
  }
}

function applyFlagMutation(
  target: { flags: string[] },
  patch: string,
) {
  const { direction, domain } = parsePatch(patch);
  const uniqueFlags = Array.from(new Set(target.flags));
  uniqueFlags.push(`seen:${patch}`);
  uniqueFlags.push(`direction:${direction}`);
  uniqueFlags.push(`domain:${domain}`);
  target.flags = Array.from(new Set(uniqueFlags)).sort();
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
    members: state.members
      ? Object.fromEntries(
          Object.entries(state.members).map(([memberId, memberState]) => [
            memberId,
            {
              tone_track: { ...(memberState?.tone_track || {}) },
              domain_track: { ...(memberState?.domain_track || {}) },
              flags: Array.isArray(memberState?.flags) ? [...memberState.flags] : [],
              history: Array.isArray(memberState?.history) ? [...memberState.history] : [],
            },
          ]),
        )
      : undefined,
  };

  const patch = outcome.outcome_patch_id || 'generic';
  applyPatchMutation(next, patch);
  applyToneMutation(next, outcome.tone_tag);
  applyHistoryMutation(next, outcome.outcome_patch_id);

  next.chapter = state.chapter + 1;
  applyFlagMutation(next, outcome.outcome_patch_id);

  if (outcome.actor_chart_id) {
    const memberId = outcome.actor_chart_id;
    const nextMembers = next.members || {};
    const memberState: RPGCampaignMemberState = nextMembers[memberId]
      ? {
          tone_track: { ...nextMembers[memberId].tone_track },
          domain_track: { ...nextMembers[memberId].domain_track },
          flags: [...nextMembers[memberId].flags],
          history: nextMembers[memberId].history ? [...nextMembers[memberId].history] : [],
        }
      : {
          tone_track: {},
          domain_track: {},
          flags: [],
          history: [],
        };
    applyPatchMutation(memberState, patch);
    applyToneMutation(memberState, outcome.tone_tag);
    applyHistoryMutation(memberState, outcome.outcome_patch_id);
    applyFlagMutation(memberState, outcome.outcome_patch_id);
    next.members = {
      ...nextMembers,
      [memberId]: memberState,
    };
  }

  const canon = canonicalize(next) as RPGCampaignState;
  return canon;
}

